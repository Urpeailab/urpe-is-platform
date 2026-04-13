"""
USCIS Case Status Scraper Service
Fetches real-time case status from egov.uscis.gov
"""
import httpx
import re
import logging
from datetime import datetime, timezone
from typing import Optional, Dict

logger = logging.getLogger(__name__)

USCIS_URL = "https://egov.uscis.gov/casestatus/mycasestatus.do"

FORM_NAMES = {
    "I-140": "Immigrant Petition for Alien Workers",
    "I-129": "Petition for Nonimmigrant Worker",
    "I-485": "Application to Register Permanent Residence",
    "I-765": "Application for Employment Authorization",
    "I-131": "Application for Travel Document",
    "I-130": "Petition for Alien Relative",
    "I-539": "Application to Extend/Change Nonimmigrant Status",
    "I-90": "Application to Replace Permanent Resident Card",
    "I-751": "Petition to Remove Conditions on Residence",
    "I-821D": "Consideration of Deferred Action for Childhood Arrivals",
}

STATUS_MAPPING = {
    # Approved (green)
    "approved": "approved",
    "case approved": "approved",
    "case was approved": "approved",
    "has been approved": "approved",
    "new card is being produced": "approved",
    "card was delivered": "approved",
    "card was mailed": "approved",
    # Denied (red)
    "denied": "denied",
    "case denied": "denied",
    "case was denied": "denied",
    "rejected": "denied",
    "case was rejected": "denied",
    # RFE (orange)
    "request for evidence": "rfe",
    "request for additional evidence": "rfe",
    "we sent a request": "rfe",
    "rfe": "rfe",
    # Received (blue)
    "case was received": "received",
    "we received your": "received",
    "response received": "received",
    "response to uscis": "received",
    "fingerprint fee was received": "received",
    "we have cancelled the request": "received",
    # Reviewing (blue)
    "actively reviewing": "reviewing",
    "being actively reviewed": "reviewing",
    "we are reviewing": "reviewing",
    "case is still being processed": "reviewing",
    "interview was scheduled": "reviewing",
    "case was updated": "reviewing",
    "case was transferred": "reviewing",
}


def _classify_status(status_text: str) -> str:
    """Classify USCIS status text into a category."""
    lower = status_text.lower().strip()
    for key, val in STATUS_MAPPING.items():
        if key in lower:
            return val
    if "approved" in lower or "granted" in lower:
        return "approved"
    if "denied" in lower or "rejected" in lower:
        return "denied"
    if "evidence" in lower and "sent" in lower:
        return "rfe"
    if "received" in lower:
        return "received"
    return "reviewing"


def _extract_form_type(text: str) -> Optional[str]:
    """Extract form type from USCIS status text."""
    match = re.search(r"Form (I-\d+\w*)", text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    for form in FORM_NAMES:
        if form.lower() in text.lower():
            return form
    return None


def _extract_date(text: str) -> Optional[str]:
    """Extract date from USCIS status text."""
    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}",
        r"(\d{1,2}/\d{1,2}/\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)
    return None


async def fetch_uscis_status(receipt_number: str) -> Dict:
    """
    Fetch case status from USCIS website.
    Returns dict with status info or error.
    """
    receipt = receipt_number.strip().upper()

    if not re.match(r"^[A-Z]{3}\d{10,13}$", receipt):
        return {"success": False, "error": "Numero de recibo invalido. Formato: 3 letras + 10-13 digitos (ej: IOE0923898213)"}

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # First get the page to obtain any session cookies
            initial = await client.get(
                "https://egov.uscis.gov/casestatus/mycasestatus.do",
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )

            response = await client.post(
                USCIS_URL,
                data={"appReceiptNum": receipt, "caseStatusSearchBtn": "CHECK STATUS"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": "https://egov.uscis.gov",
                    "Referer": "https://egov.uscis.gov/casestatus/mycasestatus.do",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )

            if response.status_code != 200:
                return {"success": False, "error": f"USCIS respondio con status {response.status_code}"}

            html = response.text

            # Extract status title
            title_match = re.search(r'<h1>(.*?)</h1>', html, re.DOTALL)
            status_title = title_match.group(1).strip() if title_match else ""

            # Extract status description
            desc_match = re.search(r'class="rows text-center">\s*<p>(.*?)</p>', html, re.DOTALL)
            if not desc_match:
                desc_match = re.search(r'<div class="rows text-center">(.*?)</div>', html, re.DOTALL)
            status_description = ""
            if desc_match:
                status_description = re.sub(r"<[^>]+>", "", desc_match.group(1)).strip()

            if not status_title and not status_description:
                return {"success": False, "error": "No se pudo obtener el estado del caso. Verifica el numero de recibo."}

            # Classify
            status_category = _classify_status(status_title)
            form_type = _extract_form_type(status_description) or _extract_form_type(status_title)
            status_date = _extract_date(status_description)

            return {
                "success": True,
                "receiptNumber": receipt,
                "statusTitle": status_title,
                "statusDescription": status_description,
                "status": status_category,
                "formType": form_type,
                "statusDate": status_date,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
            }

    except httpx.TimeoutException:
        return {"success": False, "error": "Tiempo de espera agotado al consultar USCIS"}
    except Exception as e:
        logger.error(f"USCIS scraping error for {receipt}: {e}")
        return {"success": False, "error": f"Error al consultar USCIS: {str(e)}"}
