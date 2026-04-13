"""
Resolve remaining TODOs by reading the MongoDB call that follows the TODO comment.
The pattern is:
  # TODO: db.X.method needs manual conversion → table "Y"

  db.X.method(filter, {"$set": data})

This script reads the actual MongoDB call below and converts it.
"""

import re
import sys

PORTAL_TABLE_MAP = {
    "users": "clients", "staff": "staff", "visa_cases": "visa_cases",
    "visa_stages": "visa_stages", "visa_deliverables": "visa_deliverables",
    "visa_client_documents": "visa_documents", "payments": "payments",
    "manual_payments": "payments", "appointments": "appointments",
    "uscis_submissions": "uscis_submissions", "uscis_templates": "uscis_templates",
    "eligibility_assessments": "eligibility_assessments",
    "test_eligibility_reports": "eligibility_assessments",
    "leads": "leads", "legal_documents": "legal_documents",
    "case_notes": "case_notes", "case_activities": "case_audit_logs",
    "comparator_cases": "comparator_cases", "classic_cases": "classic_cases",
    "admin_otp": "staff", "activity_log": "activity_logs",
    "book_jobs": "book_jobs", "whitepaper_jobs": "book_jobs",
    "policy_paper_jobs": "book_jobs", "case_study_jobs": "book_jobs",
    "econometric_jobs": "econometric_studies",
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


def get_table(col, app):
    m = PORTAL_TABLE_MAP if app == "portal" else REDACTORA_TABLE_MAP
    return m.get(col, col)


def resolve(filepath, app_type):
    with open(filepath) as f:
        content = f.read()

    resolved = 0

    # Pattern: # TODO: db.X.update_one ... \n\n  db.X.update_one(\n  {filter},\n  {"$set": {data}}\n)
    # Match multi-line update_one calls after TODO
    def replace_todo_update(match):
        nonlocal resolved
        indent = match.group(1)
        collection = match.group(2)
        table = get_table(collection, app_type)
        assignment = match.group(3) or ""  # "result = " or empty
        full_call = match.group(4)

        # Extract filter and $set from the call
        set_match = re.search(r"\{'\$set':\s*(\{.+?\})\}", full_call, re.DOTALL)
        if not set_match:
            set_match = re.search(r'\{"\$set":\s*(\{.+?\})\}', full_call, re.DOTALL)

        # Find the filter (first {...} before $set)
        filter_match = re.search(r'^\(\s*(\{.+?\})\s*,', full_call, re.DOTALL)

        if set_match and filter_match:
            filters = filter_match.group(1).strip()
            data = set_match.group(1).strip()

            # Clean up MongoDB-specific filter keys
            filters = filters.replace("'_id'", "'id'").replace('"_id"', '"id"')

            resolved += 1
            return f'{indent}{assignment}update("{table}", {filters}, {data})'

        # $inc pattern
        inc_match = re.search(r'\{"\$inc":\s*(\{.+?\})\}', full_call, re.DOTALL)
        if not inc_match:
            inc_match = re.search(r"\{'\$inc':\s*(\{.+?\})\}", full_call, re.DOTALL)

        if inc_match and filter_match:
            filters = filter_match.group(1).strip().replace("'_id'", "'id'")
            inc_data = inc_match.group(1).strip()
            resolved += 1
            result = f'{indent}# $inc → read-modify-write\n'
            result += f'{indent}_inc_doc = select("{table}", filters={filters}, single=True)\n'
            result += f'{indent}if _inc_doc:\n'

            # Parse inc fields
            for fm in re.finditer(r'["\'](\w+)["\']:\s*(-?\d+)', inc_data):
                field, amt = fm.group(1), fm.group(2)
                result += f'{indent}    update("{table}", {filters}, {{"{field}": _inc_doc.get("{field}", 0) + {amt}}})\n'
            return result

        # Couldn't parse — keep as comment
        return match.group(0)

    # Match: TODO comment + optional blank + optional assignment + db.X.update_one(...) or update_many(...)
    pattern = re.compile(
        r'^([ \t]*)(?:#[^\n]*TODO: db\.(\w+)\.update_(?:one|many)[^\n]*\n)'  # TODO line
        r'(?:\s*\n)*'  # optional blank lines
        r'\s*((?:\w+ = )?)'  # optional assignment like "result = "
        r'(?:# TODO:[^\n]*\n\s*)?'  # possible second TODO
        r'(?:await\s+)?db\.\w+\.update_(?:one|many)\('  # the actual call start
        r'([\s\S]+?\))\s*$',  # rest of call including closing paren
        re.MULTILINE
    )
    content = pattern.sub(replace_todo_update, content)

    # Pattern: TODO + db.X.find_one/find/delete_one/count_documents still remaining
    def replace_todo_simple(match):
        nonlocal resolved
        indent = match.group(1)
        collection = match.group(2)
        method = match.group(3)
        table = get_table(collection, app_type)
        assignment = match.group(4) or ""
        args = match.group(5).strip()

        # Clean MongoDB-specific
        args = args.replace("'_id'", "'id'").replace('"_id"', '"id"')

        if method == "find_one":
            filter_m = re.match(r'\((\{.+?\})', args, re.DOTALL)
            if filter_m:
                resolved += 1
                return f'{indent}{assignment}select("{table}", filters={filter_m.group(1)}, single=True)'

        elif method == "find":
            filter_m = re.match(r'\((\{[^)]*\})\)', args, re.DOTALL)
            if filter_m:
                f = filter_m.group(1)
                resolved += 1
                if f == "{}":
                    return f'{indent}{assignment}select("{table}")'
                return f'{indent}{assignment}select("{table}", filters={f})'

        elif method == "delete_one":
            filter_m = re.match(r'\((\{.+?\})\)', args, re.DOTALL)
            if filter_m:
                resolved += 1
                return f'{indent}{assignment}delete("{table}", {filter_m.group(1)})'

        elif method == "count_documents":
            filter_m = re.match(r'\((\{[^)]*\})\)', args, re.DOTALL)
            if filter_m:
                f = filter_m.group(1)
                resolved += 1
                if f == "{}":
                    return f'{indent}{assignment}count("{table}")'
                return f'{indent}{assignment}count("{table}", {f})'

        return match.group(0)

    # Match remaining db.X.method(...) calls (with or without TODO above)
    pattern2 = re.compile(
        r'^([ \t]*)(?:#[^\n]*TODO:[^\n]*\n\s*\n?\s*)?'
        r'((?:\w+ = )?)'
        r'(?:await\s+)?db\.(\w+)\.(find_one|find|delete_one|count_documents)\('
        r'(.+?\))\s*$',
        re.MULTILINE
    )
    # Run multiple passes
    for _ in range(3):
        old = content
        content = pattern2.sub(
            lambda m: replace_todo_simple(
                type('M', (), {'group': lambda self, i: [
                    m.group(0), m.group(1), m.group(3), m.group(4), m.group(1), m.group(5)
                ][i]})()
            ) if False else m.group(0),
            content
        )
        # Simpler approach: just use regex sub directly
        break

    # Direct replacements for remaining bare db.X.method calls
    # db.X.find_one({...}) → select("table", filters={...}, single=True)
    def direct_find_one(m):
        nonlocal resolved
        indent = m.group(1) or ""
        assign = m.group(2) or ""
        col = m.group(3)
        filt = m.group(4)
        table = get_table(col, app_type)
        filt = filt.replace("'_id'", "'id'").replace('"_id"', '"id"')
        resolved += 1
        return f'{indent}{assign}select("{table}", filters={filt}, single=True)'

    content = re.sub(
        r'^([ \t]*)((?:\w+ = )?)(?:await\s+)?db\.(\w+)\.find_one\((\{[^)]+\})\)',
        direct_find_one,
        content,
        flags=re.MULTILINE
    )

    # db.X.find({...}).to_list(...)
    def direct_find(m):
        nonlocal resolved
        indent = m.group(1) or ""
        assign = m.group(2) or ""
        col = m.group(3)
        filt = m.group(4)
        table = get_table(col, app_type)
        resolved += 1
        if filt.strip() == "{}":
            return f'{indent}{assign}select("{table}")'
        return f'{indent}{assign}select("{table}", filters={filt})'

    content = re.sub(
        r'^([ \t]*)((?:\w+ = )?)(?:await\s+)?db\.(\w+)\.find\((\{[^)]*\})\)\.to_list\([^)]*\)',
        direct_find,
        content,
        flags=re.MULTILINE
    )

    # db.X.delete_one({...})
    def direct_delete(m):
        nonlocal resolved
        indent = m.group(1) or ""
        col = m.group(2)
        filt = m.group(3)
        table = get_table(col, app_type)
        filt = filt.replace("'_id'", "'id'")
        resolved += 1
        return f'{indent}delete("{table}", {filt})'

    content = re.sub(
        r'^([ \t]*)(?:await\s+)?db\.(\w+)\.delete_one\((\{[^)]+\})\)',
        direct_delete,
        content,
        flags=re.MULTILINE
    )

    # db.X.count_documents({...})
    def direct_count(m):
        nonlocal resolved
        indent = m.group(1) or ""
        assign = m.group(2) or ""
        col = m.group(3)
        filt = m.group(4)
        table = get_table(col, app_type)
        resolved += 1
        if filt.strip() == "{}":
            return f'{indent}{assign}count("{table}")'
        return f'{indent}{assign}count("{table}", {filt})'

    content = re.sub(
        r'^([ \t]*)((?:\w+ = )?)(?:await\s+)?db\.(\w+)\.count_documents\((\{[^)]*\})\)',
        direct_count,
        content,
        flags=re.MULTILINE
    )

    # db.X.insert_one(...)
    def direct_insert(m):
        nonlocal resolved
        indent = m.group(1) or ""
        assign = m.group(2) or ""
        col = m.group(3)
        data = m.group(4)
        table = get_table(col, app_type)
        resolved += 1
        return f'{indent}{assign}insert("{table}", {data})'

    content = re.sub(
        r'^([ \t]*)((?:\w+ = )?)(?:await\s+)?db\.(\w+)\.insert_one\(([^)]+)\)',
        direct_insert,
        content,
        flags=re.MULTILINE
    )

    # Clean orphan TODO lines where the code was already resolved
    lines = content.split('\n')
    clean_lines = []
    for i, line in enumerate(lines):
        if '# TODO: db.' in line and 'needs manual conversion' in line:
            # Check if next non-blank line is already a select/insert/update/delete call
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                j += 1
            if j < len(lines):
                next_line = lines[j].strip()
                if next_line.startswith(('select(', 'insert(', 'update(', 'delete(', 'count(')):
                    resolved += 1
                    continue  # skip the TODO, the call below is already converted
        clean_lines.append(line)

    content = '\n'.join(clean_lines)

    with open(filepath, 'w') as f:
        f.write(content)

    remaining = content.count('# TODO:')
    remaining_db = len(re.findall(r'(?:await\s+)?db\.', content))
    print(f"Resolved: {resolved}")
    print(f"Remaining TODOs: {remaining}")
    print(f"Remaining db. calls: {remaining_db}")


if __name__ == "__main__":
    resolve(sys.argv[1], sys.argv[2])
