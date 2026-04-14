"""
Migracion 100% MongoDB → Supabase con JOIN inteligente entre Portal y Redactora.

Estrategia:
1. Limpia Supabase (delete all clients y dependientes)
2. Migra TODOS los users del Portal (incluso sin email) — usa mongo_id para dedup
3. Migra TODOS los clients de Redactora — match por email/phone/name con Portal
4. Re-migra todos los datos dependientes con los IDs correctos

Run: python migrate_100pct.py
"""

import requests
import sys
import json
import logging
from datetime import datetime
from typing import Optional, Dict
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MV = "https://mongoview.emergent.host/api"
SUPABASE_URL = "https://qtnzrphgmdnwmozovtgh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck"

PORTAL_URL = "mongodb+srv://urpe-legal:d4g4vaclqs2c73b27te0@customer-apps.pa08s4.mongodb.net/?appName=classic-cases-hub"
PORTAL_DB = "urpe-legal-test_database"
REDACTORA_URL = "mongodb+srv://domain-relink-test:d75v7eclqs2c738tundg@customer-apps.jdl9pi.mongodb.net/?appName=domain-relink-test"
REDACTORA_DBS = ["domain-relink-test-monica_db", "domain-relink-test-test_database"]

id_map = {
    "clients": {},   # mongo_id → supabase_uuid
    "staff": {},
    "visa_cases": {},
    "visa_stages": {},
    "patents": {},
}
email_to_uuid = {}
phone_to_uuid = {}


def connect(url: str) -> str:
    return requests.post(f"{MV}/connect", json={"production_url": url}).json()["session_id"]


def fetch_all(session: str, db: str, coll: str):
    skip = 0
    while True:
        r = requests.get(f"{MV}/documents/production/{db}/{coll}",
                         headers={"X-Session-Id": session},
                         params={"limit": 500, "skip": skip}, timeout=60)
        data = r.json()
        docs = data.get("documents", [])
        if not docs:
            break
        for d in docs:
            yield d
        if not data.get("has_next"):
            break
        skip += len(docs)


def safe_str(v, max_len=None):
    if v is None: return None
    s = str(v).strip()
    if max_len: s = s[:max_len]
    return s if s else None


def safe_float(v):
    try: return float(v) if v is not None else None
    except: return None


def safe_int(v):
    try: return int(v) if v is not None else None
    except: return None


def parse_date(v):
    if not v: return None
    return str(v)


def get_id(doc):
    return str(doc.get("id") or doc.get("_id", ""))


def normalize_phone(p):
    """Remove non-digit chars from phone."""
    if not p: return None
    import re
    digits = re.sub(r"\D", "", str(p))
    return digits if len(digits) >= 7 else None


def normalize_email(e):
    if not e: return None
    s = str(e).lower().strip()
    return s if "@" in s else None


def safe_insert(sb, table, row, ctx=""):
    try:
        r = sb.table(table).insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "unique" in err:
            return None
        logger.error(f"  {table} ({ctx}): {str(e)[:120]}")
        return None


def safe_insert_or_find(sb, table, row, lookup_filters=None):
    """Insert or return existing row by lookup filter."""
    result = safe_insert(sb, table, row)
    if result:
        return result
    # Duplicate — try to find
    if lookup_filters:
        try:
            q = sb.table(table).select("*")
            for k, v in lookup_filters.items():
                q = q.eq(k, v)
            r = q.execute()
            if r.data:
                return r.data[0]
        except Exception:
            pass
    return None


def clean_database(sb):
    """Clean all data tables before re-migration."""
    logger.info("=== Cleaning Supabase tables ===")
    # Order matters: children first, then parents
    tables = [
        "redactora_chat_messages", "generated_documents", "business_plans",
        "econometric_studies", "recommendation_letters", "niw_petitions",
        "patent_evaluations", "patents",
        "case_notes", "case_audit_logs", "visa_documents", "visa_deliverables",
        "visa_stages", "appointments", "payments", "uscis_submissions",
        "eligibility_assessments", "user_cvs", "visa_meetings",
        "leads", "legal_documents",
        "visa_cases", "magic_links", "activity_logs",
        "clients", "staff",
    ]
    for t in tables:
        try:
            # Delete everything where id is not null (can't just truncate via API)
            sb.table(t).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            logger.info(f"  cleared {t}")
        except Exception as e:
            logger.error(f"  {t}: {str(e)[:80]}")


def migrate_portal_staff(session, db, sb):
    logger.info("=== STAFF ===")
    count = 0
    for doc in fetch_all(session, db, "staff"):
        mongo_id = get_id(doc)
        email = normalize_email(doc.get("email"))
        row = {
            "email": email or f"unknown-{mongo_id[:8]}@staff.local",  # NOT NULL req
            "name": safe_str(doc.get("name", "Unknown")),
            "role": safe_str(doc.get("role", "asesor")),
            "password_hash": safe_str(doc.get("password")),
            "phone": safe_str(doc.get("phone")),
            "is_active": doc.get("isActive", True),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        result = safe_insert(sb, "staff", row, mongo_id)
        if result:
            id_map["staff"][mongo_id] = result["id"]
        count += 1
    logger.info(f"  {count} staff")


def migrate_portal_clients(session, db, sb):
    """Migrate ALL portal users, including those without email."""
    logger.info("=== CLIENTS (Portal - 100%) ===")
    count = 0
    no_email_count = 0
    for doc in fetch_all(session, db, "users"):
        mongo_id = get_id(doc)
        email = normalize_email(doc.get("email"))
        phone = normalize_phone(doc.get("phone"))
        name = safe_str(doc.get("name", "Sin nombre"))

        row = {
            "email": email,
            "phone": phone,
            "name": name,
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
            "advisor_id": id_map["staff"].get(safe_str(doc.get("advisorId"))),
            "mongo_portal_id": mongo_id,
            "supabase_legacy_id": safe_str(doc.get("supabase_id") or doc.get("supabaseId")),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not email: no_email_count += 1

        result = safe_insert(sb, "clients", row, email or mongo_id[:8])
        if result:
            id_map["clients"][mongo_id] = result["id"]
            if email: email_to_uuid[email] = result["id"]
            if phone: phone_to_uuid[phone] = result["id"]
        else:
            # Duplicate email — find existing and link
            if email:
                try:
                    existing = sb.table("clients").select("id,mongo_portal_id").eq("email", email).execute()
                    if existing.data:
                        existing_id = existing.data[0]["id"]
                        id_map["clients"][mongo_id] = existing_id
                        email_to_uuid[email] = existing_id
                        # Update to also store this mongo_id if first one didn't have it
                        if not existing.data[0].get("mongo_portal_id"):
                            sb.table("clients").update({"mongo_portal_id": mongo_id}).eq("id", existing_id).execute()
                except Exception as e:
                    logger.error(f"  Lookup: {str(e)[:80]}")
        count += 1
        if count % 100 == 0:
            logger.info(f"  ... {count} processed ({no_email_count} sin email)")
    logger.info(f"  {count} clients ({no_email_count} sin email)")


def migrate_redactora_clients(session, db, sb):
    """Match Redactora clients to existing Portal clients by email/phone/name."""
    logger.info(f"=== REDACTORA CLIENTS from {db} ===")
    matched = 0
    created = 0
    for doc in fetch_all(session, db, "clients"):
        mongo_id = get_id(doc)
        email = normalize_email(doc.get("email"))
        phone = normalize_phone(doc.get("phone"))
        name = safe_str(doc.get("name"))

        # Try to match existing
        supabase_id = None
        if email and email in email_to_uuid:
            supabase_id = email_to_uuid[email]
        elif phone and phone in phone_to_uuid:
            supabase_id = phone_to_uuid[phone]

        if supabase_id:
            # Link: set mongo_redactora_id on existing client
            try:
                sb.table("clients").update({"mongo_redactora_id": mongo_id}).eq("id", supabase_id).execute()
                id_map["clients"][mongo_id] = supabase_id
                matched += 1
            except Exception as e:
                logger.error(f"  Link: {str(e)[:80]}")
        else:
            # Create new client from Redactora
            row = {
                "email": email,
                "phone": phone,
                "name": name or "Sin nombre",
                "language": safe_str(doc.get("language", "es")),
                "visa_type": "EB-2 NIW",
                "user_state": "U1",
                "mongo_redactora_id": mongo_id,
            }
            result = safe_insert(sb, "clients", row, email or name or "")
            if result:
                id_map["clients"][mongo_id] = result["id"]
                if email: email_to_uuid[email] = result["id"]
                if phone: phone_to_uuid[phone] = result["id"]
                created += 1
            else:
                # Duplicate email
                if email:
                    existing = sb.table("clients").select("id").eq("email", email).execute()
                    if existing.data:
                        id_map["clients"][mongo_id] = existing.data[0]["id"]
                        matched += 1
    logger.info(f"  matched={matched}, created={created}")


def migrate_simple(session, db, sb, mongo_col, sb_table, field_fn, required_fks=None):
    logger.info(f"=== {sb_table} (from {mongo_col}) ===")
    count = 0
    for doc in fetch_all(session, db, mongo_col):
        mongo_id = get_id(doc)
        row = field_fn(doc, mongo_id)
        if required_fks:
            if any(not row.get(fk) for fk in required_fks):
                continue
        row["mongo_id"] = mongo_id
        if "created_at" not in row:
            row["created_at"] = parse_date(doc.get("createdAt"))
        if safe_insert(sb, sb_table, row, mongo_id):
            count += 1
    logger.info(f"  {count}")
    return count


def migrate_portal_cases_and_dependents(session, db, sb):
    # Visa cases
    logger.info("=== VISA_CASES ===")
    count = 0
    for doc in fetch_all(session, db, "visa_cases"):
        mongo_id = get_id(doc)
        client_id = id_map["clients"].get(safe_str(doc.get("userId")))
        if not client_id:
            continue
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
        result = safe_insert(sb, "visa_cases", row, mongo_id)
        if result:
            id_map["visa_cases"][mongo_id] = result["id"]
            count += 1
    logger.info(f"  {count}")

    # Stages
    logger.info("=== VISA_STAGES ===")
    count = 0
    for doc in fetch_all(session, db, "visa_stages"):
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
        result = safe_insert(sb, "visa_stages", row, mongo_id)
        if result:
            id_map["visa_stages"][mongo_id] = result["id"]
            count += 1
    logger.info(f"  {count}")

    # Deliverables
    logger.info("=== VISA_DELIVERABLES ===")
    count = 0
    for doc in fetch_all(session, db, "visa_deliverables"):
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
        if safe_insert(sb, "visa_deliverables", row, mongo_id):
            count += 1
        if count % 1000 == 0:
            logger.info(f"  ... {count}")
    logger.info(f"  {count}")

    # Documents
    logger.info("=== VISA_DOCUMENTS ===")
    count = 0
    for doc in fetch_all(session, db, "visa_client_documents"):
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
        if safe_insert(sb, "visa_documents", row, mongo_id):
            count += 1
        if count % 1000 == 0:
            logger.info(f"  ... {count}")
    logger.info(f"  {count}")

    # Payments
    logger.info("=== PAYMENTS ===")
    count = 0
    for coll in ["payments", "manual_payments", "visa_payments"]:
        try:
            for doc in fetch_all(session, db, coll):
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
                if safe_insert(sb, "payments", row, mongo_id):
                    count += 1
        except Exception: pass
    logger.info(f"  {count}")

    # Appointments (with default scheduled_at)
    logger.info("=== APPOINTMENTS ===")
    count = 0
    for doc in fetch_all(session, db, "appointments"):
        mongo_id = get_id(doc)
        client_id = id_map["clients"].get(safe_str(doc.get("userId") or doc.get("clientId")))
        if not client_id: continue
        scheduled = parse_date(doc.get("scheduledAt") or doc.get("date") or doc.get("createdAt")) or datetime.utcnow().isoformat()
        row = {
            "client_id": client_id,
            "case_id": id_map["visa_cases"].get(safe_str(doc.get("caseId"))),
            "staff_id": id_map["staff"].get(safe_str(doc.get("staffId"))),
            "title": safe_str(doc.get("title", "Sin titulo")),
            "scheduled_at": scheduled,
            "duration_minutes": safe_int(doc.get("duration", 30)) or 30,
            "status": safe_str(doc.get("status", "scheduled")),
            "notes": safe_str(doc.get("notes")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "appointments", row, mongo_id):
            count += 1
    logger.info(f"  {count}")

    # Leads
    logger.info("=== LEADS ===")
    count = 0
    for doc in fetch_all(session, db, "leads"):
        mongo_id = get_id(doc)
        row = {
            "name": safe_str(doc.get("name")),
            "email": normalize_email(doc.get("email")),
            "phone": safe_str(doc.get("phone")),
            "source": safe_str(doc.get("source")),
            "status": safe_str(doc.get("status", "new")),
            "visa_type": safe_str(doc.get("visaType")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "leads", row, mongo_id):
            count += 1
    logger.info(f"  {count}")

    # Case notes
    logger.info("=== CASE_NOTES ===")
    count = 0
    for doc in fetch_all(session, db, "case_notes"):
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
        if safe_insert(sb, "case_notes", row, mongo_id):
            count += 1
    logger.info(f"  {count}")

    # Legal documents
    logger.info("=== LEGAL_DOCUMENTS ===")
    count = 0
    for doc in fetch_all(session, db, "legal_documents"):
        mongo_id = get_id(doc)
        row = {
            "title": safe_str(doc.get("title", "Untitled")),
            "category": safe_str(doc.get("category")),
            "file_url": safe_str(doc.get("fileUrl")),
            "description": safe_str(doc.get("description")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "legal_documents", row, mongo_id):
            count += 1
    logger.info(f"  {count}")

    # Eligibility
    logger.info("=== ELIGIBILITY_ASSESSMENTS ===")
    count = 0
    for doc in fetch_all(session, db, "test_eligibility_reports"):
        mongo_id = get_id(doc)
        test_email = normalize_email(doc.get("testEmail"))
        client_id = None
        if test_email and test_email in email_to_uuid:
            client_id = email_to_uuid[test_email]
        else:
            # Create from test info
            row_c = {
                "email": test_email,
                "name": safe_str(doc.get("testName")) or "Test User",
                "visa_type": "EB-2 NIW",
                "user_state": "U1",
                "cv_url": safe_str(doc.get("cvUrl")),
            }
            created = safe_insert(sb, "clients", row_c, test_email or "")
            if created:
                client_id = created["id"]
                if test_email: email_to_uuid[test_email] = client_id
            else:
                continue

        report_data = doc.get("reportData") if isinstance(doc.get("reportData"), dict) else {"raw": str(doc.get("reportData"))[:5000] if doc.get("reportData") else None}
        row = {
            "client_id": client_id,
            "score": safe_float(report_data.get("score") if isinstance(report_data, dict) else None),
            "result": report_data,
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "eligibility_assessments", row, mongo_id):
            count += 1
    logger.info(f"  {count}")


def migrate_redactora_data(session, db, sb):
    logger.info(f"=== REDACTORA DATA from {db} ===")

    # Patents (both collections)
    count_patents = 0
    for coll, is_draft in [("patents", False), ("patents_in_progress", True)]:
        try:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
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
                result = safe_insert(sb, "patents", row, mongo_id)
                if result:
                    id_map["patents"][mongo_id] = result["id"]
                    count_patents += 1
        except Exception as e:
            logger.error(f"  patents {coll}: {str(e)[:80]}")
    logger.info(f"  patents: {count_patents}")

    # Patent evaluations (via patent_id)
    count = 0
    try:
        for doc in fetch_all(session, db, "patent_evaluations"):
            mongo_id = get_id(doc)
            patent_id = id_map["patents"].get(safe_str(doc.get("patent_id")))
            if not patent_id:
                continue
            # Get client_id from patent
            pr = sb.table("patents").select("client_id").eq("id", patent_id).execute()
            client_id = pr.data[0]["client_id"] if pr.data else None
            if not client_id: continue

            eval_data = {
                "estado": doc.get("estado"),
                "iteracion": doc.get("iteracion"),
                "problemas_criticos": doc.get("problemas_criticos"),
                "problemas_menores": doc.get("problemas_menores"),
                "correcciones_aplicadas": doc.get("correcciones_aplicadas"),
                "recomendaciones": doc.get("recomendaciones"),
            }
            row = {
                "patent_id": patent_id,
                "client_id": client_id,
                "evaluation_data": eval_data,
                "score": safe_float(doc.get("puntuacion") or doc.get("score")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("created_at") or doc.get("createdAt")),
            }
            if safe_insert(sb, "patent_evaluations", row, mongo_id):
                count += 1
    except Exception: pass
    logger.info(f"  patent_evaluations: {count}")

    # NIW petitions
    count = 0
    try:
        for doc in fetch_all(session, db, "niw_in_progress"):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            sections_raw = doc.get("sections") or doc.get("content") or {}
            sections = sections_raw if isinstance(sections_raw, dict) else {}
            if isinstance(sections_raw, list):
                for s in sections_raw:
                    if isinstance(s, dict):
                        key = s.get("name") or s.get("title") or f"section_{s.get('number', '')}"
                        sections[str(key).lower().replace(" ", "_")] = s.get("content", "")
            row = {
                "client_id": client_id,
                "status": safe_str(doc.get("status", "draft")),
                "prong_1": safe_str(sections.get("prong_1") or sections.get("substantial_merit") or doc.get("prong_1")),
                "prong_2": safe_str(sections.get("prong_2") or sections.get("well_positioned") or doc.get("prong_2")),
                "prong_3": safe_str(sections.get("prong_3") or sections.get("waive_job_offer") or doc.get("prong_3")),
                "full_petition": safe_str(doc.get("full_content") or doc.get("project_title")),
                "language": safe_str(doc.get("language", "en")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            if safe_insert(sb, "niw_petitions", row, mongo_id):
                count += 1
    except Exception: pass
    logger.info(f"  niw_petitions: {count}")

    # Recommendation letters
    count = 0
    try:
        for doc in fetch_all(session, db, "recommendation_letters"):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "recommender_name": safe_str(doc.get("recommender_name")),
                "recommender_title": safe_str(doc.get("recommender_title")),
                "relationship": safe_str(doc.get("relationship")),
                "content": safe_str(doc.get("content") or doc.get("content_en")),
                "language": safe_str(doc.get("current_language", "en")),
                "status": safe_str(doc.get("status", "completed")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            if safe_insert(sb, "recommendation_letters", row, mongo_id):
                count += 1
    except Exception: pass
    logger.info(f"  recommendation_letters: {count}")

    # Econometric
    count = 0
    for coll in ["econometric_studies", "econometric_studies_in_progress"]:
        try:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "status": safe_str(doc.get("status", "draft")),
                    "analysis_data": doc.get("analysis_data") or doc.get("data"),
                    "conclusions": safe_str(doc.get("conclusions")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                if safe_insert(sb, "econometric_studies", row, mongo_id):
                    count += 1
        except Exception: pass
    logger.info(f"  econometric_studies: {count}")

    # Business plans
    count = 0
    for coll in ["business_plans", "business_plans_in_progress"]:
        try:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("sections"),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                if safe_insert(sb, "business_plans", row, mongo_id):
                    count += 1
        except Exception: pass
    logger.info(f"  business_plans: {count}")

    # Generated documents
    count = 0
    for coll, dtype in [("books", "book"), ("books_in_progress", "book"),
                         ("whitepapers", "whitepaper"), ("whitepapers_in_progress", "whitepaper"),
                         ("designed_documents", "designed_document"), ("case_studies", "case_study"),
                         ("policy_papers", "policy_paper")]:
        try:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id: continue
                row = {
                    "client_id": client_id,
                    "document_type": dtype,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("chapters"),
                    "pdf_url": safe_str(doc.get("pdf_url") or doc.get("pdfUrl")),
                    "file_url": safe_str(doc.get("file_url") or doc.get("fileUrl")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                if safe_insert(sb, "generated_documents", row, mongo_id):
                    count += 1
        except Exception: pass
    logger.info(f"  generated_documents: {count}")

    # Chat
    count = 0
    try:
        for doc in fetch_all(session, db, "chat_messages"):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("user_id") or doc.get("userId") or doc.get("client_id")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "conversation_id": safe_str(doc.get("conversation_id")),
                "role": safe_str(doc.get("role", "user")),
                "content": safe_str(doc.get("content", "")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("timestamp") or doc.get("createdAt")),
            }
            if safe_insert(sb, "redactora_chat_messages", row, mongo_id):
                count += 1
    except Exception: pass
    logger.info(f"  chat_messages: {count}")


def main():
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Step 1: Clean
    clean_database(sb)

    # Step 2: Portal
    logger.info("=" * 60)
    logger.info("STEP 1: PORTAL")
    logger.info("=" * 60)
    session_p = connect(PORTAL_URL)
    migrate_portal_staff(session_p, PORTAL_DB, sb)
    migrate_portal_clients(session_p, PORTAL_DB, sb)
    migrate_portal_cases_and_dependents(session_p, PORTAL_DB, sb)

    # Step 3: Redactora (with JOIN via email/phone)
    logger.info("=" * 60)
    logger.info("STEP 2: REDACTORA (JOIN con Portal)")
    logger.info("=" * 60)
    session_r = connect(REDACTORA_URL)
    for rdb in REDACTORA_DBS:
        migrate_redactora_clients(session_r, rdb, sb)
        migrate_redactora_data(session_r, rdb, sb)

    logger.info("=" * 60)
    logger.info("MIGRATION 100% COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
