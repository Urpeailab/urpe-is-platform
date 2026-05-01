"""
Backend tests for NIW/translation features:
1. Health check
2. Statistics bank in system prompt
3. upload-patent-doc returns raw_text
4. Translator profile CRUD with signature_image
5. Certified translation PDF export
6. Auto-USCIS evaluation trigger
"""

import pytest
import requests
import os
import sys
import io
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# --- Auth helpers ---

@pytest.fixture(scope="module")
def auth_token():
    """Get JWT token via login"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@urpe.com",
        "password": "urpe2024"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json().get("access_token")
    assert token, "No access_token in login response"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# --- 1. Health Check ---

class TestHealthCheck:
    """Health endpoint"""

    def test_health_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_health_has_status_healthy(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        data = resp.json()
        assert data.get("status") == "healthy", f"status field not 'healthy': {data}"

    def test_health_has_timestamp(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        data = resp.json()
        assert "timestamp" in data, f"'timestamp' missing from health response: {data}"


# --- 2. Statistics Bank in System Prompt (local code verification) ---

class TestStatisticsBankInPrompt:
    """Verify get_full_system_prompt_v3 includes PRE-VERIFIED STATISTICS BANK"""

    def test_statistics_bank_included_in_full_prompt(self):
        """Local code check: statistics bank is present in system prompt"""
        sys.path.insert(0, '/app/backend')
        try:
            from business_plan_prompt_v3 import get_full_system_prompt_v3, VERIFIED_STATISTICS_BANK
            result = get_full_system_prompt_v3()
            assert "PRE-VERIFIED STATISTICS BANK" in result, \
                "PRE-VERIFIED STATISTICS BANK not found in full system prompt"
        except ImportError as e:
            pytest.fail(f"Could not import business_plan_prompt_v3: {e}")

    def test_verified_statistics_bank_constant_exists(self):
        """VERIFIED_STATISTICS_BANK constant must be defined in module"""
        sys.path.insert(0, '/app/backend')
        from business_plan_prompt_v3 import VERIFIED_STATISTICS_BANK
        assert VERIFIED_STATISTICS_BANK and len(VERIFIED_STATISTICS_BANK) > 100, \
            "VERIFIED_STATISTICS_BANK is empty or too short"

    def test_statistics_bank_contains_real_data(self):
        """Statistics bank should contain some numerical data"""
        sys.path.insert(0, '/app/backend')
        from business_plan_prompt_v3 import VERIFIED_STATISTICS_BANK
        # Should contain numbers (real statistics)
        import re
        numbers = re.findall(r'\d+', VERIFIED_STATISTICS_BANK)
        assert len(numbers) > 5, "Statistics bank seems to lack numerical data"


# --- 3. Upload Patent Doc returns raw_text ---

class TestUploadPatentDoc:
    """POST /api/business-plans/upload-patent-doc"""

    def test_upload_txt_returns_raw_text(self, auth_headers):
        """Upload a simple TXT file and verify raw_text is returned"""
        # Create minimal test file
        test_content = b"""US Patent Application
Title: Method and System for Artificial Intelligence Integration
Inventor: Test Inventor
Abstract: This invention relates to a novel method for integrating AI into business processes.
Claims:
1. A method comprising the steps of: processing data; generating outputs.
"""
        files = {'file': ('test_patent.txt', test_content, 'text/plain')}
        headers = {"Authorization": auth_headers["Authorization"]}
        resp = requests.post(
            f"{BASE_URL}/api/business-plans/upload-patent-doc",
            files=files,
            headers=headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "raw_text" in data, f"'raw_text' field missing from response: {list(data.keys())}"

    def test_upload_returns_success_true(self, auth_headers):
        """Upload returns success: true"""
        test_content = b"US Patent Application Title: Test Invention for AI processing. Abstract: A system for processing. Claims: 1. A method of processing data."
        files = {'file': ('test_patent2.txt', test_content, 'text/plain')}
        headers = {"Authorization": auth_headers["Authorization"]}
        resp = requests.post(
            f"{BASE_URL}/api/business-plans/upload-patent-doc",
            files=files,
            headers=headers
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"success field is not True: {data}"

    def test_upload_returns_raw_text_with_content(self, auth_headers):
        """raw_text should not be empty string"""
        test_content = b"US Patent Application\nTitle: Advanced Software System\nAbstract: An improved system.\nClaims: 1. A method comprising."
        files = {'file': ('test_patent3.txt', test_content, 'text/plain')}
        headers = {"Authorization": auth_headers["Authorization"]}
        resp = requests.post(
            f"{BASE_URL}/api/business-plans/upload-patent-doc",
            files=files,
            headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        raw_text = data.get("raw_text", "")
        assert isinstance(raw_text, str), "raw_text should be a string"
        assert len(raw_text) > 0, "raw_text should not be empty"

    def test_upload_requires_auth(self):
        """Upload without auth token should return 401/403"""
        test_content = b"Test patent content"
        files = {'file': ('test.txt', test_content, 'text/plain')}
        resp = requests.post(f"{BASE_URL}/api/business-plans/upload-patent-doc", files=files)
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"

    def test_upload_unsupported_format_returns_400(self, auth_headers):
        """Unsupported file type should return 400"""
        test_content = b"<html><body>test</body></html>"
        files = {'file': ('test.html', test_content, 'text/html')}
        headers = {"Authorization": auth_headers["Authorization"]}
        resp = requests.post(
            f"{BASE_URL}/api/business-plans/upload-patent-doc",
            files=files,
            headers=headers
        )
        assert resp.status_code == 400, f"Expected 400 for unsupported format, got {resp.status_code}"


# --- 4. Translator Profile CRUD with signature_image ---

class TestTranslatorProfileWithSignature:
    """Tests for translator profile creation and update including signature_image"""

    created_profile_id = None  # Will store created profile ID for cleanup

    def test_create_profile_with_signature_image(self, auth_headers):
        """POST /api/translator/profile accepts signature_image"""
        # Create a minimal PNG in base64 (1x1 red pixel)
        sig_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="

        payload = {
            "full_name": "TEST_Translator Firma",
            "id_number": "TEST-99999",
            "title": "Certified Translator",
            "phone": "+1 555 0000",
            "email": "test_translator_firma@test.com",
            "certificate_prefix": "TST",
            "signature_image": sig_b64
        }
        resp = requests.post(f"{BASE_URL}/api/translator/profile", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"Create profile failed: {resp.text}"
        data = resp.json()
        assert data.get("full_name") == "TEST_Translator Firma"
        assert "id" in data, "Profile response missing 'id'"
        assert data.get("signature_image") == sig_b64, "signature_image not saved correctly"
        TestTranslatorProfileWithSignature.created_profile_id = data["id"]

    def test_create_profile_without_signature(self, auth_headers):
        """POST /api/translator/profile works without signature_image"""
        payload = {
            "full_name": "TEST_Translator No Firma",
            "id_number": "TEST-88888",
            "title": "Certified Translator",
            "phone": "+1 555 0001",
            "email": "test_nosig@test.com",
            "certificate_prefix": "TST2"
        }
        resp = requests.post(f"{BASE_URL}/api/translator/profile", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"Create profile (no sig) failed: {resp.text}"
        data = resp.json()
        assert data.get("full_name") == "TEST_Translator No Firma"
        # Clean up
        profile_id = data.get("id")
        if profile_id:
            requests.delete(f"{BASE_URL}/api/translator/profile/{profile_id}", headers=auth_headers)

    def test_update_profile_with_signature_image(self, auth_headers):
        """PUT /api/translator/profile/{id} accepts signature_image"""
        profile_id = TestTranslatorProfileWithSignature.created_profile_id
        if not profile_id:
            pytest.skip("Profile not created in previous test")

        new_sig_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="

        payload = {
            "full_name": "TEST_Translator Firma UPDATED",
            "id_number": "TEST-99999",
            "title": "Senior Certified Translator",
            "phone": "+1 555 0000",
            "email": "test_translator_firma@test.com",
            "certificate_prefix": "TST",
            "signature_image": new_sig_b64
        }
        resp = requests.put(
            f"{BASE_URL}/api/translator/profile/{profile_id}",
            json=payload,
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Update profile failed: {resp.text}"
        data = resp.json()
        assert data.get("full_name") == "TEST_Translator Firma UPDATED"
        assert data.get("signature_image") == new_sig_b64, "Updated signature_image not returned correctly"
        assert data.get("title") == "Senior Certified Translator"

    def test_get_profiles_returns_list(self, auth_headers):
        """GET /api/translator/profiles returns a list"""
        resp = requests.get(f"{BASE_URL}/api/translator/profiles", headers=auth_headers)
        assert resp.status_code == 200, f"Get profiles failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list of profiles, got: {type(data)}"

    def test_update_nonexistent_profile_returns_404(self, auth_headers):
        """PUT /api/translator/profile/nonexistent-id returns 404"""
        payload = {
            "full_name": "Nonexistent",
            "id_number": "X",
            "title": "Translator",
            "phone": "+1",
            "email": "none@none.com",
            "certificate_prefix": "N"
        }
        resp = requests.put(
            f"{BASE_URL}/api/translator/profile/nonexistent-profile-id-12345",
            json=payload,
            headers=auth_headers
        )
        assert resp.status_code == 404, f"Expected 404 for nonexistent profile, got {resp.status_code}"

    def test_cleanup_created_profile(self, auth_headers):
        """Delete the test profile created earlier"""
        profile_id = TestTranslatorProfileWithSignature.created_profile_id
        if not profile_id:
            return
        resp = requests.delete(f"{BASE_URL}/api/translator/profile/{profile_id}", headers=auth_headers)
        assert resp.status_code in [200, 404], f"Cleanup delete failed: {resp.text}"


# --- 5. Certified Translation PDF Export ---

class TestCertifiedTranslationPDF:
    """Tests for the certified translation creation and PDF export"""

    cert_id = None  # Track created cert for PDF test

    def test_create_certified_translation(self, auth_headers):
        """POST /api/certified/translate creates a certified translation"""
        # First, ensure there's a translator profile
        payload_profile = {
            "full_name": "TEST_PDF Translator",
            "id_number": "TEST-PDF-001",
            "title": "Certified Translator",
            "phone": "+1 555 0002",
            "email": "test_pdf_translator@test.com",
            "certificate_prefix": "PDF"
        }
        prof_resp = requests.post(f"{BASE_URL}/api/translator/profile", json=payload_profile, headers=auth_headers)
        assert prof_resp.status_code == 200, f"Failed to create profile for PDF test: {prof_resp.text}"
        profile_id = prof_resp.json()["id"]

        # Create a certified translation
        translation_payload = {
            "original_text": "Este es un documento de prueba para verificar la generación de PDF. Es un texto de ejemplo.",
            "filename": "test_doc.txt",
            "document_description": "Test Document for PDF Generation",
            "profile_id": profile_id
        }
        resp = requests.post(
            f"{BASE_URL}/api/certified/translate",
            json=translation_payload,
            headers=auth_headers,
            timeout=60
        )
        assert resp.status_code == 200, f"Certified translation creation failed: {resp.text}"
        data = resp.json()
        assert "id" in data, "Certified translation missing 'id'"
        assert "certificate_number" in data, "Missing certificate_number"
        assert data.get("translated_text"), "translated_text should not be empty"
        TestCertifiedTranslationPDF.cert_id = data["id"]
        TestCertifiedTranslationPDF.profile_id_to_cleanup = profile_id

    def test_export_pdf_returns_pdf_bytes(self, auth_headers):
        """GET /api/certified/export/{cert_id}/pdf returns PDF bytes"""
        cert_id = TestCertifiedTranslationPDF.cert_id
        if not cert_id:
            pytest.skip("No cert_id from previous test")

        resp = requests.get(
            f"{BASE_URL}/api/certified/export/{cert_id}/pdf",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=30
        )
        assert resp.status_code == 200, f"PDF export failed: {resp.status_code} {resp.text[:200]}"
        assert resp.headers.get("content-type", "").startswith("application/pdf"), \
            f"Expected application/pdf, got {resp.headers.get('content-type')}"
        assert len(resp.content) > 1000, f"PDF too small, might be empty: {len(resp.content)} bytes"

    def test_export_pdf_has_content_disposition(self, auth_headers):
        """PDF response must have Content-Disposition attachment header"""
        cert_id = TestCertifiedTranslationPDF.cert_id
        if not cert_id:
            pytest.skip("No cert_id from previous test")

        resp = requests.get(
            f"{BASE_URL}/api/certified/export/{cert_id}/pdf",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=30
        )
        assert resp.status_code == 200
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd, f"Content-Disposition missing 'attachment': {cd}"
        assert ".pdf" in cd, f"Content-Disposition should contain .pdf: {cd}"

    def test_export_nonexistent_pdf_returns_404(self, auth_headers):
        """GET /api/certified/export/nonexistent-id/pdf returns 404"""
        resp = requests.get(
            f"{BASE_URL}/api/certified/export/nonexistent-cert-id-12345/pdf",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=15
        )
        assert resp.status_code == 404, f"Expected 404 for missing cert, got {resp.status_code}"

    def test_cleanup_translator_profile(self, auth_headers):
        """Cleanup test translator profile"""
        profile_id = getattr(TestCertifiedTranslationPDF, 'profile_id_to_cleanup', None)
        if profile_id:
            requests.delete(f"{BASE_URL}/api/translator/profile/{profile_id}", headers=auth_headers)


# --- 6. Business plans endpoint (auto-eval context check) ---

class TestBusinessPlansEndpoints:
    """Test business plan endpoints related to auto-evaluation"""

    def test_get_business_plans_list_returns_200(self, auth_headers):
        """GET /api/business-plans should return 200 with list"""
        resp = requests.get(f"{BASE_URL}/api/business-plans", headers=auth_headers, timeout=15)
        assert resp.status_code == 200, f"Business plans list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_evaluate_uscis_endpoint_exists(self, auth_headers):
        """POST /api/business-plans/{id}/evaluate-uscis with invalid ID returns 404 not 500"""
        resp = requests.post(
            f"{BASE_URL}/api/business-plans/nonexistent-plan-id-12345/evaluate-uscis",
            json={},
            headers=auth_headers,
            timeout=15
        )
        # Should be 404 (not found) or 422 (validation), but NOT 500
        assert resp.status_code != 500, f"evaluate-uscis returned 500 for invalid ID: {resp.text}"
        assert resp.status_code in [404, 422, 400], f"Expected 404/422/400, got {resp.status_code}: {resp.text}"
