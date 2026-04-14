"""
Last cleanup pass for Redactora — for any document with client_id not in Supabase,
look up the client in Redactora's clients collection and create a placeholder.
Then re-migrate missing patents, niw, etc.
"""

import requests
import sys
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
        if not docs: break
        for d in docs: yield d
        if not data.get("has_next"): break
        skip += len(docs)


def fetch_one(session, db, coll, doc_id):
    """Fetch single doc by id."""
    import json
    r = requests.get(f"{MV}/documents/production/{db}/{coll}",
                     headers={"X-Session-Id": session},
                     params={"filter": json.dumps({"id": doc_id}), "limit": 1}, timeout=30)
    docs = r.json().get("documents", [])
    return docs[0] if docs else None


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
        err = str(e).lower()
        if "duplicate" in err or "unique" in err:
            return None
        logger.error(f"  {table} ({ctx}): {str(e)[:120]}")
        return None


def main():
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Build client cache
    r = sb.table("clients").select("id,email,phone,mongo_redactora_id").range(0, 9999).execute()
    cache_mongo = {c["mongo_redactora_id"]: c["id"] for c in r.data if c.get("mongo_redactora_id")}
    cache_email = {c["email"].lower(): c["id"] for c in r.data if c.get("email")}

    # Also add portal clients
    r = sb.table("clients").select("id,mongo_portal_id").range(0, 9999).execute()
    for c in r.data:
        if c.get("mongo_portal_id"):
            cache_mongo[c["mongo_portal_id"]] = c["id"]

    logger.info(f"Cache: {len(cache_mongo)} mongo_ids, {len(cache_email)} emails")

    session = connect("mongodb+srv://domain-relink-test:d75v7eclqs2c738tundg@customer-apps.jdl9pi.mongodb.net/?appName=domain-relink-test")

    # For each Redactora DB, process each collection
    for db in ["domain-relink-test-monica_db", "domain-relink-test-test_database"]:
        logger.info(f"\n=== Processing {db} ===")

        def resolve_or_create(client_mongo_id):
            """Look up client_id in cache or create placeholder from Redactora's clients."""
            if not client_mongo_id:
                return None
            if client_mongo_id in cache_mongo:
                return cache_mongo[client_mongo_id]
            # Fetch from Redactora's clients collection
            c = fetch_one(session, db, "clients", client_mongo_id)
            if c:
                email = (c.get("email") or "").lower().strip() or None
                if email and email in cache_email:
                    cache_mongo[client_mongo_id] = cache_email[email]
                    # Link in DB
                    sb.table("clients").update({"mongo_redactora_id": client_mongo_id}).eq("id", cache_email[email]).execute()
                    return cache_email[email]
                # Create new
                row = {
                    "email": email,
                    "name": safe_str(c.get("name")) or f"Redactora-{client_mongo_id[:8]}",
                    "phone": safe_str(c.get("phone")),
                    "visa_type": "EB-2 NIW",
                    "user_state": "U1",
                    "mongo_redactora_id": client_mongo_id,
                }
                result = safe_insert(sb, "clients", row, email or client_mongo_id[:8])
                if result:
                    cache_mongo[client_mongo_id] = result["id"]
                    if email: cache_email[email] = result["id"]
                    return result["id"]
            else:
                # No client record — create minimal placeholder
                row = {
                    "email": None,
                    "name": f"Redactora-{client_mongo_id[:8]}",
                    "visa_type": "EB-2 NIW",
                    "user_state": "U1",
                    "mongo_redactora_id": client_mongo_id,
                }
                result = safe_insert(sb, "clients", row, client_mongo_id[:8])
                if result:
                    cache_mongo[client_mongo_id] = result["id"]
                    return result["id"]
            return None

        # Re-process patents
        logger.info("  patents cleanup")
        added = 0
        for coll, is_draft in [("patents", False), ("patents_in_progress", True)]:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                # Check if already in Supabase
                existing = sb.table("patents").select("id").eq("mongo_id", mongo_id).execute()
                if existing.data:
                    continue
                client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
                if not client_id:
                    continue
                row = {
                    "client_id": client_id,
                    "title": safe_str(doc.get("invention_title") or doc.get("title")),
                    "patent_number": safe_str(doc.get("patent_number")),
                    "application_number": safe_str(doc.get("application_number")),
                    "patent_status": "draft" if is_draft else safe_str(doc.get("status", "completed")),
                    "inventors": safe_str(doc.get("inventor_name") or doc.get("inventors")),
                    "abstract": safe_str(doc.get("abstract")),
                    "description": safe_str(doc.get("specification_content") or doc.get("invention_description")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
                }
                if safe_insert(sb, "patents", row, mongo_id):
                    added += 1
        logger.info(f"    +{added} patents")

        # patent_evaluations (via patent_id)
        logger.info("  patent_evaluations cleanup")
        added = 0
        pr = sb.table("patents").select("id,mongo_id,client_id").range(0, 9999).execute()
        patent_map = {p["mongo_id"]: (p["id"], p["client_id"]) for p in pr.data if p.get("mongo_id")}
        for doc in fetch_all(session, db, "patent_evaluations"):
            mongo_id = get_id(doc)
            existing = sb.table("patent_evaluations").select("id").eq("mongo_id", mongo_id).execute()
            if existing.data: continue
            patent_mongo = safe_str(doc.get("patent_id"))
            if patent_mongo not in patent_map: continue
            pid, cid = patent_map[patent_mongo]
            row = {
                "patent_id": pid,
                "client_id": cid,
                "evaluation_data": {
                    "estado": doc.get("estado"),
                    "iteracion": doc.get("iteracion"),
                    "problemas_criticos": doc.get("problemas_criticos"),
                    "problemas_menores": doc.get("problemas_menores"),
                    "correcciones_aplicadas": doc.get("correcciones_aplicadas"),
                    "recomendaciones": doc.get("recomendaciones"),
                },
                "score": safe_float(doc.get("puntuacion") or doc.get("score")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("created_at") or doc.get("createdAt")),
            }
            if safe_insert(sb, "patent_evaluations", row, mongo_id):
                added += 1
        logger.info(f"    +{added} patent_evaluations")

        # NIW
        logger.info("  niw_petitions cleanup")
        added = 0
        for doc in fetch_all(session, db, "niw_in_progress"):
            mongo_id = get_id(doc)
            existing = sb.table("niw_petitions").select("id").eq("mongo_id", mongo_id).execute()
            if existing.data: continue
            client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            sections_raw = doc.get("sections") or doc.get("content") or {}
            sections = sections_raw if isinstance(sections_raw, dict) else {}
            if isinstance(sections_raw, list):
                for s in sections_raw:
                    if isinstance(s, dict):
                        key = s.get("name") or s.get("title") or f"s_{s.get('number', '')}"
                        sections[str(key).lower().replace(" ", "_")] = s.get("content", "")
            row = {
                "client_id": client_id,
                "status": safe_str(doc.get("status", "draft")),
                "prong_1": safe_str(sections.get("prong_1") or sections.get("substantial_merit")),
                "prong_2": safe_str(sections.get("prong_2") or sections.get("well_positioned")),
                "prong_3": safe_str(sections.get("prong_3") or sections.get("waive_job_offer")),
                "full_petition": safe_str(doc.get("full_content") or doc.get("project_title")),
                "language": safe_str(doc.get("language", "en")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            if safe_insert(sb, "niw_petitions", row, mongo_id):
                added += 1
        logger.info(f"    +{added} niw_petitions")

        # Recommendation letters
        logger.info("  recommendation_letters cleanup")
        added = 0
        for doc in fetch_all(session, db, "recommendation_letters"):
            mongo_id = get_id(doc)
            existing = sb.table("recommendation_letters").select("id").eq("mongo_id", mongo_id).execute()
            if existing.data: continue
            client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
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
                added += 1
        logger.info(f"    +{added} recommendation_letters")

        # Econometric
        logger.info("  econometric_studies cleanup")
        added = 0
        for coll in ["econometric_studies", "econometric_studies_in_progress"]:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                existing = sb.table("econometric_studies").select("id").eq("mongo_id", mongo_id).execute()
                if existing.data: continue
                client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
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
                    added += 1
        logger.info(f"    +{added} econometric_studies")

        # Business plans
        logger.info("  business_plans cleanup")
        added = 0
        for coll in ["business_plans", "business_plans_in_progress"]:
            for doc in fetch_all(session, db, coll):
                mongo_id = get_id(doc)
                existing = sb.table("business_plans").select("id").eq("mongo_id", mongo_id).execute()
                if existing.data: continue
                client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
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
                    added += 1
        logger.info(f"    +{added} business_plans")

        # Generated documents
        logger.info("  generated_documents cleanup")
        added = 0
        for coll, dtype in [("books", "book"), ("books_in_progress", "book"),
                            ("whitepapers", "whitepaper"), ("whitepapers_in_progress", "whitepaper"),
                            ("designed_documents", "designed_document"),
                            ("case_studies", "case_study"), ("policy_papers", "policy_paper"),
                            ("self_petition_letters", "self_petition_letter"),
                            ("expert_letters", "expert_letter")]:
            try:
                for doc in fetch_all(session, db, coll):
                    mongo_id = get_id(doc)
                    existing = sb.table("generated_documents").select("id").eq("mongo_id", mongo_id).execute()
                    if existing.data: continue
                    client_id = resolve_or_create(safe_str(doc.get("client_id") or doc.get("clientId")))
                    if not client_id: continue
                    row = {
                        "client_id": client_id,
                        "document_type": dtype,
                        "title": safe_str(doc.get("title")),
                        "status": safe_str(doc.get("status", "draft")),
                        "content": doc.get("content") or doc.get("chapters"),
                        "pdf_url": safe_str(doc.get("pdf_url")),
                        "file_url": safe_str(doc.get("file_url")),
                        "mongo_id": mongo_id,
                        "created_at": parse_date(doc.get("createdAt")),
                    }
                    if safe_insert(sb, "generated_documents", row, mongo_id):
                        added += 1
            except Exception: pass
        logger.info(f"    +{added} generated_documents")

        # Chat messages
        logger.info("  chat_messages cleanup")
        added = 0
        for doc in fetch_all(session, db, "chat_messages"):
            mongo_id = get_id(doc)
            existing = sb.table("redactora_chat_messages").select("id").eq("mongo_id", mongo_id).execute()
            if existing.data: continue
            client_id = resolve_or_create(safe_str(doc.get("user_id") or doc.get("userId") or doc.get("client_id")))
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
                added += 1
        logger.info(f"    +{added} chat_messages")


if __name__ == "__main__":
    main()
