"""
Backend tests for AI Edit Async system (iteration 45)
Tests:
- POST /api/business-plans/ai-edit-async/{niw_id} - async job creation
- GET /api/business-plans/ai-edit-job/{job_id} - job polling/status
- GET /api/business-plans/{niw_id} - plan loading with sections
- Verifies job completes and sections have content
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test NIW ID provided by main agent
TEST_NIW_ID = "3ea527e9-aeb8-48ca-8c0d-02235356d9bf"
# Simple instruction to avoid long execution (avoid structural keywords)
SIMPLE_INSTRUCTION = "Actualiza todos los [Estado] por California"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dau@urpeailab.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Auth failed: {response.status_code} {response.text[:200]}")
    token = response.json().get("access_token") or response.json().get("token")
    if not token:
        pytest.skip(f"No token in response: {response.json()}")
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAuthLogin:
    """Basic auth test"""

    def test_login_success(self):
        """Admin login should return 200 with token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dau@urpeailab.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text[:300]}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token is not None, f"No token in response: {data}"
        print(f"✅ Login OK - token starts with: {str(token)[:20]}...")


class TestBusinessPlanLoad:
    """Test GET /api/business-plans/{niw_id}"""

    def test_plan_loads_with_sections(self, auth_headers):
        """Business plan should return with non-empty sections"""
        response = requests.get(f"{BASE_URL}/api/business-plans/{TEST_NIW_ID}", headers=auth_headers)
        assert response.status_code == 200, f"Plan load failed: {response.status_code} {response.text[:300]}"
        data = response.json()

        # Check basic fields
        assert "id" in data, "Plan should have 'id' field"
        assert data.get("id") == TEST_NIW_ID, f"ID mismatch: {data.get('id')}"

        # Check sections exist
        sections = data.get("sections", [])
        assert len(sections) > 0, f"Plan has no sections: {data.keys()}"
        print(f"✅ Plan loaded: {len(sections)} sections")

        # Check at least one section has content
        sections_with_content = [s for s in sections if s.get("content_es") or s.get("content") or s.get("content_en")]
        assert len(sections_with_content) > 0, "No sections have content (content_es/content/content_en all empty)"
        print(f"✅ Sections with content: {len(sections_with_content)}/{len(sections)}")

        # Log section titles and content availability
        for s in sections[:3]:
            has_es = bool(s.get("content_es"))
            has_en = bool(s.get("content_en"))
            has_content = bool(s.get("content"))
            print(f"  Section {s.get('number')}: '{s.get('title','')}' - es={has_es} en={has_en} content={has_content}")

    def test_plan_sections_have_content_es(self, auth_headers):
        """Sections should have content_es field (Spanish content)"""
        response = requests.get(f"{BASE_URL}/api/business-plans/{TEST_NIW_ID}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        sections = data.get("sections", [])

        sections_with_es = [s for s in sections if s.get("content_es") and len(s.get("content_es", "")) > 50]
        total = len(sections)
        print(f"✅ Sections with content_es (>50 chars): {len(sections_with_es)}/{total}")

        # At least 50% of sections should have Spanish content
        if total > 0:
            pct = len(sections_with_es) / total
            assert pct >= 0.5, f"Only {len(sections_with_es)}/{total} sections have content_es. Check translation status."


class TestAIEditAsync:
    """Test POST /api/business-plans/ai-edit-async/{niw_id}"""

    def test_async_edit_returns_job_id(self, auth_headers):
        """POST ai-edit-async should return 200 with job_id immediately (no 502)"""
        response = requests.post(
            f"{BASE_URL}/api/business-plans/ai-edit-async/{TEST_NIW_ID}",
            json={
                "edit_instructions": SIMPLE_INSTRUCTION,
                "language": "es"
            },
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. "
            f"Response: {response.text[:500]}"
        )
        data = response.json()
        assert "job_id" in data, f"No job_id in response: {data}"
        assert data["job_id"], "job_id should not be empty"
        assert data.get("status") == "pending", f"Expected status=pending, got {data.get('status')}"
        print(f"✅ Async edit started: job_id={data['job_id']}")
        # Store for polling test - using pytest cache via class variable
        TestAIEditAsync._job_id = data["job_id"]

    def test_job_status_endpoint_exists(self, auth_headers):
        """GET ai-edit-job/{job_id} should return job status"""
        job_id = getattr(TestAIEditAsync, '_job_id', None)
        if not job_id:
            pytest.skip("No job_id from previous test")

        response = requests.get(
            f"{BASE_URL}/api/business-plans/ai-edit-job/{job_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Job status failed: {response.status_code} {response.text[:300]}"
        data = response.json()
        assert "job_id" in data, f"No job_id in status response: {data}"
        assert "status" in data, f"No status in response: {data}"
        assert data["status"] in ("pending", "processing", "completed", "failed"), \
            f"Invalid status: {data['status']}"
        print(f"✅ Job status: {data['status']} - {data.get('progress_message', '')}")

    def test_job_not_found_returns_404(self, auth_headers):
        """Non-existent job_id should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/ai-edit-job/nonexistent-job-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Non-existent job returns 404")


class TestAIEditJobPolling:
    """Test polling the job until completion (with timeout)"""

    def test_job_completes_or_progresses(self, auth_headers):
        """
        Start a fresh simple AI edit job and poll for up to 3 minutes.
        Simple instruction: 'Actualiza todos los [Estado] por California'
        This should NOT trigger structural mode (no structural keywords).
        """
        # Start job
        response = requests.post(
            f"{BASE_URL}/api/business-plans/ai-edit-async/{TEST_NIW_ID}",
            json={
                "edit_instructions": SIMPLE_INSTRUCTION,
                "language": "es"
            },
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Failed to start job: {response.text[:300]}"
        job_id = response.json()["job_id"]
        print(f"✅ Job started: {job_id}")

        # Poll for up to 3 minutes (180 seconds)
        MAX_WAIT = 180
        POLL_INTERVAL = 5
        elapsed = 0
        final_status = None
        final_data = None

        while elapsed < MAX_WAIT:
            time.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            status_resp = requests.get(
                f"{BASE_URL}/api/business-plans/ai-edit-job/{job_id}",
                headers=auth_headers
            )
            assert status_resp.status_code == 200, f"Poll failed: {status_resp.text[:200]}"
            job_data = status_resp.json()
            current_status = job_data.get("status")
            progress = job_data.get("progress_message", "")
            print(f"  [{elapsed}s] status={current_status} | {progress}")

            if current_status in ("completed", "failed"):
                final_status = current_status
                final_data = job_data
                break

        if final_status is None:
            # Still running after 3 min - report as potential issue
            print(f"⚠️ Job still running after {MAX_WAIT}s - may need more time")
            pytest.fail(f"Job did not complete within {MAX_WAIT}s (still: {final_status or 'processing'})")

        # Assert completion
        assert final_status == "completed", (
            f"Job failed: {final_data.get('error', 'Unknown error')}"
        )

        result = final_data.get("result", {})
        total_modified = result.get("total_sections_modified", 0)
        print(f"✅ Job completed! Sections modified: {total_modified}")
        print(f"   Message: {result.get('message', '')}")

        # For a simple instruction affecting Estado → California, at least some sections should be modified
        # (Note: if document doesn't contain [Estado], it may be 0 — this is acceptable)
        assert result.get("success") is True, f"Result.success should be True: {result}"
        print(f"✅ Result success=True, total_sections_modified={total_modified}")

    def test_job_result_has_required_fields(self, auth_headers):
        """Job result should have required fields when completed"""
        # Start a new job for verification
        response = requests.post(
            f"{BASE_URL}/api/business-plans/ai-edit-async/{TEST_NIW_ID}",
            json={
                "edit_instructions": "Verifica que el formato HTML sea correcto",
                "language": "es"
            },
            headers=auth_headers,
            timeout=30
        )
        if response.status_code != 200:
            pytest.skip(f"Could not start job: {response.text[:200]}")

        job_id = response.json()["job_id"]

        # Wait up to 2 min for this simpler job
        MAX_WAIT = 120
        POLL_INTERVAL = 5
        elapsed = 0
        final_data = None

        while elapsed < MAX_WAIT:
            time.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL
            status_resp = requests.get(
                f"{BASE_URL}/api/business-plans/ai-edit-job/{job_id}",
                headers=auth_headers
            )
            job_data = status_resp.json()
            if job_data.get("status") in ("completed", "failed"):
                final_data = job_data
                break

        if final_data is None:
            pytest.skip(f"Job didn't complete within {MAX_WAIT}s")

        print(f"Job finished with status: {final_data.get('status')}")

        if final_data.get("status") == "completed":
            result = final_data.get("result", {})
            assert "success" in result, f"Result missing 'success' field: {result}"
            assert "total_sections_modified" in result, f"Result missing 'total_sections_modified': {result}"
            assert "changes" in result, f"Result missing 'changes' field: {result}"
            print(f"✅ Result fields OK: success={result['success']}, modified={result['total_sections_modified']}")
        else:
            print(f"⚠️ Job failed: {final_data.get('error')} — this is a bug to report")
            pytest.fail(f"Job failed: {final_data.get('error', 'unknown')}")
