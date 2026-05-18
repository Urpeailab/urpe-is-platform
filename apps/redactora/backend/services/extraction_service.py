"""
Extraction service for Self-Petition V2 documents
Handles detailed data extraction from classified documents using GPT-4o
"""
import logging
import json
from typing import Optional

# These will be injected from the main app
db = None
openai_client = None


def init_service(database, client):
    """Initialize the service with database and OpenAI client"""
    global db, openai_client
    db = database
    openai_client = client


async def extract_recommendation_letter_details(text: str, classification: dict) -> dict:
    """Extract detailed information from a recommendation letter"""
    prompt = f"""Analyze this recommendation letter and extract detailed information.

LETTER CONTENT:
{text[:12000]}

Extract in JSON format:
{{
    "signer_name": "Full name of the recommender",
    "signer_title": "Professional title",
    "signer_institution": "Organization/University",
    "relationship": "How they know the applicant",
    "years_known": "How long they've known the applicant",
    "key_endorsements": ["List of specific skills/qualities they endorse"],
    "specific_examples": ["Specific achievements or projects mentioned"],
    "quotes_for_petition": ["3-5 powerful quotes that can be used in the petition"],
    "prong_relevance": {{
        "prong1_merit": "How this letter supports substantial merit",
        "prong2_positioned": "How this supports well-positioned argument",
        "prong3_waiver": "How this supports waiver justification"
    }}
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Extract detailed information from recommendation letters for EB-2 NIW petitions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=3000,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result['filename'] = classification.get('filename')
        result['exhibit_number'] = classification.get('exhibit_number')
        return result
    except Exception as e:
        return {"filename": classification.get('filename'), "error": str(e)}


async def extract_credential_details(text: str, classification: dict) -> dict:
    """Extract details from academic credentials"""
    prompt = f"""Analyze this academic credential document.

DOCUMENT:
{text[:8000]}

Extract in JSON:
{{
    "credential_type": "Degree type (Bachelor's, Master's, PhD, Certificate)",
    "field_of_study": "Major/Specialization",
    "institution": "University/School name",
    "graduation_date": "Date of completion",
    "honors": "Any honors or distinctions",
    "relevance_to_petition": "How this credential supports the NIW petition"
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result['filename'] = classification.get('filename')
        result['exhibit_number'] = classification.get('exhibit_number')
        return result
    except Exception as e:
        return {"filename": classification.get('filename'), "error": str(e)}


async def extract_cv_details(text: str, classification: dict) -> dict:
    """Extract detailed CV/resume information"""
    prompt = f"""Analyze this CV/Resume and extract comprehensive career information.

CV CONTENT:
{text[:15000]}

Extract in JSON:
{{
    "professional_summary": "Brief summary of career trajectory",
    "education": [
        {{"degree": "", "field": "", "institution": "", "year": ""}}
    ],
    "work_experience": [
        {{"title": "", "organization": "", "duration": "", "key_achievements": []}}
    ],
    "publications": ["List of publications if any"],
    "awards": ["List of awards/recognition"],
    "skills": ["Key professional skills"],
    "leadership_roles": ["Leadership positions held"],
    "total_years_experience": "X years",
    "key_strengths_for_niw": ["Top 5 strengths relevant for NIW petition"]
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result['filename'] = classification.get('filename')
        return result
    except Exception as e:
        return {"filename": classification.get('filename'), "error": str(e)}


async def extract_publication_details(text: str, classification: dict) -> dict:
    """Extract publication details"""
    prompt = f"""Analyze this publication/article.

CONTENT:
{text[:10000]}

Extract in JSON:
{{
    "title": "Publication title",
    "authors": ["List of authors"],
    "publication_venue": "Journal/Conference/Book",
    "year": "Publication year",
    "abstract_summary": "Brief summary of the work",
    "impact": "Impact or citations if mentioned",
    "relevance_to_niw": "How this supports the NIW petition"
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result['filename'] = classification.get('filename')
        result['exhibit_number'] = classification.get('exhibit_number')
        return result
    except Exception as e:
        return {"filename": classification.get('filename'), "error": str(e)}


async def extract_project_details(text: str, classification: dict) -> dict:
    """Extract project/study details"""
    prompt = f"""Analyze this project or study document.

CONTENT:
{text[:12000]}

Extract in JSON:
{{
    "project_title": "Name of the project/study",
    "description": "Brief description",
    "objectives": ["Key objectives"],
    "methodology": "Approach used",
    "results": ["Key findings or results"],
    "impact": "Impact or significance",
    "applicant_role": "Role of the applicant in this project",
    "relevance_to_niw": "How this supports the NIW petition"
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result['filename'] = classification.get('filename')
        result['exhibit_number'] = classification.get('exhibit_number')
        return result
    except Exception as e:
        return {"filename": classification.get('filename'), "error": str(e)}


async def synthesize_applicant_profile(applicant_name: str, extracted_data: dict) -> dict:
    """Synthesize all extracted data into a cohesive applicant profile"""
    
    synthesis_prompt = f"""Based on the following extracted information, create a comprehensive applicant profile for {applicant_name}'s EB-2 NIW petition.

RECOMMENDATION LETTERS:
{json.dumps(extracted_data.get('recommendation_letters', []), indent=2, default=str)[:8000]}

ACADEMIC CREDENTIALS:
{json.dumps(extracted_data.get('academic_credentials', []), indent=2, default=str)[:4000]}

PROFESSIONAL EXPERIENCE:
{json.dumps(extracted_data.get('professional_experience', []), indent=2, default=str)[:6000]}

PUBLICATIONS:
{json.dumps(extracted_data.get('publications', []), indent=2, default=str)[:3000]}

PROJECTS:
{json.dumps(extracted_data.get('projects', []), indent=2, default=str)[:4000]}

Create a synthesized profile in JSON:
{{
    "applicant_name": "{applicant_name}",
    "professional_title": "Most appropriate professional title",
    "field_of_expertise": "Primary field",
    "years_of_experience": "Total years",
    "highest_degree": "Highest academic qualification",
    "current_position": "Current role and organization",
    
    "prong1_substantial_merit": {{
        "proposed_endeavor": "Description of the proposed endeavor",
        "national_importance": "Why it matters nationally",
        "supporting_evidence": ["List of evidence supporting merit"]
    }},
    
    "prong2_well_positioned": {{
        "academic_qualifications": ["Key academic credentials"],
        "professional_track_record": ["Key professional achievements"],
        "recognition_by_experts": ["Summary of expert endorsements"],
        "unique_skills": ["What makes this applicant uniquely qualified"]
    }},
    
    "prong3_waiver_justification": {{
        "entrepreneurial_nature": "Why this is entrepreneurial/self-directed",
        "urgency": "Why timing matters",
        "no_displacement": "Why no US workers are displaced"
    }},
    
    "strongest_evidence": ["Top 5 pieces of evidence for this case"],
    "recommendation_letter_summary": ["One-line summary of each recommendation letter with signer name"]
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert immigration attorney synthesizing evidence for an EB-2 NIW petition."},
                {"role": "user", "content": synthesis_prompt}
            ],
            temperature=0.4,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logging.error(f"Error synthesizing profile: {e}")
        return {"applicant_name": applicant_name, "error": str(e)}
