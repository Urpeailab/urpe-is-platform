"""
Script de migracion MongoDB → Supabase UIS 2.0
PARA EL PROYECTO: Monica Redactora (domain-relink-test)

Uso:
  python emergent_migrate_redactora.py
  python emergent_migrate_redactora.py --dry-run

Usa MONGO_URL y DB_NAME ya configuradas en Emergent.

IMPORTANTE: Ejecutar DESPUES del Portal (para que los clientes ya existan en Supabase
y la Redactora pueda hacer match por email).
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
    client_cache = {}

    async def resolve_client(client_mongo_id):
        if not client_mongo_id: return None
        if client_mongo_id in client_cache: return client_cache[client_mongo_id]
        try:
            c = await db.clients.find_one({"id": client_mongo_id})
            if not c: c = await db.clients.find_one({"_id": client_mongo_id})
            if not c: return None
            email = safe_str(c.get("email", "")).lower() if c.get("email") else None
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
            logger.error(f"  Resolve client: {str(e)[:100]}")
        return None

    # Patents
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

    # Patent evaluations
    logger.info("=== patent_evaluations ===")
    count = 0
    try:
        async for doc in db.patent_evaluations.find({}):
            mongo_id = get_id(doc)
            client_id = await resolve_client(safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id: continue
            row = {
                "client_id": client_id,
                "evaluation_data": doc.get("evaluation_data") or doc.get("data"),
                "score": safe_float(doc.get("score")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }
            safe_insert(supabase, "patent_evaluations", row, mongo_id)
            count += 1
    except Exception: pass
    totals["patent_evaluations"] = count

    # NIW petitions
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
    except Exception: pass
    totals["niw_petitions"] = count

    # Recommendation letters
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
    except Exception: pass
    totals["recommendation_letters"] = count

    # Econometric studies
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

    # Business plans
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

    # Generated documents
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
                    "file_url": safe_str(doc.get("file_url") or doc.get("fileUrl")),
                    "model_used": safe_str(doc.get("model_used")),
                    "mongo_id": mongo_id,
                    "created_at": parse_date(doc.get("createdAt")),
                }
                safe_insert(supabase, "generated_documents", row, mongo_id)
                count += 1
        except Exception: pass
    totals["generated_documents"] = count

    # Chat messages
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


async def main():
    logger.info("=" * 60)
    logger.info("UIS 2.0 Migration — REDACTORA (domain-relink-test)")
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
