"""
Migra datos de MongoDB (UIS Portal) a Supabase.
Lee MongoDB en modo read-only. No modifica la base de origen.

Uso:
  export MONGO_URL=mongodb://...
  export MONGO_DB_NAME=...
  export SUPABASE_URL=https://...
  export SUPABASE_SERVICE_ROLE_KEY=...
  python migrate_mongo_portal.py [--dry-run]
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

DRY_RUN = "--dry-run" in sys.argv

# ID mapping: mongo_id → supabase_uuid
id_map: Dict[str, Dict[str, str]] = {
    "clients": {},
    "staff": {},
    "visa_cases": {},
    "visa_stages": {},
}


def parse_date(val) -> Optional[str]:
    """Normalize date values from MongoDB to ISO format."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, str):
        return val
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


def safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def get_mongo_id(doc) -> str:
    """Get the string ID from a MongoDB document."""
    return str(doc.get("id") or doc.get("_id", ""))


async def migrate_staff(db, supabase: Client) -> int:
    """Migrate staff collection."""
    logger.info("=== Migrating staff ===")
    cursor = db.staff.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        row = {
            "email": safe_str(doc.get("email", "")).lower(),
            "name": safe_str(doc.get("name", "Unknown")),
            "role": safe_str(doc.get("role", "asesor")),
            "password_hash": safe_str(doc.get("password")),
            "phone": safe_str(doc.get("phone")),
            "is_active": doc.get("isActive", True),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if DRY_RUN:
            logger.info(f"  [DRY] staff: {row['email']}")
        else:
            result = supabase.table("staff").insert(row).execute()
            new_id = result.data[0]["id"]
            id_map["staff"][mongo_id] = new_id
        count += 1

    logger.info(f"  Staff migrated: {count}")
    return count


async def migrate_clients(db, supabase: Client) -> int:
    """Migrate users collection to clients table."""
    logger.info("=== Migrating clients (from users) ===")
    cursor = db.users.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    skipped = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        email = safe_str(doc.get("email", "")).lower()

        # Skip if no email (can't deduplicate without it)
        if not email:
            skipped += 1
            continue

        # Check for advisor mapping
        advisor_mongo_id = safe_str(doc.get("advisorId"))
        advisor_id = id_map["staff"].get(advisor_mongo_id) if advisor_mongo_id else None

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
            "advisor_id": advisor_id,
            "mongo_portal_id": mongo_id,
            "supabase_legacy_id": safe_str(doc.get("supabase_id") or doc.get("supabaseId")),
            "created_at": parse_date(doc.get("createdAt")),
        }

        if DRY_RUN:
            logger.info(f"  [DRY] client: {email}")
        else:
            try:
                result = supabase.table("clients").insert(row).execute()
                new_id = result.data[0]["id"]
                id_map["clients"][mongo_id] = new_id
            except Exception as e:
                if "duplicate" in str(e).lower():
                    # Client already exists (dedup by email)
                    existing = supabase.table("clients").select("id").eq("email", email).execute()
                    if existing.data:
                        id_map["clients"][mongo_id] = existing.data[0]["id"]
                    skipped += 1
                    continue
                raise
        count += 1

    logger.info(f"  Clients migrated: {count}, skipped (no email or duplicate): {skipped}")
    return count


async def migrate_visa_cases(db, supabase: Client) -> int:
    """Migrate visa_cases collection."""
    logger.info("=== Migrating visa_cases ===")
    cursor = db.visa_cases.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        user_id = safe_str(doc.get("userId"))
        client_id = id_map["clients"].get(user_id)

        if not client_id:
            logger.warning(f"  visa_case {mongo_id}: client not found for userId={user_id}")
            continue

        coord_id = id_map["staff"].get(safe_str(doc.get("coordinatorId")))
        adv_id = id_map["staff"].get(safe_str(doc.get("advisorId")))

        row = {
            "client_id": client_id,
            "coordinator_id": coord_id,
            "advisor_id": adv_id,
            "case_id": safe_str(doc.get("caseId")),
            "visa_type": safe_str(doc.get("visaType", "EB-2 NIW")),
            "current_stage": safe_int(doc.get("currentStage", 1)),
            "status": safe_str(doc.get("status", "active")),
            "is_master_case": doc.get("isMasterCase", False),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if DRY_RUN:
            logger.info(f"  [DRY] visa_case: {row['case_id']}")
        else:
            result = supabase.table("visa_cases").insert(row).execute()
            new_id = result.data[0]["id"]
            id_map["visa_cases"][mongo_id] = new_id
        count += 1

    logger.info(f"  Visa cases migrated: {count}")
    return count


async def migrate_visa_stages(db, supabase: Client) -> int:
    """Migrate visa_stages collection."""
    logger.info("=== Migrating visa_stages ===")
    cursor = db.visa_stages.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        case_mongo_id = safe_str(doc.get("caseId"))
        case_id = id_map["visa_cases"].get(case_mongo_id)

        if not case_id:
            continue

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

        if not DRY_RUN:
            result = supabase.table("visa_stages").insert(row).execute()
            id_map["visa_stages"][mongo_id] = result.data[0]["id"]
        count += 1

    logger.info(f"  Visa stages migrated: {count}")
    return count


async def migrate_simple_collection(db, supabase: Client, mongo_col: str, sb_table: str, field_map: dict, fk_field: str = None, fk_map_name: str = None) -> int:
    """Generic migrator for simple collections."""
    logger.info(f"=== Migrating {mongo_col} → {sb_table} ===")
    cursor = db[mongo_col].find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        row = {"mongo_id": mongo_id}

        for sb_col, mongo_key in field_map.items():
            if callable(mongo_key):
                row[sb_col] = mongo_key(doc)
            else:
                row[sb_col] = safe_str(doc.get(mongo_key))

        # Resolve FK
        if fk_field and fk_map_name:
            fk_mongo_val = safe_str(doc.get(fk_field.replace("_id", "Id").replace("client_id", "userId").replace("case_id", "caseId")))
            if not fk_mongo_val:
                fk_mongo_val = safe_str(doc.get(fk_field.replace("_id", "_id")))
            resolved = id_map.get(fk_map_name, {}).get(fk_mongo_val)
            if resolved:
                row[fk_field] = resolved
            elif fk_field == "client_id":
                continue  # Skip if no client found

        if DRY_RUN:
            logger.info(f"  [DRY] {sb_table}: {mongo_id}")
        else:
            try:
                supabase.table(sb_table).insert(row).execute()
            except Exception as e:
                logger.error(f"  Error inserting {sb_table} ({mongo_id}): {e}")
                continue
        count += 1

    logger.info(f"  {sb_table} migrated: {count}")
    return count


async def migrate_payments(db, supabase: Client) -> int:
    """Migrate payments + manual_payments."""
    logger.info("=== Migrating payments ===")
    count = 0

    for col_name in ["payments", "manual_payments"]:
        cursor = db[col_name].find({})
        docs = await cursor.to_list(length=None)

        for doc in docs:
            mongo_id = get_mongo_id(doc)
            user_id = safe_str(doc.get("userId"))
            case_mongo_id = safe_str(doc.get("caseId"))

            client_id = id_map["clients"].get(user_id)
            case_id = id_map["visa_cases"].get(case_mongo_id)

            if not client_id:
                continue

            stage_numbers = doc.get("stageNumbers")

            row = {
                "client_id": client_id,
                "case_id": case_id,
                "amount": safe_float(doc.get("amount", 0)),
                "currency": safe_str(doc.get("currency", "USD")),
                "payment_method": safe_str(doc.get("paymentMethod") or doc.get("method")),
                "stage_number": safe_int(doc.get("stageNumber")),
                "stage_numbers": stage_numbers if isinstance(stage_numbers, list) else None,
                "status": safe_str(doc.get("status", "completed")),
                "reference": safe_str(doc.get("reference") or doc.get("receiptUrl")),
                "receipt_url": safe_str(doc.get("receiptUrl")),
                "notes": safe_str(doc.get("notes")),
                "paid_at": parse_date(doc.get("paymentDate") or doc.get("createdAt")),
                "mongo_id": mongo_id,
                "created_at": parse_date(doc.get("createdAt")),
            }

            if not DRY_RUN:
                try:
                    supabase.table("payments").insert(row).execute()
                except Exception as e:
                    logger.error(f"  Error inserting payment {mongo_id}: {e}")
            count += 1

    logger.info(f"  Payments migrated: {count}")
    return count


async def migrate_deliverables(db, supabase: Client) -> int:
    """Migrate visa_deliverables."""
    logger.info("=== Migrating visa_deliverables ===")
    cursor = db.visa_deliverables.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        stage_id = id_map["visa_stages"].get(safe_str(doc.get("stageId")))

        if not case_id:
            continue

        row = {
            "case_id": case_id,
            "stage_id": stage_id,
            "stage_number": safe_int(doc.get("stageNumber")),
            "name": safe_str(doc.get("name")),
            "description": safe_str(doc.get("description")),
            "file_url": safe_str(doc.get("fileUrl")),
            "file_name": safe_str(doc.get("fileName")),
            "status": safe_str(doc.get("status", "pending")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if not DRY_RUN:
            try:
                supabase.table("visa_deliverables").insert(row).execute()
            except Exception as e:
                logger.error(f"  Error: {e}")
        count += 1

    logger.info(f"  Deliverables migrated: {count}")
    return count


async def migrate_documents(db, supabase: Client) -> int:
    """Migrate visa_client_documents → visa_documents."""
    logger.info("=== Migrating visa_documents ===")
    cursor = db.visa_client_documents.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
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

        if not DRY_RUN:
            try:
                supabase.table("visa_documents").insert(row).execute()
            except Exception as e:
                logger.error(f"  Error: {e}")
        count += 1

    logger.info(f"  Documents migrated: {count}")
    return count


async def migrate_appointments(db, supabase: Client) -> int:
    """Migrate appointments."""
    logger.info("=== Migrating appointments ===")
    cursor = db.appointments.find({})
    docs = await cursor.to_list(length=None)
    count = 0

    for doc in docs:
        mongo_id = get_mongo_id(doc)
        client_id = id_map["clients"].get(safe_str(doc.get("userId") or doc.get("clientId")))
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        staff_id = id_map["staff"].get(safe_str(doc.get("staffId") or doc.get("advisorId")))

        if not client_id:
            continue

        row = {
            "client_id": client_id,
            "case_id": case_id,
            "staff_id": staff_id,
            "title": safe_str(doc.get("title")),
            "scheduled_at": parse_date(doc.get("scheduledAt") or doc.get("date")),
            "duration_minutes": safe_int(doc.get("duration", 30)),
            "status": safe_str(doc.get("status", "scheduled")),
            "notes": safe_str(doc.get("notes")),
            "meeting_url": safe_str(doc.get("meetingUrl")),
            "mongo_id": mongo_id,
            "created_at": parse_date(doc.get("createdAt")),
        }

        if not DRY_RUN:
            try:
                supabase.table("appointments").insert(row).execute()
            except Exception as e:
                logger.error(f"  Error: {e}")
        count += 1

    logger.info(f"  Appointments migrated: {count}")
    return count


async def migrate_uscis(db, supabase: Client) -> int:
    """Migrate uscis_submissions and uscis_templates."""
    logger.info("=== Migrating USCIS submissions ===")
    count = 0

    # Templates first
    cursor = db.uscis_templates.find({})
    templates = await cursor.to_list(length=None)
    for doc in templates:
        row = {
            "name": safe_str(doc.get("name", "I-140")),
            "form_type": safe_str(doc.get("formType", "I-140")),
            "fields": json.dumps(doc.get("fields", {})),
            "questions": json.dumps(doc.get("questions", {})) if doc.get("questions") else None,
            "is_active": doc.get("isActive", True),
            "mongo_id": get_mongo_id(doc),
        }
        if not DRY_RUN:
            try:
                supabase.table("uscis_templates").insert(row).execute()
            except Exception as e:
                logger.error(f"  Template error: {e}")
        count += 1

    # Submissions
    cursor = db.uscis_submissions.find({})
    subs = await cursor.to_list(length=None)
    for doc in subs:
        client_id = id_map["clients"].get(safe_str(doc.get("userId")))
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))

        row = {
            "client_id": client_id,
            "case_id": case_id,
            "form_type": safe_str(doc.get("formType", "I-140")),
            "form_data": json.dumps(doc.get("formData") or doc.get("answers") or {}),
            "answers": json.dumps(doc.get("answers", {})) if doc.get("answers") else None,
            "pdf_url": safe_str(doc.get("pdfUrl")),
            "status": safe_str(doc.get("status", "draft")),
            "shared_token": safe_str(doc.get("sharedToken")),
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if client_id and not DRY_RUN:
            try:
                supabase.table("uscis_submissions").insert(row).execute()
            except Exception as e:
                logger.error(f"  Submission error: {e}")
        count += 1

    logger.info(f"  USCIS migrated: {count}")
    return count


async def migrate_remaining(db, supabase: Client) -> dict:
    """Migrate smaller collections: leads, legal_documents, case_notes, classic_cases, etc."""
    results = {}

    # Leads
    logger.info("=== Migrating leads ===")
    cursor = db.leads.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        row = {
            "name": safe_str(doc.get("name")),
            "email": safe_str(doc.get("email")),
            "phone": safe_str(doc.get("phone")),
            "source": safe_str(doc.get("source")),
            "status": safe_str(doc.get("status", "new")),
            "visa_type": safe_str(doc.get("visaType")),
            "metadata": json.dumps({k: v for k, v in doc.items() if k not in ("_id", "id", "name", "email", "phone", "source", "status", "visaType", "createdAt")}) if len(doc) > 7 else None,
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("leads").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["leads"] = count

    # Case notes
    logger.info("=== Migrating case_notes ===")
    cursor = db.case_notes.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        staff_id = id_map["staff"].get(safe_str(doc.get("staffId")))
        if not case_id:
            continue
        row = {
            "case_id": case_id,
            "staff_id": staff_id,
            "content": safe_str(doc.get("content", "")),
            "note_type": safe_str(doc.get("type", "general")),
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("case_notes").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["case_notes"] = count

    # Legal documents
    logger.info("=== Migrating legal_documents ===")
    cursor = db.legal_documents.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        row = {
            "title": safe_str(doc.get("title", "Untitled")),
            "category": safe_str(doc.get("category")),
            "file_url": safe_str(doc.get("fileUrl")),
            "description": safe_str(doc.get("description")),
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("legal_documents").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["legal_documents"] = count

    # Activity logs
    logger.info("=== Migrating activity_logs ===")
    cursor = db.activity_log.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        row = {
            "client_id": id_map["clients"].get(safe_str(doc.get("userId"))),
            "staff_id": id_map["staff"].get(safe_str(doc.get("staffId"))),
            "action": safe_str(doc.get("action", "unknown")),
            "entity_type": safe_str(doc.get("resource")),
            "entity_id": safe_str(doc.get("resourceId")),
            "details": json.dumps(doc.get("details", {})) if doc.get("details") else None,
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("activity_logs").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["activity_logs"] = count

    # Eligibility assessments
    logger.info("=== Migrating eligibility_assessments ===")
    cursor = db.eligibility_assessments.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        client_id = id_map["clients"].get(safe_str(doc.get("userId")))
        if not client_id:
            continue
        row = {
            "client_id": client_id,
            "score": safe_float(doc.get("score")),
            "result": json.dumps(doc.get("result", {})) if doc.get("result") else None,
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("eligibility_assessments").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["eligibility_assessments"] = count

    # Book preparations
    logger.info("=== Migrating book_preparations ===")
    cursor = db.book_preparations.find({})
    docs = await cursor.to_list(length=None)
    count = 0
    for doc in docs:
        case_id = id_map["visa_cases"].get(safe_str(doc.get("caseId")))
        row = {
            "case_id": case_id,
            "profile_summary": safe_str(doc.get("profileSummary")),
            "selected_idea": safe_str(doc.get("selectedIdea")),
            "selected_title": safe_str(doc.get("selectedTitle")),
            "ideas": json.dumps(doc.get("ideas", [])) if doc.get("ideas") else None,
            "titles": json.dumps(doc.get("titles", [])) if doc.get("titles") else None,
            "status": safe_str(doc.get("status", "pending")),
            "mongo_id": get_mongo_id(doc),
            "created_at": parse_date(doc.get("createdAt")),
        }
        if not DRY_RUN:
            try:
                supabase.table("book_preparations").insert(row).execute()
            except Exception:
                pass
        count += 1
    results["book_preparations"] = count

    for table, cnt in results.items():
        logger.info(f"  {table}: {cnt}")
    return results


async def main():
    logger.info("=" * 60)
    logger.info("URPE IS Portal — MongoDB → Supabase Migration")
    logger.info(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    logger.info("=" * 60)

    # Connect
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["MONGO_DB_NAME"]
    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client[db_name]

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase: Client = create_client(supabase_url, supabase_key)

    # Migrate in dependency order
    totals = {}
    totals["staff"] = await migrate_staff(db, supabase)
    totals["clients"] = await migrate_clients(db, supabase)
    totals["visa_cases"] = await migrate_visa_cases(db, supabase)
    totals["visa_stages"] = await migrate_visa_stages(db, supabase)
    totals["deliverables"] = await migrate_deliverables(db, supabase)
    totals["documents"] = await migrate_documents(db, supabase)
    totals["payments"] = await migrate_payments(db, supabase)
    totals["appointments"] = await migrate_appointments(db, supabase)
    totals["uscis"] = await migrate_uscis(db, supabase)
    remaining = await migrate_remaining(db, supabase)
    totals.update(remaining)

    # Save ID mappings
    if not DRY_RUN:
        with open("portal_id_map.json", "w") as f:
            json.dump(id_map, f, indent=2)
        logger.info("ID mappings saved to portal_id_map.json")

    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    for table, count in totals.items():
        logger.info(f"  {table}: {count}")
    logger.info("=" * 60)

    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
