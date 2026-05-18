"""
Test file for CV upload enhanced endpoint and toast fix verification.
Tests:
  1. /api/upload-cv-enhanced - POST with PDF returns SSE streaming
  2. Verifies token stream, done event with enhanced_cv
  3. Verifies auth is required
"""

import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"
TEST_PDF_PATH = "/tmp/test_resume.pdf"


@pytest.fixture(scope="module")
def auth_token():
    """Obtain a valid JWT token for testing"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token") or data.get("token")
        if token:
            return token
    pytest.skip(f"Authentication failed (status={resp.status_code}): {resp.text[:200]}")


class TestCVUploadEnhanced:
    """Tests for /api/upload-cv-enhanced SSE endpoint"""

    def test_endpoint_requires_auth(self):
        """Verify that the endpoint returns 401/403 without token"""
        with open(TEST_PDF_PATH, 'rb') as f:
            resp = requests.post(
                f"{BASE_URL}/api/upload-cv-enhanced",
                files={"file": ("test_resume.pdf", f, "application/pdf")},
                data={"additional_info": ""},
                timeout=30
            )
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 without auth, got {resp.status_code}: {resp.text[:200]}"
        )
        print(f"✅ Auth guard working: {resp.status_code}")

    def test_endpoint_accepts_pdf_and_streams_sse(self, auth_token):
        """Verify endpoint accepts PDF and returns SSE events with tokens"""
        assert os.path.exists(TEST_PDF_PATH), f"Test PDF not found at {TEST_PDF_PATH}"

        with open(TEST_PDF_PATH, 'rb') as f:
            resp = requests.post(
                f"{BASE_URL}/api/upload-cv-enhanced",
                headers={"Authorization": f"Bearer {auth_token}"},
                files={"file": ("test_resume.pdf", f, "application/pdf")},
                data={"additional_info": ""},
                stream=True,
                timeout=300
            )

        print(f"  Status code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"

        content_type = resp.headers.get("content-type", "")
        assert "text/event-stream" in content_type, (
            f"Expected text/event-stream content type, got: {content_type}"
        )
        print(f"✅ Content-Type is text/event-stream: {content_type}")

    def test_sse_stream_sends_token_events(self, auth_token):
        """Verify SSE stream sends data:{token:...} events"""
        assert os.path.exists(TEST_PDF_PATH), f"Test PDF not found at {TEST_PDF_PATH}"

        with open(TEST_PDF_PATH, 'rb') as f:
            resp = requests.post(
                f"{BASE_URL}/api/upload-cv-enhanced",
                headers={"Authorization": f"Bearer {auth_token}"},
                files={"file": ("test_resume.pdf", f, "application/pdf")},
                data={"additional_info": ""},
                stream=True,
                timeout=300
            )

        assert resp.status_code == 200

        token_count = 0
        done_received = False
        enhanced_cv_content = ""
        error_received = None
        lines_read = 0
        max_lines = 10000  # safety limit

        for raw_line in resp.iter_lines():
            lines_read += 1
            if lines_read > max_lines:
                print(f"  Reached max_lines={max_lines}, stopping")
                break

            if not raw_line:
                continue

            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line

            if not line.startswith("data: "):
                continue

            payload_str = line[6:]
            if payload_str.strip() == "[DONE]":
                break

            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                continue

            if "error" in payload:
                error_received = payload["error"]
                print(f"  ⚠️ Error in stream: {error_received}")
                break

            if "token" in payload:
                token_count += 1

            if payload.get("done"):
                done_received = True
                enhanced_cv_content = payload.get("enhanced_cv", "")
                print(f"  ✅ Done event received. enhanced_cv length: {len(enhanced_cv_content)}")
                break

        print(f"  Token events received: {token_count}")
        print(f"  Done event received: {done_received}")

        assert error_received is None, f"Stream returned error: {error_received}"
        assert token_count > 0, "No token events received from SSE stream"
        assert done_received, "Stream did not send 'done' event"
        assert len(enhanced_cv_content) > 100, (
            f"Enhanced CV content too short ({len(enhanced_cv_content)} chars)"
        )
        print(f"✅ SSE stream working: {token_count} tokens, done=True, enhanced_cv={len(enhanced_cv_content)} chars")

    def test_sse_stream_with_additional_info(self, auth_token):
        """Verify SSE stream also works when additional_info (project_idea) is provided"""
        assert os.path.exists(TEST_PDF_PATH), f"Test PDF not found at {TEST_PDF_PATH}"

        project_idea = "Quiero hacer una investigación en machine learning aplicado a bioinformática"

        with open(TEST_PDF_PATH, 'rb') as f:
            resp = requests.post(
                f"{BASE_URL}/api/upload-cv-enhanced",
                headers={"Authorization": f"Bearer {auth_token}"},
                files={"file": ("test_resume.pdf", f, "application/pdf")},
                data={"additional_info": project_idea},
                stream=True,
                timeout=300
            )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:500]}"

        done_received = False
        error_received = None
        enhanced_cv_content = ""

        for raw_line in resp.iter_lines():
            if not raw_line:
                continue
            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
            if not line.startswith("data: "):
                continue
            payload_str = line[6:]
            if payload_str.strip() == "[DONE]":
                break
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                continue
            if "error" in payload:
                error_received = payload["error"]
                break
            if payload.get("done"):
                done_received = True
                enhanced_cv_content = payload.get("enhanced_cv", "")
                break

        assert error_received is None, f"Stream returned error: {error_received}"
        assert done_received, "Stream did not send 'done' event with additional_info"
        assert len(enhanced_cv_content) > 100, (
            f"Enhanced CV with additional_info too short: {len(enhanced_cv_content)} chars"
        )
        print(f"✅ SSE stream with additional_info working: enhanced_cv={len(enhanced_cv_content)} chars")

    def test_endpoint_rejects_non_pdf(self, auth_token):
        """Verify the endpoint rejects non-PDF/DOC files"""
        fake_txt = b"This is a text file not a PDF"
        resp = requests.post(
            f"{BASE_URL}/api/upload-cv-enhanced",
            headers={"Authorization": f"Bearer {auth_token}"},
            files={"file": ("resume.txt", fake_txt, "text/plain")},
            data={"additional_info": ""},
            timeout=30
        )
        assert resp.status_code in [400, 422], (
            f"Expected 400/422 for non-PDF file, got {resp.status_code}: {resp.text[:300]}"
        )
        print(f"✅ Non-PDF correctly rejected with status {resp.status_code}")
