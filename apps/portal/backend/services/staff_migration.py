"""
Staff Migration

POST /api/admin/migration/staff-import

Acepta el JSON que devuelve el endpoint legacy `/admin/staff` (misma forma:
{staff:[...], pagination:{...}, flags:{...}}) y para cada miembro:

- Si ya existe un staff con el mismo email (case-insensitive) → NO hace nada.
- Si no existe → INSERTA una nueva fila en la tabla `staff` con los datos
  del origen (incluyendo passwordHash, role, etc.).

Características:
- Idempotente por email: re-correr el mismo payload no duplica filas.
- No sobrescribe staff existentes (a propósito — el destino gana).
- Solo super_admin / admin.
- Soporta dryRun=true (simula sin escribir).

NOTA: no expone `cleanBefore` porque borrar staff cascadea a visa_cases.coordinator_id /
advisor_id y rompería datos en producción. Si lo necesitás, agregalo a mano.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import logging
import uuid as _uuid

from db.supabase_client import get_supabase, insert

logger = logging.getLogger(__name__)


# camelCase del payload → columna snake_case del destino.
# Solo se importan estos campos; cualquier otro se ignora.
# Restringido a las columnas que SÍ existen en `staff` (ver
# database/migrations/001_core_schema.sql y 006_otp_columns.sql).
# Los demás campos del export legacy (roleLevel, permissions, department,
# linkedin, managedBy, teamMembers, lastLogin, magicLinkToken/Expires,
# mustChangePassword) se ignoran a propósito — la app los reconstruye en
# tiempo de login desde DEFAULT_PERMISSIONS / ROLE_LEVELS según `role`.
_FIELD_MAP = {
    'id': 'id',
    'email': 'email',
    'name': 'name',
    'role': 'role',
    'phone': 'phone',
    'passwordHash': 'password_hash',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
}


def _to_record(src: Dict[str, Any]) -> Dict[str, Any]:
    """Map a single camelCase staff dict to its snake_case row."""
    row: Dict[str, Any] = {}
    for camel, snake in _FIELD_MAP.items():
        if camel in src:
            row[snake] = src[camel]
        elif snake in src:
            row[snake] = src[snake]

    # Traducciones especiales: status:"active"|"inactive" → is_active boolean,
    # photo (url o null) → avatar_url. Estas son las columnas reales de la tabla.
    if 'status' in src:
        status = (src.get('status') or '').strip().lower()
        row['is_active'] = status != 'inactive'
    if 'photo' in src and 'avatar_url' not in row:
        row['avatar_url'] = src.get('photo')

    # Algunos payloads vienen con `_id` (estilo Mongo) en vez de `id`.
    if 'id' not in row and src.get('_id'):
        row['id'] = src['_id']
    # email es la clave de match — normalizo a lowercase.
    if isinstance(row.get('email'), str):
        row['email'] = row['email'].strip().lower()
    # Si no trae id válido, genero uno (la tabla lo requiere).
    if not row.get('id'):
        row['id'] = str(_uuid.uuid4())
    return row


class StaffImportPayload(BaseModel):
    staff: List[Dict[str, Any]]
    pagination: Optional[Dict[str, Any]] = None
    flags: Optional[Dict[str, Any]] = None


def setup_staff_migration_router(verify_staff_token):
    router = APIRouter(prefix="/admin/migration", tags=["Migration"])

    @router.post("/staff-import")
    async def staff_import(
        payload: StaffImportPayload,
        dryRun: bool = Query(False),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        if staff_payload.get('role') not in ('super_admin', 'admin'):
            raise HTTPException(status_code=403, detail="Only admin/super_admin can run migrations")

        sb = get_supabase()

        # Pre-cargo todos los emails existentes en una sola query para evitar
        # 1 SELECT por fila del payload.
        existing_emails: set[str] = set()
        try:
            page = 0
            page_size = 1000
            while True:
                res = (
                    sb.table('staff')
                    .select('email')
                    .range(page * page_size, page * page_size + page_size - 1)
                    .execute()
                )
                rows = res.data or []
                for r in rows:
                    em = (r.get('email') or '').strip().lower()
                    if em:
                        existing_emails.add(em)
                if len(rows) < page_size:
                    break
                page += 1
        except Exception as e:
            logger.exception("staff_import: failed to preload existing emails")
            raise HTTPException(status_code=500, detail=f"No pude leer staff existente: {e}")

        inserted = 0
        skipped_existing: List[Dict[str, Any]] = []
        skipped_invalid: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        # Emails ya creados en esta corrida (evita duplicados dentro del mismo payload).
        seen_in_payload: set[str] = set()

        for idx, src in enumerate(payload.staff):
            email = (src.get('email') or '').strip().lower()
            if not email:
                skipped_invalid.append({'index': idx, 'reason': 'missing_email'})
                continue

            if email in existing_emails or email in seen_in_payload:
                skipped_existing.append({'index': idx, 'email': email})
                continue

            row = _to_record(src)
            if not row.get('name') or not row.get('role'):
                skipped_invalid.append({'index': idx, 'email': email, 'reason': 'missing_name_or_role'})
                continue

            if dryRun:
                inserted += 1
                seen_in_payload.add(email)
                continue

            try:
                insert('staff', row)
                inserted += 1
                seen_in_payload.add(email)
            except Exception as e:
                msg = str(e)
                # Si el id del source choca con uno existente (otro staff con
                # mismo UUID pero distinto email), reintento con un id fresco.
                if 'duplicate key' in msg.lower() and 'pkey' in msg.lower():
                    try:
                        retry = dict(row)
                        retry['id'] = str(_uuid.uuid4())
                        insert('staff', retry)
                        inserted += 1
                        seen_in_payload.add(email)
                        continue
                    except Exception as e2:
                        msg = f"PK collision retry failed: {e2}"
                logger.exception("staff_import: failed to insert %s", email)
                errors.append({'email': email, 'error': msg})

        return {
            'dryRun': dryRun,
            'processed': len(payload.staff),
            'inserted': inserted,
            'skippedExisting': skipped_existing,
            'skippedInvalid': skipped_invalid,
            'errors': errors,
        }

    return router
