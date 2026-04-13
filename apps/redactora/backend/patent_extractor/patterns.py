"""Regex patterns and keywords for patent information extraction"""

import re

# Patent Number Patterns
PATENT_NUMBER_PATTERNS = [
    r'US\d{7,10}[A-Z]\d?',  # US patents: US1234567B1
    r'EP\d{7}[A-Z]\d?',  # European patents: EP1234567A1
    r'WO\d{4}/\d{6}',  # WIPO: WO2023/123456
    r'PCT/[A-Z]{2}\d{4}/\d{6}',  # PCT: PCT/US2023/123456
    r'Publication\s+No\.?[:\s]+([A-Z]{2}\d{7,10}[A-Z]?\d?)',
    r'Patent\s+No\.?[:\s]+([A-Z]{2}\d{7,10}[A-Z]?\d?)',
    r'Application\s+No\.?[:\s]+(\d{2}/\d{3},\d{3})',  # US application format
]

# Filing Date Patterns
FILING_DATE_PATTERNS = [
    r'Filing\s+Date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})',
    r'Filed[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})',
    r'Application\s+Date[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
    r'Date\s+of\s+Filing[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
    r'Filed[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
    r'Application\s+filed[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})',
]

# Publication Date Patterns
PUBLICATION_DATE_PATTERNS = [
    r'Publication\s+Date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})',
    r'Published[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})',
    r'Pub\.?\s+Date[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
]

# Patent Title Patterns
TITLE_PATTERNS = [
    r'(?:Title|Invention\s+Title)[:\s]+(.+?)(?:\n|Inventor)',
    r'^([A-Z][A-Z\s,]+(?:[A-Z][a-z]+[\s,]*)+)\n(?:Patent|Application)',  # All caps or title case
    r'Title\s+of\s+Invention[:\s]+(.+?)(?:\n)',
    r'^(.{10,100})\n{2,}',  # First substantial line before double newline
]

# Inventors Patterns
INVENTOR_PATTERNS = [
    r'Inventor(?:s)?[:\s]+(.+?)(?:\n\n|Assignee|Abstract|Address)',
    r'Applicant[:\s]+(.+?)(?:\n\n|Address|Abstract)',
    r'Inventor\(s\)[:\s]+(.+?)(?:\n)',
]

# Assignee/Applicant Patterns
ASSIGNEE_PATTERNS = [
    r'Assignee[:\s]+(.+?)(?:\n\n|Address)',
    r'Applicant[:\s]+(.+?)(?:\n\n)',
]

# Abstract Patterns
ABSTRACT_PATTERNS = [
    r'Abstract[:\s]+(.{100,1500})(?:\n\n|BACKGROUND|FIELD)',
    r'ABSTRACT[:\s]+(.{100,1500})(?:\n\n|BACKGROUND)',
    r'Summary[:\s]+(.{100,1500})(?:\n\n)',
]

# Application Number Patterns
APPLICATION_NUMBER_PATTERNS = [
    r'Application\s+No\.?[:\s]+(\d{2}/\d{3},\d{3})',
    r'Serial\s+No\.?[:\s]+(\d{2}/\d{3},\d{3})',
    r'Appl\.\s+No\.?[:\s]+(\d+)',
]

# Status Keywords
STATUS_KEYWORDS = ['Granted', 'Pending', 'Published', 'Application', 'Issued', 'Abandoned', 'Expired']

# Field of Invention Patterns
FIELD_PATTERNS = [
    r'Field\s+of\s+(?:the\s+)?Invention[:\s]+(.+?)(?:\n\n|BACKGROUND)',
    r'Technical\s+Field[:\s]+(.+?)(?:\n\n)',
]

def compile_patterns():
    """Compile all regex patterns for better performance"""
    return {
        'patent_number': [re.compile(p, re.IGNORECASE) for p in PATENT_NUMBER_PATTERNS],
        'filing_date': [re.compile(p, re.IGNORECASE) for p in FILING_DATE_PATTERNS],
        'publication_date': [re.compile(p, re.IGNORECASE) for p in PUBLICATION_DATE_PATTERNS],
        'title': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in TITLE_PATTERNS],
        'inventors': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in INVENTOR_PATTERNS],
        'assignee': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in ASSIGNEE_PATTERNS],
        'abstract': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in ABSTRACT_PATTERNS],
        'application_number': [re.compile(p, re.IGNORECASE) for p in APPLICATION_NUMBER_PATTERNS],
        'field': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in FIELD_PATTERNS],
    }
