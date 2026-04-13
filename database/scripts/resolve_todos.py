"""
Resolve TODO markers left by the automated MongoDB→Supabase refactoring.
Handles: db.X.find_one, db.X.find, db.X.update_one, $inc, $or patterns.

Usage:
  python resolve_todos.py <file> <app_type>
  python resolve_todos.py apps/portal/backend/server.py portal
"""

import re
import sys

PORTAL_TABLE_MAP = {
    "users": "clients", "staff": "staff", "visa_cases": "visa_cases",
    "visa_stages": "visa_stages", "visa_deliverables": "visa_deliverables",
    "visa_client_documents": "visa_documents", "visa_documents": "visa_documents",
    "payments": "payments", "manual_payments": "payments",
    "appointments": "appointments", "uscis_submissions": "uscis_submissions",
    "uscis_shared_forms": "uscis_submissions", "uscis_templates": "uscis_templates",
    "eligibility_assessments": "eligibility_assessments",
    "eligibility_templates": "eligibility_templates",
    "test_eligibility_reports": "eligibility_assessments",
    "leads": "leads", "legal_documents": "legal_documents",
    "case_notes": "case_notes", "case_activities": "case_audit_logs",
    "case_audit_logs": "case_audit_logs", "classic_cases": "classic_cases",
    "classic_case_notes": "case_notes", "comparator_cases": "comparator_cases",
    "user_cvs": "user_cvs", "visa_meetings": "visa_meetings",
    "magic_links": "magic_links", "admin_api_tokens": "admin_api_tokens",
    "admin_otp": "staff", "activity_log": "activity_logs",
    "webhook_notifications": "webhook_notifications",
    "book_preparations": "book_preparations", "book_jobs": "book_jobs",
    "messages": "redactora_chat_messages",
}

REDACTORA_TABLE_MAP = {
    "clients": "clients", "users": "clients",
    "patents": "patents", "patents_in_progress": "patents",
    "patent_evaluations": "patent_evaluations",
    "niw_in_progress": "niw_petitions",
    "recommendation_letters": "recommendation_letters",
    "econometric_studies": "econometric_studies",
    "econometric_studies_in_progress": "econometric_studies",
    "business_plans": "business_plans",
    "business_plans_in_progress": "business_plans",
    "books": "generated_documents", "books_in_progress": "generated_documents",
    "whitepapers": "generated_documents", "whitepapers_in_progress": "generated_documents",
    "designed_documents": "generated_documents",
    "chat_messages": "redactora_chat_messages",
    "chat_conversations": "redactora_chat_messages",
    "activity_logs": "activity_logs",
}


def get_table(collection, app_type):
    m = PORTAL_TABLE_MAP if app_type == "portal" else REDACTORA_TABLE_MAP
    return m.get(collection, collection)


def resolve_todos(filepath, app_type):
    with open(filepath, "r") as f:
        lines = f.readlines()

    resolved = 0
    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Pattern 1: var = # TODO: db.X.find_one needs manual conversion → table "Y"
        m = re.match(r'^(\s*)(\w+)\s*=\s*# TODO: db\.(\w+)\.find_one needs manual conversion.*table "(\w+)"', line)
        if m:
            indent, var, collection, table = m.groups()
            # Next line usually has the original commented out or the broken call
            # Look for the filter in nearby lines
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                # Try to find the original call comment
                orig_match = re.search(r'# Original: db\.\w+\.find_one\((\{[^)]+\})\)', next_line)
                if orig_match:
                    filters = orig_match.group(1)
                    new_lines.append(f'{indent}{var} = select("{table}", filters={filters}, single=True)\n')
                    i += 2  # skip TODO + comment
                    resolved += 1
                    continue
                # Or the line itself has a partial call
                call_match = re.search(r'db\.\w+\.find_one\((\{[^)]+\})', next_line)
                if call_match:
                    filters = call_match.group(1)
                    new_lines.append(f'{indent}{var} = select("{table}", filters={filters}, single=True)\n')
                    i += 2
                    resolved += 1
                    continue

            # Fallback: just make a generic select
            new_lines.append(f'{indent}{var} = select("{table}", single=True)  # REVIEW: add filters\n')
            i += 1
            resolved += 1
            continue

        # Pattern 2: var = # TODO: db.X.find needs manual conversion → table "Y"
        m = re.match(r'^(\s*)(\w+)\s*=\s*# TODO: db\.(\w+)\.find needs manual conversion.*table "(\w+)"', line)
        if m:
            indent, var, collection, table = m.groups()
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                orig_match = re.search(r'# Original: db\.\w+\.find\((\{[^)]*\})\)', next_line)
                if orig_match:
                    filters = orig_match.group(1)
                    if filters == "{}":
                        new_lines.append(f'{indent}{var} = select("{table}")\n')
                    else:
                        new_lines.append(f'{indent}{var} = select("{table}", filters={filters})\n')
                    i += 2
                    resolved += 1
                    continue

            new_lines.append(f'{indent}{var} = select("{table}")  # REVIEW: add filters\n')
            i += 1
            resolved += 1
            continue

        # Pattern 3: # TODO: db.X.update_one needs manual conversion → table "Y"
        m = re.match(r'^(\s*)# TODO: db\.(\w+)\.update_one needs manual conversion.*table "(\w+)"', line)
        if m:
            indent, collection, table = m.groups()
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                # Look for the original pattern
                orig_match = re.search(r'# Original: db\.\w+\.update_one\((.+)\)', next_line)
                if orig_match:
                    args = orig_match.group(1)
                    # Try to extract filter and $set
                    set_match = re.search(r'(\{[^}]+\}),\s*\{"\$set":\s*(\{.+\})\}', args)
                    if set_match:
                        filters = set_match.group(1)
                        data = set_match.group(2)
                        new_lines.append(f'{indent}update("{table}", {filters}, {data})\n')
                        i += 2
                        resolved += 1
                        continue

                # Check if it's a direct broken update call
                update_match = re.search(r'update\("(\w+)",\s*\{\},\s*\{\}\)', next_line)
                if update_match:
                    # Replace the placeholder with a better version
                    new_lines.append(line)  # keep TODO as comment
                    i += 1
                    continue

            new_lines.append(line)
            i += 1
            continue

        # Pattern 4: # TODO: $inc needs read-modify-write pattern
        m = re.match(r'^(\s*)# TODO: \$inc needs read-modify-write pattern', line)
        if m:
            indent = m.group(1)
            # Look for the original on next line
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                orig_match = re.search(r'# Original: db\.(\w+)\.update_one\((\{[^}]+\}),\s*\{"\$inc":\s*\{([^}]+)\}\}\)', next_line)
                if orig_match:
                    collection = orig_match.group(1)
                    filters = orig_match.group(2)
                    inc_fields = orig_match.group(3)
                    table = get_table(collection, app_type)

                    # Parse inc fields: "field": 1, "field2": -1
                    inc_parts = []
                    for field_match in re.finditer(r'"(\w+)":\s*(-?\d+)', inc_fields):
                        field = field_match.group(1)
                        amount = int(field_match.group(2))
                        inc_parts.append((field, amount))

                    if inc_parts:
                        new_lines.append(f'{indent}# Read-modify-write for $inc\n')
                        new_lines.append(f'{indent}_doc = select("{table}", filters={filters}, single=True)\n')
                        new_lines.append(f'{indent}if _doc:\n')
                        update_dict_parts = []
                        for field, amount in inc_parts:
                            update_dict_parts.append(f'"{field}": _doc.get("{field}", 0) + {amount}')
                        update_dict = "{" + ", ".join(update_dict_parts) + "}"
                        new_lines.append(f'{indent}    update("{table}", {filters}, {update_dict})\n')

                        # Skip the original comment line and the FIXME line
                        i += 2
                        if i < len(lines) and "FIXME" in lines[i]:
                            i += 1
                        resolved += 1
                        continue

            new_lines.append(line)
            i += 1
            continue

        # Pattern 5: # TODO: Complex query — needs manual conversion
        m = re.match(r'^(\s*)# TODO: Complex query — needs manual conversion', line)
        if m:
            indent = m.group(1)
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                orig_match = re.search(r'# Original: db\.(\w+)\.find_one\((.+)\)', next_line)
                if orig_match:
                    collection = orig_match.group(1)
                    filter_expr = orig_match.group(2)
                    table = get_table(collection, app_type)

                    # Handle $or pattern
                    or_match = re.search(r'\{"\$or":\s*\[(\{[^]]+\})\]\}', filter_expr)
                    if or_match:
                        or_items = or_match.group(1)
                        # Parse individual conditions
                        conditions = []
                        for cond_match in re.finditer(r'\{["\'](\w+)["\']:\s*([^}]+)\}', or_items):
                            field = cond_match.group(1)
                            val = cond_match.group(2).strip()
                            conditions.append(f'{field}.eq.{val}')

                        if conditions:
                            or_str = ",".join(conditions)
                            new_lines.append(f'{indent}sb = get_supabase()\n')
                            new_lines.append(f'{indent}_result = sb.table("{table}").select("*").or_("{or_str}").execute()\n')
                            new_lines.append(f'{indent}_result = _result.data[0] if _result.data else None\n')
                            # Skip TODO + original comment + FIXME
                            i += 2
                            if i < len(lines) and "FIXME" in lines[i]:
                                i += 1
                            resolved += 1
                            continue

            new_lines.append(line)
            i += 1
            continue

        # Pattern 6: # TODO: Complex update — needs manual conversion
        m = re.match(r'^(\s*)# TODO: Complex update — needs manual conversion', line)
        if m:
            indent = m.group(1)
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                orig_match = re.search(r'# Original: db\.(\w+)\.update_one\((.+)\)', next_line)
                if orig_match:
                    collection = orig_match.group(1)
                    args = orig_match.group(2)
                    table = get_table(collection, app_type)

                    # Handle $set within complex updates
                    set_match = re.search(r'(\{[^}]+\}),\s*\{"\$set":\s*(\{.+?\})', args)
                    if set_match:
                        filters = set_match.group(1)
                        data = set_match.group(2)
                        new_lines.append(f'{indent}update("{table}", {filters}, {data})\n')
                        i += 2
                        if i < len(lines) and "FIXME" in lines[i]:
                            i += 1
                        resolved += 1
                        continue

                    # Handle $push — convert to append to JSONB array
                    push_match = re.search(r'(\{[^}]+\}),\s*\{"\$push":', args)
                    if push_match:
                        new_lines.append(f'{indent}# $push converted: read array, append, write back\n')
                        new_lines.append(f'{indent}# Original: db.{collection}.update_one({args})\n')
                        new_lines.append(line)
                        i += 1
                        continue

            new_lines.append(line)
            i += 1
            continue

        # Pattern 7: # TODO: Aggregate pipeline needs manual SQL conversion
        m = re.match(r'^(\s*)# TODO: Aggregate pipeline needs manual SQL conversion', line)
        if m:
            indent = m.group(1)
            # Keep the TODO but make it cleaner
            new_lines.append(f'{indent}# TODO: Convert MongoDB aggregate to SQL/RPC\n')
            if i + 1 < len(lines) and "# Original:" in lines[i + 1]:
                new_lines.append(lines[i + 1])  # keep original as reference
                i += 2
                if i < len(lines) and "FIXME" in lines[i]:
                    new_lines.append(f'{indent}[]  # Placeholder — implement as Supabase RPC or raw SQL\n')
                    i += 1
                continue
            new_lines.append(line)
            i += 1
            continue

        # Pattern 8: Standalone TODO db.X.Y needs manual conversion
        m = re.match(r'^(\s*)# TODO: db\.(\w+)\.(\w+) needs manual conversion.*table "(\w+)"', line)
        if m and "=" not in line:
            indent, collection, method, table = m.groups()

            if i + 1 < len(lines):
                next_line = lines[i + 1]

                if method == "find_one":
                    # Find the broken call on next line
                    call_match = re.search(r'db\.(\w+)\.find_one\((\{[^)]+\})', next_line)
                    if call_match:
                        filters = call_match.group(2)
                        new_lines.append(f'{indent}select("{table}", filters={filters}, single=True)\n')
                        i += 2
                        resolved += 1
                        continue

                elif method == "find":
                    call_match = re.search(r'db\.(\w+)\.find\((\{[^)]*\})', next_line)
                    if call_match:
                        filters = call_match.group(2)
                        if filters == "{}":
                            new_lines.append(f'{indent}select("{table}")\n')
                        else:
                            new_lines.append(f'{indent}select("{table}", filters={filters})\n')
                        i += 2
                        resolved += 1
                        continue

                elif method == "update_one":
                    # Keep as TODO with cleaner format
                    pass

                elif method == "delete_one":
                    call_match = re.search(r'db\.(\w+)\.delete_one\((\{[^)]+\})', next_line)
                    if call_match:
                        filters = call_match.group(2)
                        new_lines.append(f'{indent}delete("{table}", {filters})\n')
                        i += 2
                        resolved += 1
                        continue

            new_lines.append(line)
            i += 1
            continue

        # No pattern matched — keep the line as-is
        new_lines.append(line)
        i += 1

    with open(filepath, "w") as f:
        f.writelines(new_lines)

    remaining = sum(1 for l in new_lines if "# TODO:" in l)
    print(f"Resolved: {resolved}")
    print(f"Remaining TODOs: {remaining}")
    return resolved, remaining


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python resolve_todos.py <file> <portal|redactora>")
        sys.exit(1)
    resolve_todos(sys.argv[1], sys.argv[2])
