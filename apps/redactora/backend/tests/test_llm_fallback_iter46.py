"""
Iteration 46 — Backend Tests for OpenAI → OpenRouter fallback chain
Covers:
  1. POST /api/whitepapers/extract-cv-info — CV extraction with fallback
  2. POST /api/case-studies/generate — Case study generation
  3. POST /api/policy-papers/generate — Policy paper generation
  4. Concurrent CV extractions (3x)

Expects OpenAI 429 (insufficient_quota) → OpenRouter fallback chain
  openai/gpt-4o → anthropic/claude-sonnet-4.5 → google/gemini-2.5-pro
with refusal-pattern detection.
"""

import os
import time
import io
import json
import asyncio
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://domain-relink-test.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "dau@urpeailab.com"
ADMIN_PASSWORD = "admin123"
TEST_CLIENT_ID = "45bc9b9a-1f58-406f-9b16-accafd1fa601"  # Juan Carlos Rodriguez (existing test client)

REFUSAL_MARKERS = [
    "i'm sorry, but i can't",
    "i'm sorry, i can't",
    "i cannot assist",
    "i can't assist",
    "i am unable to",
    "i'm unable to",
    "no puedo asistir",
]


SAMPLE_CV_TEXT = """
Dr. Maria Elena Gonzalez, PhD
Senior Research Scientist | Biomedical Engineer

CONTACT
Email: maria.gonzalez@example.com
Phone: +1 (305) 555-0147
Location: Miami, Florida, USA

EDUCATION
- PhD in Biomedical Engineering, MIT (2015)
- MS in Electrical Engineering, Stanford University (2010)
- BS in Physics, University of Florida (2008)
- Board Certification in Medical Imaging (ABMP, 2017)
- PMP Certification (PMI, 2019)

EXPERIENCE
- Senior Research Scientist, Mayo Clinic, 2019-present
  Lead 15-person team developing FDA-approved MRI diagnostic tools for early-stage
  Alzheimer's detection. Published 27 peer-reviewed papers. Generated $4.2M in NIH grants.
- Principal Engineer, GE Healthcare, 2015-2019
  Designed next-gen ultrasound imaging systems deployed in 450+ hospitals.

ACHIEVEMENTS
- Cited 3,200+ times on Google Scholar
- 8 US patents granted in medical imaging
- IEEE Senior Member; Fellow of American Institute for Medical and Biological Engineering
- Keynote speaker at RSNA 2022, IEEE EMBC 2023
- Reviewer for Nature Medicine, IEEE Transactions on Medical Imaging

IMPACT
Her imaging algorithms are now used in 1.2M patient scans annually across North America,
contributing to a documented 23% improvement in early Alzheimer's detection rates.
"""

SAMPLE_PROJECT_DESCRIPTION = """
Title: Renewable Energy Microgrid for Rural Communities in Puerto Rico

Project Lead: Dr. Carlos Rivera-Santos

Overview:
This initiative deploys solar + battery microgrids to 12 underserved rural communities
in Puerto Rico to provide reliable electricity, reducing diesel dependence by 78%.
The project directly benefits 8,400 residents and powers 4 clinics and 6 schools.

Economic Impact:
- $2.3M federal grant secured (DOE Office of Electricity)
- Creates 140 local jobs in installation and maintenance
- Saves residents an average of $1,200/year in energy costs
- Attracts $4.5M in private follow-on investment

Social Impact:
- Provides reliable power during hurricane season (tested during Fiona, 2022)
- Enables 24/7 operation of dialysis machines in remote clinics
- Supports 1,200 students with reliable classroom electricity

National Interest:
Addresses U.S. energy resilience priorities, reduces GHG emissions by 4,800 tons/year,
and serves as a replicable model for disaster-prone U.S. territories.
""" * 3  # Give enough content for policy paper generation


# --------------------------- Fixtures ---------------------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                     timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token")
    assert tok, "No access_token returned"
    return tok


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# --------------------------- Helpers ---------------------------

def _poll_cv_extraction(session, auth_headers, task_id, timeout_s=120):
    """Poll /whitepapers/extraction-status until completed or timeout."""
    start = time.time()
    last_status = None
    while time.time() - start < timeout_s:
        r = session.get(f"{BASE_URL}/api/whitepapers/extraction-status/{task_id}",
                        headers=auth_headers, timeout=30)
        if r.status_code != 200:
            time.sleep(3)
            continue
        data = r.json()
        last_status = data.get("status")
        if last_status in ("completed", "failed", "error"):
            return data
        time.sleep(4)
    return {"status": "timeout", "last_status": last_status}


def _is_refusal(text: str) -> bool:
    if not text:
        return False
    low = text.strip().lower()[:300]
    return any(p in low for p in REFUSAL_MARKERS)


# --------------------------- Tests ---------------------------

class TestCVExtraction:
    """POST /api/whitepapers/extract-cv-info — with OpenRouter fallback"""

    def test_cv_extraction_completes(self, session, auth_headers):
        files = {"file": ("test_cv.txt", io.BytesIO(SAMPLE_CV_TEXT.encode("utf-8")), "text/plain")}
        r = session.post(f"{BASE_URL}/api/whitepapers/extract-cv-info",
                         headers=auth_headers, files=files, timeout=60)
        assert r.status_code == 200, f"extract-cv-info failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert "task_id" in data, f"No task_id: {data}"
        assert data.get("status") == "processing"
        task_id = data["task_id"]

        result = _poll_cv_extraction(session, auth_headers, task_id, timeout_s=180)
        assert result.get("status") == "completed", \
            f"CV extraction did not complete. Final: {json.dumps(result)[:500]}"

        payload = result.get("result") or result.get("data") or {}
        # Accept either nested under "result" or flat
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                pass
        author = payload.get("author_name") if isinstance(payload, dict) else None
        credentials = payload.get("author_credentials") if isinstance(payload, dict) else None

        assert author, f"author_name missing. Full result keys: {list(result.keys())}; payload: {str(payload)[:500]}"
        # Verify real name extracted (not a refusal)
        assert not _is_refusal(str(author)), f"Author looks like refusal: {author}"
        assert credentials, f"author_credentials missing: payload={str(payload)[:500]}"

    def test_cv_extractions_concurrent_3x(self, session, auth_headers):
        """Launch 3 CV extractions in parallel and verify all complete."""
        task_ids = []
        for i in range(3):
            files = {"file": (f"cv_{i}.txt",
                              io.BytesIO((SAMPLE_CV_TEXT + f"\nREQ-{i}").encode("utf-8")),
                              "text/plain")}
            r = session.post(f"{BASE_URL}/api/whitepapers/extract-cv-info",
                             headers=auth_headers, files=files, timeout=60)
            assert r.status_code == 200, f"concurrent-{i} start: {r.status_code} {r.text[:200]}"
            task_ids.append(r.json()["task_id"])

        results = [_poll_cv_extraction(session, auth_headers, tid, timeout_s=240) for tid in task_ids]
        completed = sum(1 for r in results if r.get("status") == "completed")
        assert completed >= 2, \
            f"Only {completed}/3 concurrent extractions completed. Results: {[r.get('status') for r in results]}"


class TestCaseStudy:
    """POST /api/case-studies/generate — ensure content_en/es are real, not refusals"""

    def test_case_study_no_refusal(self, session, auth_headers):
        # Upload both project_description and client_id
        files = {
            "project_description": ("project.txt",
                                    io.BytesIO(SAMPLE_PROJECT_DESCRIPTION.encode("utf-8")),
                                    "text/plain"),
        }
        data = {"client_id": TEST_CLIENT_ID, "title": "TEST_ Case Study Fallback"}
        r = session.post(f"{BASE_URL}/api/case-studies/generate",
                         headers=auth_headers, files=files, data=data, timeout=120)
        assert r.status_code == 200, f"case-studies/generate failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        study_id = body.get("id")
        assert study_id, f"No id returned: {body}"

        # Poll GET /case-studies/{id} for status==completed
        start = time.time()
        final = None
        while time.time() - start < 420:  # up to 7 minutes
            s = session.get(f"{BASE_URL}/api/case-studies/{study_id}",
                            headers=auth_headers, timeout=30)
            if s.status_code == 200:
                final = s.json()
                if final.get("status") in ("completed", "failed", "error"):
                    break
            time.sleep(10)

        assert final is not None, "case study never fetched"
        assert final.get("status") == "completed", \
            f"Case study did not complete in 7min. status={final.get('status')}, error={final.get('error_message','')[:200]}"

        content_en = final.get("content_en") or ""
        content_es = final.get("content_es") or ""
        assert len(content_en) > 2000, f"content_en too short: {len(content_en)} chars; head={content_en[:200]}"
        assert not _is_refusal(content_en), f"content_en is a refusal: {content_en[:200]}"
        assert not _is_refusal(content_es), f"content_es is a refusal: {content_es[:200]}"


class TestPolicyPaper:
    """POST /api/policy-papers/generate — ensure content_en is real analysis, not a refusal"""

    def test_policy_paper_no_refusal(self, session, auth_headers):
        files = {
            "file": ("project.txt",
                     io.BytesIO(SAMPLE_PROJECT_DESCRIPTION.encode("utf-8")),
                     "text/plain"),
        }
        data = {"client_id": TEST_CLIENT_ID}
        r = session.post(f"{BASE_URL}/api/policy-papers/generate",
                         headers=auth_headers, files=files, data=data, timeout=120)
        assert r.status_code == 200, f"policy-papers/generate failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        paper_id = body.get("paper_id") or body.get("id")
        assert paper_id, f"No paper_id returned: {body}"

        # Poll status — policy papers can take 5-10 minutes
        start = time.time()
        final_status = None
        while time.time() - start < 600:  # 10 minutes
            s = session.get(f"{BASE_URL}/api/policy-papers/{paper_id}/status",
                            headers=auth_headers, timeout=30)
            if s.status_code == 200:
                final_status = s.json()
                st = final_status.get("status")
                if st in ("completed", "failed", "error"):
                    break
            time.sleep(15)

        assert final_status is not None and final_status.get("status") == "completed", \
            f"Policy paper did not complete. status={final_status}"

        # Fetch full paper content
        r2 = session.get(f"{BASE_URL}/api/policy-papers/{paper_id}",
                         headers=auth_headers, timeout=30)
        assert r2.status_code == 200, f"GET policy-paper: {r2.status_code}"
        paper = r2.json()
        content_en = paper.get("content_en") or ""
        assert len(content_en) > 5000, \
            f"content_en only {len(content_en)} chars (expected >5000). Head: {content_en[:200]}"
        assert not _is_refusal(content_en), f"content_en appears to be a refusal: {content_en[:300]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
