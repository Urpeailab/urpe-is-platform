"""Intelligent patent extraction using GPT-4o-mini (fallback only)"""

import json
import logging
import os
from typing import Dict, Any
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_MESSAGE = """You are a patent document analyzer. Extract structured information from patent documents quickly and accurately. Return ONLY valid JSON, no additional text."""

USER_PROMPT_TEMPLATE = """Extract the following information from this patent document text:

**Required Fields:**
- patent_title: The title of the invention
- patent_number: Patent or publication number (if available, e.g., US1234567B1)
- application_number: Application number (if available)
- filing_date: Filing date (if available)
- patent_status: Status (choose one: Granted, Pending, Published, Application, or "Not found")
- inventors: Names of inventors/applicants
- abstract: Brief summary of the invention (max 500 words)
- key_innovation: What makes this patent unique (1-2 sentences)

**Document Text:**
```
{document_text}
```

**Important:**
- If a field is not found, use "No especificado"
- Return ONLY valid JSON in this exact format:
{{
  "patent_title": "...",
  "patent_number": "...",
  "application_number": "...",
  "filing_date": "...",
  "patent_status": "...",
  "inventors": "...",
  "abstract": "...",
  "key_innovation": "..."
}}
"""

async def intelligent_extract_patent_info(text: str) -> Dict[str, Any]:
    """
    GPT-4o-mini based extraction for unstructured documents.
    Only called when fast_extraction has low confidence.
    
    Args:
        text: Extracted text from patent document
        
    Returns:
        Dict with extracted data, confidence, and method
    """
    try:
        logger.info("Starting intelligent extraction with GPT-4o-mini...")
        
        # Truncate text to first 4000 characters to save tokens
        text_truncated = text[:4000] if len(text) > 4000 else text
        
        # Prepare prompt
        user_prompt = USER_PROMPT_TEMPLATE.format(document_text=text_truncated)
        
        # Call GPT-4o-mini via OpenAI directly
        client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        llm_response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_MESSAGE},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )

        # Parse response
        extracted = json.loads(llm_response.choices[0].message.content)
        
        logger.info("Intelligent extraction completed successfully")
        logger.info(f"Extracted fields: {list(extracted.keys())}")
        
        return {
            'data': extracted,
            'confidence': 90,  # GPT-based extraction assumed high confidence
            'method': 'intelligent_extraction'
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from GPT response: {e}")
        return {
            'data': {},
            'confidence': 0,
            'method': 'intelligent_extraction',
            'error': 'Failed to parse GPT response'
        }
    except Exception as e:
        logger.error(f"Error in intelligent extraction: {e}")
        return {
            'data': {},
            'confidence': 0,
            'method': 'intelligent_extraction',
            'error': str(e)
        }
