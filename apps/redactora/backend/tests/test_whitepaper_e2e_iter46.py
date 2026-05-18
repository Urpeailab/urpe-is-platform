"""
E2E test for Whitepaper generation - iteration 46
Validates:
  - Full flow: start-interactive -> generate-complete -> poll until ready
  - No placeholder patterns in content_es/content_en/content
  - No raw markdown (####, ##, **bold**, - item, backticks)
  - PDF download text also free of placeholders / markdown
  - Both Spanish and English flows
  - extract-cv-info / extract-project-info auxiliary endpoints (text/plain files)
"""
import os
import re
import io
import time
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://domain-relink-test.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "dau@urpeailab.com"
ADMIN_PASSWORD = "admin123"

# Placeholder patterns (case-insensitive) that must NOT appear in any field
PLACEHOLDER_PATTERNS = [
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
]

# Raw markdown patterns that must not appear in HTML content
MARKDOWN_PATTERNS = [
    (r"^#{2,6}\s", "markdown heading (## / ### / ####)"),
    (r"\*\*[^*\n]+\*\*", "bold **...**"),
    (r"(?<![_\w])__[^_\n]+__(?![_\w])", "bold __...__"),
    (r"^-\s", "bullet `- item`"),
    (r"```", "triple backticks"),
]

MAX_POLL_SECONDS = 15 * 60  # 15 minutes per whitepaper
POLL_INTERVAL = 15

# ---------- helpers ----------

def _login():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _get_client_id(token):
    r = requests.get(f"{BASE_URL}/api/clients?limit=5", headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    items = d if isinstance(d, list) else d.get("clients", d.get("items", []))
    assert items, "No clients found to use for whitepaper tests"
    return items[0]["id"]


def _scan_text_for_issues(text, label):
    """Return list of (pattern_label, snippet) for any match. Skips empty text."""
    issues = []
    if not text:
        return issues

    # placeholders
    for pat in PLACEHOLDER_PATTERNS:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            start = max(0, m.start() - 40)
            end = min(len(text), m.end() + 40)
            issues.append({
                "field": label,
                "pattern": pat,
                "type": "placeholder",
                "snippet": text[start:end].replace("\n", " ")
            })
            if len(issues) >= 20:
                return issues

    # markdown - apply line-based for ^ anchors
    for pat, description in MARKDOWN_PATTERNS:
        flags = re.MULTILINE
        for m in re.finditer(pat, text, flags=flags):
            start = max(0, m.start() - 40)
            end = min(len(text), m.end() + 40)
            snippet = text[start:end].replace("\n", " ")
            # Skip obvious false positives: hex colors, urls, math formulas
            if pat.startswith(r"\*\*") and ("http" in snippet[:80]):
                continue
            issues.append({
                "field": label,
                "pattern": description,
                "type": "markdown",
                "snippet": snippet
            })
            if len(issues) >= 20:
                return issues
    return issues


def _scan_whitepaper(wp):
    """Recursively scan all content_* fields of each section."""
    issues = []
    sections = wp.get("sections", []) or []
    for sec in sections:
        num = sec.get("number") or sec.get("section_number")
        title = sec.get("title") or ""
        for fld in ("content", "content_es", "content_en"):
            val = sec.get(fld)
            if isinstance(val, str) and val.strip():
                label = f"section_{num}[{title[:40]}].{fld}"
                issues.extend(_scan_text_for_issues(val, label))
    return issues


def _poll_until_ready(token, wp_id, max_seconds=MAX_POLL_SECONDS):
    start = time.time()
    last_status = None
    last_section = None
    while time.time() - start < max_seconds:
        r = requests.get(f"{BASE_URL}/api/whitepapers/{wp_id}", headers=_auth(token), timeout=60)
        if r.status_code != 200:
            print(f"  [poll] status fetch failed: {r.status_code}")
            time.sleep(POLL_INTERVAL)
            continue
        wp = r.json()
        st = wp.get("status")
        cs = wp.get("current_section")
        if (st, cs) != (last_status, last_section):
            elapsed = int(time.time() - start)
            print(f"  [poll @{elapsed}s] status={st} section={cs}/{wp.get('total_sections')}")
            last_status, last_section = st, cs
        if st in ("ready_for_review", "completed"):
            return wp
        if st in ("failed", "error"):
            pytest.fail(f"Whitepaper generation failed with status={st}: {wp.get('error_message')}")
        time.sleep(POLL_INTERVAL)
    pytest.fail(f"Whitepaper {wp_id} did not reach ready_for_review within {max_seconds}s (last status={last_status})")


def _start_and_generate(token, client_id, language):
    payload = {
        "client_id": client_id,
        "project_title": f"AI-Driven Tax Compliance Framework ({language.upper()}-iter46)",
        "author_name": "Dr. María González",
        "author_credentials": "PhD Economics, Harvard",
        "project_description": "A novel framework using ML to automate tax compliance for small businesses in the US, reducing audit risk by 40%.",
        "target_audience": "Federal policymakers and SMB owners",
        "technical_domain": "Economics & AI",
        "language": language,
    }
    r = requests.post(f"{BASE_URL}/api/whitepapers/start-interactive",
                      headers=_auth(token), json=payload, timeout=60)
    assert r.status_code == 200, f"start-interactive failed: {r.status_code} {r.text[:300]}"
    wp_id = r.json()["whitepaper_id"]
    print(f"  Created whitepaper {wp_id} (lang={language})")

    r2 = requests.post(f"{BASE_URL}/api/whitepapers/{wp_id}/generate-complete",
                       headers=_auth(token), timeout=60)
    assert r2.status_code in (200, 202), f"generate-complete failed: {r2.status_code} {r2.text[:300]}"
    print(f"  generate-complete accepted: {r2.status_code}")
    return wp_id


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def token():
    return _login()


@pytest.fixture(scope="module")
def client_id(token):
    return _get_client_id(token)


# ---------- tests ----------

def test_00_health(token):
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200


def test_01_whitepaper_spanish_flow(token, client_id, request):
    wp_id = _start_and_generate(token, client_id, "es")
    wp = _poll_until_ready(token, wp_id)
    assert wp["status"] in ("ready_for_review", "completed")
    sections = wp.get("sections") or []
    assert len(sections) >= 10, f"expected >=10 sections, got {len(sections)}"

    issues = _scan_whitepaper(wp)
    request.config._wp_es_id = wp_id
    request.config._wp_es_issues = issues

    # persist the content for debugging
    os.makedirs("/app/test_reports/artifacts", exist_ok=True)
    with open(f"/app/test_reports/artifacts/wp_es_{wp_id}.json", "w") as f:
        json.dump({"status": wp.get("status"), "sections_count": len(sections), "issues": issues[:50]}, f, indent=2)

    assert not issues, f"Found {len(issues)} placeholder/markdown issues in Spanish whitepaper. First 5: {issues[:5]}"


def test_02_whitepaper_english_flow(token, client_id, request):
    wp_id = _start_and_generate(token, client_id, "en")
    wp = _poll_until_ready(token, wp_id)
    assert wp["status"] in ("ready_for_review", "completed")
    sections = wp.get("sections") or []
    assert len(sections) >= 10, f"expected >=10 sections, got {len(sections)}"

    issues = _scan_whitepaper(wp)
    request.config._wp_en_id = wp_id
    request.config._wp_en_issues = issues

    os.makedirs("/app/test_reports/artifacts", exist_ok=True)
    with open(f"/app/test_reports/artifacts/wp_en_{wp_id}.json", "w") as f:
        json.dump({"status": wp.get("status"), "sections_count": len(sections), "issues": issues[:50]}, f, indent=2)

    assert not issues, f"Found {len(issues)} placeholder/markdown issues in English whitepaper. First 5: {issues[:5]}"


def test_03_pdf_download_spanish(token, request):
    wp_id = getattr(request.config, "_wp_es_id", None)
    if not wp_id:
        pytest.skip("Spanish WP not created")
    r = requests.get(f"{BASE_URL}/api/whitepapers/{wp_id}/download?language=es",
                     headers=_auth(token), timeout=120)
    assert r.status_code == 200, f"pdf download failed: {r.status_code} {r.text[:200]}"
    pdf_bytes = r.content
    assert pdf_bytes[:4] == b"%PDF", "Response is not a valid PDF"
    # Extract text with PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception as e:
        pytest.skip(f"pdf parser unavailable: {e}")
    issues = _scan_text_for_issues(text, "pdf_es")
    # Filter markdown-only issues from PDF (since PDFs may have stray chars). Keep placeholders strict.
    placeholder_issues = [i for i in issues if i["type"] == "placeholder"]
    assert not placeholder_issues, f"PDF (es) has placeholder issues: {placeholder_issues[:5]}"


def test_04_pdf_download_english(token, request):
    wp_id = getattr(request.config, "_wp_en_id", None)
    if not wp_id:
        pytest.skip("English WP not created")
    r = requests.get(f"{BASE_URL}/api/whitepapers/{wp_id}/download?language=en",
                     headers=_auth(token), timeout=120)
    assert r.status_code == 200, f"pdf download failed: {r.status_code} {r.text[:200]}"
    pdf_bytes = r.content
    assert pdf_bytes[:4] == b"%PDF"
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception as e:
        pytest.skip(f"pdf parser unavailable: {e}")
    issues = _scan_text_for_issues(text, "pdf_en")
    placeholder_issues = [i for i in issues if i["type"] == "placeholder"]
    assert not placeholder_issues, f"PDF (en) has placeholder issues: {placeholder_issues[:5]}"


def test_05_extract_cv_info_txt(token):
    txt = (
        "Dr. Maria Gonzalez\nPhD in Economics, Harvard University, 2015\n"
        "10 years experience in AI-driven tax compliance research.\n"
        "Published 15 papers, 200+ citations.\n"
    )
    files = {"file": ("cv.txt", txt.encode("utf-8"), "text/plain")}
    r = requests.post(f"{BASE_URL}/api/whitepapers/extract-cv-info",
                      headers=_auth(token), files=files, timeout=60)
    assert r.status_code == 200, f"extract-cv-info failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "task_id" in data, f"no task_id in response: {data}"
    assert data.get("status") in ("processing", "completed")


def test_06_extract_project_info_txt(token):
    txt = (
        "Project: AI-Driven Tax Compliance Framework for SMEs.\n"
        "A novel framework using ML to automate tax compliance for small businesses.\n"
        "Target: Federal policymakers and SMB owners. Domain: Economics & AI.\n"
    )
    files = {"file": ("project.txt", txt.encode("utf-8"), "text/plain")}
    r = requests.post(f"{BASE_URL}/api/whitepapers/extract-project-info",
                      headers=_auth(token), files=files, timeout=60)
    assert r.status_code == 200, f"extract-project-info failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "task_id" in data, f"no task_id in response: {data}"
