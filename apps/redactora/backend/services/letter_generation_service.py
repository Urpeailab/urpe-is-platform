"""
Letter generation service for Self-Petition V2
Handles drafting the letter in English and translating to Spanish using GPT-5.1
"""
import logging
import json
import re
from typing import Optional

# These will be injected from the main app
db = None
openai_client = None


def init_service(database, client):
    """Initialize the service with database and OpenAI client"""
    global db, openai_client
    db = database
    openai_client = client


def clean_content(content: str) -> str:
    """Remove AI meta-commentary and notes from the generated content"""
    if not content:
        return content
    
    # Patterns to remove
    patterns_to_remove = [
        r'(?i)\*\*?NOTE[S]?\s*(TO\s*(THE\s*)?(REVIEWER|EDITOR|USER))?\*?\*?:?.*?(?=\n\n|\n<|\Z)',
        r'(?i)\*\*?NOTA\s*(PARA\s*(EL\s*)?(REVISOR|EDITOR))?\*?\*?:?.*?(?=\n\n|\n<|\Z)',
        r'(?i)\[NOTE[S]?\s*(TO\s*(THE\s*)?(REVIEWER|EDITOR))?\]:?.*?(?=\n\n|\n<|\Z)',
        r'(?i)\[NOTA\s*(PARA\s*(EL\s*)?(REVISOR|EDITOR))?\]:?.*?(?=\n\n|\n<|\Z)',
        r'(?i)---+\s*NOTE[S]?\s*---+.*?(?=\n\n|\n<|\Z)',
        r'(?i)---+\s*NOTA[S]?\s*---+.*?(?=\n\n|\n<|\Z)',
        r'(?i)<aside>.*?</aside>',
        r'(?i)<!--.*?-->',
        r'(?i)\(Note:.*?\)',
        r'(?i)\(Nota:.*?\)',
    ]
    
    cleaned = content
    for pattern in patterns_to_remove:
        cleaned = re.sub(pattern, '', cleaned, flags=re.DOTALL)
    
    # Remove excessive whitespace
    cleaned = re.sub(r'\n{4,}', '\n\n\n', cleaned)
    
    return cleaned.strip()


async def draft_v2_letter_english(applicant_name: str, profile: dict, extracted_data: dict, classifications: list) -> str:
    """Draft the complete self-petition letter in English using GPT-5"""
    from datetime import datetime as _dt
    today_str = _dt.now().strftime("%B %d, %Y")
    
    # Build exhibit reference list
    exhibit_list = "\n".join([
        f"Exhibit {c.get('exhibit_number', i+1)}: {c.get('filename')} ({c.get('document_type', 'document')})"
        for i, c in enumerate(classifications)
    ])
    
    # Get recommendation letter details for proper citation
    rec_letters = extracted_data.get('recommendation_letters', [])
    rec_letter_details = "\n".join([
        f"- {r.get('signer_name', 'Unknown')} ({r.get('signer_title', '')}, {r.get('signer_institution', '')}): Exhibit {r.get('exhibit_number', 'N/A')}\n  Key Quote: \"{r.get('key_quote', 'N/A')}\""
        for r in rec_letters
    ])
    
    # Get professional experience details
    prof_exp = extracted_data.get('professional_experience', [])
    prof_exp_summary = json.dumps(prof_exp, indent=2, default=str)[:5000] if prof_exp else "Not available"
    
    # Get academic credentials
    credentials = extracted_data.get('academic_credentials', [])
    credentials_summary = json.dumps(credentials, indent=2, default=str)[:3000] if credentials else "Not available"
    
    # Get projects/studies
    projects = extracted_data.get('projects', [])
    projects_summary = json.dumps(projects, indent=2, default=str)[:4000] if projects else "Not available"
    
    draft_prompt = f"""Write a COMPREHENSIVE and DETAILED EB-2 NIW self-petition cover letter for {applicant_name}.

CURRENT DATE: {today_str} — Use this as the letter date throughout the document.

CRITICAL: This letter must be 22-27 pages long and thoroughly analyze EVERY aspect of the Dhanasar standard.

=== APPLICANT PROFILE (USE THIS DATA) ===
{json.dumps(profile, indent=2, default=str)}

=== RECOMMENDATION LETTERS (QUOTE THESE DIRECTLY) ===
{rec_letter_details}

=== PROFESSIONAL EXPERIENCE ===
{prof_exp_summary}

=== ACADEMIC CREDENTIALS ===
{credentials_summary}

=== PROJECTS AND STUDIES ===
{projects_summary}

=== EXHIBIT LIST (REFERENCE BY NUMBER) ===
{exhibit_list}

=== REQUIRED STRUCTURE (FOLLOW EXACTLY) ===

SECTION I: INTRODUCTION AND PURPOSE OF THIS PETITION
   A. Current Employment and Professional Context (2-3 paragraphs)
   B. The Central Purpose of This Petition (2-3 paragraphs)
   C. Why This Petition Qualifies Under the Dhanasar Standard (brief overview)
   D. Structure of This Letter (navigation guide)

SECTION II: COMPLIANCE WITH THE DHANASAR STANDARD - DETAILED ANALYSIS

   PRONG 1: THE PROPOSED ENDEAVOR HAS SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE
   (This section should be 6-8 pages)
   - A. The Problem of National Importance: Context and Magnitude
     * Include statistics, research data, federal recognition
   - B. The Proposed Solution: What {applicant_name} Offers
     * Detail specific methodologies, innovations, approaches
   - C. Quantitative Evidence of National Impact
     * Include projected economic impact, cost savings, beneficiaries
   - D. Alignment with Federal Priorities and Regional Needs
     * Reference specific federal programs, executive orders, policy papers
   - E. Why Current Solutions Are Insufficient
     * Explain gaps that only this applicant can fill

   PRONG 2: I AM WELL POSITIONED TO ADVANCE THE PROPOSED ENDEAVOR
   (This section should be 8-10 pages)
   - A. Advanced Academic Credentials
     * Detail each degree, institution, relevance
   - B. Verifiable and Progressive Professional Experience (20+ Years if applicable)
     * CURRENT POSITION
     * PREVIOUS POSITIONS
     * INTERNATIONAL EXPERIENCE (if any)
     * Summary table of experience
   - C. Intellectual Property and Proprietary Methodologies
     * Detail unique frameworks, approaches, innovations developed
   - D. Recognition by Multidisciplinary Experts
     * QUOTE EACH RECOMMENDATION LETTER with exhibit number
     * Include signer name, title, institution, and direct quote
   - E. Evidence of Execution Capacity
     * Projects already underway, collaborations, track record

   PRONG 3: IT WOULD BENEFIT THE UNITED STATES TO WAIVE THE JOB OFFER AND LABOR CERTIFICATION REQUIREMENTS
   (This section should be 5-7 pages)
   - A. Unique Nature of the Proposed Project (Not Traditional Employment)
   - B. Urgency of the National Interest Problem (Time Matters)
   - C. The PERM Process Is Not Appropriate for This Case (Legal Analysis)
   - D. Balance of Interests: National vs. Standard Process
   - E. Precedents and Consistency with USCIS Policy
   - F. No Conflict with U.S. Workers

SECTION III: CONCLUSION AND FORMAL PETITION
   - A. Summary of Evidence Presented
   - B. Why This Case Merits Approval
   - C. Consistency with Precedents and Policy
   - D. Formal Petition and Request
   - E. Personal Final Statement

SECTION IV: COMPLETE LIST OF EXHIBITS
   (List all exhibits organized by category)

=== WRITING INSTRUCTIONS ===
1. Write in FIRST PERSON ("I submit this petition...", "My work demonstrates...")
2. Reference SPECIFIC EXHIBITS by number frequently (e.g., "As documented in Exhibit 5...")
3. QUOTE recommendation letters DIRECTLY with attribution ("According to [Name], '[quote]' (Exhibit X)")
4. Use PROFESSIONAL, LEGAL-TECHNICAL language appropriate for USCIS adjudicators
5. Include SPECIFIC DATA, statistics, and CONCRETE examples from the documents
6. Be EXHAUSTIVE - every claim must be supported by evidence
7. Format in proper HTML: <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul><li> for lists
8. Include proper spacing and organization for readability

=== CRITICAL RULES - DO NOT VIOLATE ===
- DO NOT include ANY notes to the reviewer, editor, or any meta-commentary
- DO NOT include phrases like "NOTE:", "NOTA:", "Note to reviewer", "This document", etc.
- DO NOT include any explanations about the document itself or its limitations
- DO NOT include any HTML wrapper tags like <html>, <head>, <body>
- START DIRECTLY with the content: <h1>SECTION I: INTRODUCTION...</h1>
- The output must be ONLY the professional letter content, nothing else"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-5.1-2025-11-13",
            messages=[
                {"role": "system", "content": "You are an expert immigration attorney with 20+ years of experience drafting successful EB-2 NIW self-petition cover letters. Your letters are known for being comprehensive, well-organized, and persuasive. You always use evidence from the provided documents and quote recommendation letters directly."},
                {"role": "user", "content": draft_prompt}
            ],
            temperature=0.7,
            max_completion_tokens=32000
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Error drafting letter: {e}")
        raise


async def translate_v2_letter_to_spanish(content_en: str) -> str:
    """Translate the letter to Spanish using GPT-4o"""
    
    # Split into chunks if too long
    max_chunk = 12000
    if len(content_en) <= max_chunk:
        chunks = [content_en]
    else:
        # Split by sections
        chunks = []
        current_chunk = ""
        for line in content_en.split('\n'):
            if len(current_chunk) + len(line) > max_chunk:
                chunks.append(current_chunk)
                current_chunk = line
            else:
                current_chunk += '\n' + line
        if current_chunk:
            chunks.append(current_chunk)
    
    translated_chunks = []
    for i, chunk in enumerate(chunks):
        translation_prompt = f"""Translate this EB-2 NIW self-petition letter section from English to Spanish.

REQUIREMENTS:
- Maintain professional, formal legal tone
- Preserve all HTML formatting
- Keep exhibit references as-is (Exhibit 1, Exhibit 2, etc.)
- Translate technical terms accurately
- Produce native-sounding Spanish

ENGLISH TEXT:
{chunk}

Provide ONLY the Spanish translation."""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Eres un traductor legal profesional especializado en documentos de inmigración de EE.UU."},
                    {"role": "user", "content": translation_prompt}
                ],
                temperature=0.3,
                max_tokens=16000
            )
            translated_chunks.append(response.choices[0].message.content)
        except Exception as e:
            logging.error(f"Error translating chunk {i+1}: {e}")
            translated_chunks.append(chunk)  # Fallback to English
    
    return '\n'.join(translated_chunks)
