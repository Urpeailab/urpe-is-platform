"""
Payment Authorizations Migration

POST /api/admin/migration/payment-authorizations-import

Acepta el JSON que devuelve el endpoint legacy
`/admin/payment-authorizations` (misma forma:
{authorizations:[...], pagination:{...}, flags:{...}}) y hace UPSERT de
cada fila en la tabla `payment_authorizations` de Supabase preservando
el `id` original.

Características:
- Idempotente: re-correr el mismo payload no duplica filas (UPSERT por id).
- Mapeo camelCase → snake_case automático.
- Skips filas sin `id` válido (UUID).
- Soporta dryRun=true (no escribe) y cleanBefore=true (vacía la tabla antes).
- Solo super_admin / admin.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import logging
import re

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)

UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def _is_uuid(s: Any) -> bool:
    return isinstance(s, str) and bool(UUID_RE.match(s))


# camelCase keys del payload → columnas snake_case de la tabla.
# Cualquier campo que no esté aquí se ignora.
_FIELD_MAP = {
    'id': 'id',
    'payerName': 'payer_name',
    'payerAddress': 'payer_address',
    'payerZip': 'payer_zip',
    'payerPhone': 'payer_phone',
    'payerEmail': 'payer_email',
    'paymentMethod': 'payment_method',
    'cardType': 'card_type',
    'cardLastFour': 'card_last_four',
    'bankName': 'bank_name',
    'accountType': 'account_type',
    'accountLastFour': 'account_last_four',
    'amount': 'amount',
    'currency': 'currency',
    'procedureType': 'procedure_type',
    'beneficiaryName': 'beneficiary_name',
    'beneficiaryAddress': 'beneficiary_address',
    'beneficiaryZip': 'beneficiary_zip',
    'isSamePerson': 'is_same_person',
    'relationship': 'relationship',
    'signatureDataUrl': 'signature_data_url',
    'agreedToTerms': 'agreed_to_terms',
    'ipAddress': 'ip_address',
    'submittedAt': 'submitted_at',
    'status': 'status',
    'pdfUrl': 'pdf_url',
    'createdAt': 'created_at',
}


def _to_record(src: Dict[str, Any]) -> Dict[str, Any]:
    """Map a single camelCase authorization dict to its snake_case row."""
    row: Dict[str, Any] = {}
    for camel, snake in _FIELD_MAP.items():
        if camel in src:
            row[snake] = src[camel]
        elif snake in src:
            row[snake] = src[snake]
    # Strip strings, normalize Nones.
    for k, v in list(row.items()):
        if isinstance(v, str):
            stripped = v.strip()
            row[k] = stripped if stripped != '' else None
    return row


def _truncate_table_batched(sb, table: str, batch_size: int = 100) -> int:
    """Delete every row of `table` in small batches (stays under statement_timeout)."""
    total = 0
    while True:
        page = sb.table(table).select('id').limit(batch_size).execute()
        ids = [r['id'] for r in (page.data or []) if r.get('id')]
        if not ids:
            break
        sb.table(table).delete().in_('id', ids).execute()
        total += len(ids)
        if len(ids) < batch_size:
            break
    return total


class PaymentAuthImportPayload(BaseModel):
    authorizations: List[Dict[str, Any]]
    pagination: Optional[Dict[str, Any]] = None
    flags: Optional[Dict[str, Any]] = None


def setup_payment_auth_migration_router(verify_staff_token):
    router = APIRouter(prefix="/admin/migration", tags=["Migration"])

    @router.post("/payment-authorizations-import")
    async def payment_authorizations_import(
        payload: PaymentAuthImportPayload,
        dryRun: bool = Query(False),
        cleanBefore: bool = Query(False, description="Si true, elimina TODAS las filas de payment_authorizations antes de importar."),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        if staff_payload.get('role') not in ('super_admin', 'admin'):
            raise HTTPException(status_code=403, detail="Only admin/super_admin can run migrations")

        sb = get_supabase()

        deleted_before = 0
        if cleanBefore and not dryRun:
            try:
                deleted_before = _truncate_table_batched(sb, 'payment_authorizations')
                logger.info("payment_authorizations cleanBefore: deleted %d rows", deleted_before)
            except Exception as e:
                logger.exception("payment_authorizations cleanBefore failed: %s", e)
                raise HTTPException(status_code=500, detail=f"cleanBefore falló: {e}")

        inserted = 0
        skipped: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        for idx, src in enumerate(payload.authorizations):
            src_id = src.get('id') or src.get('_id')
            if not _is_uuid(src_id):
                skipped.append({'index': idx, 'id': src_id, 'reason': 'invalid_or_missing_uuid'})
                continue

            row = _to_record(src)
            row['id'] = src_id  # garantizar id explícito

            if not row.get('payer_name') or row.get('amount') is None:
                skipped.append({'index': idx, 'id': src_id, 'reason': 'missing_required_fields'})
                continue

            if dryRun:
                inserted += 1
                continue

            try:
                sb.table('payment_authorizations').upsert(row, on_conflict='id').execute()
                inserted += 1
            except Exception as e:
                logger.exception("Failed to upsert payment_authorization %s", src_id)
                errors.append({'id': src_id, 'error': str(e)})

        return {
            'dryRun': dryRun,
            'cleanBefore': cleanBefore,
            'deletedBefore': deleted_before,
            'processed': len(payload.authorizations),
            'inserted': inserted,
            'skipped': skipped,
            'errors': errors,
        }

    return router
