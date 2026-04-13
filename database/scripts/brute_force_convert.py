"""
Brute force conversion of ALL remaining db.X.method() calls.
Reads the file as a single string and uses balanced-brace matching
to find and replace every MongoDB call regardless of line breaks or indentation.
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

def t(col):
    return TABLE_MAP.get(col, col)

def find_matching_paren(text, start):
    """Find the position of the closing ) that matches the ( at start."""
    depth = 0
    i = start
    while i < len(text):
        if text[i] == '(':
            depth += 1
        elif text[i] == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def find_matching_brace(text, start):
    """Find the position of the closing } that matches the { at start."""
    depth = 0
    i = start
    in_string = False
    string_char = None
    while i < len(text):
        c = text[i]
        if in_string:
            if c == string_char and text[i-1] != '\\':
                in_string = False
        else:
            if c in ('"', "'"):
                in_string = True
                string_char = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1

def extract_first_dict(text):
    """Extract the first {...} from text, handling nested braces."""
    start = text.find('{')
    if start == -1:
        return None, -1, -1
    end = find_matching_brace(text, start)
    if end == -1:
        return None, -1, -1
    return text[start:end+1], start, end

def clean_filter(f):
    return f.replace("'_id'", "'id'").replace('"_id"', '"id"')

def convert(filepath):
    with open(filepath) as f:
        content = f.read()

    converted = 0
    # Find all db.X.method( occurrences
    pattern = re.compile(r'(?:await\s+)?db\.(\w+)\.(find_one|find|update_one|update_many|insert_one|insert_many|delete_one|delete_many|count_documents)\(')

    offset = 0
    iterations = 0
    max_iterations = 500

    while iterations < max_iterations:
        iterations += 1
        m = pattern.search(content, offset)
        if not m:
            break

        col = m.group(1)
        method = m.group(2)
        table = t(col)
        call_start = m.start()
        paren_start = m.end() - 1  # position of (
        paren_end = find_matching_paren(content, paren_start)

        if paren_end == -1:
            offset = m.end()
            continue

        full_call = content[call_start:paren_end + 1]
        args_text = content[paren_start + 1:paren_end].strip()

        # Detect the leading whitespace/assignment
        line_start = content.rfind('\n', 0, call_start) + 1
        prefix = content[line_start:call_start]
        indent = re.match(r'^(\s*)', prefix).group(1)
        assignment = prefix.strip()  # e.g. "result = " or "existing = await "
        assignment = re.sub(r'await\s+$', '', assignment)

        # Check if this is inside a comment
        line = content[line_start:content.find('\n', call_start)]
        if line.strip().startswith('#'):
            offset = paren_end + 1
            continue

        replacement = None

        if method == 'find_one':
            first_dict, _, _ = extract_first_dict(args_text)
            if first_dict:
                replacement = f'select("{table}", filters={clean_filter(first_dict)}, single=True)'
            else:
                replacement = f'select("{table}", single=True)'

        elif method == 'find':
            first_dict, _, _ = extract_first_dict(args_text)
            # Check for .sort().to_list() or .to_list() after the closing paren
            after = content[paren_end + 1:paren_end + 200]

            sort_match = re.match(r'\.sort\([\'"](\w+)[\'"],\s*(-?\d+)\)', after)
            limit_match = re.search(r'\.(?:to_list|limit)\((\d+)\)', after)

            extra_end = paren_end
            order_str = ""
            limit_str = ""

            if sort_match:
                field = sort_match.group(1)
                desc = "True" if sort_match.group(2) == "-1" else "False"
                order_str = f', order="{field}", order_desc={desc}'
                extra_end = paren_end + 1 + sort_match.end()
                after2 = content[extra_end:extra_end + 100]
                limit_match2 = re.match(r'\.(?:to_list|limit)\((\d+)\)', after2)
                if limit_match2:
                    limit_str = f', limit={limit_match2.group(1)}'
                    extra_end += limit_match2.end()
                else:
                    to_list_match = re.match(r'\.to_list\([^)]*\)', after2)
                    if to_list_match:
                        extra_end += to_list_match.end()
            else:
                to_list_match = re.match(r'\.to_list\([^)]*\)', after)
                if to_list_match:
                    extra_end = paren_end + 1 + to_list_match.end()
                    lm = re.search(r'\.to_list\((\d+)\)', to_list_match.group(0))
                    if lm and lm.group(1) != "None":
                        limit_str = f', limit={lm.group(1)}'
                limit_only = re.match(r'\.limit\((\d+)\)', after)
                if limit_only:
                    limit_str = f', limit={limit_only.group(1)}'
                    extra_end = paren_end + 1 + limit_only.end()

            if first_dict and first_dict.strip() != '{}':
                replacement = f'select("{table}", filters={clean_filter(first_dict)}{order_str}{limit_str})'
            else:
                replacement = f'select("{table}"{order_str}{limit_str})'

            # Replace the full expression including .sort().to_list()
            full_end = extra_end
            full_start = call_start
            # Check if 'await' precedes
            pre_check = content[max(0, call_start - 10):call_start]
            if 'await' in pre_check:
                await_pos = content.rfind('await', max(0, call_start - 10), call_start)
                if await_pos >= 0:
                    full_start = await_pos

            content = content[:full_start] + (prefix.lstrip() if assignment else '') + replacement + content[full_end:]
            converted += 1
            offset = full_start + len(replacement)
            continue

        elif method in ('update_one', 'update_many'):
            # Extract filter dict
            first_dict, fd_start, fd_end = extract_first_dict(args_text)
            if first_dict:
                remaining = args_text[fd_end + 1:].strip()
                if remaining.startswith(','):
                    remaining = remaining[1:].strip()

                # Look for $set
                set_idx = remaining.find('$set')
                if set_idx >= 0:
                    # Find the { after $set
                    colon_idx = remaining.find(':', set_idx)
                    if colon_idx >= 0:
                        after_colon = remaining[colon_idx + 1:].strip()
                        set_dict, _, _ = extract_first_dict(after_colon)
                        if set_dict:
                            replacement = f'update("{table}", {clean_filter(first_dict)}, {set_dict})'

                # $inc
                if not replacement:
                    inc_idx = remaining.find('$inc')
                    if inc_idx >= 0:
                        colon_idx = remaining.find(':', inc_idx)
                        if colon_idx >= 0:
                            after_colon = remaining[colon_idx + 1:].strip()
                            inc_dict, _, _ = extract_first_dict(after_colon)
                            if inc_dict:
                                fields = re.findall(r'["\'](\w+)["\']:\s*(-?\d+)', inc_dict)
                                if fields:
                                    lines = []
                                    lines.append(f'# $inc read-modify-write')
                                    lines.append(f'\n{indent}_d = select("{table}", filters={clean_filter(first_dict)}, single=True)')
                                    lines.append(f'\n{indent}if _d:')
                                    parts = ', '.join(f'"{f}": _d.get("{f}", 0) + {a}' for f, a in fields)
                                    lines.append(f'\n{indent}    update("{table}", {clean_filter(first_dict)}, {{{parts}}})')
                                    replacement = ''.join(lines)

                # $unset
                if not replacement:
                    unset_idx = remaining.find('$unset')
                    if unset_idx >= 0:
                        replacement = f'update("{table}", {clean_filter(first_dict)}, {{}})  # $unset — set fields to None'

                # $push
                if not replacement:
                    push_idx = remaining.find('$push')
                    if push_idx >= 0:
                        replacement = f'# $push needs array append logic\n{indent}update("{table}", {clean_filter(first_dict)}, {{}})  # TODO: implement $push'

                # Fallback: just use the full second arg as data
                if not replacement:
                    second_dict, _, _ = extract_first_dict(remaining)
                    if second_dict:
                        replacement = f'update("{table}", {clean_filter(first_dict)}, {second_dict})'

        elif method == 'insert_one':
            replacement = f'insert("{table}", {args_text})'

        elif method == 'insert_many':
            replacement = f'# insert_many\n{indent}for _item in {args_text}:\n{indent}    insert("{table}", _item)'

        elif method in ('delete_one', 'delete_many'):
            first_dict, _, _ = extract_first_dict(args_text)
            if first_dict:
                replacement = f'delete("{table}", {clean_filter(first_dict)})'

        elif method == 'count_documents':
            first_dict, _, _ = extract_first_dict(args_text)
            if first_dict and first_dict.strip() != '{}':
                replacement = f'count("{table}", {clean_filter(first_dict)})'
            else:
                replacement = f'count("{table}")'

        if replacement:
            # Replace the full call (including await if present)
            full_start = call_start
            full_end = paren_end + 1
            pre_check = content[max(0, call_start - 10):call_start]
            if 'await' in pre_check:
                await_pos = content.rfind('await', max(0, call_start - 10), call_start)
                if await_pos >= 0:
                    full_start = await_pos

            content = content[:full_start] + replacement + content[full_end:]
            converted += 1
            offset = full_start + len(replacement)
        else:
            offset = paren_end + 1

    # Clean orphan TODOs
    lines = content.split('\n')
    clean = []
    for i, line in enumerate(lines):
        if '# TODO:' in line and 'needs manual conversion' in line:
            # Check if next non-blank line is already converted
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                j += 1
            if j < len(lines) and any(lines[j].strip().startswith(x) for x in ('select(', 'insert(', 'update(', 'delete(', 'count(')):
                continue
        clean.append(line)
    content = '\n'.join(clean)

    with open(filepath, 'w') as f:
        f.write(content)

    remaining = len([l for l in content.split('\n') if re.search(r'db\.\w+\.(?:find|insert|update|delete|count)', l) and not l.strip().startswith('#')])
    todos = content.count('# TODO:')
    print(f"Converted: {converted}")
    print(f"Remaining db calls: {remaining}")
    print(f"TODOs: {todos}")

if __name__ == "__main__":
    convert(sys.argv[1])
