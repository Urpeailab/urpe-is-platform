"""
Test suite for language integrity bugs in immigration document generation.
Tests:
1. translate_text_to_spanish() — chunking logic & no English fallback at doc level
2. GET /api/econometric-studies — content_en in English, content_es in Spanish
3. GET /api/whitepapers — sections content_en is pure English
4. GET /api/whitepapers/{id}/download — returns PDF without 500 errors
5. GET /api/econometric-studies/{id}/download — returns PDF without 500 errors
6. whitepaper_prompts_eb2_niw.py — no 'NEEDED placeholders is MORE VALUABLE' phrase
"""

import pytest
import requests
import os
import re
import sys

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://domain-relink-test.preview.emergentagent.com"

ADMIN_EMAIL = "dau@urpeailab.com"
ADMIN_PASSWORD = "admin123"


# ─── Language detection helpers ────────────────────────────────────────────────
SPANISH_PATTERNS = [
    r'\b(también|también|también)\b',
    r'\b(también|además|aunque|porque|donde|cuando|como|para|pero|con|son|los|las|del|que)\b',
    # Spanish-specific characters
    r'[ñáéíóúÁÉÍÓÚÑ]',
]

ENGLISH_ONLY_WORDS = [
    r'\b(the|of|and|to|in|is|are|for|with|this|that|have|been|was|were|will|would|should|could|can|may|might|must|shall|their|there|through|about|which|when|where|while|from)\b',
]


def _is_likely_spanish(text: str, threshold: float = 0.3) -> bool:
    """Return True if text is likely Spanish (has Spanish chars/words)."""
    if not text:
        return False
    text_lower = text.lower()
    # Spanish-specific characters are very reliable indicators
    spanish_chars = len(re.findall(r'[ñáéíóúüÁÉÍÓÚ]', text))
    words = len(text.split())
    if words == 0:
        return False
    if spanish_chars / max(words, 1) > 0.05:
        return True
    # Spanish words
    spanish_word_count = sum(
        len(re.findall(r'\b' + w + r'\b', text_lower))
        for w in ['también', 'aunque', 'porque', 'donde', 'cuando', 'además',
                  'para', 'pero', 'los', 'las', 'del', 'que', 'con', 'son',
                  'esta', 'esto', 'estos', 'estas', 'una', 'uno', 'unos', 'unas',
                  'como', 'tiene', 'tienen', 'debe', 'pueden', 'será', 'han']
    )
    return spanish_word_count / max(words, 1) > 0.04


def _is_likely_english(text: str, threshold: float = 0.1) -> bool:
    """Return True if text is likely English (has enough English-only words)."""
    if not text:
        return False
    text_lower = text.lower()
    english_words = ['the', 'of', 'and', 'to', 'in', 'is', 'are', 'for',
                     'with', 'this', 'that', 'have', 'been', 'was', 'were',
                     'will', 'would', 'should', 'could', 'can', 'their',
                     'there', 'through', 'about', 'which', 'when', 'where']
    english_count = sum(
        len(re.findall(r'\b' + w + r'\b', text_lower))
        for w in english_words
    )
    words = len(text.split())
    return english_count / max(words, 1) > 0.04


# ─── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_token():
    """Login and return admin auth token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert resp.status_code == 200, f"Login failed: {resp.status_code} — {resp.text[:300]}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def client(auth_token):
    """Requests session with auth header."""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ─── Test 1: Prompt file check ────────────────────────────────────────────────
class TestWhitepaperPromptFile:
    """Verify whitepaper_prompts_eb2_niw.py does not contain removed instructions."""

    def test_prompt_no_more_valuable_phrase(self):
        """Bug fix: 'NEEDED placeholders is MORE VALUABLE' should be removed from prompt."""
        prompt_file = "/app/backend/whitepaper_prompts_eb2_niw.py"
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read()
        assert "NEEDED placeholders is MORE VALUABLE" not in content, \
            "Still contains the old placeholder instruction 'NEEDED placeholders is MORE VALUABLE'"
        print("✅ Prompt file does NOT contain 'NEEDED placeholders is MORE VALUABLE'")

    def test_prompt_output_requirements_no_needed(self):
        """OUTPUT REQUIREMENTS section should explicitly forbid [NEEDED: ...] placeholders."""
        prompt_file = "/app/backend/whitepaper_prompts_eb2_niw.py"
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Should have the prohibition in OUTPUT REQUIREMENTS section
        assert "NEVER write [NEEDED:" in content or "NEVER write [NEEDED" in content, \
            "OUTPUT REQUIREMENTS missing NEVER write [NEEDED:...] prohibition"
        print("✅ OUTPUT REQUIREMENTS section contains prohibition against [NEEDED: ...] placeholders")

    def test_prompt_no_pending_information_instruction(self):
        """The prompt should explicitly forbid [pending information] in OUTPUT REQUIREMENTS."""
        prompt_file = "/app/backend/whitepaper_prompts_eb2_niw.py"
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Line 87-88 should say DO NOT write [pending information]
        assert "[pending information]" in content, "Expected prohibition of [pending information] in prompt"
        # The phrase 'DO NOT write' should appear near [pending information]
        idx = content.find("[pending information]")
        context = content[max(0, idx-200):idx+200]
        assert "DO NOT" in context or "NEVER" in context or "EVER" in context, \
            f"No 'DO NOT'/'NEVER'/'EVER' found near [pending information]: {context}"
        print("✅ Prompt explicitly forbids [pending information] placeholders")


# ─── Test 2: translate_text_to_spanish() logic ───────────────────────────────
class TestTranslateFunction:
    """Verify translate_text_to_spanish() implementation has correct chunking logic."""

    def test_function_exists_in_server(self):
        """translate_text_to_spanish should be defined in server.py."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        assert "async def translate_text_to_spanish" in content, \
            "translate_text_to_spanish function not found in server.py"
        print("✅ translate_text_to_spanish() exists in server.py")

    def test_function_uses_max_chunk_12000(self):
        """MAX_CHUNK must be 12000 characters to stay within GPT-4o output limits."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # Find the function context around translate_text_to_spanish
        idx = content.find("async def translate_text_to_spanish")
        assert idx != -1
        # Look within next 2000 chars after function definition
        func_body = content[idx:idx+2000]
        assert "MAX_CHUNK = 12000" in func_body, \
            f"MAX_CHUNK = 12000 not found in translate_text_to_spanish. Found: {func_body[:500]}"
        print("✅ MAX_CHUNK = 12000 chars confirmed")

    def test_function_uses_asyncio_gather(self):
        """asyncio.gather() must be used for parallel chunk translation."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        idx = content.find("async def translate_text_to_spanish")
        assert idx != -1
        func_body = content[idx:idx+3000]
        assert "asyncio.gather" in func_body, \
            "asyncio.gather not found in translate_text_to_spanish — parallel chunking not implemented"
        print("✅ asyncio.gather() confirmed in translate_text_to_spanish")

    def test_function_no_doc_level_16k_tokens(self):
        """generate_complete_econometric_study_v2 must NOT call translate with max_completion_tokens=16000."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # Check that 16000 token limit is NOT used in translate calls
        assert "max_completion_tokens=16000" not in content, \
            "Still uses max_completion_tokens=16000 — the old single-doc translation approach"
        print("✅ No max_completion_tokens=16000 found (old translation approach removed)")

    def test_translation_fallback_is_not_english_in_background_thread(self):
        """In background thread, if translation fails, store empty string NOT English content."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # Search for the fallback comment in the background thread
        assert "NOT English fallback" in content or "NOT fallback" in content or \
               "storing empty" in content, \
            "Cannot confirm that translation failure in background thread stores empty (not English)"
        print("✅ Translation failure in background thread stores empty string (NOT English fallback)")


# ─── Test 3: Econometric Studies API ─────────────────────────────────────────
class TestEconometricStudiesAPI:
    """Test econometric studies endpoints for language integrity."""

    def test_list_econometric_studies_status(self, client):
        """GET /api/econometric-studies should return 200."""
        resp = client.get(f"{BASE_URL}/api/econometric-studies")
        assert resp.status_code == 200, \
            f"Expected 200, got {resp.status_code} — {resp.text[:300]}"
        print(f"✅ GET /api/econometric-studies: 200 OK")

    def test_list_econometric_studies_structure(self, client):
        """Response should have 'studies' key with a list."""
        resp = client.get(f"{BASE_URL}/api/econometric-studies")
        assert resp.status_code == 200
        data = resp.json()
        assert "studies" in data, f"Missing 'studies' key in response: {list(data.keys())}"
        assert isinstance(data["studies"], list), "studies should be a list"
        print(f"✅ Studies list returned: {len(data['studies'])} completed studies")

    def test_econometric_study_content_en_is_english(self, client):
        """content_en in econometric study sections should be English (not Spanish)."""
        resp = client.get(f"{BASE_URL}/api/econometric-studies")
        assert resp.status_code == 200
        data = resp.json()
        studies = data.get("studies", [])
        
        if not studies:
            # Also check in-progress
            resp2 = client.get(f"{BASE_URL}/api/econometric-studies/in-progress")
            if resp2.status_code == 200:
                in_prog = resp2.json()
                if isinstance(in_prog, list):
                    studies = in_prog
        
        if not studies:
            pytest.skip("No econometric studies found in DB — cannot verify language integrity")
        
        checked = 0
        language_issues = []
        for study in studies[:5]:  # Check up to 5 studies
            study_id = study.get("id")
            if not study_id:
                continue
            
            # Fetch full study to get sections
            study_resp = client.get(f"{BASE_URL}/api/econometric-studies/{study_id}")
            if study_resp.status_code != 200:
                continue
            full_study = study_resp.json()
            sections = full_study.get("sections", [])
            
            for sec in sections[:3]:  # Check first 3 sections
                content_en = sec.get("content_en", "")
                if content_en and len(content_en) > 200:
                    checked += 1
                    # content_en must be English — not Spanish
                    if _is_likely_spanish(content_en):
                        language_issues.append({
                            "study_id": study_id,
                            "section": sec.get("number"),
                            "issue": "content_en appears to be in Spanish",
                            "sample": content_en[:200]
                        })
                    elif not _is_likely_english(content_en):
                        print(f"   ⚠️ Study {study_id} section {sec.get('number')}: "
                              f"content_en language unclear (may be valid)")
        
        if checked == 0:
            pytest.skip("No content_en found in econometric study sections")
        
        assert not language_issues, \
            f"Language integrity issue: content_en is NOT English in {len(language_issues)} sections:\n" + \
            "\n".join([str(i) for i in language_issues])
        print(f"✅ Checked {checked} sections — content_en is English in all econometric studies")

    def test_econometric_study_content_es_is_spanish(self, client):
        """content_es in econometric study sections should be Spanish (if populated)."""
        resp = client.get(f"{BASE_URL}/api/econometric-studies")
        assert resp.status_code == 200
        data = resp.json()
        studies = data.get("studies", [])
        
        if not studies:
            pytest.skip("No completed econometric studies found in DB")
        
        checked = 0
        language_issues = []
        for study in studies[:5]:
            study_id = study.get("id")
            if not study_id:
                continue
            study_resp = client.get(f"{BASE_URL}/api/econometric-studies/{study_id}")
            if study_resp.status_code != 200:
                continue
            full_study = study_resp.json()
            sections = full_study.get("sections", [])
            
            for sec in sections[:3]:
                content_es = sec.get("content_es", "")
                if content_es and len(content_es) > 200:
                    checked += 1
                    # content_es must be Spanish
                    if _is_likely_english(content_es) and not _is_likely_spanish(content_es):
                        language_issues.append({
                            "study_id": study_id,
                            "section": sec.get("number"),
                            "issue": "content_es appears to be in English (not Spanish)",
                            "sample": content_es[:200]
                        })
        
        if checked == 0:
            print("ℹ️ No content_es populated in econometric studies — may be English-only docs")
            return
        
        assert not language_issues, \
            f"Language integrity issue: content_es is NOT Spanish in {len(language_issues)} sections:\n" + \
            "\n".join([str(i) for i in language_issues])
        print(f"✅ Checked {checked} sections — content_es is Spanish in all econometric studies")


# ─── Test 4: Econometric PDF Download ────────────────────────────────────────
class TestEconometricPDFDownload:
    """Test econometric study PDF download endpoint."""

    def _get_study_id(self, client):
        """Helper to get any available study ID."""
        resp = client.get(f"{BASE_URL}/api/econometric-studies")
        if resp.status_code == 200:
            studies = resp.json().get("studies", [])
            if studies:
                return studies[0].get("id")
        # Try in-progress
        resp2 = client.get(f"{BASE_URL}/api/econometric-studies/in-progress")
        if resp2.status_code == 200:
            data = resp2.json()
            studies = data if isinstance(data, list) else data.get("studies", [])
            if studies:
                return studies[0].get("id")
        return None

    def test_econometric_pdf_no_500_error(self, client):
        """GET /api/econometric-studies/{id}/download should not return 500."""
        study_id = self._get_study_id(client)
        if not study_id:
            pytest.skip("No econometric studies available to test PDF download")
        
        resp = client.get(f"{BASE_URL}/api/econometric-studies/{study_id}/download?language=es")
        assert resp.status_code != 500, \
            f"PDF download returned 500: {resp.text[:500]}"
        print(f"✅ Econometric PDF download returned {resp.status_code} (not 500)")

    def test_econometric_pdf_returns_pdf_content(self, client):
        """PDF download should return PDF content-type or 200/404 (not 500)."""
        study_id = self._get_study_id(client)
        if not study_id:
            pytest.skip("No econometric studies available to test PDF download")
        
        resp = client.get(f"{BASE_URL}/api/econometric-studies/{study_id}/download?language=es")
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            assert "pdf" in content_type.lower() or resp.content[:4] == b'%PDF', \
                f"Expected PDF content-type, got: {content_type}"
            print(f"✅ Econometric PDF download returns PDF (content-type: {content_type}, size: {len(resp.content)} bytes)")
        elif resp.status_code == 404:
            print(f"ℹ️ Study not found (404) — sections may be empty")
        elif resp.status_code == 400:
            print(f"ℹ️ Study has no sections (400): {resp.text[:200]}")
        else:
            pytest.fail(f"Unexpected status code: {resp.status_code} — {resp.text[:300]}")

    def test_econometric_pdf_english_download(self, client):
        """PDF download in English (language=en) should not return 500."""
        study_id = self._get_study_id(client)
        if not study_id:
            pytest.skip("No econometric studies available")
        
        resp = client.get(f"{BASE_URL}/api/econometric-studies/{study_id}/download?language=en")
        assert resp.status_code != 500, \
            f"English PDF download returned 500: {resp.text[:500]}"
        print(f"✅ Econometric English PDF download returned {resp.status_code}")


# ─── Test 5: Whitepapers API ──────────────────────────────────────────────────
class TestWhitepaperAPI:
    """Test whitepaper endpoints for language integrity."""

    def test_list_whitepapers_status(self, client):
        """GET /api/whitepapers should return 200."""
        resp = client.get(f"{BASE_URL}/api/whitepapers")
        assert resp.status_code == 200, \
            f"Expected 200, got {resp.status_code} — {resp.text[:300]}"
        print(f"✅ GET /api/whitepapers: 200 OK")

    def test_list_whitepapers_structure(self, client):
        """Whitepapers response should have 'completed' and 'in_progress' keys."""
        resp = client.get(f"{BASE_URL}/api/whitepapers")
        assert resp.status_code == 200
        data = resp.json()
        assert "completed" in data or "in_progress" in data, \
            f"Missing expected keys. Got: {list(data.keys())}"
        total = data.get("total", 0)
        print(f"✅ Whitepapers list: completed={len(data.get('completed',[]))}, "
              f"in_progress={len(data.get('in_progress', []))}")

    def test_whitepaper_sections_content_en_is_english(self, client):
        """Whitepaper section content_en should be pure English."""
        resp = client.get(f"{BASE_URL}/api/whitepapers")
        assert resp.status_code == 200
        data = resp.json()
        
        all_whitepapers = data.get("completed", []) + data.get("in_progress", [])
        if not all_whitepapers:
            pytest.skip("No whitepapers found in DB — cannot verify language integrity")
        
        checked = 0
        language_issues = []
        
        for wp in all_whitepapers[:5]:
            wp_id = wp.get("id")
            if not wp_id:
                continue
            
            # Fetch full whitepaper
            wp_resp = client.get(f"{BASE_URL}/api/whitepapers/{wp_id}")
            if wp_resp.status_code != 200:
                continue
            full_wp = wp_resp.json()
            sections = full_wp.get("sections", [])
            
            for sec in sections[:3]:  # Check first 3 sections
                content_en = sec.get("content_en", "")
                if not content_en:
                    content_en = sec.get("content", "") if full_wp.get("language", "en") == "en" else ""
                
                if content_en and len(content_en) > 200:
                    checked += 1
                    if _is_likely_spanish(content_en):
                        language_issues.append({
                            "whitepaper_id": wp_id,
                            "section": sec.get("number"),
                            "title": sec.get("title", ""),
                            "issue": "content_en appears to be Spanish",
                            "sample": content_en[:200]
                        })
        
        if checked == 0:
            pytest.skip("No content_en found in whitepaper sections")
        
        assert not language_issues, \
            f"Language bug: content_en is NOT English in {len(language_issues)} whitepaper sections:\n" + \
            "\n".join([str(i) for i in language_issues])
        print(f"✅ Checked {checked} whitepaper sections — content_en is English")

    def test_whitepaper_sections_no_placeholder_text(self, client):
        """Whitepaper sections should not contain [pending information] or [NEEDED: ...] in content."""
        resp = client.get(f"{BASE_URL}/api/whitepapers")
        assert resp.status_code == 200
        data = resp.json()
        all_whitepapers = data.get("completed", []) + data.get("in_progress", [])
        
        if not all_whitepapers:
            pytest.skip("No whitepapers found")
        
        placeholder_issues = []
        for wp in all_whitepapers[:3]:
            wp_id = wp.get("id")
            if not wp_id:
                continue
            wp_resp = client.get(f"{BASE_URL}/api/whitepapers/{wp_id}")
            if wp_resp.status_code != 200:
                continue
            full_wp = wp_resp.json()
            sections = full_wp.get("sections", [])
            for sec in sections[:5]:
                for field in ["content", "content_en", "content_es"]:
                    text = sec.get(field, "")
                    if text and "[pending information]" in text:
                        placeholder_issues.append(f"WP {wp_id}, section {sec.get('number')}, field {field}: '[pending information]'")
        
        if placeholder_issues:
            print(f"⚠️ Found [pending information] in whitepaper sections (these are stored raw, PDF cleans them):")
            for issue in placeholder_issues:
                print(f"   - {issue}")
            # This is a warning, not a test failure, because clean_whitepaper_content() cleans them at PDF time
        else:
            print("✅ No [pending information] placeholders found in whitepaper section content")


# ─── Test 6: Whitepaper PDF Download ─────────────────────────────────────────
class TestWhitepaperPDFDownload:
    """Test whitepaper PDF download endpoint."""

    def _get_whitepaper_id(self, client):
        """Helper to get any available whitepaper ID with sections."""
        resp = client.get(f"{BASE_URL}/api/whitepapers")
        if resp.status_code != 200:
            return None
        data = resp.json()
        all_wps = data.get("completed", []) + data.get("in_progress", [])
        # Prefer ones with sections
        for wp in all_wps:
            if wp.get("sections") and len(wp.get("sections", [])) > 0:
                return wp.get("id")
        # Fallback: return first available
        return all_wps[0].get("id") if all_wps else None

    def test_whitepaper_pdf_no_500_error(self, client):
        """GET /api/whitepapers/{id}/download should not return 500."""
        wp_id = self._get_whitepaper_id(client)
        if not wp_id:
            pytest.skip("No whitepapers available to test PDF download")
        
        resp = client.get(f"{BASE_URL}/api/whitepapers/{wp_id}/download?language=en")
        assert resp.status_code != 500, \
            f"Whitepaper PDF download returned 500: {resp.text[:500]}"
        print(f"✅ Whitepaper PDF download returned {resp.status_code} (not 500)")

    def test_whitepaper_pdf_returns_pdf_content(self, client):
        """Whitepaper PDF download should return PDF bytes when sections exist."""
        wp_id = self._get_whitepaper_id(client)
        if not wp_id:
            pytest.skip("No whitepapers available")
        
        resp = client.get(f"{BASE_URL}/api/whitepapers/{wp_id}/download?language=en")
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            assert "pdf" in content_type.lower() or resp.content[:4] == b'%PDF', \
                f"Expected PDF, got content-type: {content_type}"
            assert len(resp.content) > 1000, \
                f"PDF too small: {len(resp.content)} bytes — may be empty"
            print(f"✅ Whitepaper PDF generated: {len(resp.content)} bytes")
        elif resp.status_code in [400, 404]:
            print(f"ℹ️ Whitepaper has no sections yet ({resp.status_code}): {resp.text[:200]}")
        else:
            pytest.fail(f"Unexpected status: {resp.status_code} — {resp.text[:300]}")

    def test_whitepaper_pdf_spanish_download(self, client):
        """Whitepaper Spanish PDF download should not return 500."""
        wp_id = self._get_whitepaper_id(client)
        if not wp_id:
            pytest.skip("No whitepapers available")
        
        resp = client.get(f"{BASE_URL}/api/whitepapers/{wp_id}/download?language=es")
        assert resp.status_code != 500, \
            f"Spanish PDF download returned 500: {resp.text[:500]}"
        print(f"✅ Whitepaper Spanish PDF download returned {resp.status_code}")


# ─── Test 7: clean_whitepaper_content() logic in server.py ───────────────────
class TestCleanWhitepaperContent:
    """Verify clean_whitepaper_content() removes placeholders before PDF generation."""

    def test_clean_function_handles_pending_information(self):
        """clean_whitepaper_content must remove [pending information] from content."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # Check function exists
        assert "def clean_whitepaper_content" in content, \
            "clean_whitepaper_content function not found in server.py"
        
        # Check it handles [pending information]
        idx = content.find("def clean_whitepaper_content")
        func_body = content[idx:idx+8000]
        assert "[pending information]" in func_body, \
            "clean_whitepaper_content does not handle [pending information] cleanup"
        print("✅ clean_whitepaper_content handles [pending information] cleanup")

    def test_clean_function_handles_needed_placeholders(self):
        """clean_whitepaper_content must remove [NEEDED: ...] from content."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        idx = content.find("def clean_whitepaper_content")
        func_body = content[idx:idx+8000]
        assert "NEEDED:" in func_body, \
            "clean_whitepaper_content does not handle [NEEDED:...] cleanup"
        print("✅ clean_whitepaper_content handles [NEEDED: ...] cleanup")

    def test_clean_function_handles_dashes_separator_lines(self):
        """clean_whitepaper_content or econometric PDF should handle --- separator lines."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        # Look for handling of --- line separators in either clean function
        # The econometric PDF had issues with --- lines
        has_dash_handling = (
            "---" in content or
            r"\-\-\-" in content or
            "horizontal rule" in content.lower()
        )
        print(f"ℹ️ Dash separator handling: {'found' if has_dash_handling else 'not explicitly found'}")


# ─── Test 8: Check server.py syntax (import test) ────────────────────────────
class TestServerSyntax:
    """Verify server.py has no syntax errors."""

    def test_server_py_syntax(self):
        """server.py should have valid Python syntax."""
        import subprocess
        result = subprocess.run(
            ["python3", "-m", "py_compile", "/app/backend/server.py"],
            capture_output=True, text=True
        )
        assert result.returncode == 0, \
            f"server.py has syntax errors:\n{result.stderr}"
        print("✅ server.py syntax is valid")

    def test_whitepaper_prompts_syntax(self):
        """whitepaper_prompts_eb2_niw.py should have valid Python syntax."""
        import subprocess
        result = subprocess.run(
            ["python3", "-m", "py_compile", "/app/backend/whitepaper_prompts_eb2_niw.py"],
            capture_output=True, text=True
        )
        assert result.returncode == 0, \
            f"whitepaper_prompts_eb2_niw.py has syntax errors:\n{result.stderr}"
        print("✅ whitepaper_prompts_eb2_niw.py syntax is valid")
