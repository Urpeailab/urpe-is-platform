"""
Script de migracion MongoDB → Supabase UIS 2.0 para ejecutar DENTRO de Emergent.

Uso:
  python emergent_migrate.py portal      # Para el proyecto UIS (classic-cases-hub)
  python emergent_migrate.py redactora   # Para el proyecto Monica Redactora (domain-relink-test)
  python emergent_migrate.py portal --dry-run   # Simular sin escribir

El script usa:
- MONGO_URL y DB_NAME de las variables de entorno que Emergent ya tiene configuradas
- Credenciales de Supabase UIS 2.0 hardcoded abajo (o override con env vars)
"""

import asyncio
import os
import sys
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# === Supabase UIS 2.0 credentials (can be overridden via env vars) ===
SUPABASE_URL = os.environ.get("UIS_SUPABASE_URL", "https://qtnzrphgmdnwmozovtgh.supabase.co")
SUPABASE_KEY = os.environ.get("UIS_SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck")

APP_TYPE = None
DRY_RUN = "--dry-run" in sys.argv

id_map: Dict[str, Dict[str, str]] = {
    "clients": {}, "staff": {}, "visa_cases": {}, "visa_stages": {},
}


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


def safe_insert(supabase: Client, table: str, row: dict, context: str = "") -> Optional[dict]:
    """Insert with dedup and error handling."""
    if DRY_RUN:
        return {"id": "dry-run"}
    try:
        result = supabase.table(table).insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return None  # Already exists
        logger.error(f"  Insert error {table} ({context}): {str(e)[:150]}")
        return None


# ========================================================================
# PORTAL MIGRATION (classic-cases-hub)
# ========================================================================

async def migrate_portal(db, supabase: Client):
    totals = {}

    # 1. Staff
    logger.info("=== staff ===")
    count = 0
    async for doc in db.staff.find({}):
        mongo_id = get_id(doc)
        row = {
            "email": safe_str(doc.get("email", "")).lower() if doc.get("email") else None,
            "name": safe_str(doc.get("name", "Unknown")),
            "role": safe_str(doc.get("role", "asesor")),
            "password_hash": safe_str(doc.get("password")),
            "phone": safe_str(doc.get("phone")),
            "is_active": doc.get("isActive", True),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not row["email"]: continue
        result = safe_insert(supabase, "staff", row, mongo_id)
        if result: id_map["staff"][mongo_id] = result["id"]
        count += 1
    totals["staff"] = count

    # 2. Clients (from users)
    logger.info("=== clients (users) ===")
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
            # Check for existing client by email
            try:
                existing = supabase.table("clients").select("id").eq("email", email).execute()
                if existing.data:
                    id_map["clients"][mongo_id] = existing.data[0]["id"]
            except Exception: pass
        count += 1
    totals["clients"] = count

    # 3. Visa cases
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

    # 4. Visa stages
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
            "description": safe_str(doc.get("description")),
            "percentage": safe_float(doc.get("percentage", 0)),
            "amount": safe_float(doc.get("amount", 0)),
            "status": safe_str(doc.get("status", "locked")),
            "is_paid": doc.get("isPaid", False),
            "paid_amount": safe_float(doc.get("paidAmount")),
            "paid_date": parse_date(doc.get("paidDate")),
            "completed_deliverables_count": safe_int(doc.get("completedDeliverablesCount", 0)),
            "total_deliverables_count": safe_int(doc.get("totalDeliverablesCount", 0)),
            "start_date": parse_date(doc.get("startDate")),
            "completion_date": parse_date(doc.get("completionDate")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(supabase, "visa_stages", row, mongo_id)
        if result: id_map["visa_stages"][mongo_id] = result["id"]
        count += 1
    totals["visa_stages"] = count

    # 5. Deliverables, documents, payments, appointments, uscis, etc.
    simple_migrations = [
        ("visa_deliverables", "visa_deliverables", {
            "case_id": lambda d: id_map["visa_cases"].get(safe_str(d.get("caseId"))),
            "stage_id": lambda d: id_map["visa_stages"].get(safe_str(d.get("stageId"))),
            "stage_number": lambda d: safe_int(d.get("stageNumber")),
            "name": lambda d: safe_str(d.get("name")),
            "description": lambda d: safe_str(d.get("description")),
            "file_url": lambda d: safe_str(d.get("fileUrl")),
            "file_name": lambda d: safe_str(d.get("fileName")),
            "status": lambda d: safe_str(d.get("status", "pending")),
        }, "case_id"),
        ("visa_client_documents", "visa_documents", {
            "case_id": lambda d: id_map["visa_cases"].get(safe_str(d.get("caseId"))),
            "stage_number": lambda d: safe_int(d.get("stageNumber")),
            "document_type": lambda d: safe_str(d.get("documentType")),
            "file_url": lambda d: safe_str(d.get("fileUrl")),
            "file_name": lambda d: safe_str(d.get("fileName")),
            "status": lambda d: safe_str(d.get("status", "pending")),
            "rejection_reason": lambda d: safe_str(d.get("rejectionReason")),
            "revision_count": lambda d: safe_int(d.get("revisionCount", 0)),
        }, "case_id"),
        ("appointments", "appointments", {
            "client_id": lambda d: id_map["clients"].get(safe_str(d.get("userId") or d.get("clientId"))),
            "case_id": lambda d: id_map["visa_cases"].get(safe_str(d.get("caseId"))),
            "staff_id": lambda d: id_map["staff"].get(safe_str(d.get("staffId") or d.get("advisorId"))),
            "title": lambda d: safe_str(d.get("title")),
            "scheduled_at": lambda d: parse_date(d.get("scheduledAt") or d.get("date")),
            "duration_minutes": lambda d: safe_int(d.get("duration", 30)),
            "status": lambda d: safe_str(d.get("status", "scheduled")),
            "notes": lambda d: safe_str(d.get("notes")),
        }, "client_id"),
        ("leads", "leads", {
            "name": lambda d: safe_str(d.get("name")),
            "email": lambda d: safe_str(d.get("email")),
            "phone": lambda d: safe_str(d.get("phone")),
            "source": lambda d: safe_str(d.get("source")),
            "status": lambda d: safe_str(d.get("status", "new")),
            "visa_type": lambda d: safe_str(d.get("visaType")),
        }, None),
        ("case_notes", "case_notes", {
            "case_id": lambda d: id_map["visa_cases"].get(safe_str(d.get("caseId"))),
            "staff_id": lambda d: id_map["staff"].get(safe_str(d.get("staffId"))),
            "content": lambda d: safe_str(d.get("content", "")),
            "note_type": lambda d: safe_str(d.get("type", "general")),
        }, "case_id"),
        ("legal_documents", "legal_documents", {
            "title": lambda d: safe_str(d.get("title", "Untitled")),
            "category": lambda d: safe_str(d.get("category")),
            "file_url": lambda d: safe_str(d.get("fileUrl")),
            "description": lambda d: safe_str(d.get("description")),
        }, None),
        ("eligibility_assessments", "eligibility_assessments", {
            "client_id": lambda d: id_map["clients"].get(safe_str(d.get("userId"))),
            "score": lambda d: safe_float(d.get("score")),
            "result": lambda d: d.get("result") if isinstance(d.get("result"), dict) else None,
        }, "client_id"),
    ]

    for mongo_col, sb_table, field_map, required_fk in simple_migrations:
        logger.info(f"=== {mongo_col} → {sb_table} ===")
        count = 0
        try:
            async for doc in db[mongo_col].find({}):
                mongo_id = get_id(doc)
                row = {"mongo_id": mongo_id, "created_at": parse_date(doc.get("createdAt"))}
                for col, getter in field_map.items():
                    row[col] = getter(doc)
                if required_fk and not row.get(required_fk): continue
                safe_insert(supabase, sb_table, row, mongo_id)
                count += 1
        except Exception as e:
            logger.error(f"  Collection {mongo_col} error: {str(e)[:100]}")
        totals[sb_table] = count

    # Payments (from both payments + manual_payments)
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
                    "reference": safe_str(doc.get("reference") or doc.get("receiptUrl")),
                    "receipt_url": safe_str(doc.get("receiptUrl")),
                    "notes": safe_str(doc.get("notes")),
                    "paid_at": parse_date(doc.get("paymentDate") or doc.get("createdAt")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "payments", row, mongo_id)
                count += 1
        except Exception: pass
    totals["payments"] = count

    return totals


# ========================================================================
# REDACTORA MIGRATION (domain-relink-test)
# ========================================================================

async def migrate_redactora(db, supabase: Client):
    totals = {}
    client_cache = {}

    async def resolve_client(client_mongo_id: str) -> Optional[str]:
        if not client_mongo_id: return None
        if client_mongo_id in client_cache: return client_cache[client_mongo_id]
        # Look up in MongoDB
        try:
            c = await db.clients.find_one({"id": client_mongo_id})
            if not c: c = await db.clients.find_one({"_id": client_mongo_id})
            if not c: return None
            email = safe_str(c.get("email", "")).lower() if c.get("email") else None
            name = safe_str(c.get("name", ""))
            # Try to match by email first
            if email:
                existing = supabase.table("clients").select("id").eq("email", email).execute()
                if existing.data:
                    client_cache[client_mongo_id] = existing.data[0]["id"]
                    return existing.data[0]["id"]
            # Create new
            row = {
                "email": email, "name": name or "Sin nombre",
                "phone": safe_str(c.get("phone")),
                "language": safe_str(c.get("language", "es")),
                "visa_type": "EB-2 NIW", "user_state": "U1",
                "mongo_redactora_id": client_mongo_id,
            }
            result = safe_insert(supabase, "clients", row, email or name)
            if result:
                client_cache[client_mongo_id] = result["id"]
                return result["id"]
        except Exception as e:
            logger.error(f"  Resolve client error: {str(e)[:100]}")
        return None

    # 1. Patents (from patents + patents_in_progress)
    logger.info("=== patents ===")
    count = 0
    for col_name in ["patents", "patents_in_progress"]:
        is_draft = col_name == "patents_in_progress"
        try:
            async for doc in db[col_name].find({}):
                mongo_id = get_id(doc)
                client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("invention_title") or doc.get("title")),
                    "patent_number": safe_str(doc.get("patent_number")),
                    "application_number": safe_str(doc.get("application_number")),
                    "filing_date": safe_str(doc.get("filing_date")),
                    "patent_status": "draft" if is_draft else safe_str(doc.get("status", "completed")),
                    "inventors": safe_str(doc.get("inventor_name") or doc.get("inventors")),
                    "abstract": safe_str(doc.get("abstract")),
                    "description": safe_str(doc.get("specification_content")),
                    "key_innovation": safe_str(doc.get("key_innovation")),
                    "drawings_url": safe_str(doc.get("drawings_url")),
                    "pdf_url": safe_str(doc.get("pdf_url")),
                    "quality_score": safe_float(doc.get("quality_score")),
                    "model_used": safe_str(doc.get("model_used")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
                }
                safe_insert(supabase, "patents", row, mongo_id)
                count += 1
        except Exception as e:
            logger.error(f"  {col_name}: {str(e)[:100]}")
    totals["patents"] = count

    # 2. NIW petitions
    logger.info("=== niw_petitions ===")
    count = 0
    try:
        async for doc in db.niw_in_progress.find({}):
            mongo_id = get_id(doc)
            client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            sections = doc.get("sections", {}) or {}
            row = {
                "client_id": client_id,
                "status": safe_str(doc.get("status", "draft")),
                "prong_1": safe_str(sections.get("prong_1") or sections.get("substantial_merit")),
                "prong_2": safe_str(sections.get("prong_2") or sections.get("well_positioned")),
                "prong_3": safe_str(sections.get("prong_3") or sections.get("waive_job_offer")),
                "full_petition": safe_str(doc.get("full_content")),
                "language": safe_str(doc.get("language", "en")),
                "model_used": safe_str(doc.get("model_used")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "niw_petitions", row, mongo_id)
            count += 1
    except Exception as e:
        logger.error(f"  niw: {str(e)[:100]}")
    totals["niw_petitions"] = count

    # 3. Recommendation letters
    logger.info("=== recommendation_letters ===")
    count = 0
    try:
        async for doc in db.recommendation_letters.find({}):
            mongo_id = get_id(doc)
            client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "recommender_name": safe_str(doc.get("recommender_name")),
                "recommender_title": safe_str(doc.get("recommender_title")),
                "recommender_institution": safe_str(doc.get("recommender_institution")),
                "relationship": safe_str(doc.get("relationship")),
                "content": safe_str(doc.get("content") or doc.get("content_en")),
                "language": safe_str(doc.get("current_language", "en")),
                "status": safe_str(doc.get("status", "completed")),
                "model_used": safe_str(doc.get("model_used")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
            }
            safe_insert(supabase, "recommendation_letters", row, mongo_id)
            count += 1
    except Exception as e:
        logger.error(f"  rec_letters: {str(e)[:100]}")
    totals["recommendation_letters"] = count

    # 4. Econometric studies
    logger.info("=== econometric_studies ===")
    count = 0
    for col in ["econometric_studies", "econometric_studies_in_progress"]:
        try:
            async for doc in db[col].find({}):
                mongo_id = get_id(doc)
                client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "status": safe_str(doc.get("status", "draft")),
                    "analysis_data": doc.get("analysis_data") or doc.get("data"),
                    "conclusions": safe_str(doc.get("conclusions")),
                    "model_used": safe_str(doc.get("model_used")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "econometric_studies", row, mongo_id)
                count += 1
        except Exception: pass
    totals["econometric_studies"] = count

    # 5. Business plans
    logger.info("=== business_plans ===")
    count = 0
    for col in ["business_plans", "business_plans_in_progress"]:
        try:
            async for doc in db[col].find({}):
                mongo_id = get_id(doc)
                client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("sections"),
                    "model_used": safe_str(doc.get("model_used")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "business_plans", row, mongo_id)
                count += 1
        except Exception: pass
    totals["business_plans"] = count

    # 6. Generated documents (books, whitepapers, designed_documents)
    logger.info("=== generated_documents ===")
    count = 0
    type_map = {
        "books": "book", "books_in_progress": "book",
        "whitepapers": "whitepaper", "whitepapers_in_progress": "whitepaper",
        "designed_documents": "designed_document",
    }
    for col, doc_type in type_map.items():
        try:
            async for doc in db[col].find({}):
                mongo_id = get_id(doc)
                client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "document_type": doc_type,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("chapters"),
                    "pdf_url": safe_str(doc.get("pdf_url") or doc.get("pdfUrl")),
                    "model_used": safe_str(doc.get("model_used")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "generated_documents", row, mongo_id)
                count += 1
        except Exception: pass
    totals["generated_documents"] = count

    # 7. Chat messages
    logger.info("=== redactora_chat_messages ===")
    count = 0
    try:
        async for doc in db.chat_messages.find({}):
            mongo_id = get_id(doc)
            client_id = await resolve_client(safe_str(doc.get("user_id") or doc.get("userId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "conversation_id": safe_str(doc.get("conversation_id")),
                "role": safe_str(doc.get("role", "user")),
                "content": safe_str(doc.get("content", "")),
                "has_file": doc.get("has_file", False),
                "file_url": safe_str(doc.get("file_url")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("timestamp") or doc.get("createdAt")),
            }
            safe_insert(supabase, "redactora_chat_messages", row, mongo_id)
            count += 1
    except Exception: pass
    totals["redactora_chat_messages"] = count

    return totals


# ========================================================================
# MAIN
# ========================================================================

async def main():
    global APP_TYPE

    if len(sys.argv) < 2 or sys.argv[1] not in ("portal", "redactora"):
        print("Usage: python emergent_migrate.py <portal|redactora> [--dry-run]")
        sys.exit(1)

    APP_TYPE = sys.argv[1]

    logger.info("=" * 60)
    logger.info(f"UIS 2.0 Migration — {APP_TYPE.upper()}")
    logger.info(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    logger.info("=" * 60)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")

    if not mongo_url or not db_name:
        logger.error("MONGO_URL and DB_NAME env vars required (already set by Emergent)")
        sys.exit(1)

    logger.info(f"MongoDB: {db_name}")
    logger.info(f"Supabase: {SUPABASE_URL}")

    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client[db_name]
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if APP_TYPE == "portal":
        totals = await migrate_portal(db, supabase)
    else:
        totals = await migrate_redactora(db, supabase)

    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)

    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
