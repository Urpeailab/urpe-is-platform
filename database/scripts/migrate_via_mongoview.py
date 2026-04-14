"""
Migra datos MongoDB → Supabase usando la API de mongoview.emergent.host.
No requiere acceso directo a MongoDB Atlas (por IP whitelist).

Uso:
  python migrate_via_mongoview.py portal
  python migrate_via_mongoview.py redactora
  python migrate_via_mongoview.py portal --dry-run
"""

import requests
import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, Optional, List
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MONGOVIEW_URL = "https://mongoview.emergent.host/api"

SUPABASE_URL = "https://qtnzrphgmdnwmozovtgh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck"

PORTAL_URL = "mongodb+srv://urpe-legal:d4g4vaclqs2c73b27te0@customer-apps.pa08s4.mongodb.net/?appName=classic-cases-hub&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority"
PORTAL_DB = "urpe-legal-test_database"

REDACTORA_URL = "mongodb+srv://domain-relink-test:d75v7eclqs2c738tundg@customer-apps.jdl9pi.mongodb.net/?appName=domain-relink-test&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority"
REDACTORA_DB = None  # Discover after connecting

DRY_RUN = "--dry-run" in sys.argv

id_map: Dict[str, Dict[str, str]] = {
    "clients": {}, "staff": {}, "visa_cases": {}, "visa_stages": {},
}


def connect(mongo_url: str) -> str:
    """Connect via mongoview and return session_id."""
    r = requests.post(f"{MONGOVIEW_URL}/connect", json={"production_url": mongo_url})
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"Connect failed: {data}")
    logger.info(f"Connected: {data['connections']['production']}")
    return data["session_id"]


def list_databases(session: str) -> List[dict]:
    r = requests.get(f"{MONGOVIEW_URL}/databases/production", headers={"X-Session-Id": session})
    r.raise_for_status()
    return r.json()["databases"]


def list_collections(session: str, db_name: str) -> List[dict]:
    r = requests.get(f"{MONGOVIEW_URL}/collections/production/{db_name}", headers={"X-Session-Id": session})
    r.raise_for_status()
    return r.json()["collections"]


def fetch_documents(session: str, db: str, collection: str, limit: int = 500, skip: int = 0) -> dict:
    r = requests.get(
        f"{MONGOVIEW_URL}/documents/production/{db}/{collection}",
        headers={"X-Session-Id": session},
        params={"limit": limit, "skip": skip},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def fetch_all_documents(session: str, db: str, collection: str, batch_size: int = 500):
    """Generator that yields all documents in a collection."""
    skip = 0
    while True:
        data = fetch_documents(session, db, collection, limit=batch_size, skip=skip)
        docs = data.get("documents", [])
        if not docs:
            break
        for doc in docs:
            yield doc
        if not data.get("has_next"):
            break
        skip += len(docs)


def parse_date(val) -> Optional[str]:
    if not val:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


def safe_str(val) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def get_id(doc) -> str:
    return str(doc.get("id") or doc.get("_id", ""))


def safe_insert(supabase: Client, table: str, row: dict, context: str = "") -> Optional[dict]:
    if DRY_RUN:
        return {"id": "dry-run"}
    try:
        result = supabase.table(table).insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "unique" in err:
            return None
        logger.error(f"  Insert {table} ({context}): {str(e)[:150]}")
        return None


def migrate_portal(session: str, db: str, supabase: Client) -> dict:
    totals = {}

    # Staff
    logger.info("=== staff ===")
    count = 0
    for doc in fetch_all_documents(session, db, "staff"):
        mongo_id = get_id(doc)
        email_raw = doc.get("email", "")
        email = email_raw.lower().strip() if isinstance(email_raw, str) and email_raw else None
        if not email:
            continue
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
        if result:
            id_map["staff"][mongo_id] = result["id"]
        else:
            try:
                existing = supabase.table("staff").select("id").eq("email", email).execute()
                if existing.data:
                    id_map["staff"][mongo_id] = existing.data[0]["id"]
            except Exception:
                pass
        count += 1
    totals["staff"] = count
    logger.info(f"  Migrated {count} staff")

    # Clients (from users)
    logger.info("=== clients ===")
    count = 0
    for doc in fetch_all_documents(session, db, "users"):
        mongo_id = get_id(doc)
        email_raw = doc.get("email", "")
        email = email_raw.lower().strip() if isinstance(email_raw, str) and email_raw else None
        if not email:
            continue
        row = {
            "email": email,
            "phone": safe_str(doc.get("phone")),
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
            "advisor_id": id_map["staff"].get(safe_str(doc.get("advisorId"))),
            "mongo_portal_id": mongo_id,
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
            except Exception:
                pass
        count += 1
        if count % 100 == 0:
            logger.info(f"  ... {count} clients processed")
    totals["clients"] = count
    logger.info(f"  Migrated {count} clients")

    # Visa cases
    logger.info("=== visa_cases ===")
    count = 0
    for doc in fetch_all_documents(session, db, "visa_cases"):
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
        result = safe_insert(supabase, "visa_cases", row, mongo_id)
        if result:
            id_map["visa_cases"][mongo_id] = result["id"]
        count += 1
        if count % 100 == 0:
            logger.info(f"  ... {count} visa_cases processed")
    totals["visa_cases"] = count

    # Visa stages
    logger.info("=== visa_stages ===")
    count = 0
    for doc in fetch_all_documents(session, db, "visa_stages"):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id:
            continue
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
        if result:
            id_map["visa_stages"][mongo_id] = result["id"]
        count += 1
        if count % 500 == 0:
            logger.info(f"  ... {count} visa_stages processed")
    totals["visa_stages"] = count

    # Visa deliverables
    logger.info("=== visa_deliverables ===")
    count = 0
    for doc in fetch_all_documents(session, db, "visa_deliverables"):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id:
            continue
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
        if count % 1000 == 0:
            logger.info(f"  ... {count} deliverables processed")
    totals["visa_deliverables"] = count

    # Visa documents
    logger.info("=== visa_documents ===")
    count = 0
    for doc in fetch_all_documents(session, db, "visa_client_documents"):
        mongo_id = get_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        if not case_id:
            continue
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
        if count % 1000 == 0:
            logger.info(f"  ... {count} documents processed")
    totals["visa_documents"] = count

    # Payments
    logger.info("=== payments ===")
    count = 0
    for col_name in ["manual_payments", "visa_payments", "payment_transactions"]:
        try:
            for doc in fetch_all_documents(session, db, col_name):
                mongo_id = get_id(doc)
                client_id = id_map["clients"].get(safe_str(doc.get("userId")))
                if not client_id:
                    continue
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
        except Exception as e:
            logger.error(f"  {col_name}: {str(e)[:100]}")
    totals["payments"] = count

    # Appointments
    logger.info("=== appointments ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "appointments"):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("userId") or doc.get("clientId")))
            if not client_id:
                continue
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
    except Exception as e:
        logger.error(f"  {str(e)[:100]}")
    totals["appointments"] = count

    # Leads
    logger.info("=== leads ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "leads"):
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
    except Exception:
        pass
    totals["leads"] = count

    # Case notes
    logger.info("=== case_notes ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "case_notes"):
            mongo_id = get_id(doc)
            case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
            if not case_id:
                continue
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
    except Exception:
        pass
    totals["case_notes"] = count

    # Legal documents
    logger.info("=== legal_documents ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "legal_documents"):
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
    except Exception:
        pass
    totals["legal_documents"] = count

    # Eligibility assessments (from test_eligibility_reports)
    logger.info("=== eligibility_assessments ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "test_eligibility_reports"):
            mongo_id = get_id(doc)
            client_id = id_map["clients"].get(safe_str(doc.get("userId")))
            if not client_id:
                continue
            row = {
                "client_id": client_id,
                "score": safe_float(doc.get("score")),
                "result": doc.get("result") if isinstance(doc.get("result"), dict) else None,
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "eligibility_assessments", row, mongo_id)
            count += 1
    except Exception:
        pass
    totals["eligibility_assessments"] = count

    return totals


def migrate_redactora(session: str, db: str, supabase: Client) -> dict:
    totals = {}
    client_cache = {}

    def resolve_client(client_mongo_id: str) -> Optional[str]:
        if not client_mongo_id:
            return None
        if client_mongo_id in client_cache:
            return client_cache[client_mongo_id]
        try:
            # Lookup in Redactora clients collection
            r = requests.get(
                f"{MONGOVIEW_URL}/documents/production/{db}/clients",
                headers={"X-Session-Id": session},
                params={"filter": json.dumps({"id": client_mongo_id}), "limit": 1},
                timeout=30,
            )
            r.raise_for_status()
            docs = r.json().get("documents", [])
            if not docs:
                return None
            c = docs[0]
            email_raw = c.get("email", "")
            email = email_raw.lower().strip() if isinstance(email_raw, str) and email_raw else None
            if email:
                existing = supabase.table("clients").select("id").eq("email", email).execute()
                if existing.data:
                    client_cache[client_mongo_id] = existing.data[0]["id"]
                    return existing.data[0]["id"]
            row = {
                "email": email,
                "name": safe_str(c.get("name", "")) or "Sin nombre",
                "phone": safe_str(c.get("phone")),
                "language": safe_str(c.get("language", "es")),
                "visa_type": "EB-2 NIW",
                "user_state": "U1",
                "mongo_redactora_id": client_mongo_id,
            }
            result = safe_insert(supabase, "clients", row, email or "")
            if result:
                client_cache[client_mongo_id] = result["id"]
                return result["id"]
        except Exception as e:
            logger.error(f"  Resolve: {str(e)[:100]}")
        return None

    for col_name, patent_status_draft in [("patents", False), ("patents_in_progress", True)]:
        logger.info(f"=== patents ({col_name}) ===")
        count = 0
        try:
            for doc in fetch_all_documents(session, db, col_name):
                mongo_id = get_id(doc)
                client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id:
                    continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("invention_title") or doc.get("title")),
                    "patent_number": safe_str(doc.get("patent_number")),
                    "application_number": safe_str(doc.get("application_number")),
                    "filing_date": safe_str(doc.get("filing_date")),
                    "patent_status": "draft" if patent_status_draft else safe_str(doc.get("status", "completed")),
                    "inventors": safe_str(doc.get("inventor_name") or doc.get("inventors")),
                    "abstract": safe_str(doc.get("abstract")),
                    "description": safe_str(doc.get("specification_content")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
                }
                safe_insert(supabase, "patents", row, mongo_id)
                count += 1
        except Exception as e:
            logger.error(f"  {col_name}: {str(e)[:100]}")
        totals[f"patents_{col_name}"] = count

    logger.info("=== niw_petitions ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "niw_in_progress"):
            mongo_id = get_id(doc)
            client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id:
                continue
            sections = doc.get("sections", {}) or {}
            row = {
                "client_id": client_id,
                "status": safe_str(doc.get("status", "draft")),
                "prong_1": safe_str(sections.get("prong_1") or sections.get("substantial_merit")),
                "prong_2": safe_str(sections.get("prong_2") or sections.get("well_positioned")),
                "prong_3": safe_str(sections.get("prong_3") or sections.get("waive_job_offer")),
                "full_petition": safe_str(doc.get("full_content")),
                "language": safe_str(doc.get("language", "en")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "niw_petitions", row, mongo_id)
            count += 1
    except Exception:
        pass
    totals["niw_petitions"] = count

    logger.info("=== recommendation_letters ===")
    count = 0
    try:
        for doc in fetch_all_documents(session, db, "recommendation_letters"):
            mongo_id = get_id(doc)
            client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id:
                continue
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
            safe_insert(supabase, "recommendation_letters", row, mongo_id)
            count += 1
    except Exception:
        pass
    totals["recommendation_letters"] = count

    for col in ["econometric_studies", "econometric_studies_in_progress"]:
        try:
            for doc in fetch_all_documents(session, db, col):
                mongo_id = get_id(doc)
                client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id:
                    continue
                row = {
                    "client_id": client_id,
                    "status": safe_str(doc.get("status", "draft")),
                    "analysis_data": doc.get("analysis_data") or doc.get("data"),
                    "conclusions": safe_str(doc.get("conclusions")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "econometric_studies", row, mongo_id)
        except Exception:
            pass

    for col in ["business_plans", "business_plans_in_progress"]:
        try:
            for doc in fetch_all_documents(session, db, col):
                mongo_id = get_id(doc)
                client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id:
                    continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("sections"),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "business_plans", row, mongo_id)
        except Exception:
            pass

    type_map = {"books": "book", "books_in_progress": "book", "whitepapers": "whitepaper",
                "whitepapers_in_progress": "whitepaper", "designed_documents": "designed_document"}
    for col, doc_type in type_map.items():
        try:
            for doc in fetch_all_documents(session, db, col):
                mongo_id = get_id(doc)
                client_id = resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id:
                    continue
                row = {
                    "client_id": client_id,
                    "document_type": doc_type,
                    "title": safe_str(doc.get("title")),
                    "status": safe_str(doc.get("status", "draft")),
                    "content": doc.get("content") or doc.get("chapters"),
                    "pdf_url": safe_str(doc.get("pdf_url") or doc.get("pdfUrl")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "generated_documents", row, mongo_id)
        except Exception:
            pass

    try:
        for doc in fetch_all_documents(session, db, "chat_messages"):
            mongo_id = get_id(doc)
            client_id = resolve_client(safe_str(doc.get("user_id") or doc.get("userId")))
            if not client_id:
                continue
            row = {
                "client_id": client_id,
                "conversation_id": safe_str(doc.get("conversation_id")),
                "role": safe_str(doc.get("role", "user")),
                "content": safe_str(doc.get("content", "")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("timestamp") or doc.get("createdAt")),
            }
            safe_insert(supabase, "redactora_chat_messages", row, mongo_id)
    except Exception:
        pass

    return totals


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("portal", "redactora"):
        print("Usage: python migrate_via_mongoview.py <portal|redactora> [--dry-run]")
        sys.exit(1)
    app_type = sys.argv[1]

    logger.info("=" * 60)
    logger.info(f"UIS 2.0 Migration via mongoview — {app_type.upper()}")
    logger.info(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    logger.info("=" * 60)

    if app_type == "portal":
        mongo_url = PORTAL_URL
        db_name = PORTAL_DB
    else:
        mongo_url = REDACTORA_URL
        # Allow --db override via CLI arg
        db_name = None
        for arg in sys.argv[2:]:
            if arg.startswith("--db="):
                db_name = arg.split("=", 1)[1]

    session = connect(mongo_url)
    logger.info(f"Session: {session}")

    if not db_name:
        dbs = list_databases(session)
        logger.info(f"Databases: {[d['name'] for d in dbs]}")
        # Pick biggest one
        dbs.sort(key=lambda d: d.get("collection_count", 0), reverse=True)
        db_name = dbs[0]["name"]
        logger.info(f"Selected database: {db_name}")

    logger.info(f"MongoDB DB: {db_name}")
    logger.info(f"Supabase: {SUPABASE_URL}")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if app_type == "portal":
        totals = migrate_portal(session, db_name, supabase)
    else:
        totals = migrate_redactora(session, db_name, supabase)

    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
