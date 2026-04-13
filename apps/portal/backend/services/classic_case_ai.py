"""
Classic Cases - Document Analysis with AI (Gemini)
Extracts IOE numbers from I-797C letters and analyzes RFE documents.
"""
import os
import re
import logging
import base64
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_KEY = os.environ.get("GEMINI_API_KEY_VISION", os.environ.get("GEMINI_API_KEY", ""))


def _get_client():
    return genai.Client(api_key=GEMINI_KEY)



async def extract_tracking_from_document(file_bytes: bytes, filename: str) -> dict:
    """Extract tracking number from a shipping receipt (FedEx, USPS, UPS, DHL)."""
    if not GEMINI_KEY:
        return {"success": False, "error": "GEMINI_API_KEY not configured"}

    try:
        client = _get_client()
        mime = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(parts=[
                    types.Part(inline_data=types.Blob(mime_type=mime, data=file_bytes)),
                    types.Part(text=(
                        "This is a shipping receipt or label. Extract:\n"
                        "1. Tracking number\n"
                        "2. Shipping company (FedEx, USPS, UPS, DHL)\n\n"
                        "Return ONLY a JSON object with keys: trackingNumber, shippingCompany. "
                        "If you cannot find a field, use null."
                    ))
                ])
            ]
        )

        text = response.text.strip()
        import json
        json_match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {"success": True, **data}

        return {"success": False, "error": "No se pudo extraer el tracking"}

    except Exception as e:
        logger.error(f"Tracking extraction error: {e}")
        return {"success": False, "error": str(e)}



async def extract_ioe_from_document(file_bytes: bytes, filename: str) -> dict:
    """Extract IOE number from I-797C USCIS receipt notice."""
    if not GEMINI_KEY:
        return {"success": False, "error": "GEMINI_API_KEY not configured"}

    try:
        client = _get_client()
        b64 = base64.b64encode(file_bytes).decode()
        mime = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(parts=[
                    types.Part(inline_data=types.Blob(mime_type=mime, data=file_bytes)),
                    types.Part(text=(
                        "This is a USCIS I-797C receipt notice. Extract the following:\n"
                        "1. Receipt Number (IOE number, format: IOE + 10 digits)\n"
                        "2. Receipt Date\n"
                        "3. Beneficiary Name\n"
                        "4. Form Type (e.g. I-140)\n\n"
                        "Return ONLY a JSON object with keys: receiptNumber, receiptDate, beneficiaryName, formType. "
                        "If you cannot find a field, use null."
                    ))
                ])
            ]
        )

        text = response.text.strip()
        # Extract JSON from response
        import json
        json_match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {"success": True, **data}

        # Try regex fallback for IOE
        ioe_match = re.search(r'(IOE\d{10,13})', text)
        if ioe_match:
            return {"success": True, "receiptNumber": ioe_match.group(1)}

        return {"success": False, "error": "No se pudo extraer el IOE del documento", "rawText": text[:200]}

    except Exception as e:
        logger.error(f"IOE extraction error: {e}")
        return {"success": False, "error": str(e)}


async def analyze_rfe_document(file_bytes: bytes, filename: str) -> dict:
    """Analyze RFE document to extract key points and deadline."""
    if not GEMINI_KEY:
        return {"success": False, "error": "GEMINI_API_KEY not configured"}

    try:
        client = _get_client()
        mime = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(parts=[
                    types.Part(inline_data=types.Blob(mime_type=mime, data=file_bytes)),
                    types.Part(text=(
                        "This is a USCIS Request for Evidence (RFE) document. Analyze it and extract:\n"
                        "1. What evidence USCIS is requesting (list each point)\n"
                        "2. The response deadline date\n"
                        "3. The receipt number\n"
                        "4. A brief summary of the key issues\n\n"
                        "Return a JSON object with keys: evidenceRequested (array of strings), deadline, receiptNumber, summary. "
                        "If you cannot find a field, use null."
                    ))
                ])
            ]
        )

        text = response.text.strip()
        import json
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {"success": True, **data}

        return {"success": False, "error": "No se pudo analizar el RFE", "rawText": text[:500]}

    except Exception as e:
        logger.error(f"RFE analysis error: {e}")
        return {"success": False, "error": str(e)}


async def analyze_devolucion_document(file_bytes: bytes, filename: str) -> dict:
    """Analyze USCIS return/rejection document."""
    if not GEMINI_KEY:
        return {"success": False, "error": "GEMINI_API_KEY not configured"}

    try:
        client = _get_client()
        mime = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(parts=[
                    types.Part(inline_data=types.Blob(mime_type=mime, data=file_bytes)),
                    types.Part(text=(
                        "This is a USCIS rejection/return notice. Extract:\n"
                        "1. The reason for rejection/return\n"
                        "2. The receipt number\n"
                        "3. Any instructions for resubmission\n\n"
                        "Return a JSON object with keys: reason, receiptNumber, instructions. "
                        "If you cannot find a field, use null."
                    ))
                ])
            ]
        )

        text = response.text.strip()
        import json
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {"success": True, **data}

        return {"success": False, "error": "No se pudo analizar el documento", "rawText": text[:500]}

    except Exception as e:
        logger.error(f"Devolucion analysis error: {e}")
        return {"success": False, "error": str(e)}


async def generate_rfe_strategy(rfe_analysis: str, case_info: str) -> dict:
    """Generate an AI strategy to respond to an RFE."""
    if not GEMINI_KEY:
        return {"success": False, "error": "GEMINI_API_KEY not configured"}

    try:
        client = _get_client()

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=(
                f"You are an immigration attorney specialized in EB-2 NIW cases.\n\n"
                f"RFE Analysis:\n{rfe_analysis}\n\n"
                f"Case Info:\n{case_info}\n\n"
                f"Generate a detailed response strategy for this RFE. Include:\n"
                f"1. Key points to address\n"
                f"2. Evidence to gather\n"
                f"3. Arguments to make\n"
                f"4. Recommended timeline\n\n"
                f"Write in Spanish. Be specific and actionable."
            )
        )

        return {"success": True, "strategy": response.text.strip()}

    except Exception as e:
        logger.error(f"RFE strategy generation error: {e}")
        return {"success": False, "error": str(e)}
