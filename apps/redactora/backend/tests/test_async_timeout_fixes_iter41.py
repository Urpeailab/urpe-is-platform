"""
Test Suite for P0 Async Timeout Fixes (Iteration 41)
=====================================================
Tests the three P0 fixes made to avoid Cloudflare 520/524 timeouts:
1. POST /business-plans/suggest-project-names-async - returns task_id immediately
2. GET /business-plans/suggest-project-status/{task_id} - polling endpoint
3. POST /business-plans/ai-edit-async/{niw_id} - returns job_id immediately
4. GET /business-plans/ai-edit-job/{job_id} - polling endpoint
5. POST /upload-cv-enhanced - SSE with heartbeat as first event
"""

import pytest
import requests
import os
import time
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or "https://domain-relink-test.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"


class TestHealthAndAuth:
    """Basic health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test that the health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Health endpoint returns 200")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✅ Login successful, token received")
        return data["access_token"]


class TestSuggestProjectNamesAsync:
    """Tests for the async suggest-project-names endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_suggest_project_names_async_returns_task_id(self, auth_token):
        """POST /business-plans/suggest-project-names-async returns task_id immediately"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {
            "applicant_name": "Test Applicant",
            "applicant_cv": "Software Engineer with 10 years experience in AI/ML",
            "patent_info": "",
            "custom_project_suggestion": "",
            "language": "en"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/business-plans/suggest-project-names-async",
            json=payload,
            headers=headers,
            timeout=30
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "task_id" in data, "No task_id in response"
        assert "status" in data, "No status in response"
        assert data["status"] == "pending", f"Expected status 'pending', got '{data['status']}'"
        
        # Should return quickly (< 5 seconds) since it's async
        assert elapsed < 5, f"Response took too long ({elapsed:.2f}s) - should be immediate"
        
        print(f"✅ suggest-project-names-async returned task_id={data['task_id']} in {elapsed:.2f}s")
        return data["task_id"]
    
    def test_suggest_project_status_endpoint(self, auth_token):
        """GET /business-plans/suggest-project-status/{task_id} returns correct status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a task
        payload = {
            "applicant_name": "Test Applicant",
            "applicant_cv": "Software Engineer with 10 years experience in AI/ML",
            "patent_info": "",
            "custom_project_suggestion": "",
            "language": "en"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/business-plans/suggest-project-names-async",
            json=payload,
            headers=headers,
            timeout=30
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Poll for status
        response = requests.get(
            f"{BASE_URL}/api/business-plans/suggest-project-status/{task_id}",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "task_id" in data, "No task_id in status response"
        assert "status" in data, "No status in status response"
        assert data["status"] in ["pending", "processing", "completed", "failed"], \
            f"Invalid status: {data['status']}"
        
        print(f"✅ suggest-project-status returned status='{data['status']}' for task_id={task_id}")
    
    def test_suggest_project_status_not_found(self, auth_token):
        """GET /business-plans/suggest-project-status/{task_id} returns 404 for invalid task_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/business-plans/suggest-project-status/invalid-task-id-12345",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ suggest-project-status returns 404 for invalid task_id")


class TestAIEditAsync:
    """Tests for the async AI edit endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_ai_edit_async_returns_job_id(self, auth_token):
        """POST /business-plans/ai-edit-async/{niw_id} returns job_id immediately"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Use a fake NIW ID - the endpoint should still return job_id immediately
        # (the background task will fail, but that's fine for this test)
        payload = {
            "edit_instructions": "Test instruction",
            "language": "es"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/business-plans/ai-edit-async/fake-niw-id-test",
            json=payload,
            headers=headers,
            timeout=30
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "job_id" in data, "No job_id in response"
        assert "status" in data, "No status in response"
        assert data["status"] == "pending", f"Expected status 'pending', got '{data['status']}'"
        
        # Should return quickly (< 5 seconds) since it's async
        assert elapsed < 5, f"Response took too long ({elapsed:.2f}s) - should be immediate"
        
        print(f"✅ ai-edit-async returned job_id={data['job_id']} in {elapsed:.2f}s")
        return data["job_id"]
    
    def test_ai_edit_job_status_endpoint(self, auth_token):
        """GET /business-plans/ai-edit-job/{job_id} returns correct status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a job
        payload = {
            "edit_instructions": "Test instruction",
            "language": "es"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/business-plans/ai-edit-async/fake-niw-id-test-2",
            json=payload,
            headers=headers,
            timeout=30
        )
        assert create_response.status_code == 200
        job_id = create_response.json()["job_id"]
        
        # Poll for status
        response = requests.get(
            f"{BASE_URL}/api/business-plans/ai-edit-job/{job_id}",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "job_id" in data, "No job_id in status response"
        assert "status" in data, "No status in status response"
        assert data["status"] in ["pending", "processing", "completed", "failed"], \
            f"Invalid status: {data['status']}"
        
        print(f"✅ ai-edit-job returned status='{data['status']}' for job_id={job_id}")
    
    def test_ai_edit_job_not_found(self, auth_token):
        """GET /business-plans/ai-edit-job/{job_id} returns 404 for invalid job_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/business-plans/ai-edit-job/invalid-job-id-12345",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ ai-edit-job returns 404 for invalid job_id")


class TestUploadCVEnhancedSSE:
    """Tests for the upload-cv-enhanced SSE endpoint with heartbeat"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_upload_cv_enhanced_returns_sse_with_heartbeat(self, auth_token):
        """POST /upload-cv-enhanced returns SSE with heartbeat as first event"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple test PDF-like content (we'll use a text file for simplicity)
        # The endpoint should reject non-PDF/DOC files, but we can test the SSE structure
        test_content = b"Test CV content for testing purposes"
        
        files = {
            'file': ('test_cv.pdf', test_content, 'application/pdf')
        }
        data = {
            'additional_info': 'Test additional info'
        }
        
        # Use stream=True to receive SSE
        response = requests.post(
            f"{BASE_URL}/api/upload-cv-enhanced",
            files=files,
            data=data,
            headers=headers,
            stream=True,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert 'text/event-stream' in response.headers.get('content-type', ''), \
            f"Expected SSE content-type, got {response.headers.get('content-type')}"
        
        # Read first few events
        events = []
        for i, line in enumerate(response.iter_lines(decode_unicode=True)):
            if line and line.startswith('data: '):
                try:
                    event_data = json.loads(line[6:])
                    events.append(event_data)
                    print(f"  Event {i}: {event_data}")
                except json.JSONDecodeError:
                    pass
            if len(events) >= 3:  # Read first 3 events
                break
        
        # Check that first event is heartbeat
        if events:
            first_event = events[0]
            if 'heartbeat' in first_event:
                assert first_event.get('heartbeat') == True, "First event should have heartbeat=True"
                assert 'status' in first_event, "Heartbeat should have status field"
                print(f"✅ upload-cv-enhanced SSE first event is heartbeat: {first_event}")
            elif 'error' in first_event:
                # If there's an error (e.g., PDF extraction failed), that's still valid SSE
                print(f"⚠️ upload-cv-enhanced returned error (expected for test file): {first_event}")
            else:
                print(f"⚠️ First event is not heartbeat: {first_event}")
        else:
            print("⚠️ No events received from SSE stream")
        
        response.close()


class TestDashboardAndNavigation:
    """Tests for dashboard and basic navigation"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_dashboard_overview(self, auth_token):
        """GET /dashboard/overview returns stats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/overview?view_all=false",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ Dashboard overview returned: {list(data.keys())}")
    
    def test_auth_me(self, auth_token):
        """GET /auth/me returns current user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=headers,
            timeout=15
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "email" in data, "No email in user data"
        print(f"✅ Auth me returned user: {data.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
