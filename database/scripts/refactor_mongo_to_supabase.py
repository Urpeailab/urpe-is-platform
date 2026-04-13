"""
Automated refactoring: MongoDB motor queries → Supabase client helpers.
Transforms server.py files mechanically.

Usage:
  python refactor_mongo_to_supabase.py <input_file> <output_file> <app_type>

  app_type: "portal" or "redactora"

Example:
  python refactor_mongo_to_supabase.py apps/portal/backend/server.py apps/portal/backend/server_supabase.py portal
"""

import re
import sys

# === Collection → Table mapping ===

PORTAL_TABLE_MAP = {
    "users": "clients",
    "staff": "staff",
    "visa_cases": "visa_cases",
    "visa_stages": "visa_stages",
    "visa_deliverables": "visa_deliverables",
    "visa_client_documents": "visa_documents",
    "visa_documents": "visa_documents",
    "visa_payments": "payments",
    "payments": "payments",
    "manual_payments": "payments",
    "appointments": "appointments",
    "uscis_submissions": "uscis_submissions",
    "uscis_shared_forms": "uscis_submissions",
    "uscis_templates": "uscis_templates",
    "uscis_form_history": "uscis_submissions",
    "uscis_form_drafts": "uscis_submissions",
    "eligibility_assessments": "eligibility_assessments",
    "eligibility_templates": "eligibility_templates",
    "leads": "leads",
    "legal_documents": "legal_documents",
    "case_notes": "case_notes",
    "case_activities": "case_audit_logs",
    "case_audit_logs": "case_audit_logs",
    "classic_cases": "classic_cases",
    "classic_case_notes": "case_notes",
    "classic_case_contacts": "clients",
    "classic_case_timeline": "user_timelines",
    "timeline_templates": "timeline_templates",
    "user_timelines": "user_timelines",
    "comparator_cases": "comparator_cases",
    "user_cvs": "user_cvs",
    "visa_meetings": "visa_meetings",
    "magic_links": "magic_links",
    "admin_api_tokens": "admin_api_tokens",
    "admin_otp": "staff",
    "activity_log": "activity_logs",
    "webhook_notifications": "webhook_notifications",
    "messages": "redactora_chat_messages",
    "book_preparations": "book_preparations",
    "book_jobs": "book_jobs",
    "bp_preparations": "business_plans",
    "bp_jobs": "book_jobs",
    "case_study_jobs": "book_jobs",
    "econometric_jobs": "econometric_studies",
    "policy_paper_jobs": "book_jobs",
    "whitepaper_jobs": "book_jobs",
    "test_eligibility_reports": "eligibility_assessments",
    "stages": "visa_stages",
    "cases": "visa_cases",
}

REDACTORA_TABLE_MAP = {
    "clients": "clients",
    "users": "clients",
    "patents": "patents",
    "patents_in_progress": "patents",
    "patent_evaluations": "patent_evaluations",
    "niw_in_progress": "niw_petitions",
    "recommendation_letters": "recommendation_letters",
    "econometric_studies": "econometric_studies",
    "econometric_studies_in_progress": "econometric_studies",
    "business_plans": "business_plans",
    "business_plans_in_progress": "business_plans",
    "books": "generated_documents",
    "books_in_progress": "generated_documents",
    "whitepapers": "generated_documents",
    "whitepapers_in_progress": "generated_documents",
    "designed_documents": "generated_documents",
    "chat_messages": "redactora_chat_messages",
    "chat_conversations": "redactora_chat_messages",
    "activity_logs": "activity_logs",
}

# === camelCase → snake_case field mapping ===

FIELD_MAP = {
    "userId": "client_id",
    "clientId": "client_id",
    "client_id": "client_id",
    "caseId": "case_id",
    "stageId": "stage_id",
    "stageNumber": "stage_number",
    "staffId": "staff_id",
    "advisorId": "advisor_id",
    "coordinatorId": "coordinator_id",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "userState": "user_state",
    "isActive": "is_active",
    "isPaid": "is_paid",
    "isMasterCase": "is_master_case",
    "currentStage": "current_stage",
    "paymentMethod": "payment_method",
    "paymentDate": "paid_at",
    "visaType": "visa_type",
    "fileUrl": "file_url",
    "fileName": "file_name",
    "documentType": "document_type",
    "rejectionReason": "rejection_reason",
    "revisionCount": "revision_count",
    "completedDeliverablesCount": "completed_deliverables_count",
    "totalDeliverablesCount": "total_deliverables_count",
    "paidAmount": "paid_amount",
    "paidDate": "paid_date",
    "scheduledAt": "scheduled_at",
    "meetingUrl": "meeting_url",
    "receiptUrl": "receipt_url",
    "cvUrl": "cv_url",
    "originalFileUrl": "original_file_url",
    "supabase_id": "supabase_legacy_id",
    "supabaseId": "supabase_legacy_id",
    "templateId": "template_id",
    "formType": "form_type",
    "formData": "form_data",
    "sharedToken": "shared_token",
    "invention_title": "title",
    "inventor_name": "inventors",
    "specification_content": "description",
    "current_language": "language",
    "recommender_name": "recommender_name",
    "recommender_title": "recommender_title",
    "recommender_institution": "recommender_institution",
    "user_id": "client_id",
    "conversation_id": "conversation_id",
}


def get_table(collection: str, app_type: str) -> str:
    table_map = PORTAL_TABLE_MAP if app_type == "portal" else REDACTORA_TABLE_MAP
    return table_map.get(collection, collection)


def transform_file(input_path: str, output_path: str, app_type: str):
    with open(input_path, "r") as f:
        content = f.read()

    lines_before = content.count("\n")
    table_map = PORTAL_TABLE_MAP if app_type == "portal" else REDACTORA_TABLE_MAP

    # === Step 1: Replace imports ===
    # Remove motor import
    content = re.sub(
        r'from motor\.motor_asyncio import AsyncIOMotorClient\n?',
        '',
        content
    )

    # Add supabase import if not present
    if "from db.supabase_client import" not in content:
        # Add after the last import block
        content = re.sub(
            r'(import logging\n)',
            r'\1from db.supabase_client import select, insert, update, delete, count, upsert, get_supabase\n',
            content,
            count=1
        )

    # === Step 2: Remove MongoDB connection setup ===
    # Remove mongo_url, client, db lines
    content = re.sub(
        r"mongo_url\s*=\s*os\.environ\[?'MONGO_URL'\]?\n",
        "# MongoDB removed — using Supabase\n",
        content
    )
    content = re.sub(
        r"client\s*=\s*AsyncIOMotorClient\(mongo_url\)\n",
        "",
        content
    )
    content = re.sub(
        r"db\s*=\s*client\[os\.environ\[?'DB_NAME'\]?\]\n",
        "",
        content
    )

    # === Step 3: Replace find_one patterns ===
    # Pattern: await db.COLLECTION.find_one(FILTER)
    # → select("TABLE", filters=FILTER, single=True)
    def replace_find_one(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        filter_expr = match.group(3).strip()
        table = get_table(collection, app_type)

        # Try to parse simple filter like {"key": value}
        # For complex filters ($or, $and), wrap in comment
        if "$or" in filter_expr or "$and" in filter_expr or "$in" in filter_expr:
            return f'{indent}# TODO: Complex query — needs manual conversion\n{indent}# Original: db.{collection}.find_one({filter_expr})\n{indent}select("{table}", single=True)  # FIXME: add proper filters'

        return f'{indent}select("{table}", filters={filter_expr}, single=True)'

    # await db.X.find_one({...})
    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.find_one\((\{[^)]*\})\)',
        replace_find_one,
        content
    )

    # await db.X.find_one({...}, {projection})
    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.find_one\((\{[^}]*\}),\s*\{[^}]*\}\)',
        replace_find_one,
        content
    )

    # === Step 4: Replace find patterns ===
    # await db.X.find({...}).to_list(length=None) → select("TABLE", filters={...})
    def replace_find_to_list(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        filter_expr = match.group(3).strip()
        table = get_table(collection, app_type)

        if filter_expr == "{}":
            return f'{indent}select("{table}")'
        return f'{indent}select("{table}", filters={filter_expr})'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.find\((\{[^)]*\})\)\.to_list\(length=None\)',
        replace_find_to_list,
        content
    )

    # Cursor patterns: cursor = db.X.find({...}) ... await cursor.to_list(...)
    # Replace db.X.find({...}).sort(...).to_list(...)
    def replace_find_sort_list(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        filter_expr = match.group(3).strip()
        sort_field = match.group(4).strip().strip("'\"")
        sort_dir = match.group(5).strip()
        table = get_table(collection, app_type)

        desc = "True" if "-1" in sort_dir else "False"
        snake_field = FIELD_MAP.get(sort_field, sort_field)

        if filter_expr == "{}":
            return f'{indent}select("{table}", order="{snake_field}", order_desc={desc})'
        return f'{indent}select("{table}", filters={filter_expr}, order="{snake_field}", order_desc={desc})'

    content = re.sub(
        r'(\s*)await?\s+db\.(\w+)\.find\((\{[^)]*\})\)\.sort\([\'"]?(\w+)[\'"]?,\s*(-?\d+)\)\.to_list\([^)]*\)',
        replace_find_sort_list,
        content
    )

    # === Step 5: Replace insert_one patterns ===
    # await db.X.insert_one(doc) → insert("TABLE", doc)
    def replace_insert(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        doc_var = match.group(3).strip()
        table = get_table(collection, app_type)
        return f'{indent}insert("{table}", {doc_var})'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.insert_one\(([^)]+)\)',
        replace_insert,
        content
    )

    # === Step 6: Replace insert_many patterns ===
    def replace_insert_many(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        docs_var = match.group(3).strip()
        table = get_table(collection, app_type)
        return f'{indent}# insert_many: iterate and insert each\n{indent}for _doc in {docs_var}:\n{indent}    insert("{table}", _doc)'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.insert_many\(([^)]+)\)',
        replace_insert_many,
        content
    )

    # === Step 7: Replace update_one patterns ===
    # await db.X.update_one(FILTER, {"$set": DATA}) → update("TABLE", FILTER, DATA)
    def replace_update(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        full_args = match.group(3)
        table = get_table(collection, app_type)

        # Try to extract filter and $set data
        # Simple case: ({filter}, {"$set": {data}})
        set_match = re.search(r'\{"\$set":\s*(\{[^}]*\})\}', full_args)
        if set_match:
            data_part = set_match.group(1)
            filter_part = full_args[:full_args.index(', {"$set"')].strip()
            return f'{indent}update("{table}", {filter_part}, {data_part})'

        # $inc pattern — leave a TODO
        if "$inc" in full_args:
            return f'{indent}# TODO: $inc needs read-modify-write pattern\n{indent}# Original: db.{collection}.update_one({full_args})\n{indent}update("{table}", {{}}, {{}})  # FIXME'

        return f'{indent}# TODO: Complex update — needs manual conversion\n{indent}# Original: db.{collection}.update_one({full_args})\n{indent}update("{table}", {{}}, {{}})  # FIXME'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.update_one\((.+?)\)(?=\s*\n)',
        replace_update,
        content
    )

    # === Step 8: Replace update_many ===
    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.update_many\((.+?)\)(?=\s*\n)',
        replace_update,
        content
    )

    # === Step 9: Replace delete_one / delete_many ===
    def replace_delete(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        filter_expr = match.group(3).strip()
        table = get_table(collection, app_type)
        return f'{indent}delete("{table}", {filter_expr})'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.delete_one\((\{[^)]*\})\)',
        replace_delete,
        content
    )

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.delete_many\((\{[^)]*\})\)',
        replace_delete,
        content
    )

    # === Step 10: Replace count_documents ===
    def replace_count(match):
        indent = match.group(1) or ""
        collection = match.group(2)
        filter_expr = match.group(3).strip()
        table = get_table(collection, app_type)
        if filter_expr == "{}":
            return f'{indent}count("{table}")'
        return f'{indent}count("{table}", {filter_expr})'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.count_documents\((\{[^)]*\})\)',
        replace_count,
        content
    )

    # === Step 11: Replace aggregate patterns ===
    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.aggregate\((.+?)\)\.to_list\([^)]*\)',
        lambda m: f'{m.group(1)}# TODO: Aggregate pipeline needs manual SQL conversion\n{m.group(1)}# Original: db.{m.group(2)}.aggregate({m.group(3)})\n{m.group(1)}[]  # FIXME: convert to SQL/Supabase RPC',
        content
    )

    # === Step 12: Clean up remaining cursor patterns ===
    # db.X.find({...}).sort(...) without .to_list
    content = re.sub(
        r'(\s*)db\.(\w+)\.find\((\{[^)]*\})\)\.sort\([\'"]?(\w+)[\'"]?,\s*(-?\d+)\)',
        lambda m: f'{m.group(1)}# cursor replaced\n{m.group(1)}select("{get_table(m.group(2), app_type)}", filters={m.group(3)}, order="{FIELD_MAP.get(m.group(4), m.group(4))}", order_desc={"-1" in m.group(5)})',
        content
    )

    # === Step 13: Replace remaining await db.X patterns that weren't caught ===
    def replace_remaining_db(match):
        full = match.group(0)
        indent = match.group(1) or ""
        collection = match.group(2)
        method = match.group(3)
        table = get_table(collection, app_type)
        return f'{indent}# TODO: db.{collection}.{method} needs manual conversion → table "{table}"\n{indent}{full.replace("await ", "")}'

    content = re.sub(
        r'(\s*)await\s+db\.(\w+)\.(\w+)\(',
        replace_remaining_db,
        content
    )

    # === Step 14: Remove ObjectId imports and usage ===
    content = re.sub(r'from bson import ObjectId\n?', '', content)
    content = re.sub(r'from bson\.objectid import ObjectId\n?', '', content)

    # === Step 15: Clean up get_db() function if it exists ===
    content = re.sub(
        r'def get_db\(\):[^\n]*\n\s*return db\n?',
        'def get_db():\n    return get_supabase()\n',
        content
    )

    # Count remaining issues
    remaining_db = len(re.findall(r'await\s+db\.', content))
    todo_count = content.count("# TODO:")
    fixme_count = content.count("# FIXME")

    lines_after = content.count("\n")

    with open(output_path, "w") as f:
        f.write(content)

    print(f"\n{'='*60}")
    print(f"Refactoring complete: {input_path}")
    print(f"  Lines: {lines_before} → {lines_after}")
    print(f"  Remaining 'await db.' calls: {remaining_db}")
    print(f"  TODO markers: {todo_count}")
    print(f"  FIXME markers: {fixme_count}")
    print(f"  Output: {output_path}")
    print(f"{'='*60}")

    if remaining_db > 0:
        print(f"\n⚠️  {remaining_db} MongoDB calls still need manual conversion.")
        print("  Search for 'await db.' in the output file.")

    if todo_count > 0:
        print(f"\n⚠️  {todo_count} TODO markers need attention.")
        print("  These are complex queries (aggregate, $or, $inc) that need manual SQL conversion.")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python refactor_mongo_to_supabase.py <input> <output> <portal|redactora>")
        sys.exit(1)

    transform_file(sys.argv[1], sys.argv[2], sys.argv[3])
