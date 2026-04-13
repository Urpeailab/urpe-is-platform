"""
Migra datos de MongoDB (Monica Redactora) a Supabase.
Ejecutar DESPUES de migrate_mongo_portal.py para que los clientes ya existan.
Lee MongoDB en modo read-only. No modifica la base de origen.

Uso:
  export MONGO_URL=mongodb://...  (MongoDB de Redactora)
  export MONGO_DB_NAME=...
  export SUPABASE_URL=https://...
  export SUPABASE_SERVICE_ROLE_KEY=...
  python migrate_mongo_redactora.py [--dry-run]
"""

import asyncio
import os
import sys
import json
import logging
from datetime import datetime
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DRY_RUN = "--dry-run" in sys.argv


def parse_date(val) -> Optional[str]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


def safe_str(val, max_len=None) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if max_len:
        s = s[:max_len]
    return s if s else None


def safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def get_mongo_id(doc) -> str:
    return str(doc.get("id") or doc.get("_id", ""))


def resolve_client_id(supabase: Client, doc: dict) -> Optional[str]:
    """Find existing client in Supabase by email match, or create new one."""
    email = safe_str(doc.get("email", "")).lower()
    name = safe_str(doc.get("name", ""))
    mongo_id = get_mongo_id(doc)

    if not email and not name:
        return None

    # Try match by email
    if email:
        result = supabase.table("clients").select("id").eq("email", email).execute()
        if result.data:
            return result.data[0]["id"]

    # Try match by mongo_redactora_id (if already migrated)
    result = supabase.table("clients").select("id").eq("mongo_redactora_id", mongo_id).execute()
    if result.data:
        return result.data[0]["id"]

    # Create new client
    row = {
        "email": email if email else None,
        "name": name or "Sin nombre",
        "phone": safe_str(doc.get("phone")),
        "language": safe_str(doc.get("language", "es")),
        "visa_type": "EB-2 NIW",
        "user_state": "U1",
        "mongo_redactora_id": mongo_id,
    }

    if DRY_RUN:
        logger.info(f"  [DRY] Would create client: {email or name}")
        return "dry-run-id"

    try:
        result = supabase.table("clients").insert(row).execute()
        new_id = result.data[0]["id"]
        logger.info(f"  Created new client from Redactora: {email or name} → {new_id}")
        return new_id
    except Exception as e:
        logger.error(f"  Error creating client: {e}")
        return None


# Cache: redactora mongo client id → supabase client id
client_cache = {}


async def get_client_id(supabase: Client, db, client_mongo_id: str) -> Optional[str]:
    """Resolve a Redactora client_id to a Supabase client UUID."""
    if not client_mongo_id:
        return None

    if client_mongo_id in client_cache:
        return client_cache[client_mongo_id]

    # Look up the client document in MongoDB
    client_doc = await db.clients.find_one({"$or": [{"id": client_mongo_id}, {"_id": client_mongo_id}]})
    if not client_doc:
        return None

    sb_id = resolve_client_id(supabase, client_doc)
    if sb_id:
        client_cache[client_mongo_id] = sb_id
    return sb_id


async def migrate_patents(db, supabase: Client) -> int:
    """Migrate patents + patents_in_progress."""
    logger.info("=== Migrating patents ===")
    count = 0

    for col_name in ["patents", "patents_in_progress"]:
        try:
            cursor = db[col_name].find({})
            docs = await cursor.to_list(length=None)
        except Exception:
            continue

        is_draft = col_name == "patents_in_progress"

        for doc in docs:
            mongo_id = get_mongo_id(doc)
            client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))

            if not client_id:
                continue

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
                "metadata": json.dumps({k: v for k, v in doc.items() if k not in ("_id", "id", "client_id", "clientId", "invention_title", "title", "patent_number", "status", "createdAt", "updatedAt") and v is not None}) if not is_draft else None,
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt") or doc.get("created_at")),
            }

            if not DRY_RUN:
                try:
                    supabase.table("patents").insert(row).execute()
                except Exception as e:
                    logger.error(f"  Patent error ({mongo_id}): {e}")
            count += 1

    logger.info(f"  Patents migrated: {count}")
    return count


async def migrate_niw(db, supabase: Client) -> int:
    """Migrate niw_in_progress → niw_petitions."""
    logger.info("=== Migrating NIW petitions ===")
    cursor = db.niw_in_progress.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
        if not client_id:
            continue

        sections = doc.get("sections", {})

        row = {
            "client_id": client_id,
            "status": safe_str(doc.get("status", "draft")),
            "prong_1": safe_str(sections.get("prong_1") or sections.get("substantial_merit")),
            "prong_2": safe_str(sections.get("prong_2") or sections.get("well_positioned")),
            "prong_3": safe_str(sections.get("prong_3") or sections.get("waive_job_offer")),
            "full_petition": safe_str(doc.get("full_content")),
            "language": safe_str(doc.get("language", "en")),
            "model_used": safe_str(doc.get("model_used")),
            "metadata": json.dumps(sections) if sections else None,
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if not DRY_RUN:
            try:
                supabase.table("niw_petitions").insert(row).execute()
            except Exception as e:
                logger.error(f"  NIW error ({mongo_id}): {e}")
        count += 1

    logger.info(f"  NIW petitions migrated: {count}")
    return count


async def migrate_recommendation_letters(db, supabase: Client) -> int:
    """Migrate recommendation_letters."""
    logger.info("=== Migrating recommendation_letters ===")
    cursor = db.recommendation_letters.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
        if not client_id:
            continue

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

        if not DRY_RUN:
            try:
                supabase.table("recommendation_letters").insert(row).execute()
            except Exception as e:
                logger.error(f"  Rec letter error ({mongo_id}): {e}")
        count += 1

    logger.info(f"  Recommendation letters migrated: {count}")
    return count


async def migrate_econometric(db, supabase: Client) -> int:
    """Migrate econometric_studies + econometric_studies_in_progress."""
    logger.info("=== Migrating econometric_studies ===")
    count = 0

    for col_name in ["econometric_studies", "econometric_studies_in_progress"]:
        try:
            cursor = db[col_name].find({})
            docs = await cursor.to_list(length=None)
        except Exception:
            continue

        for doc in docs:
            mongo_id = get_mongo_id(doc)
            client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id:
                continue

            row = {
                "client_id": client_id,
                "status": safe_str(doc.get("status", "draft")),
                "analysis_data": json.dumps(doc.get("analysis_data") or doc.get("data", {})),
                "conclusions": safe_str(doc.get("conclusions")),
                "model_used": safe_str(doc.get("model_used")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }

            if not DRY_RUN:
                try:
                    supabase.table("econometric_studies").insert(row).execute()
                except Exception as e:
                    logger.error(f"  Econometric error ({mongo_id}): {e}")
            count += 1

    logger.info(f"  Econometric studies migrated: {count}")
    return count


async def migrate_business_plans(db, supabase: Client) -> int:
    """Migrate business_plans + business_plans_in_progress."""
    logger.info("=== Migrating business_plans ===")
    count = 0

    for col_name in ["business_plans", "business_plans_in_progress"]:
        try:
            cursor = db[col_name].find({})
            docs = await cursor.to_list(length=None)
        except Exception:
            continue

        for doc in docs:
            mongo_id = get_mongo_id(doc)
            client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id:
                continue

            row = {
                "client_id": client_id,
                "title": safe_str(doc.get("title")),
                "status": safe_str(doc.get("status", "draft")),
                "content": json.dumps(doc.get("content") or doc.get("sections", {})),
                "model_used": safe_str(doc.get("model_used")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }

            if not DRY_RUN:
                try:
                    supabase.table("business_plans").insert(row).execute()
                except Exception as e:
                    logger.error(f"  Business plan error ({mongo_id}): {e}")
            count += 1

    logger.info(f"  Business plans migrated: {count}")
    return count


async def migrate_generated_docs(db, supabase: Client) -> int:
    """Migrate books, whitepapers, designed_documents → generated_documents."""
    logger.info("=== Migrating generated_documents ===")
    count = 0

    type_map = {
        "books": "book",
        "books_in_progress": "book",
        "whitepapers": "whitepaper",
        "whitepapers_in_progress": "whitepaper",
        "designed_documents": "designed_document",
    }

    for col_name, doc_type in type_map.items():
        try:
            cursor = db[col_name].find({})
            docs = await cursor.to_list(length=None)
        except Exception:
            continue

        for doc in docs:
            mongo_id = get_mongo_id(doc)
            client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
            if not client_id:
                continue

            row = {
                "client_id": client_id,
                "document_type": doc_type,
                "title": safe_str(doc.get("title")),
                "status": safe_str(doc.get("status", "draft")),
                "content": json.dumps(doc.get("content") or doc.get("chapters", {})),
                "pdf_url": safe_str(doc.get("pdf_url") or doc.get("pdfUrl")),
                "file_url": safe_str(doc.get("file_url") or doc.get("fileUrl")),
                "model_used": safe_str(doc.get("model_used")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }

            if not DRY_RUN:
                try:
                    supabase.table("generated_documents").insert(row).execute()
                except Exception as e:
                    logger.error(f"  Gen doc error ({mongo_id}): {e}")
            count += 1

    logger.info(f"  Generated documents migrated: {count}")
    return count


async def migrate_chat(db, supabase: Client) -> int:
    """Migrate chat_messages."""
    logger.info("=== Migrating chat_messages ===")
    cursor = db.chat_messages.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        client_id = await get_client_id(supabase, db, safe_str(doc.get("user_id") or doc.get("userId")))
        if not client_id:
            continue

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

        if not DRY_RUN:
            try:
                supabase.table("redactora_chat_messages").insert(row).execute()
            except Exception as e:
                logger.error(f"  Chat error ({mongo_id}): {e}")
        count += 1

    logger.info(f"  Chat messages migrated: {count}")
    return count


async def migrate_patent_evaluations(db, supabase: Client) -> int:
    """Migrate patent_evaluations."""
    logger.info("=== Migrating patent_evaluations ===")
    cursor = db.patent_evaluations.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        client_id = await get_client_id(supabase, db, safe_str(doc.get("client_id") or doc.get("clientId")))
        if not client_id:
            continue

        row = {
            "client_id": client_id,
            "evaluation_data": json.dumps(doc.get("evaluation_data") or doc.get("data", {})),
            "score": safe_float(doc.get("score")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if not DRY_RUN:
            try:
                supabase.table("patent_evaluations").insert(row).execute()
            except Exception as e:
                logger.error(f"  Patent eval error ({mongo_id}): {e}")
        count += 1

    logger.info(f"  Patent evaluations migrated: {count}")
    return count


async def main():
    logger.info("=" * 60)
    logger.info("Monica Redactora — MongoDB → Supabase Migration")
    logger.info(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    logger.info("=" * 60)

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["MONGO_DB_NAME"]
    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client[db_name]

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase: Client = create_client(supabase_url, supabase_key)

    totals = {}
    totals["patents"] = await migrate_patents(db, supabase)
    totals["patent_evaluations"] = await migrate_patent_evaluations(db, supabase)
    totals["niw_petitions"] = await migrate_niw(db, supabase)
    totals["recommendation_letters"] = await migrate_recommendation_letters(db, supabase)
    totals["econometric_studies"] = await migrate_econometric(db, supabase)
    totals["business_plans"] = await migrate_business_plans(db, supabase)
    totals["generated_documents"] = await migrate_generated_docs(db, supabase)
    totals["chat_messages"] = await migrate_chat(db, supabase)

    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)

    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
