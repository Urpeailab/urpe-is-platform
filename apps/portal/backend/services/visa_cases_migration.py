"""
Visa Cases Migration

POST /api/admin/migration/visa-cases-import

Acepta el JSON que devuelve el endpoint legacy `/admin/visa-cases` (misma
forma: {cases:[...], pagination:{...}}) y hace UPSERT de cada entidad en
las tablas actuales de Supabase preservando los IDs legacy de Mongo en las
columnas *_mongo_id.

Características:
- Idempotente: re-correr el mismo payload no duplica filas.
- Híbrido: campos críticos (overall_progress, total_fee, etc.) van a columnas
  tipadas (ver migración 017). El resto cae en metadata JSONB.
- Resolución de IDs: distingue UUIDs de Mongo ObjectIds (24 hex).
- Sobrescribe en conflicto: si el id ya existe, los valores del source ganan.
- Staff faltante: si un staff_id viene como UUID pero NO existe en destino,
  se setea a NULL (no rompe FK).
- Clientes por email: si el email del source existe ya en destino con otro
  UUID, se reusa ese UUID para no romper UNIQUE(email).
- Dry-run con ?dryRun=true: no escribe nada, solo reporta contadores.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
import logging
import re
import uuid as _uuid

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)

UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)
MONGO_RE = re.compile(r'^[0-9a-f]{24}$', re.IGNORECASE)


def is_uuid(s) -> bool:
    return isinstance(s, str) and bool(UUID_RE.match(s))


def is_mongo_id(s) -> bool:
    return isinstance(s, str) and bool(MONGO_RE.match(s))


def _clean(d: dict) -> dict:
    """Remove None values to avoid wiping columns on upsert."""
    return {k: v for k, v in d.items() if v is not None}


# ─────────────────────────────────────────────────────────────────────
# Id Resolver
# ─────────────────────────────────────────────────────────────────────

class IdResolver:
    """
    Resolves source ids (UUID or Mongo ObjectId) to destination UUIDs.

    - UUID source: passthrough; recorded in cache for the run.
    - Mongo source: SELECT id WHERE mongo_col=src; if found, reuse; if not,
      generate a new UUID and remember to set mongo_col on first insert.
    - Unknown formats: returns None.
    """

    def __init__(self, sb):
        self.sb = sb
        self.cache: Dict[tuple, Optional[str]] = {}
        self.needs_mongo: Dict[tuple, str] = {}

    def resolve(self, table: str, source_id: Optional[str], mongo_col: str = 'mongo_id') -> Optional[str]:
        if not source_id:
            return None
        key = (table, source_id)
        if key in self.cache:
            return self.cache[key]

        if is_uuid(source_id):
            self.cache[key] = source_id
            return source_id

        if is_mongo_id(source_id):
            try:
                r = self.sb.table(table).select("id").eq(mongo_col, source_id).limit(1).execute()
                if r.data:
                    dest = str(r.data[0]['id'])
                    self.cache[key] = dest
                    return dest
            except Exception as e:
                logger.warning("ID resolve lookup failed table=%s src=%s: %s", table, source_id, e)
            new_id = str(_uuid.uuid4())
            self.cache[key] = new_id
            self.needs_mongo[key] = source_id
            return new_id

        logger.warning("Unrecognized id format table=%s id=%s", table, source_id)
        self.cache[key] = None
        return None

    def mongo_for(self, table: str, source_id: str) -> Optional[str]:
        return self.needs_mongo.get((table, source_id))

    def resolve_staff(self, source_id: Optional[str]) -> Optional[str]:
        """Staff is never auto-created — return None if not in destination."""
        if not source_id:
            return None
        key = ('staff', source_id)
        if key in self.cache:
            return self.cache[key]
        try:
            if is_uuid(source_id):
                r = self.sb.table('staff').select('id').eq('id', source_id).limit(1).execute()
                if r.data:
                    self.cache[key] = source_id
                    return source_id
                self.cache[key] = None
                return None
            if is_mongo_id(source_id):
                r = self.sb.table('staff').select('id').eq('mongo_id', source_id).limit(1).execute()
                if r.data:
                    uid = str(r.data[0]['id'])
                    self.cache[key] = uid
                    return uid
        except Exception as e:
            logger.warning("Staff resolve failed src=%s: %s", source_id, e)
        self.cache[key] = None
        return None

    def resolve_staff_by_email(self, email: Optional[str]) -> Optional[str]:
        """Lookup staff por email (case-insensitive). Útil para reconciliar entre
        instancias donde los UUIDs difieren pero los emails coinciden."""
        if not email or not isinstance(email, str):
            return None
        norm = email.strip().lower()
        key = ('staff_email', norm)
        if key in self.cache:
            return self.cache[key]
        try:
            r = self.sb.table('staff').select('id').ilike('email', norm).limit(1).execute()
            if r.data:
                uid = str(r.data[0]['id'])
                self.cache[key] = uid
                return uid
        except Exception as e:
            logger.warning("Staff email lookup failed (%s): %s", email, e)
        self.cache[key] = None
        return None

    def resolve_staff_obj(self, obj) -> Optional[str]:
        """
        Acepta el objeto staff completo del source: {id, name, email, role}.
        Estrategia: email-first (estable entre instancias), fallback a UUID/Mongo id.
        Si recibe un string (id pelado) cae al lookup por id directamente.
        """
        if not obj:
            return None
        if isinstance(obj, str):
            return self.resolve_staff(obj)
        if isinstance(obj, dict):
            uid = self.resolve_staff_by_email(obj.get('email'))
            if uid:
                return uid
            return self.resolve_staff(obj.get('id'))
        return None


# ─────────────────────────────────────────────────────────────────────
# Entity importers
# ─────────────────────────────────────────────────────────────────────

def _import_client(sb, resolver: IdResolver, src: dict, dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    email = src.get('email') or None

    # Prefer matching an existing client by email to avoid UNIQUE violation.
    dest_id = None
    if email:
        try:
            r = sb.table('clients').select('id').eq('email', email).limit(1).execute()
            if r.data:
                dest_id = str(r.data[0]['id'])
                resolver.cache[('clients', sid)] = dest_id
        except Exception as e:
            logger.warning("client email lookup failed (%s): %s", email, e)

    if not dest_id:
        dest_id = resolver.resolve('clients', sid, mongo_col='mongo_portal_id')
    if not dest_id:
        return None

    payload = _clean({
        'id': dest_id,
        'name': src.get('name') or 'Cliente Sin Nombre',
        'email': email,
        'phone': src.get('phone'),
        'profession': src.get('profession'),
        'user_state': src.get('userState'),
        'cv_url': src.get('cvUrl'),
        'created_at': src.get('createdAt'),
        'updated_at': src.get('updatedAt'),
    })
    mongo_id = resolver.mongo_for('clients', sid)
    if mongo_id:
        payload['mongo_portal_id'] = mongo_id

    if not dry_run:
        sb.table('clients').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_visa_case(sb, resolver: IdResolver, src: dict, client_uuid: str,
                     coord_uuid: Optional[str], advisor_uuid: Optional[str],
                     dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('visa_cases', sid)
    if not dest_id:
        return None

    metadata = {
        'tags': src.get('tags') or [],
        'customFields': src.get('customFields') or {},
    }

    payload = _clean({
        'id': dest_id,
        'client_id': client_uuid,
        'coordinator_id': coord_uuid,
        'advisor_id': advisor_uuid,
        'visa_type': src.get('visaType'),
        'status': src.get('status'),
        'current_stage': src.get('currentStage'),
        'overall_progress': src.get('overallProgress'),
        'total_fee': src.get('totalFee'),
        'paid_amount': src.get('paidAmount'),
        'remaining_balance': src.get('remainingBalance'),
        'eligibility_date': src.get('eligibilityDate'),
        'filed_at': src.get('filedAt'),
        'approved_at': src.get('approvedAt'),
        'case_level_notes': src.get('caseLevelNotes'),
        'metadata': metadata,
        'created_at': src.get('createdAt'),
        'updated_at': src.get('updatedAt'),
    })
    mongo_id = resolver.mongo_for('visa_cases', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('visa_cases').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_stage(sb, resolver: IdResolver, src: dict, case_uuid: str, dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('visa_stages', sid)
    if not dest_id:
        return None

    name = src.get('name')
    if not name:
        sn = src.get('stageNumber') or '?'
        name = {'es': f"Etapa {sn}", 'en': f"Stage {sn}"}

    # paid_amount: la UI muestra "Pagada" solo si paidAmount>0. Si el source
    # marca isPaid=true pero no trae paidAmount explícito, usamos `amount`.
    paid_amount = src.get('paidAmount')
    if paid_amount is None and src.get('isPaid'):
        paid_amount = src.get('amount')

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'stage_number': src.get('stageNumber'),
        'name': name,
        'description': src.get('description'),
        'percentage': src.get('percentage'),
        'amount': src.get('amount'),
        'status': src.get('status'),
        'is_paid': src.get('isPaid'),
        'paid_amount': paid_amount,
        'paid_date': src.get('paidAt'),
        'unlocked_at': src.get('unlockedAt'),
        'completed_at': src.get('completedAt'),
        'created_at': src.get('createdAt'),
        'updated_at': src.get('updatedAt'),
    })
    mongo_id = resolver.mongo_for('visa_stages', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('visa_stages').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_deliverable(sb, resolver: IdResolver, src: dict, case_uuid: str,
                        stage_uuid: Optional[str], dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('visa_deliverables', sid)
    if not dest_id:
        return None

    desc = src.get('description')
    if isinstance(desc, str):
        desc = {'es': desc, 'en': desc}

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'stage_id': stage_uuid,
        'stage_number': src.get('stageNumber'),
        'deliverable_name': src.get('deliverableName'),
        'name': src.get('name'),
        'description': desc,
        'status': src.get('status'),
        'file_url': src.get('fileUrl'),
        'file_name': src.get('fileName'),
        'file_size': src.get('fileSize'),
        'uploaded_at': src.get('uploadedAt'),
        'uploaded_by': resolver.resolve_staff(src.get('uploadedBy')),
        'validated_at': src.get('validatedAt'),
        'validated_by': resolver.resolve_staff(src.get('validatedBy')),
        'notes': src.get('notes') if isinstance(src.get('notes'), str) else None,
        'is_draft': src.get('isDraft'),
        'files': src.get('files'),
        'created_at': src.get('createdAt'),
        'updated_at': src.get('updatedAt'),
    })
    mongo_id = resolver.mongo_for('visa_deliverables', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('visa_deliverables').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_document(sb, resolver: IdResolver, src: dict, case_uuid: str, dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('visa_documents', sid)
    if not dest_id:
        return None

    desc = src.get('description')
    if isinstance(desc, str):
        desc = {'es': desc, 'en': desc}

    raw_notes = src.get('notes')
    note_text = raw_notes if isinstance(raw_notes, str) else None
    notes_list = raw_notes if isinstance(raw_notes, list) else None

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'stage_number': src.get('stageNumber'),
        'document_name': src.get('documentName'),
        'name': src.get('name'),
        'description': desc,
        'status': src.get('status'),
        'required': src.get('required'),
        'requires_physical_copy': src.get('requiresPhysicalCopy'),
        'file_url': src.get('fileUrl'),
        'file_name': src.get('fileName'),
        'file_size': src.get('fileSize'),
        'uploaded_at': src.get('uploadedAt'),
        'reviewed_at': src.get('reviewedAt'),
        'reviewed_by': resolver.resolve_staff(src.get('reviewedBy')),
        'rejection_reason': src.get('rejectionReason'),
        'note': note_text,
        'notes': notes_list,
        'created_at': src.get('createdAt'),
        'updated_at': src.get('updatedAt'),
    })
    mongo_id = resolver.mongo_for('visa_documents', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('visa_documents').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_payment(sb, resolver: IdResolver, src: dict, case_uuid: Optional[str],
                    client_uuid: Optional[str], dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('payments', sid)
    if not dest_id:
        return None

    # createdBy puede ser dict {id,name,email} o solo id — email-first matching
    registered_by = resolver.resolve_staff_obj(src.get('createdBy'))

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'client_id': client_uuid,
        'amount': src.get('amount'),
        'currency': src.get('currency') or 'USD',
        'payment_method': src.get('paymentMethod'),
        'stage_number': src.get('stageNumber'),
        'stage_numbers': src.get('stageNumbers'),
        'status': src.get('status') or 'completed',
        'reference': src.get('reference'),
        'receipt_url': src.get('receiptUrl'),
        'notes': src.get('notes'),
        'registered_by': registered_by,
        'paid_at': src.get('paymentDate') or src.get('paidAt'),
        'created_at': src.get('createdAt'),
    })
    mongo_id = resolver.mongo_for('payments', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('payments').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_note(sb, resolver: IdResolver, src: dict, case_uuid: str, dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('case_notes', sid)
    if not dest_id:
        return None

    staff_id = resolver.resolve_staff_obj(src.get('createdBy'))

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'staff_id': staff_id,
        'content': src.get('content') or '',
        'note_type': src.get('type') or 'general',
        'metadata': {
            'category': src.get('category'),
            'isAutomatic': src.get('isAutomatic'),
            'isTestEnvironment': src.get('isTestEnvironment'),
        },
        'created_at': src.get('createdAt'),
    })
    mongo_id = resolver.mongo_for('case_notes', sid)
    if mongo_id:
        payload['mongo_id'] = mongo_id

    if not dry_run:
        sb.table('case_notes').upsert(payload, on_conflict='id').execute()
    return dest_id


# Namespace fijo para generar UUIDs determinísticos de case_audit_logs
_AUDIT_NS = _uuid.UUID('11111111-2222-3333-4444-555555555555')


def _det_audit_id(case_uuid: str, type_key: str, ref_id: str, timestamp: str) -> str:
    """Deterministic UUID para que re-correr la migración no duplique audits."""
    seed = f"{case_uuid}|{type_key}|{ref_id}|{timestamp}"
    return str(_uuid.uuid5(_AUDIT_NS, seed))


# Mapeo source(action,resource) → destination field_changed (clave del icon map en frontend)
_AUDIT_TYPE_MAP = {
    ('upload', 'deliverable'):  'deliverable_file_uploaded',
    ('delete', 'deliverable'):  'deliverable_file_deleted',
    ('create', 'deliverable'):  'deliverable_created',
    ('update', 'deliverable'):  'deliverable_updated',
    ('upload', 'document'):     'client_uploaded_doc',
    ('validate', 'document'):   'document_validated',
    ('approve', 'document'):    'document_validated',
    ('reject', 'document'):     'document_rejected',
    ('create', 'document'):     'document_created',
    ('create', 'payment'):      'payment_registered',
    ('register', 'payment'):    'payment_registered',
    ('delete', 'payment'):      'payment_deleted',
    ('unlock', 'stage'):        'stage_unlocked',
    ('update', 'stage'):        'stage_updated',
    ('add', 'note'):            'note_added',
    ('create', 'note'):         'note_added',
    ('assign', 'coordinator'):  'coordinator_assigned',
    ('update', 'case'):         'case_updated',
    ('change_status', 'case'):  'case_status_changed',
}


def _map_audit_type(action: Optional[str], resource: Optional[str]) -> str:
    a = (action or '').strip().lower()
    r = (resource or '').strip().lower()
    if (a, r) in _AUDIT_TYPE_MAP:
        return _AUDIT_TYPE_MAP[(a, r)]
    return f"{r}_{a}".strip('_') or 'other'


# Etiqueta legible para mostrar en el timeline (action TEXT en la tabla)
_AUDIT_LABEL = {
    'deliverable_file_uploaded': 'Entregable subido',
    'deliverable_file_deleted':  'Archivo eliminado',
    'deliverable_created':       'Entregable creado',
    'deliverable_updated':       'Entregable actualizado',
    'client_uploaded_doc':       'Documento subido',
    'document_validated':        'Documento validado',
    'document_rejected':         'Documento rechazado',
    'document_created':          'Documento solicitado',
    'payment_registered':        'Pago registrado',
    'payment_deleted':           'Pago eliminado',
    'stage_unlocked':            'Etapa desbloqueada',
    'stage_updated':             'Etapa actualizada',
    'note_added':                'Nota agregada',
    'coordinator_assigned':      'Coordinador asignado',
    'case_updated':              'Caso actualizado',
    'case_status_changed':       'Estado del caso cambiado',
}


def _import_activity(sb, resolver: IdResolver, src: dict, case_uuid: Optional[str], dry_run: bool):
    """
    Importa una entrada de activityHistory a case_audit_logs.
    Usa id determinístico para idempotencia.
    """
    if not case_uuid:
        return
    action = src.get('action')
    resource = src.get('resource')
    type_key = _map_audit_type(action, resource)
    timestamp = src.get('timestamp')
    ref_id = src.get('resourceId') or ''

    audit_id = _det_audit_id(case_uuid, type_key, str(ref_id), str(timestamp or ''))
    staff_id = resolver.resolve_staff(src.get('staffId'))
    label = _AUDIT_LABEL.get(type_key) or (action or type_key)

    payload = _clean({
        'id': audit_id,
        'case_id': case_uuid,
        'staff_id': staff_id,
        'action': label,
        'field_changed': type_key,
        'old_value': None,
        'new_value': src.get('resourceId'),
        'details': src.get('details') or {},
        'created_at': timestamp,
    })
    if not dry_run:
        sb.table('case_audit_logs').upsert(payload, on_conflict='id').execute()


def _synth_audit_for_payment(sb, payment_src: dict, case_uuid: str, dry_run: bool):
    """Crea entrada case_audit_logs sintética para un pago migrado."""
    if not case_uuid:
        return
    pid = payment_src.get('id')
    ts = (payment_src.get('createdAt')
          or payment_src.get('paymentDate')
          or payment_src.get('paidAt')
          or '')
    audit_id = _det_audit_id(case_uuid, 'payment_registered', str(pid or ''), str(ts))
    details = {
        'amount': payment_src.get('amount'),
        'stageNumbers': payment_src.get('stageNumbers'),
        'paymentMethod': payment_src.get('paymentMethod'),
        'reference': payment_src.get('reference'),
    }
    payload = _clean({
        'id': audit_id,
        'case_id': case_uuid,
        'staff_id': None,
        'action': 'Pago registrado',
        'field_changed': 'payment_registered',
        'new_value': str(pid or ''),
        'details': {k: v for k, v in details.items() if v is not None},
        'created_at': ts or None,
    })
    if not dry_run:
        sb.table('case_audit_logs').upsert(payload, on_conflict='id').execute()


def _synth_audit_for_deliverable_upload(sb, resolver: IdResolver, deliv_src: dict,
                                        case_uuid: str, dry_run: bool):
    """Crea entrada case_audit_logs sintética cuando un deliverable trae file/uploadedAt."""
    if not case_uuid:
        return
    uploaded_at = deliv_src.get('uploadedAt')
    files = deliv_src.get('files') or []
    if not uploaded_at and not files:
        return  # nada subido

    # Nombre legible del entregable (es preferred, fallback a deliverableName)
    name = deliv_src.get('name')
    if isinstance(name, dict):
        display = name.get('es') or name.get('en') or deliv_src.get('deliverableName')
    else:
        display = name or deliv_src.get('deliverableName')

    file_name = deliv_src.get('fileName') or (files[0].get('fileName') if files and isinstance(files[0], dict) else None)
    ts = uploaded_at or (files[0].get('uploadedAt') if files and isinstance(files[0], dict) else None)
    if not ts:
        return

    deliv_id = deliv_src.get('id') or ''
    audit_id = _det_audit_id(case_uuid, 'deliverable_file_uploaded', str(deliv_id), str(ts))

    staff_id = resolver.resolve_staff(
        deliv_src.get('uploadedBy')
        or (files[0].get('uploadedBy') if files and isinstance(files[0], dict) else None)
    )

    payload = _clean({
        'id': audit_id,
        'case_id': case_uuid,
        'staff_id': staff_id,
        'action': 'Entregable subido',
        'field_changed': 'deliverable_file_uploaded',
        'new_value': str(deliv_id),
        'details': {
            'deliverableName': display,
            'fileName': file_name,
            'stageNumber': deliv_src.get('stageNumber'),
        },
        'created_at': ts,
    })
    if not dry_run:
        sb.table('case_audit_logs').upsert(payload, on_conflict='id').execute()


def _synth_audit_for_note(sb, resolver: IdResolver, note_src: dict, case_uuid: str, dry_run: bool):
    """Crea entrada case_audit_logs sintética para una nota."""
    if not case_uuid:
        return
    nid = note_src.get('id') or ''
    ts = note_src.get('createdAt') or ''
    audit_id = _det_audit_id(case_uuid, 'note_added', str(nid), str(ts))

    created_by = note_src.get('createdBy')
    if isinstance(created_by, dict):
        created_by = created_by.get('id')
    staff_id = resolver.resolve_staff(created_by)

    payload = _clean({
        'id': audit_id,
        'case_id': case_uuid,
        'staff_id': staff_id,
        'action': 'Nota agregada',
        'field_changed': 'note_added',
        'new_value': str(nid),
        'details': {
            'content': (note_src.get('content') or '')[:200],
            'category': note_src.get('category'),
            'type': note_src.get('type'),
        },
        'created_at': ts or None,
    })
    if not dry_run:
        sb.table('case_audit_logs').upsert(payload, on_conflict='id').execute()


def _import_cv(sb, resolver: IdResolver, src: dict, client_uuid: str, dry_run: bool) -> Optional[str]:
    sid = src.get('id')
    if not sid:
        return None
    dest_id = resolver.resolve('user_cvs', sid)
    if not dest_id:
        return None

    # uploadedBy del CV viene como dict {id,name,email} — email-first matching
    uploaded_by = resolver.resolve_staff_obj(src.get('uploadedBy'))

    payload = _clean({
        'id': dest_id,
        'client_id': client_uuid,
        'file_url': src.get('url') or src.get('fileUrl'),
        'file_name': src.get('fileName'),
        'uploaded_by': uploaded_by,
        'uploaded_at': src.get('uploadedAt'),
        'is_active': src.get('active', True),
    })
    if not dry_run:
        sb.table('user_cvs').upsert(payload, on_conflict='id').execute()
    return dest_id


def _import_access_link(sb, src: dict, client_uuid: str, client_phone: Optional[str], dry_run: bool):
    token = src.get('magicToken') or src.get('token')
    if not token:
        return
    # phone es clave: el endpoint /auth/validate-magic-link busca el cliente por
    # magic_links.phone. Preferimos el phone del accessLink; si no, fallback al del cliente.
    phone = src.get('phone') or client_phone
    payload = _clean({
        'client_id': client_uuid,
        'token': token,
        'phone': phone,
        'expires_at': src.get('expiresAt') or '2099-12-31T23:59:59Z',
        'used': src.get('used') or False,
        'created_at': src.get('createdAt'),
    })
    if not dry_run:
        sb.table('magic_links').upsert(payload, on_conflict='token').execute()


def _import_meeting(sb, resolver: IdResolver, src: dict, case_uuid: Optional[str],
                    client_uuid: Optional[str], dry_run: bool):
    sid = src.get('id')
    if not sid:
        return
    dest_id = resolver.resolve('visa_meetings', sid)
    if not dest_id:
        return

    staff_src = src.get('staffId') or (src.get('staff') or {}).get('id')
    staff_uuid = resolver.resolve_staff(staff_src)

    payload = _clean({
        'id': dest_id,
        'case_id': case_uuid,
        'client_id': client_uuid,
        'staff_id': staff_uuid,
        'meeting_url': src.get('meetingUrl'),
        'scheduled_at': src.get('scheduledAt'),
        'status': src.get('status'),
        'recording_url': src.get('recordingUrl'),
        'notes': src.get('notes'),
        'created_at': src.get('createdAt'),
    })
    if not dry_run:
        sb.table('visa_meetings').upsert(payload, on_conflict='id').execute()


# ─────────────────────────────────────────────────────────────────────
# Bundle orchestrator
# ─────────────────────────────────────────────────────────────────────

def _import_case_bundle(sb, resolver: IdResolver, bundle: dict, dry_run: bool) -> dict:
    case_src = bundle.get('case') or {}
    client_src = bundle.get('client') or {}
    team = bundle.get('team') or {}

    case_source_id = case_src.get('id')
    counts = {
        'clients': 0, 'cases': 0, 'stages': 0, 'deliverables': 0,
        'documents': 0, 'payments': 0, 'notes': 0, 'activities': 0,
        'cvs': 0, 'access_links': 0, 'meetings': 0,
    }

    if not case_source_id or not client_src.get('id'):
        return {
            'case_id': case_source_id,
            'status': 'skipped',
            'reason': 'missing case/client id',
            'counts': counts,
        }

    # 1) Client
    client_uuid = _import_client(sb, resolver, client_src, dry_run)
    if client_uuid:
        counts['clients'] = 1

    # 2) Team — resolver por email primero (UUIDs de staff suelen diferir entre instancias),
    #          fallback a UUID/Mongo id si no hay match por email.
    coord_uuid = resolver.resolve_staff_obj(team.get('coordinator'))
    advisor_uuid = resolver.resolve_staff_obj(team.get('seller'))

    # 3) Visa case
    case_uuid = _import_visa_case(sb, resolver, case_src, client_uuid, coord_uuid, advisor_uuid, dry_run)
    if case_uuid:
        counts['cases'] = 1

    # Pre-pase: resourceIds ya cubiertos por activityHistory → no sintetizar duplicado
    covered_resource_ids = set()
    for a in bundle.get('activityHistory') or []:
        rid = a.get('resourceId')
        res = (a.get('resource') or '').lower()
        if rid and res:
            covered_resource_ids.add((res, str(rid)))

    # 4) Stages + nested
    seen_payments = set()
    for st in bundle.get('stages') or []:
        stage_uuid = _import_stage(sb, resolver, st, case_uuid, dry_run)
        if stage_uuid:
            counts['stages'] += 1
        for d in st.get('deliverables') or []:
            if _import_deliverable(sb, resolver, d, case_uuid, stage_uuid, dry_run):
                counts['deliverables'] += 1
                # Sintetizar audit solo si no está ya cubierto por activityHistory
                if ('deliverable', str(d.get('id') or '')) not in covered_resource_ids:
                    _synth_audit_for_deliverable_upload(sb, resolver, d, case_uuid, dry_run)
        for doc in st.get('requiredDocuments') or []:
            if _import_document(sb, resolver, doc, case_uuid, dry_run):
                counts['documents'] += 1
        for p in st.get('paymentSummary') or []:
            pid = p.get('id')
            if pid in seen_payments:
                continue
            seen_payments.add(pid)
            if _import_payment(sb, resolver, p, case_uuid, client_uuid, dry_run):
                counts['payments'] += 1
                if ('payment', str(pid or '')) not in covered_resource_ids:
                    _synth_audit_for_payment(sb, p, case_uuid, dry_run)

    # 5) Top-level payments (dedupe vs stage paymentSummary)
    for p in bundle.get('payments') or []:
        pid = p.get('id')
        if pid in seen_payments:
            continue
        seen_payments.add(pid)
        if _import_payment(sb, resolver, p, case_uuid, client_uuid, dry_run):
            counts['payments'] += 1
            if ('payment', str(pid or '')) not in covered_resource_ids:
                _synth_audit_for_payment(sb, p, case_uuid, dry_run)

    # 6) Notes — viven en case_notes (pestaña "Notas"), NO van al timeline
    for n in bundle.get('notes') or []:
        if _import_note(sb, resolver, n, case_uuid, dry_run):
            counts['notes'] += 1

    # 7) Activity history → case_audit_logs (con id determinístico)
    for a in bundle.get('activityHistory') or []:
        _import_activity(sb, resolver, a, case_uuid, dry_run)
        counts['activities'] += 1

    # 8) CVs
    for cv in bundle.get('clientCvs') or []:
        if _import_cv(sb, resolver, cv, client_uuid, dry_run):
            counts['cvs'] += 1

    # 9) Access links (magic links). El phone es necesario para que el endpoint
    # validate-magic-link encuentre al cliente al usar el link.
    client_phone = (client_src or {}).get('phone')
    for al in bundle.get('accessLinks') or []:
        _import_access_link(sb, al, client_uuid, client_phone, dry_run)
        counts['access_links'] += 1

    # 10) Meetings
    for m in bundle.get('meetings') or []:
        _import_meeting(sb, resolver, m, case_uuid, client_uuid, dry_run)
        counts['meetings'] += 1

    return {
        'case_id': case_source_id,
        'destination_id': case_uuid,
        'status': 'ok',
        'counts': counts,
    }


# ─────────────────────────────────────────────────────────────────────
# FastAPI router
# ─────────────────────────────────────────────────────────────────────

class VisaCaseImportPayload(BaseModel):
    cases: List[Dict[str, Any]]
    pagination: Optional[Dict[str, Any]] = None


def setup_visa_cases_migration_router(verify_staff_token):
    router = APIRouter(prefix="/admin/migration", tags=["Migration"])

    @router.post("/visa-cases-import")
    async def visa_cases_import(
        payload: VisaCaseImportPayload,
        dryRun: bool = Query(False),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        if staff_payload.get('role') not in ('super_admin', 'admin'):
            raise HTTPException(status_code=403, detail="Only admin/super_admin can run migrations")

        sb = get_supabase()
        resolver = IdResolver(sb)

        results = []
        totals = {
            'clients': 0, 'cases': 0, 'stages': 0, 'deliverables': 0,
            'documents': 0, 'payments': 0, 'notes': 0, 'activities': 0,
            'cvs': 0, 'access_links': 0, 'meetings': 0,
        }
        errors = []

        for bundle in payload.cases:
            try:
                r = _import_case_bundle(sb, resolver, bundle, dryRun)
                results.append(r)
                for k, v in (r.get('counts') or {}).items():
                    totals[k] = totals.get(k, 0) + v
            except Exception as e:
                src_id = (bundle.get('case') or {}).get('id')
                logger.exception("Failed to import case %s", src_id)
                errors.append({'case_id': src_id, 'error': str(e)})

        return {
            'dryRun': dryRun,
            'processed': len(payload.cases),
            'success': len(payload.cases) - len(errors),
            'errors': errors,
            'totals': totals,
            'per_case': results,
        }

    return router
