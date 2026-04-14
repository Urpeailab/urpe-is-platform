"""
Final gap fixes:
- eligibility_assessments: use testName/testEmail/reportData from test_eligibility_reports
- patent_evaluations: link via patent_id (not client_id) to already-migrated patents
"""

import requests
import sys
import json
import logging
from datetime import datetime
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MV = "https://mongoview.emergent.host/api"
SUPABASE_URL = "https://qtnzrphgmdnwmozovtgh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnpycGhnbWRud21vem92dGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyMTMwMiwiZXhwIjoyMDkxNjk3MzAyfQ.jcOccSQ-gzwRVAZjNUIQZuI0bNi4yyr2tgjinWjkmck"


def connect(url):
    return requests.post(f"{MV}/connect", json={"production_url": url}).json()["session_id"]


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


def safe_insert(sb, table, row, ctx=""):
    try:
        r = sb.table(table).insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        if "duplicate" in str(e).lower():
            return None
        logger.error(f"  {table} ({ctx}): {str(e)[:120]}")
        return None


def main():
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Build client email → id cache
    logger.info("Building client cache...")
    r = sb.table("clients").select("id,email").range(0, 9999).execute()
    cache_email = {c["email"].lower(): c["id"] for c in r.data if c.get("email")}

    # Build patents mongo_id → supabase_uuid cache
    r = sb.table("patents").select("id,mongo_id").range(0, 9999).execute()
    cache_patents = {p["mongo_id"]: p["id"] for p in r.data if p.get("mongo_id")}
    logger.info(f"  {len(cache_email)} emails, {len(cache_patents)} patents cached")

    # === Fix eligibility_assessments ===
    logger.info("=== Fixing eligibility_assessments ===")
    session = connect("mongodb+srv://urpe-legal:d4g4vaclqs2c73b27te0@customer-apps.pa08s4.mongodb.net/?appName=classic-cases-hub")
    count = 0
    for doc in fetch_all(session, "urpe-legal-test_database", "test_eligibility_reports"):
        mongo_id = str(doc.get("id") or doc.get("_id", ""))
        test_email = safe_str(doc.get("testEmail"))
        if not test_email:
            continue
        client_id = cache_email.get(test_email.lower())
        if not client_id:
            # Create client from test data
            row = {
                "email": test_email.lower(),
                "name": safe_str(doc.get("testName")) or "Test User",
                "phone": None,
                "language": "es",
                "visa_type": "EB-2 NIW",
                "user_state": "U1",
                "cv_url": safe_str(doc.get("cvUrl")),
            }
            created = safe_insert(sb, "clients", row, test_email)
            if created:
                client_id = created["id"]
                cache_email[test_email.lower()] = client_id
            else:
                continue

        report_data = doc.get("reportData") if isinstance(doc.get("reportData"), dict) else {"raw": str(doc.get("reportData"))[:2000] if doc.get("reportData") else None}
        row = {
            "client_id": client_id,
            "score": safe_float(report_data.get("score") if isinstance(report_data, dict) else None),
            "result": report_data,
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if safe_insert(sb, "eligibility_assessments", row, mongo_id):
            count += 1
    logger.info(f"  Added {count} eligibility_assessments")

    # === Fix patent_evaluations via patent_id ===
    logger.info("=== Fixing patent_evaluations ===")
    session = connect("mongodb+srv://domain-relink-test:d75v7eclqs2c738tundg@customer-apps.jdl9pi.mongodb.net/?appName=domain-relink-test")
    total_count = 0
    for mongo_db in ["domain-relink-test-monica_db", "domain-relink-test-test_database"]:
        count = 0
        for doc in fetch_all(session, mongo_db, "patent_evaluations"):
            mongo_id = str(doc.get("id") or doc.get("_id", ""))
            patent_mongo_id = safe_str(doc.get("patent_id"))
            if not patent_mongo_id:
                continue
            patent_id = cache_patents.get(patent_mongo_id)
            if not patent_id:
                continue
            # Get client_id from the patent
            try:
                pr = sb.table("patents").select("client_id").eq("id", patent_id).execute()
                client_id = pr.data[0]["client_id"] if pr.data else None
            except Exception:
                client_id = None
            if not client_id:
                continue

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
                "score": safe_float(doc.get("puntuacion")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("created_at") or doc.get("createdAt")),
            }
            if safe_insert(sb, "patent_evaluations", row, mongo_id):
                count += 1
        logger.info(f"  {mongo_db}: {count}")
        total_count += count
    logger.info(f"  Total patent_evaluations added: {total_count}")


if __name__ == "__main__":
    main()
