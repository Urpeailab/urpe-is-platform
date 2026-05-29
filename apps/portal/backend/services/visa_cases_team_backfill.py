"""
Visa Cases Team Backfill

POST /api/admin/migration/visa-cases-team-backfill

Acepta el JSON del endpoint legacy `/admin/visa-cases` (misma forma:
{cases:[...], pagination:{...}}) y, para cada caso, rellena
`coordinator_id` y `advisor_id` cuando estén en NULL en destino, usando
`team.coordinator.email` y `team.seller.email` del source.

Reglas (decisiones tomadas con el usuario):
- Solo llena si está vacío en destino (NO sobrescribe asignaciones existentes).
- Match de staff por email (case-insensitive).
- Si el staff no existe en destino: saltar esa asignación y reportar el email
  faltante en la respuesta.
- Match del caso: por `id` UUID directo, o por `mongo_id` si el source id es
  un ObjectId de Mongo (24 hex).
- Solo super_admin / admin pueden correrlo.
- Soporta dryRun=true.
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
MONGO_RE = re.compile(r'^[0-9a-f]{24}$', re.IGNORECASE)


def _is_uuid(s: Any) -> bool:
    return isinstance(s, str) and bool(UUID_RE.match(s))


def _is_mongo_id(s: Any) -> bool:
    return isinstance(s, str) and bool(MONGO_RE.match(s))


def _email_of(member: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(member, dict):
        return None
    em = member.get('email')
    if not isinstance(em, str):
        return None
    em = em.strip().lower()
    return em or None


class VisaCasesTeamBackfillPayload(BaseModel):
    cases: List[Dict[str, Any]]
    pagination: Optional[Dict[str, Any]] = None


def setup_visa_cases_team_backfill_router(verify_staff_token):
    router = APIRouter(prefix="/admin/migration", tags=["Migration"])

    @router.post("/visa-cases-team-backfill")
    async def visa_cases_team_backfill(
        payload: VisaCasesTeamBackfillPayload,
        dryRun: bool = Query(False),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        if staff_payload.get('role') not in ('super_admin', 'admin'):
            raise HTTPException(status_code=403, detail="Only admin/super_admin can run migrations")

        sb = get_supabase()

        # Pre-carga staff email → id en una sola query (paginada por seguridad).
        email_to_staff_id: Dict[str, str] = {}
        try:
            page = 0
            page_size = 1000
            while True:
                res = (
                    sb.table('staff')
                    .select('id,email')
                    .range(page * page_size, page * page_size + page_size - 1)
                    .execute()
                )
                rows = res.data or []
                for r in rows:
                    em = (r.get('email') or '').strip().lower()
                    sid = r.get('id')
                    if em and sid:
                        email_to_staff_id[em] = sid
                if len(rows) < page_size:
                    break
                page += 1
        except Exception as e:
            logger.exception("team_backfill: failed to preload staff")
            raise HTTPException(status_code=500, detail=f"No pude leer staff: {e}")

        updated_coordinator = 0
        updated_advisor = 0
        already_coordinator: List[Dict[str, Any]] = []
        already_advisor: List[Dict[str, Any]] = []
        skipped_case_not_found: List[Dict[str, Any]] = []
        missing_staff_emails: set[str] = set()
        missing_staff_details: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        for idx, bundle in enumerate(payload.cases):
            try:
                case = bundle.get('case') or {}
                team = bundle.get('team') or {}
                source_id = case.get('id') or case.get('_id')
                if not source_id:
                    skipped_case_not_found.append({'index': idx, 'reason': 'missing_source_id'})
                    continue

                # Resolver el caso en destino: UUID directo o por mongo_id.
                dest_row = None
                if _is_uuid(source_id):
                    res = (
                        sb.table('visa_cases')
                        .select('id,coordinator_id,advisor_id')
                        .eq('id', source_id)
                        .limit(1)
                        .execute()
                    )
                    if res.data:
                        dest_row = res.data[0]
                if dest_row is None and _is_mongo_id(source_id):
                    res = (
                        sb.table('visa_cases')
                        .select('id,coordinator_id,advisor_id')
                        .eq('mongo_id', source_id)
                        .limit(1)
                        .execute()
                    )
                    if res.data:
                        dest_row = res.data[0]

                if dest_row is None:
                    skipped_case_not_found.append({'index': idx, 'sourceId': source_id})
                    continue

                dest_case_id = dest_row['id']
                update_data: Dict[str, Any] = {}

                # Coordinator
                coord_email = _email_of(team.get('coordinator'))
                if coord_email:
                    if dest_row.get('coordinator_id'):
                        already_coordinator.append({'caseId': dest_case_id, 'sourceEmail': coord_email})
                    else:
                        staff_id = email_to_staff_id.get(coord_email)
                        if staff_id:
                            update_data['coordinator_id'] = staff_id
                        else:
                            if coord_email not in missing_staff_emails:
                                missing_staff_emails.add(coord_email)
                                missing_staff_details.append({
                                    'email': coord_email,
                                    'role': 'coordinator',
                                    'firstSeenCaseId': dest_case_id,
                                })

                # Seller (advisor)
                seller_email = _email_of(team.get('seller'))
                if seller_email:
                    if dest_row.get('advisor_id'):
                        already_advisor.append({'caseId': dest_case_id, 'sourceEmail': seller_email})
                    else:
                        staff_id = email_to_staff_id.get(seller_email)
                        if staff_id:
                            update_data['advisor_id'] = staff_id
                        else:
                            if seller_email not in missing_staff_emails:
                                missing_staff_emails.add(seller_email)
                                missing_staff_details.append({
                                    'email': seller_email,
                                    'role': 'seller',
                                    'firstSeenCaseId': dest_case_id,
                                })

                if not update_data:
                    continue

                if dryRun:
                    if 'coordinator_id' in update_data:
                        updated_coordinator += 1
                    if 'advisor_id' in update_data:
                        updated_advisor += 1
                    continue

                sb.table('visa_cases').update(update_data).eq('id', dest_case_id).execute()
                if 'coordinator_id' in update_data:
                    updated_coordinator += 1
                if 'advisor_id' in update_data:
                    updated_advisor += 1

            except Exception as e:
                src_id = (bundle.get('case') or {}).get('id')
                logger.exception("team_backfill: failed on case %s", src_id)
                errors.append({'sourceId': src_id, 'error': str(e)})

        return {
            'dryRun': dryRun,
            'processed': len(payload.cases),
            'updatedCoordinator': updated_coordinator,
            'updatedAdvisor': updated_advisor,
            'alreadyAssignedCoordinator': already_coordinator,
            'alreadyAssignedAdvisor': already_advisor,
            'skippedCaseNotFound': skipped_case_not_found,
            'missingStaff': missing_staff_details,
            'errors': errors,
        }

    return router
