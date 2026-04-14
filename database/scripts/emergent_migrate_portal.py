"""
Script de migracion MongoDB → Supabase UIS 2.0
PARA EL PROYECTO: UIS (classic-cases-hub)

Uso:
  python emergent_migrate_portal.py
  python emergent_migrate_portal.py --dry-run   # Simular sin escribir

Usa MONGO_URL y DB_NAME ya configuradas en Emergent.
"""

import asyncio
import os
import sys
import logging
from datetime import datetime
from typing import Dict, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = "https://qtnzrphgmdnwmozovtgh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck"

DRY_RUN = "--dry-run" in sys.argv
id_map: Dict[str, Dict[str, str]] = {"clients": {}, "staff": {}, "visa_cases": {}, "visa_stages": {}}


def parse_date(val) -> Optional[str]:
    if not val: return None
    if isinstance(val, datetime): return val.isoformat()
    return str(val)


def safe_str(val, max_len=None) -> Optional[str]:
    if val is None: return None
    s = str(val).strip()
    return (s[:max_len] if max_len else s) if s else None


def safe_float(val) -> Optional[float]:
    try: return float(val) if val is not None else None
    except (ValueError, TypeError): return None


def safe_int(val) -> Optional[int]:
    try: return int(val) if val is not None else None
    except (ValueError, TypeError): return None


def get_id(doc) -> str:
    return str(doc.get("id") or doc.get("_id", ""))


def safe_insert(supabase, table, row, context=""):
    if DRY_RUN: return {"id": "dry-run"}
    try:
        result = supabase.table(table).insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return None
        logger.error(f"  Insert {table} ({context}): {str(e)[:150]}")
        return None


async def migrate(db, supabase):
    totals = {}

    # Staff
    logger.info("=== staff ===")
    count = 0
    async for doc in db.staff.find({}):
        mongo_id = get_id(doc)
        email = safe_str(doc.get("email", "")).lower() if doc.get("email") else None
        if not email: continue
        row = {
            "email": email,
            "name": safe_str(doc.get("name", "Unknown")),
            "role": safe_str(doc.get("role", "asesor")),
            "password_hash": safe_str(doc.get("password")),
            "phone": safe_str(doc.get("phone")),
            "is_active": doc.get("isActive", True),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(supabase, "staff", row, mongo_id)
        if result: id_map["staff"][mongo_id] = result["id"]
        count += 1
    totals["staff"] = count

    # Clients
    logger.info("=== clients ===")
    count = 0
    async for doc in db.users.find({}):
        mongo_id = get_id(doc)
        email = safe_str(doc.get("email", "")).lower() if doc.get("email") else None
        if not email: continue
        advisor_id = id_map["staff"].get(safe_str(doc.get("advisorId")))
        row = {
            "email": email, "phone": safe_str(doc.get("phone")),
            "name": safe_str(doc.get("name", "Sin nombre")),
            "profession": safe_str(doc.get("profession")),
            "language": safe_str(doc.get("language", "es")),
            "visa_type": safe_str(doc.get("visaType", "EB-2 NIW")),
            "user_state": safe_str(doc.get("userState", "U1")),
            "password_hash": safe_str(doc.get("password")),
            "cv_url": safe_str(doc.get("cvUrl")),
            "original_file_url": safe_str(doc.get("originalFileUrl")),
            "is_eligible": doc.get("eligible", False),
            "eligible_report": doc["report"] if doc.get("report") and isinstance(doc["report"], dict) else None,
            "welcome_shown": doc.get("welcome", False),
            "advisor_id": advisor_id, "mongo_portal_id": mongo_id,
            "supabase_legacy_id": safe_str(doc.get("supabase_id") or doc.get("supabaseId")),
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(supabase, "clients", row, email)
        if result:
            id_map["clients"][mongo_id] = result["id"]
        else:
            try:
                existing = supabase.table("clients").select("id").eq("email", email).execute()
                if existing.data:
                    id_map["clients"][mongo_id] = existing.data[0]["id"]
            except Exception: pass
        count += 1
    totals["clients"] = count

    # Visa cases
    logger.info("=== visa_cases ===")
    count = 0
    async for doc in db.visa_cases.find({}):
        mongo_id = get_id(doc)
        client_id = id_map["clients"].get(safe_str(doc.get("userId")))
        if not client_id: continue
        row = {
            "client_id": client_id,
            "coordinator_id": id_map["staff"].get(safe_str(doc.get("coordinatorId"))),
            "advisor_id": id_map["staff"].get(safe_str(doc.get("advisorId"))),
            "case_id": safe_str(doc.get("caseId")),
            "visa_type": safe_str(doc.get("visaType", "EB-2 NIW")),
            "current_stage": safe_int(doc.get("currentStage", 1)),
            "status": safe_str(doc.get("status", "active")),
            "is_master_case": doc.get("isMasterCase", False),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(supabase, "visa_cases", row, mongo_id)
        if result: id_map["visa_cases"][mongo_id] = result["id"]
        count += 1
    totals["visa_cases"] = count

    # Visa stages
    logger.info("=== visa_stages ===")
    count = 0
    async for doc in db.visa_stages.find({}):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id: continue
        row = {
            "case_id": case_id,
            "stage_number": safe_int(doc.get("stageNumber", 0)),
            "name": safe_str(doc.get("name", "")),
            "status": safe_str(doc.get("status", "locked")),
            "is_paid": doc.get("isPaid", False),
            "paid_amount": safe_float(doc.get("paidAmount")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(supabase, "visa_stages", row, mongo_id)
        if result: id_map["visa_stages"][mongo_id] = result["id"]
        count += 1
    totals["visa_stages"] = count

    # Visa deliverables
    logger.info("=== visa_deliverables ===")
    count = 0
    async for doc in db.visa_deliverables.find({}):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id: continue
        row = {
            "case_id": case_id,
            "stage_id": id_map["visa_stages"].get(safe_str(doc.get("stageId"))),
            "stage_number": safe_int(doc.get("stageNumber")),
            "name": safe_str(doc.get("name")),
            "description": safe_str(doc.get("description")),
            "file_url": safe_str(doc.get("fileUrl")),
            "file_name": safe_str(doc.get("fileName")),
            "status": safe_str(doc.get("status", "pending")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        safe_insert(supabase, "visa_deliverables", row, mongo_id)
        count += 1
    totals["visa_deliverables"] = count

    # Visa documents
    logger.info("=== visa_documents ===")
    count = 0
    async for doc in db.visa_client_documents.find({}):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id: continue
        row = {
            "case_id": case_id,
            "stage_number": safe_int(doc.get("stageNumber")),
            "document_type": safe_str(doc.get("documentType")),
            "file_url": safe_str(doc.get("fileUrl")),
            "file_name": safe_str(doc.get("fileName")),
            "status": safe_str(doc.get("status", "pending")),
            "rejection_reason": safe_str(doc.get("rejectionReason")),
            "revision_count": safe_int(doc.get("revisionCount", 0)),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        safe_insert(supabase, "visa_documents", row, mongo_id)
        count += 1
    totals["visa_documents"] = count

    # Payments
    logger.info("=== payments ===")
    count = 0
    for col_name in ["payments", "manual_payments"]:
        try:
            async for doc in db[col_name].find({}):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("userId")))
                if not client_id: continue
                sn = doc.get("stageNumbers")
                row = {
                    "client_id": client_id,
                    "case_id": id_map["visa_cases"].get(safe_str(doc.get("caseId"))),
                    "amount": safe_float(doc.get("amount", 0)),
                    "currency": safe_str(doc.get("currency", "USD")),
                    "payment_method": safe_str(doc.get("paymentMethod") or doc.get("method")),
                    "stage_number": safe_int(doc.get("stageNumber")),
                    "stage_numbers": sn if isinstance(sn, list) else None,
                    "status": safe_str(doc.get("status", "completed")),
                    "paid_at": parse_date(doc.get("paymentDate") or doc.get("createdAt")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "payments", row, mongo_id)
                count += 1
        except Exception: pass
    totals["payments"] = count

    # Appointments
    logger.info("=== appointments ===")
    count = 0
    try:
        async for doc in db.appointments.find({}):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("userId") or doc.get("clientId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "case_id": id_map["visa_cases"].get(safe_str(doc.get("caseId"))),
                "staff_id": id_map["staff"].get(safe_str(doc.get("staffId") or doc.get("advisorId"))),
                "title": safe_str(doc.get("title")),
                "scheduled_at": parse_date(doc.get("scheduledAt") or doc.get("date")),
                "duration_minutes": safe_int(doc.get("duration", 30)),
                "status": safe_str(doc.get("status", "scheduled")),
                "notes": safe_str(doc.get("notes")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "appointments", row, mongo_id)
            count += 1
    except Exception: pass
    totals["appointments"] = count

    # Leads
    logger.info("=== leads ===")
    count = 0
    try:
        async for doc in db.leads.find({}):
            mongo_id = get_id(doc)
            row = {
                "name": safe_str(doc.get("name")),
                "email": safe_str(doc.get("email")),
                "phone": safe_str(doc.get("phone")),
                "source": safe_str(doc.get("source")),
                "status": safe_str(doc.get("status", "new")),
                "visa_type": safe_str(doc.get("visaType")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "leads", row, mongo_id)
            count += 1
    except Exception: pass
    totals["leads"] = count

    # Case notes
    logger.info("=== case_notes ===")
    count = 0
    try:
        async for doc in db.case_notes.find({}):
            mongo_id = get_id(doc)
            case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
            if not case_id: continue
            row = {
                "case_id": case_id,
                "staff_id": id_map["staff"].get(safe_str(doc.get("staffId"))),
                "content": safe_str(doc.get("content", "")),
                "note_type": safe_str(doc.get("type", "general")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "case_notes", row, mongo_id)
            count += 1
    except Exception: pass
    totals["case_notes"] = count

    # Legal documents
    logger.info("=== legal_documents ===")
    count = 0
    try:
        async for doc in db.legal_documents.find({}):
            mongo_id = get_id(doc)
            row = {
                "title": safe_str(doc.get("title", "Untitled")),
                "category": safe_str(doc.get("category")),
                "file_url": safe_str(doc.get("fileUrl")),
                "description": safe_str(doc.get("description")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "legal_documents", row, mongo_id)
            count += 1
    except Exception: pass
    totals["legal_documents"] = count

    # Eligibility assessments
    logger.info("=== eligibility_assessments ===")
    count = 0
    try:
        async for doc in db.eligibility_assessments.find({}):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("userId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "score": safe_float(doc.get("score")),
                "result": doc.get("result") if isinstance(doc.get("result"), dict) else None,
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "eligibility_assessments", row, mongo_id)
            count += 1
    except Exception: pass
    totals["eligibility_assessments"] = count

    return totals


async def main():
    logger.info("=" * 60)
    logger.info("UIS 2.0 Migration — PORTAL (classic-cases-hub)")
    logger.info(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    logger.info("=" * 60)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        logger.error("MONGO_URL and DB_NAME env vars required")
        sys.exit(1)

    logger.info(f"MongoDB: {db_name}")
    logger.info(f"Supabase: {SUPABASE_URL}")

    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client[db_name]
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    totals = await migrate(db, supabase)

    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)
    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
