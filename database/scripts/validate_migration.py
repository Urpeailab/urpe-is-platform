"""
Valida la migracion MongoDB → Supabase.
Compara conteos de registros y verifica integridad referencial.

Uso:
  export MONGO_URL=mongodb://... (Portal)
  export MONGO_DB_NAME=...
  export MONGO_REDACTORA_URL=mongodb://... (Redactora, opcional)
  export MONGO_REDACTORA_DB_NAME=...
  export SUPABASE_URL=https://...
  export SUPABASE_SERVICE_ROLE_KEY=...
  python validate_migration.py
"""

import asyncio
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def count_mongo(db, collection: str) -> int:
    try:
        return await db[collection].count_documents({})
    except Exception:
        return 0


def count_supabase(supabase: Client, table: str) -> int:
    try:
        result = supabase.table(table).select("id", count="exact").execute()
        return result.count or 0
    except Exception:
        return 0


async def main():
    logger.info("=" * 60)
    logger.info("Migration Validation Report")
    logger.info("=" * 60)

    # Connect to Portal MongoDB
    mongo_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db_portal = mongo_client[os.environ["MONGO_DB_NAME"]]

    # Connect to Redactora MongoDB (if available)
    db_redactora = None
    if os.environ.get("MONGO_REDACTORA_URL"):
        mongo_client_r = AsyncIOMotorClient(os.environ["MONGO_REDACTORA_URL"])
        db_redactora = mongo_client_r[os.environ["MONGO_REDACTORA_DB_NAME"]]

    # Connect to Supabase
    supabase: Client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

    issues = []

    # === Portal collections ===
    portal_checks = [
        ("users", "clients"),
        ("staff", "staff"),
        ("visa_cases", "visa_cases"),
        ("visa_stages", "visa_stages"),
        ("visa_deliverables", "visa_deliverables"),
        ("visa_client_documents", "visa_documents"),
        ("payments", "payments"),        # + manual_payments
        ("appointments", "appointments"),
        ("uscis_submissions", "uscis_submissions"),
        ("uscis_templates", "uscis_templates"),
        ("leads", "leads"),
        ("case_notes", "case_notes"),
        ("legal_documents", "legal_documents"),
        ("activity_log", "activity_logs"),
        ("eligibility_assessments", "eligibility_assessments"),
        ("book_preparations", "book_preparations"),
    ]

    logger.info("\n--- PORTAL (MongoDB → Supabase) ---")
    logger.info(f"{'MongoDB Collection':<35} {'Mongo':>8} {'Supabase':>8} {'Status':>10}")
    logger.info("-" * 65)

    for mongo_col, sb_table in portal_checks:
        mongo_count = await count_mongo(db_portal, mongo_col)

        # Special case: payments includes manual_payments
        if mongo_col == "payments":
            mongo_count += await count_mongo(db_portal, "manual_payments")

        sb_count = count_supabase(supabase, sb_table)

        if sb_count == 0 and mongo_count > 0:
            status = "MISSING"
            issues.append(f"{sb_table}: 0 rows in Supabase but {mongo_count} in MongoDB")
        elif sb_count < mongo_count:
            status = "PARTIAL"
            issues.append(f"{sb_table}: {sb_count}/{mongo_count} migrated ({mongo_count - sb_count} missing)")
        elif sb_count == mongo_count:
            status = "OK"
        else:
            status = "EXTRA"  # More in Supabase than MongoDB (duplicates?)

        logger.info(f"{mongo_col:<35} {mongo_count:>8} {sb_count:>8} {status:>10}")

    # === Redactora collections ===
    if db_redactora:
        redactora_checks = [
            ("patents", "patents"),               # + patents_in_progress
            ("patent_evaluations", "patent_evaluations"),
            ("niw_in_progress", "niw_petitions"),
            ("recommendation_letters", "recommendation_letters"),
            ("econometric_studies", "econometric_studies"),  # + _in_progress
            ("business_plans", "business_plans"),  # + _in_progress
            ("books", "generated_documents"),      # + whitepapers + designed_documents
            ("chat_messages", "redactora_chat_messages"),
        ]

        logger.info("\n--- REDACTORA (MongoDB → Supabase) ---")
        logger.info(f"{'MongoDB Collection':<35} {'Mongo':>8} {'Supabase':>8} {'Status':>10}")
        logger.info("-" * 65)

        for mongo_col, sb_table in redactora_checks:
            mongo_count = await count_mongo(db_redactora, mongo_col)

            # Add _in_progress variants
            if mongo_col == "patents":
                mongo_count += await count_mongo(db_redactora, "patents_in_progress")
            elif mongo_col == "econometric_studies":
                mongo_count += await count_mongo(db_redactora, "econometric_studies_in_progress")
            elif mongo_col == "business_plans":
                mongo_count += await count_mongo(db_redactora, "business_plans_in_progress")
            elif mongo_col == "books":
                mongo_count += await count_mongo(db_redactora, "books_in_progress")
                mongo_count += await count_mongo(db_redactora, "whitepapers")
                mongo_count += await count_mongo(db_redactora, "whitepapers_in_progress")
                mongo_count += await count_mongo(db_redactora, "designed_documents")

            sb_count = count_supabase(supabase, sb_table)

            if sb_count == 0 and mongo_count > 0:
                status = "MISSING"
                issues.append(f"{sb_table}: 0 rows but {mongo_count} in MongoDB")
            elif sb_count < mongo_count:
                status = "PARTIAL"
                issues.append(f"{sb_table}: {sb_count}/{mongo_count} ({mongo_count - sb_count} missing)")
            elif sb_count == mongo_count:
                status = "OK"
            else:
                status = "EXTRA"

            logger.info(f"{mongo_col:<35} {mongo_count:>8} {sb_count:>8} {status:>10}")

    # === Referential integrity checks ===
    logger.info("\n--- REFERENTIAL INTEGRITY ---")

    # Orphan visa_cases (no client)
    orphan_cases = supabase.rpc("check_orphan_cases", {}).execute() if False else None
    # Simpler approach: count cases where client_id not in clients
    all_cases = supabase.table("visa_cases").select("client_id").execute()
    all_clients = supabase.table("clients").select("id").execute()
    client_ids = {c["id"] for c in all_clients.data}
    orphan_count = sum(1 for c in all_cases.data if c["client_id"] not in client_ids)
    if orphan_count > 0:
        issues.append(f"visa_cases: {orphan_count} orphan records (client_id not in clients)")
    logger.info(f"Orphan visa_cases (no client): {orphan_count}")

    # Orphan payments (no client)
    all_payments = supabase.table("payments").select("client_id").execute()
    orphan_payments = sum(1 for p in all_payments.data if p["client_id"] not in client_ids)
    if orphan_payments > 0:
        issues.append(f"payments: {orphan_payments} orphan records")
    logger.info(f"Orphan payments (no client): {orphan_payments}")

    # Summary
    logger.info("\n" + "=" * 60)
    if issues:
        logger.warning(f"ISSUES FOUND: {len(issues)}")
        for issue in issues:
            logger.warning(f"  - {issue}")
    else:
        logger.info("ALL CHECKS PASSED")
    logger.info("=" * 60)

    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
