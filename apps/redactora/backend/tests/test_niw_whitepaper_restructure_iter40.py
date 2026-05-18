"""
Iteration 40 — NIW Whitepaper Format Restructuring Tests
Tests for the new 9-section Dhanasar 3-prong test whitepaper structure.
Verifies whitepaper_eb2_niw_strict.py rewrite and server.py updates.
"""
import pytest
import requests
import os
import sys

# Add backend to path for direct module inspection
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    """Login and return bearer token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "dau@urpeailab.com", "password": "admin123"},
        timeout=15,
    )
    if resp.status_code != 200:
        pytest.skip(f"Login failed ({resp.status_code}) — skipping authenticated tests")
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, "No token in login response"
    return token


@pytest.fixture(scope="module")
def authed(auth_token):
    """Requests session with Authorization header."""
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return s


# ─── Health & Auth ─────────────────────────────────────────────────────────────

class TestHealthAndAuth:
    """Basic health and authentication checks."""

    def test_health_returns_200(self):
        """GET /health must return 200."""
        resp = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("PASS: GET /health returned 200")

    def test_login_success(self):
        """POST /api/auth/login with valid credentials must return 200 with token."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Login failed: {resp.status_code} — {resp.text[:200]}"
        data = resp.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token field in login response"
        print(f"PASS: Login returned 200 with token (length={len(token)})")


# ─── Module-Level: whitepaper_eb2_niw_strict.py ───────────────────────────────

class TestWhitepaperModuleStructure:
    """Verify SECTION_TITLES_EB2_NIW and GENERATION_BATCHES in the strict module."""

    def test_section_titles_count_is_9(self):
        """SECTION_TITLES_EB2_NIW must have exactly 9 sections."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        count = len(SECTION_TITLES_EB2_NIW)
        assert count == 9, f"Expected 9 sections, got {count}: {SECTION_TITLES_EB2_NIW}"
        print(f"PASS: SECTION_TITLES_EB2_NIW has {count} sections")

    def test_section_titles_contains_prong1(self):
        """SECTION_TITLES_EB2_NIW must contain a PRONG 1 entry."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        has_prong1 = any("PRONG 1" in t for t in SECTION_TITLES_EB2_NIW)
        assert has_prong1, f"No 'PRONG 1' in {SECTION_TITLES_EB2_NIW}"
        print("PASS: SECTION_TITLES_EB2_NIW contains 'PRONG 1'")

    def test_section_titles_contains_prong2(self):
        """SECTION_TITLES_EB2_NIW must contain a PRONG 2 entry."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        has_prong2 = any("PRONG 2" in t for t in SECTION_TITLES_EB2_NIW)
        assert has_prong2, f"No 'PRONG 2' in {SECTION_TITLES_EB2_NIW}"
        print("PASS: SECTION_TITLES_EB2_NIW contains 'PRONG 2'")

    def test_section_titles_contains_prong3(self):
        """SECTION_TITLES_EB2_NIW must contain a PRONG 3 entry."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        has_prong3 = any("PRONG 3" in t for t in SECTION_TITLES_EB2_NIW)
        assert has_prong3, f"No 'PRONG 3' in {SECTION_TITLES_EB2_NIW}"
        print("PASS: SECTION_TITLES_EB2_NIW contains 'PRONG 3'")

    def test_section_titles_contains_eb2_eligibility(self):
        """SECTION_TITLES_EB2_NIW must contain 'EB-2 Eligibility: Threshold Requirements'."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        match = any("EB-2 Eligibility" in t and "Threshold" in t for t in SECTION_TITLES_EB2_NIW)
        assert match, f"No 'EB-2 Eligibility: Threshold Requirements' in {SECTION_TITLES_EB2_NIW}"
        print("PASS: SECTION_TITLES_EB2_NIW contains 'EB-2 Eligibility: Threshold Requirements'")

    def test_section_titles_contains_conclusion(self):
        """SECTION_TITLES_EB2_NIW must contain 'Conclusion and Request for Favorable Adjudication'."""
        from whitepaper_eb2_niw_strict import SECTION_TITLES_EB2_NIW
        match = any("Conclusion" in t and "Favorable Adjudication" in t for t in SECTION_TITLES_EB2_NIW)
        assert match, f"No 'Conclusion and Request for Favorable Adjudication' in {SECTION_TITLES_EB2_NIW}"
        print("PASS: SECTION_TITLES_EB2_NIW contains 'Conclusion and Request for Favorable Adjudication'")

    def test_generation_batches_count_is_3(self):
        """GENERATION_BATCHES must have exactly 3 batches (not 4)."""
        from whitepaper_eb2_niw_strict import GENERATION_BATCHES
        count = len(GENERATION_BATCHES)
        assert count == 3, f"Expected 3 batches, got {count}"
        print(f"PASS: GENERATION_BATCHES has {count} batches")

    def test_generation_batches_cover_9_sections(self):
        """All 9 section numbers (1–9) must be covered across the 3 batches."""
        from whitepaper_eb2_niw_strict import GENERATION_BATCHES
        all_sections = []
        for batch in GENERATION_BATCHES:
            all_sections.extend(batch["sections"])
        assert sorted(all_sections) == list(range(1, 10)), \
            f"Batches cover sections {sorted(all_sections)}, expected [1..9]"
        print(f"PASS: GENERATION_BATCHES covers sections {sorted(all_sections)}")

    def test_batch2_includes_all_three_prong_sections(self):
        """Batch 2 must contain the three PRONG sections (4, 5, 6)."""
        from whitepaper_eb2_niw_strict import GENERATION_BATCHES
        batch2 = GENERATION_BATCHES[1]
        assert sorted(batch2["sections"]) == [4, 5, 6], \
            f"Batch 2 sections expected [4,5,6], got {batch2['sections']}"
        print("PASS: Batch 2 covers sections 4 (Prong 1), 5 (Prong 2), 6 (Prong 3)")

    def test_prong_functions_exist(self):
        """get_section_prong1/2/3_prompt functions must be importable and callable."""
        from whitepaper_eb2_niw_strict import (
            get_section_prong1_prompt,
            get_section_prong2_prompt,
            get_section_prong3_prompt,
        )
        for fn, label in [
            (get_section_prong1_prompt, "prong1"),
            (get_section_prong2_prompt, "prong2"),
            (get_section_prong3_prompt, "prong3"),
        ]:
            result = fn()
            assert isinstance(result, str) and len(result) > 100, \
                f"{label} prompt returned empty or short string"
        print("PASS: All three prong prompt functions callable and return non-empty strings")

    def test_eb2_eligibility_function_exists(self):
        """get_section_eb2_eligibility_prompt must be importable and callable."""
        from whitepaper_eb2_niw_strict import get_section_eb2_eligibility_prompt
        result = get_section_eb2_eligibility_prompt()
        assert isinstance(result, str) and len(result) > 100, \
            "eb2_eligibility prompt returned empty or short string"
        print("PASS: get_section_eb2_eligibility_prompt callable and returns non-empty string")

    def test_translate_es_to_en_preserved(self):
        """_translate_es_to_en_credentials must be present and work correctly."""
        from whitepaper_eb2_niw_strict import _translate_es_to_en_credentials
        result = _translate_es_to_en_credentials("Maestría en Administración de Negocios")
        assert "Master" in result, f"Translation failed: {result}"
        print(f"PASS: _translate_es_to_en_credentials works: 'Maestría' -> '{result}'")

    def test_section_display_numbers_map(self):
        """SECTION_DISPLAY_NUMBERS must map 9 sections (keys 1–9 → values '0'–'8')."""
        from whitepaper_eb2_niw_strict import SECTION_DISPLAY_NUMBERS
        assert len(SECTION_DISPLAY_NUMBERS) == 9, \
            f"Expected 9 entries in SECTION_DISPLAY_NUMBERS, got {len(SECTION_DISPLAY_NUMBERS)}"
        assert SECTION_DISPLAY_NUMBERS[1] == "0"
        assert SECTION_DISPLAY_NUMBERS[9] == "8"
        print("PASS: SECTION_DISPLAY_NUMBERS maps sections 1–9 to display numbers 0–8")


# ─── server.py static code inspection ─────────────────────────────────────────

class TestServerPyNIWStructure:
    """Verify server.py has been updated for the 9-section NIW structure."""

    def test_server_section_titles_en_contains_prong1(self):
        """server.py section_titles_en array must contain 'PRONG 1'."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # Confirm the section_titles_en block has PRONG 1
        assert "PRONG 1" in content, "server.py section_titles_en missing 'PRONG 1'"
        print("PASS: server.py contains 'PRONG 1' in section_titles_en")

    def test_server_section_titles_en_contains_prong2(self):
        """server.py section_titles_en array must contain 'PRONG 2'."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        assert "PRONG 2" in content, "server.py section_titles_en missing 'PRONG 2'"
        print("PASS: server.py contains 'PRONG 2' in section_titles_en")

    def test_server_section_titles_en_contains_prong3(self):
        """server.py section_titles_en array must contain 'PRONG 3'."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        assert "PRONG 3" in content, "server.py section_titles_en missing 'PRONG 3'"
        print("PASS: server.py contains 'PRONG 3' in section_titles_en")

    def test_server_len_sections_9_whitepaper_retry(self):
        """server.py whitepaper retry endpoint must use len(sections) >= 9."""
        with open("/app/backend/server.py", "r") as f:
            lines = f.readlines()
        # Find all occurrences of >= 9 in whitepaper-related context (lines 31000–31300)
        hits = [
            (i + 1, line.strip())
            for i, line in enumerate(lines[31000:31300], start=31000)
            if "len(sections) >= 9" in line
        ]
        assert len(hits) >= 1, (
            "Expected at least 1 occurrence of 'len(sections) >= 9' in whitepaper section "
            f"(lines 31000-31300), found 0"
        )
        for lineno, text in hits:
            print(f"  Line {lineno}: {text}")
        print(f"PASS: server.py has {len(hits)} 'len(sections) >= 9' check(s) in whitepaper section")

    def test_server_no_len_sections_16_whitepaper(self):
        """server.py whitepaper section must NOT have 'len(sections) >= 16' (old value)."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # The old check was >= 16; make sure it does not appear in whitepaper area
        # We search within a restricted range of lines (31000-31300)
        with open("/app/backend/server.py", "r") as f:
            lines = f.readlines()
        hits_16 = [
            (i + 1, line.strip())
            for i, line in enumerate(lines[31000:31300], start=31000)
            if "len(sections) >= 16" in line
        ]
        assert len(hits_16) == 0, (
            f"Found old 'len(sections) >= 16' in whitepaper section: {hits_16}"
        )
        print("PASS: server.py whitepaper section has no stale 'len(sections) >= 16' checks")

    def test_server_section_titles_en_9_entries(self):
        """section_titles_en array in server.py must have exactly 9 entries."""
        with open("/app/backend/server.py", "r") as f:
            lines = f.readlines()
        # Find the section_titles_en list (starts around line 31015)
        start = None
        for i, line in enumerate(lines[31000:31100], start=31000):
            if "section_titles_en = [" in line:
                start = i
                break
        assert start is not None, "Could not find section_titles_en in server.py"
        # Count entries (lines with quoted strings) in the array
        entries = []
        for line in lines[start + 1: start + 15]:
            stripped = line.strip()
            if stripped.startswith('"') or stripped.startswith("'"):
                entries.append(stripped)
            elif stripped.startswith("]"):
                break
        assert len(entries) == 9, (
            f"section_titles_en in server.py has {len(entries)} entries, expected 9: {entries}"
        )
        print(f"PASS: server.py section_titles_en has {len(entries)} entries")


# ─── API Endpoints ─────────────────────────────────────────────────────────────

class TestWhitepaperAPI:
    """Test GET /api/whitepapers and related endpoints."""

    def test_get_whitepapers_returns_200(self, authed):
        """GET /api/whitepapers must return 200 with a list or dict containing whitepapers."""
        resp = authed.get(f"{BASE_URL}/api/whitepapers", timeout=15)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        # Response may be a list OR a dict like {"completed": [], "in_progress": []}
        assert isinstance(data, (list, dict)), \
            f"Expected list or dict, got {type(data).__name__}: {data}"
        if isinstance(data, list):
            print(f"PASS: GET /api/whitepapers returned 200 with {len(data)} whitepaper(s)")
        else:
            completed = data.get("completed", [])
            in_progress = data.get("in_progress", [])
            print(f"PASS: GET /api/whitepapers returned 200 — completed={len(completed)}, in_progress={len(in_progress)}")

    def test_get_whitepapers_in_progress(self, authed):
        """GET /api/whitepapers/in-progress must return 200 (or 404 if no in-progress)."""
        resp = authed.get(f"{BASE_URL}/api/whitepapers/in-progress", timeout=15)
        assert resp.status_code in (200, 404), \
            f"Expected 200 or 404, got {resp.status_code}: {resp.text[:200]}"
        print(f"PASS: GET /api/whitepapers/in-progress returned {resp.status_code}")

    def test_get_whitepapers_unauthenticated_returns_403(self):
        """GET /api/whitepapers without token must return 401 or 403."""
        resp = requests.get(f"{BASE_URL}/api/whitepapers", timeout=10)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 for unauthenticated request, got {resp.status_code}"
        print(f"PASS: Unauthenticated GET /api/whitepapers correctly returns {resp.status_code}")
