"""
Fix migration gaps: niw_petitions, patent_evaluations, appointments.
Uses direct data from docs without requiring client matching via clients collection.
"""

import requests
import sys
import json
import logging
from datetime import datetime
from typing import Optional
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MV = "https://mongoview.emergent.host/api"
SUPABASE_URL = "https://qtnzrphgmdnwmozovtgh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck"


def connect(url):
    r = requests.post(f"{MV}/connect", json={"production_url": url})
    return r.json()["session_id"]


def fetch_all(session, db, coll):
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


def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s else None


def safe_float(v):
    try: return float(v) if v is not None else None
    except: return None


def parse_date(v):
    if not v: return None
    return str(v)


def get_id(doc):
    return str(doc.get("id") or doc.get("_id", ""))


def safe_insert(sb, table, row, ctx=""):
    try:
        r = sb.table(table).insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return None
        logger.error(f"  {table} ({ctx}): {str(e)[:120]}")
        return None


# Build client cache: mongo_id → supabase_uuid via email and via mongo_portal_id/mongo_redactora_id
def build_client_cache(sb):
    cache_email = {}
    cache_mongo = {}
    # Paginate through all clients
    offset = 0
    while True:
        r = sb.table("clients").select("id,email,mongo_portal_id,mongo_redactora_id").range(offset, offset + 999).execute()
        if not r.data:
            break
        for c in r.data:
            if c.get("email"):
                cache_email[c["email"].lower()] = c["id"]
            if c.get("mongo_portal_id"):
                cache_mongo[c["mongo_portal_id"]] = c["id"]
            if c.get("mongo_redactora_id"):
                cache_mongo[c["mongo_redactora_id"]] = c["id"]
        if len(r.data) < 1000:
            break
        offset += 1000
    logger.info(f"Cache built: {len(cache_email)} emails, {len(cache_mongo)} mongo IDs")
    return cache_email, cache_mongo


def resolve_client_from_doc(doc, cache_email, cache_mongo, sb, session, db):
    """Try multiple strategies to find/create a Supabase client for a doc."""
    # Strategy 1: doc has client_id mongo_id that we know
    for key in ("client_id", "clientId", "user_id", "userId"):
        mid = doc.get(key)
        if mid and str(mid) in cache_mongo:
            return cache_mongo[str(mid)]

    # Strategy 2: fetch from Redactora clients collection and match by email
    client_mongo_id = safe_str(doc.get("client_id") or doc.get("clientId"))
    if client_mongo_id:
        try:
            r = requests.get(f"{MV}/documents/production/{db}/clients",
                             headers={"X-Session-Id": session},
                             params={"filter": json.dumps({"id": client_mongo_id}), "limit": 1},
                             timeout=20)
            docs = r.json().get("documents", [])
            if docs:
                c = docs[0]
                email = (c.get("email") or "").lower().strip()
                if email and email in cache_email:
                    cache_mongo[client_mongo_id] = cache_email[email]
                    return cache_email[email]
                # Create new client
                row = {
                    "email": email or None,
                    "name": safe_str(c.get("name")) or "Sin nombre",
                    "phone": safe_str(c.get("phone")),
                    "language": safe_str(c.get("language", "es")),
                    "visa_type": "EB-2 NIW",
                    "user_state": "U1",
                    "mongo_redactora_id": client_mongo_id,
                }
                result = safe_insert(sb, "clients", row, email or "")
                if result:
                    cache_mongo[client_mongo_id] = result["id"]
                    if email: cache_email[email] = result["id"]
                    return result["id"]
        except Exception as e:
            logger.error(f"  resolve: {str(e)[:80]}")

    # Strategy 3: doc has applicant_name/email directly — search by email in doc
    for key in ("email", "applicant_email", "contact_email"):
        e = safe_str(doc.get(key))
        if e and "@" in e:
            e = e.lower()
            if e in cache_email:
                return cache_email[e]
    return None


def migrate_niw(session, db, sb, cache_email, cache_mongo):
    """Migrate niw_in_progress → niw_petitions."""
    count = 0
    for doc in fetch_all(session, db, "niw_in_progress"):
        mongo_id = get_id(doc)
        client_id = resolve_client_from_doc(doc, cache_email, cache_mongo, sb, session, db)
        if not client_id:
            continue
        sections_raw = doc.get("sections") or doc.get("content") or {}
        sections = sections_raw if isinstance(sections_raw, dict) else {}
        # If sections is a list, convert to dict by section name/number
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
            "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
        }
        if safe_insert(sb, "niw_petitions", row, mongo_id):
            count += 1
    return count


def migrate_patent_evals(session, db, sb, cache_email, cache_mongo):
    count = 0
    for doc in fetch_all(session, db, "patent_evaluations"):
        mongo_id = get_id(doc)
        client_id = resolve_client_from_doc(doc, cache_email, cache_mongo, sb, session, db)
        if not client_id:
            continue
        row = {
            "client_id": client_id,
            "evaluation_data": doc.get("evaluation_data") or doc.get("data") or doc.get("result") or {"raw": True},
            "score": safe_float(doc.get("score") or doc.get("overall_score")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
        }
        if safe_insert(sb, "patent_evaluations", row, mongo_id):
            count += 1
    return count


def migrate_appointments(sb):
    """Fix appointments — use current timestamp for null scheduled_at."""
    # Re-run portal appointments with default scheduled_at
    session = connect("mongodb+srv://urpe-legal:d4g4vaclqs2c73b27te0@customer-apps.pa08s4.mongodb.net/?appName=classic-cases-hub")
    db = "urpe-legal-test_database"
    count = 0
    r = sb.table("clients").select("id,mongo_portal_id").execute()
    client_map = {c["mongo_portal_id"]: c["id"] for c in r.data if c.get("mongo_portal_id")}
    for doc in fetch_all(session, db, "appointments"):
        mongo_id = get_id(doc)
        client_id = client_map.get(safe_str(doc.get("userId") or doc.get("clientId")))
        if not client_id:
            continue
        scheduled = parse_date(doc.get("scheduledAt") or doc.get("date"))
        if not scheduled:
            scheduled = parse_date(doc.get("createdAt")) or datetime.utcnow().isoformat()
        row = {
            "client_id": client_id,
            "title": safe_str(doc.get("title", "Sin titulo")),
            "scheduled_at": scheduled,
            "duration_minutes": int(doc.get("duration", 30)) if doc.get("duration") else 30,
            "status": safe_str(doc.get("status", "scheduled")),
            "notes": safe_str(doc.get("notes")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "appointments", row, mongo_id):
            count += 1
    return count


def migrate_eligibility(sb):
    session = connect("mongodb+srv://urpe-legal:d4g4vaclqs2c73b27te0@customer-apps.pa08s4.mongodb.net/?appName=classic-cases-hub")
    db = "urpe-legal-test_database"
    count = 0
    # Build email lookup too since eligibility reports may only have email, not userId
    r = sb.table("clients").select("id,email,mongo_portal_id").range(0, 9999).execute()
    client_by_mongo = {c["mongo_portal_id"]: c["id"] for c in r.data if c.get("mongo_portal_id")}
    client_by_email = {c["email"].lower(): c["id"] for c in r.data if c.get("email")}

    for doc in fetch_all(session, db, "test_eligibility_reports"):
        mongo_id = get_id(doc)
        # Try multiple ways to find client
        client_id = client_by_mongo.get(safe_str(doc.get("userId") or doc.get("clientId")))
        if not client_id:
            email = safe_str(doc.get("email") or doc.get("userEmail"))
            if email:
                client_id = client_by_email.get(email.lower())
        if not client_id:
            continue
        result_val = doc.get("result") or doc.get("report") or doc.get("data")
        if not isinstance(result_val, dict):
            result_val = {"raw": str(result_val)[:5000] if result_val else None}
        row = {
            "client_id": client_id,
            "score": safe_float(doc.get("score") or doc.get("overall_score")),
            "result": result_val,
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "eligibility_assessments", row, mongo_id):
            count += 1
    return count


def main():
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    logger.info("=== Building client cache ===")
    cache_email, cache_mongo = build_client_cache(sb)

    # Fix appointments + eligibility (portal)
    logger.info("=== Fixing appointments ===")
    n = migrate_appointments(sb)
    logger.info(f"  Added {n} appointments")

    logger.info("=== Fixing eligibility_assessments ===")
    n = migrate_eligibility(sb)
    logger.info(f"  Added {n} eligibility_assessments")

    # Fix niw + patent_evaluations for both redactora databases
    for mongo_db in ["domain-relink-test-monica_db", "domain-relink-test-test_database"]:
        logger.info(f"=== Redactora: {mongo_db} ===")
        session = connect("mongodb+srv://domain-relink-test:d75v7eclqs2c738tundg@customer-apps.jdl9pi.mongodb.net/?appName=domain-relink-test")

        logger.info(f"  Fixing niw_petitions from {mongo_db}")
        n = migrate_niw(session, mongo_db, sb, cache_email, cache_mongo)
        logger.info(f"    Added {n} niw_petitions")

        logger.info(f"  Fixing patent_evaluations from {mongo_db}")
        n = migrate_patent_evals(session, mongo_db, sb, cache_email, cache_mongo)
        logger.info(f"    Added {n} patent_evaluations")


if __name__ == "__main__":
    main()
