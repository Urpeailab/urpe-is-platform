"""End-to-end validation for Whitepaper placeholder/markdown cleanup.

Uses OpenRouter fallback configured in server.py.
Runs a full generate-complete flow then scans the final content and PDF
for residual placeholders and literal markdown.
"""
import os
import re
import sys
import time
import json
import subprocess
import argparse
import requests

API_URL = subprocess.check_output(
    "grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2",
    shell=True,
).decode().strip()

ADMIN_EMAIL = "dau@urpeailab.com"
ADMIN_PASSWORD = "admin123"

# Patrones críticos (case-insensitive) que NO deben aparecer en contenido final
FORBIDDEN_BRACKET_TOKENS = [
    r"\[pending information\]",
    r"\[organization\]",
    r"\[start date\]",
    r"\[end date\]",
    r"\[company name\]",
    r"\[company\]",
    r"\[name\]",
    r"\[date\]",
    r"\[location\]",
    r"\[institution\]",
    r"\[university\]",
    r"\[tbd\]",
    r"\[insert[^\]]*\]",
    r"\[specify[^\]]*\]",
    r"\[describe[^\]]*\]",
    r"\[your [^\]]*\]",
]

# Markdown literal que no debe quedar crudo
FORBIDDEN_MARKDOWN = [
    (r"(?m)^#{2,6}\s", "heading ####"),
    (r"\*\*[^\*\n]{1,120}\*\*", "bold **...**"),
    (r"__[^_\n]{2,120}__", "bold __...__"),
    (r"(?m)^\s*-\s", "list hyphen '- '"),
    (r"```", "triple backtick"),
]


def login():
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def get_client_id(token):
    r = requests.get(
        f"{API_URL}/api/clients?limit=1",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    clients = data if isinstance(data, list) else data.get("clients", data)
    return clients[0]["id"]


def start_whitepaper(token, client_id, language="en"):
    payload = {
        "client_id": client_id,
        "project_title": "AI-Driven Tax Compliance Framework for SMEs",
        "author_name": "Dr. Maria Gonzalez",
        "author_credentials": "PhD in Economics, Harvard University",
        "project_description": (
            "A novel framework using machine learning to automate tax "
            "compliance for small and medium businesses in the US, "
            "reducing audit risk by 40% and improving IRS reporting accuracy."
        ),
        "target_audience": "Federal policymakers and SMB owners",
        "technical_domain": "Economics and Artificial Intelligence",
        "language": language,
    }
    r = requests.post(
        f"{API_URL}/api/whitepapers/start-interactive",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["whitepaper_id"]


def trigger_generate(token, wid):
    r = requests.post(
        f"{API_URL}/api/whitepapers/{wid}/generate-complete",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    print(f"  generate-complete -> {r.status_code}: {r.text[:200]}")
    return r.status_code in (200, 202)


def poll_until_ready(token, wid, timeout_sec=1500, interval=20):
    start = time.time()
    last_status = None
    while time.time() - start < timeout_sec:
        try:
            r = requests.get(
                f"{API_URL}/api/whitepapers/{wid}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=60,
            )
            if r.status_code == 200:
                doc = r.json()
                st = doc.get("status")
                secs = len(doc.get("sections") or [])
                if st != last_status:
                    print(f"  [{int(time.time()-start)}s] status={st}, sections={secs}")
                    last_status = st
                if st in ("ready_for_review", "completed", "finalized", "ready"):
                    return doc
                if st in ("failed", "error"):
                    return doc
        except Exception as e:
            print(f"  poll error: {e}")
        time.sleep(interval)
    return None


def scan_text(label, text, findings):
    if not isinstance(text, str):
        return
    for pattern in FORBIDDEN_BRACKET_TOKENS:
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            ctx = text[max(0, m.start() - 40): m.end() + 40]
            findings.append({
                "where": label,
                "type": "placeholder",
                "match": m.group(0),
                "context": ctx,
            })
    for pattern, name in FORBIDDEN_MARKDOWN:
        for m in re.finditer(pattern, text):
            ctx = text[max(0, m.start() - 40): m.end() + 40]
            findings.append({
                "where": label,
                "type": f"markdown:{name}",
                "match": m.group(0),
                "context": ctx,
            })


def scan_document(doc):
    findings = []
    for i, sec in enumerate(doc.get("sections") or []):
        for field in ("content_es", "content_en", "content", "title", "title_es", "title_en"):
            val = sec.get(field)
            if val:
                scan_text(f"section[{i}].{field}", val, findings)
    return findings


def extract_pdf_text(pdf_bytes):
    try:
        from pypdf import PdfReader
        from io import BytesIO
        reader = PdfReader(BytesIO(pdf_bytes))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception as e:
        try:
            import pdfplumber
            from io import BytesIO
            with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
                return "\n".join((p.extract_text() or "") for p in pdf.pages)
        except Exception as e2:
            return f"[[pdf-extract-failed: {e} / {e2}]]"


def download_pdf(token, wid):
    r = requests.get(
        f"{API_URL}/api/whitepapers/{wid}/download",
        headers={"Authorization": f"Bearer {token}"},
        timeout=180,
    )
    if r.status_code != 200:
        return None, r.status_code
    return r.content, 200


def run(language):
    print(f"=== Whitepaper E2E validation [language={language}] ===")
    token = login()
    client_id = get_client_id(token)
    print(f"  client_id={client_id}")
    wid = start_whitepaper(token, client_id, language=language)
    print(f"  whitepaper_id={wid}")
    if not trigger_generate(token, wid):
        return {"ok": False, "error": "trigger failed", "wid": wid}
    doc = poll_until_ready(token, wid, timeout_sec=1500, interval=25)
    if doc is None:
        return {"ok": False, "error": "timeout", "wid": wid}
    if doc.get("status") in ("failed", "error"):
        return {"ok": False, "error": "status failed", "wid": wid, "status": doc.get("status"), "error_msg": doc.get("error_message")}
    findings = scan_document(doc)
    pdf_findings = []
    pdf_bytes, code = download_pdf(token, wid)
    if pdf_bytes:
        text = extract_pdf_text(pdf_bytes)
        scan_text("pdf", text, pdf_findings)
    else:
        pdf_findings.append({"where": "pdf", "type": "download_failed", "match": str(code)})
    return {
        "ok": len(findings) == 0 and not any(f.get("type") != "download_failed" for f in pdf_findings) and not pdf_findings or (len(findings) == 0 and len(pdf_findings) == 0),
        "wid": wid,
        "status": doc.get("status"),
        "section_count": len(doc.get("sections") or []),
        "content_findings": findings[:50],
        "content_findings_total": len(findings),
        "pdf_findings": pdf_findings[:50],
        "pdf_findings_total": len(pdf_findings),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="en", choices=["en", "es"])
    parser.add_argument("--out", default="/app/test_reports/e2e_whitepaper.json")
    args = parser.parse_args()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    result = run(args.lang)
    # append if already exists
    previous = {}
    if os.path.exists(args.out):
        try:
            previous = json.load(open(args.out))
        except Exception:
            previous = {}
    previous[args.lang] = result
    with open(args.out, "w") as f:
        json.dump(previous, f, indent=2)
    print(json.dumps(result, indent=2)[:3000])
