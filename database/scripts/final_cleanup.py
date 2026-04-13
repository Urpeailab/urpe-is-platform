"""Final pass: replace ALL remaining bare db.X.method() calls."""

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

counter = [0]

def t(col):
    return TABLE_MAP.get(col, col)

def do_find_one(m):
    counter[0] += 1
    pre, col, filt = m.group(1), m.group(2), m.group(3)
    filt = filt.replace("'_id'", "'id'").replace('"_id"', '"id"')
    return f'{pre}select("{t(col)}", filters={filt}, single=True)'

def do_find_list(m):
    counter[0] += 1
    pre, col, filt = m.group(1), m.group(2), m.group(3)
    if filt.strip() == '{}':
        return f'{pre}select("{t(col)}")'
    return f'{pre}select("{t(col)}", filters={filt})'

def do_insert(m):
    counter[0] += 1
    pre, col, data = m.group(1), m.group(2), m.group(3)
    return f'{pre}insert("{t(col)}", {data})'

def do_delete(m):
    counter[0] += 1
    pre, col, filt = m.group(1), m.group(2), m.group(3)
    filt = filt.replace("'_id'", "'id'")
    return f'{pre}delete("{t(col)}", {filt})'

def do_count(m):
    counter[0] += 1
    pre, col, filt = m.group(1), m.group(2), m.group(3)
    if filt.strip() == '{}':
        return f'{pre}count("{t(col)}")'
    return f'{pre}count("{t(col)}", {filt})'


filepath = sys.argv[1]
with open(filepath) as f:
    content = f.read()

# find_one({...})
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.find_one\((\{[^)]+\})\)',
    do_find_one, content)

# find({}).to_list(...)
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.find\((\{[^)]*\})\)\.to_list\([^)]*\)',
    do_find_list, content)

# find({}).sort(...).to_list(...)
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.find\((\{[^)]*\})\)\.sort\([^)]+\)\.to_list\([^)]*\)',
    do_find_list, content)

# insert_one(...)
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.insert_one\(([^)]+)\)',
    do_insert, content)

# delete_one/many({...})
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.delete_(?:one|many)\((\{[^)]+\})\)',
    do_delete, content)

# count_documents({...})
content = re.sub(
    r'([ \t]*)(?:await\s+)?db\.(\w+)\.count_documents\((\{[^)]*\})\)',
    do_count, content)

with open(filepath, 'w') as f:
    f.write(content)

remaining = len(re.findall(r'db\.\w+\.(?:find|insert|update|delete|count)', content))
todos = content.count('# TODO:')
print(f"Converted: {counter[0]}")
print(f"Remaining db.X calls: {remaining}")
print(f"Remaining TODOs: {todos}")
