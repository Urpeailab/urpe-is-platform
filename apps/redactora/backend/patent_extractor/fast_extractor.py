"""Fast patent information extractor using regex patterns"""

import re
import logging
from typing import Dict, Any
from .patterns import compile_patterns, STATUS_KEYWORDS

logger = logging.getLogger(__name__)

# Compile patterns once at module load
COMPILED_PATTERNS = compile_patterns()

def fast_extract_patent_info(text: str) -> Dict[str, Any]:
    """
    Fast extraction using regex patterns and keyword matching.
    Works best with structured documents from USPTO, EPO, WIPO.
    
    Args:
        text: Extracted text from patent document
        
    Returns:
        Dict with extracted data, confidence score, and method
    """
    extracted = {}
    confidence_score = 0
    total_fields = 8  # Number of fields we try to extract
    
    # Limit text for faster processing (most info is in first pages)
    text_sample = text[:10000] if len(text) > 10000 else text
    
    # 1. Patent Number
    patent_number = _extract_with_patterns(text_sample, COMPILED_PATTERNS['patent_number'])
    if patent_number:
        extracted['patent_number'] = patent_number
        confidence_score += 1
    
    # 2. Application Number
    application_number = _extract_with_patterns(text_sample, COMPILED_PATTERNS['application_number'])
    if application_number:
        extracted['application_number'] = application_number
        confidence_score += 1
    
    # 3. Filing Date
    filing_date = _extract_with_patterns(text_sample, COMPILED_PATTERNS['filing_date'])
    if filing_date:
        extracted['filing_date'] = filing_date
        confidence_score += 1
    
    # 4. Publication Date
    publication_date = _extract_with_patterns(text_sample, COMPILED_PATTERNS['publication_date'])
    if publication_date:
        extracted['publication_date'] = publication_date
        confidence_score += 0.5  # Less critical
    
    # 5. Patent Status
    status = _extract_status(text_sample)
    if status:
        extracted['patent_status'] = status
        confidence_score += 1
    
    # 6. Title
    title = _extract_title(text_sample)
    if title:
        extracted['patent_title'] = title
        confidence_score += 1.5  # Title is very important
    
    # 7. Inventors
    inventors = _extract_with_patterns(text_sample, COMPILED_PATTERNS['inventors'])
    if inventors:
        extracted['inventors'] = inventors
        confidence_score += 1
    
    # 8. Abstract
    abstract = _extract_abstract(text[:5000])  # Look in first 5000 chars
    if abstract:
        extracted['abstract'] = abstract
        confidence_score += 1
    
    # Calculate confidence percentage
    confidence_percentage = (confidence_score / total_fields) * 100
    
    logger.info(f"Fast extraction completed with {confidence_percentage:.1f}% confidence")
    logger.info(f"Extracted fields: {list(extracted.keys())}")
    
    return {
        'data': extracted,
        'confidence': confidence_percentage,
        'method': 'fast_extraction',
        'fields_found': len(extracted),
        'total_fields': total_fields
    }

def _extract_with_patterns(text: str, patterns: list) -> str:
    """Try multiple patterns and return first match"""
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            # Return the first capturing group if it exists, otherwise the whole match
            result = match.group(1) if len(match.groups()) > 0 else match.group(0)
            return result.strip()
    return ''

def _extract_status(text: str) -> str:
    """Extract patent status using keywords"""
    text_lower = text.lower()
    
    # Look in first 2000 characters where status usually appears
    search_text = text_lower[:2000]
    
    # Priority order
    for keyword in STATUS_KEYWORDS:
        # Look for keyword near context words
        if keyword.lower() in search_text:
            # Check if it appears near relevant context
            if any(ctx in search_text for ctx in ['status', 'patent', 'application']):
                return keyword
    
    # Fallback: check for any keyword in first part
    for keyword in STATUS_KEYWORDS:
        if keyword.lower() in search_text:
            return keyword
    
    return ''

def _extract_title(text: str) -> str:
    """Extract patent title with special handling"""
    # Try patterns first
    for pattern in COMPILED_PATTERNS['title']:
        match = pattern.search(text[:2000])  # Look in first 2000 chars
        if match:
            title = match.group(1) if len(match.groups()) > 0 else match.group(0)
            title = title.strip()
            
            # Clean up title
            title = re.sub(r'\s+', ' ', title)  # Normalize whitespace
            title = title.split('\n')[0]  # Take only first line
            
            # Validate title length
            if 10 <= len(title) <= 200:
                return title
    
    # Fallback: look for first substantial line that looks like a title
    lines = text.split('\n')
    for line in lines[:20]:  # Check first 20 lines
        line = line.strip()
        if 20 <= len(line) <= 200 and not line.startswith(('Page', 'Patent', 'Application', 'United States')):
            # Check if it looks like a title (capitalized, no special formatting)
            if line[0].isupper() and not re.match(r'^\d+', line):
                return line
    
    return ''

def _extract_abstract(text: str) -> str:
    """Extract abstract/summary"""
    for pattern in COMPILED_PATTERNS['abstract']:
        match = pattern.search(text)
        if match:
            abstract = match.group(1) if len(match.groups()) > 0 else match.group(0)
            abstract = abstract.strip()
            
            # Clean up
            abstract = re.sub(r'\s+', ' ', abstract)
            
            # Return if reasonable length
            if 50 <= len(abstract) <= 2000:
                return abstract
    
    return ''
