"""
Intent Letters — Third-party Letter of Intent contract tests.

The intent_letters module produces ONLY third-party Letters of Intent —
signed by an employer / investor / client / collaborator who supports the
petitioner. All three documents (petitioner_cv, project_info, signer_cv)
are REQUIRED. These tests verify the HTTP contract without running the
full LLM generation (which takes 2-3 minutes and costs money).
"""

import io
import os
import time

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dau@urpeailab.com",
        "password": "admin123"
    })
    if res.status_code != 200:
        pytest.skip(f"Login failed: {res.status_code} {res.text}")
    return res.json().get("access_token")


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Minimal synthetic input documents (just enough to pass the upload layer) ──

def _minimal_cv_text(name="Dr. Jane Petitioner", org="Stanford University"):
    return (
        f"CURRICULUM VITAE\n{name}\n"
        f"PhD in Biomedical Engineering, {org}, 2015.\n"
        f"Current: Senior Research Scientist at {org}.\n"
        f"15 years experience in clinical decision support.\n"
        f"Publications: 12. Patents: 3. Grants: $2.1M NIH R01.\n"
    )


def _minimal_project_text():
    return (
        "PROPOSED ENDEAVOR: Development of an AI-powered diagnostic platform "
        "for rural U.S. hospitals, reducing misdiagnosis rates by 30% and "
        "serving 14 states in underserved regions. Aligns with HHS Rural "
        "Health Strategic Initiative and 21st Century Cures Act. Projected "
        "impact: 75 jobs, $18M economic multiplier over 5 years."
    )


def _minimal_signer_cv_text():
    return (
        "CURRICULUM VITAE\nMark T. Signer, MD, MBA\n"
        "Chief Medical Officer, Regional Health Systems Inc.\n"
        "Harvard Medical School 2002. Wharton MBA 2010.\n"
        "20 years executive leadership in U.S. healthcare delivery.\n"
        "Oversees $400M operational budget across 12 hospitals.\n"
    )


def _make_txt_upload(name, text):
    return (name, io.BytesIO(text.encode("utf-8")), "text/plain")


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestSignerCVRequired:
    """POST /api/intent-letters/generate requires signer_cv (third-party LOI only)."""

    def test_generate_with_all_three_required_cvs_succeeds(self, headers):
        """Happy path: all three required files produce a third_party_loi."""
        files = {
            "petitioner_cv": _make_txt_upload("cv.txt", _minimal_cv_text()),
            "project_info": _make_txt_upload("proj.txt", _minimal_project_text()),
            "signer_cv": _make_txt_upload("signer.txt", _minimal_signer_cv_text()),
        }
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            timeout=30,
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        body = res.json()
        assert body["status"] == "generating"
        assert body["letter_mode"] == "third_party_loi"
        assert "letter_id" in body

        letter_id = body["letter_id"]
        time.sleep(2)
        get_res = requests.get(
            f"{BASE_URL}/api/intent-letters/{letter_id}", headers=headers, timeout=10
        )
        assert get_res.status_code == 200
        doc = get_res.json()
        assert doc.get("letter_mode") == "third_party_loi"

        requests.delete(f"{BASE_URL}/api/intent-letters/{letter_id}", headers=headers)

    def test_generate_rejects_missing_signer_cv(self, headers):
        """signer_cv is now MANDATORY — omitting it must return 400/422."""
        files = {
            "petitioner_cv": _make_txt_upload("cv.txt", _minimal_cv_text()),
            "project_info": _make_txt_upload("proj.txt", _minimal_project_text()),
        }
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            timeout=15,
        )
        assert res.status_code in (400, 422), (
            f"Expected 400/422 when signer_cv is missing, got {res.status_code}: {res.text}"
        )

    def test_generate_rejects_missing_petitioner_cv(self, headers):
        """petitioner_cv is also mandatory."""
        files = {
            "project_info": _make_txt_upload("proj.txt", _minimal_project_text()),
            "signer_cv": _make_txt_upload("signer.txt", _minimal_signer_cv_text()),
        }
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            timeout=15,
        )
        assert res.status_code in (400, 422)

    def test_generate_rejects_missing_project_info(self, headers):
        """project_info is also mandatory."""
        files = {
            "petitioner_cv": _make_txt_upload("cv.txt", _minimal_cv_text()),
            "signer_cv": _make_txt_upload("signer.txt", _minimal_signer_cv_text()),
        }
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            timeout=15,
        )
        assert res.status_code in (400, 422)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
