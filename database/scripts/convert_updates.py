"""
Convert multi-line db.X.update_one/update_many calls to Supabase update() calls.
Handles the pattern:
  db.X.update_one(
      {'field': value},
      {'$set': {
          'key1': val1,
          'key2': val2
      }}
  )
→
  update("table", {'field': value}, {
      'key1': val1,
      'key2': val2
  })
"""

import re
import sys

TABLE_MAP = {
    'users': 'clients', 'staff': 'staff', 'visa_cases': 'visa_cases',
    'visa_stages': 'visa_stages', 'visa_deliverables': 'visa_deliverables',
    'visa_client_documents': 'visa_documents', 'visa_documents': 'visa_documents',
    'payments': 'payments', 'manual_payments': 'payments',
    'appointments': 'appointments', 'uscis_submissions': 'uscis_submissions',
    'uscis_templates': 'uscis_templates', 'eligibility_assessments': 'eligibility_assessments',
    'test_eligibility_reports': 'eligibility_assessments',
    'leads': 'leads', 'legal_documents': 'legal_documents',
    'case_notes': 'case_notes', 'case_activities': 'case_audit_logs',
    'comparator_cases': 'comparator_cases', 'classic_cases': 'classic_cases',
    'admin_otp': 'staff', 'activity_log': 'activity_logs',
    'book_jobs': 'book_jobs', 'whitepaper_jobs': 'book_jobs',
    'policy_paper_jobs': 'book_jobs', 'case_study_jobs': 'book_jobs',
    'econometric_jobs': 'econometric_studies', 'webhook_notifications': 'webhook_notifications',
    'magic_links': 'magic_links', 'admin_api_tokens': 'admin_api_tokens',
    'book_preparations': 'book_preparations', 'user_cvs': 'user_cvs',
    'visa_meetings': 'visa_meetings', 'messages': 'redactora_chat_messages',
    'clients': 'clients', 'patents': 'patents', 'patents_in_progress': 'patents',
    'patent_evaluations': 'patent_evaluations', 'niw_in_progress': 'niw_petitions',
    'recommendation_letters': 'recommendation_letters',
    'econometric_studies': 'econometric_studies', 'econometric_studies_in_progress': 'econometric_studies',
    'business_plans': 'business_plans', 'business_plans_in_progress': 'business_plans',
    'books': 'generated_documents', 'books_in_progress': 'generated_documents',
    'whitepapers': 'generated_documents', 'whitepapers_in_progress': 'generated_documents',
    'designed_documents': 'generated_documents',
    'chat_messages': 'redactora_chat_messages', 'chat_conversations': 'redactora_chat_messages',
    'activity_logs': 'activity_logs',
}


def convert_file(filepath):
    with open(filepath) as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    converted = 0

    while i < len(lines):
        line = lines[i]

        # Detect: db.X.update_one( or db.X.update_many( — with optional await and assignment
        m = re.match(r'^(\s*)((?:\w+\s*=\s*)?)(await\s+)?db\.(\w+)\.update_(one|many)\(', line)
        if m:
            indent = m.group(1)
            assignment = m.group(2) or ""
            col = m.group(4)
            table = TABLE_MAP.get(col, col)

            # Collect the full multi-line call until the closing ) that matches
            call_lines = [line]
            paren_depth = line.count('(') - line.count(')')
            j = i + 1
            while paren_depth > 0 and j < len(lines):
                call_lines.append(lines[j])
                paren_depth += lines[j].count('(') - lines[j].count(')')
                j += 1

            full_call = ''.join(call_lines)

            # Try to extract filter and $set data
            # Pattern: ({filter}, {"$set": {data}})
            # Use a simpler approach: find the filter dict and the $set dict
            set_match = re.search(r'["\']?\$set["\']?\s*:\s*(\{)', full_call)

            if set_match:
                # Find the filter: everything between first ( and the comma before $set
                call_body = full_call[full_call.index('(') + 1:]

                # Extract filter: first balanced {} block
                filter_str = extract_balanced_braces(call_body)

                if filter_str:
                    # Extract $set value: balanced {} after "$set":
                    set_start = full_call.index(set_match.group(0)) + len(set_match.group(0)) - 1
                    remaining = full_call[set_start:]
                    set_data = extract_balanced_braces(remaining)

                    if set_data:
                        filter_clean = filter_str.replace("'_id'", "'id'").replace('"_id"', '"id"')
                        new_lines.append(f'{indent}{assignment}update("{table}", {filter_clean}, {set_data})\n')
                        i = j
                        converted += 1
                        continue

            # Try $inc
            inc_match = re.search(r'["\']?\$inc["\']?\s*:\s*(\{)', full_call)
            if inc_match:
                call_body = full_call[full_call.index('(') + 1:]
                filter_str = extract_balanced_braces(call_body)

                if filter_str:
                    inc_start = full_call.index(inc_match.group(0)) + len(inc_match.group(0)) - 1
                    remaining = full_call[inc_start:]
                    inc_data = extract_balanced_braces(remaining)

                    if inc_data and filter_str:
                        filter_clean = filter_str.replace("'_id'", "'id'").replace('"_id"', '"id"')
                        # Parse inc fields
                        fields = re.findall(r'["\'](\w+)["\']:\s*(-?\d+)', inc_data)
                        if fields:
                            new_lines.append(f'{indent}# $inc → read-modify-write\n')
                            new_lines.append(f'{indent}_d = select("{table}", filters={filter_clean}, single=True)\n')
                            new_lines.append(f'{indent}if _d:\n')
                            parts = ', '.join(f'"{f}": _d.get("{f}", 0) + {a}' for f, a in fields)
                            new_lines.append(f'{indent}    update("{table}", {filter_clean}, {{{parts}}})\n')
                            i = j
                            converted += 1
                            continue

            # Try $push
            push_match = re.search(r'["\']?\$push["\']?', full_call)
            if push_match:
                # Convert to read-append-write
                call_body = full_call[full_call.index('(') + 1:]
                filter_str = extract_balanced_braces(call_body)
                if filter_str:
                    filter_clean = filter_str.replace("'_id'", "'id'")
                    new_lines.append(f'{indent}# $push → read-append-write (needs review)\n')
                    new_lines.append(f'{indent}_d = select("{table}", filters={filter_clean}, single=True)\n')
                    new_lines.append(f'{indent}# TODO: append to array field and update\n')
                    i = j
                    converted += 1
                    continue

            # Couldn't parse — keep original lines
            new_lines.extend(call_lines)
            i = j
            continue

        new_lines.append(line)
        i += 1

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

    remaining_updates = sum(1 for l in new_lines if re.search(r'db\.\w+\.update_', l))
    remaining_db = sum(1 for l in new_lines if re.search(r'db\.\w+\.(?:find|insert|update|delete|count)', l))
    todos = sum(1 for l in new_lines if '# TODO:' in l)
    print(f"Converted: {converted}")
    print(f"Remaining update calls: {remaining_updates}")
    print(f"Remaining total db calls: {remaining_db}")
    print(f"TODOs: {todos}")


def extract_balanced_braces(text):
    """Extract the first balanced {...} block from text."""
    start = text.find('{')
    if start == -1:
        return None

    depth = 0
    i = start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
        i += 1
    return None


if __name__ == "__main__":
    convert_file(sys.argv[1])
