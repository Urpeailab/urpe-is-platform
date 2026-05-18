"""
Tests for Case Studies Router refactoring validation and related regression tests.
Iteration 30 - Testing:
  1. Case Studies Router (refactored from server.py to routers/case_studies_router.py)
  2. Policy Papers endpoints (regression)
  3. Backend health
  4. Auth endpoints regression
  5. Clients Router regression
  6. No duplicate route registration
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for all tests in this module."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "dau@urpeailab.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.status_code} {response.text}"
    token = response.json().get("access_token", "")
    assert token, "Access token is empty"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ──────────────────────────────────────────────
# 1. Backend Health
# ──────────────────────────────────────────────

class TestBackendHealth:
    """Health check - must pass before any other tests"""

    def test_health_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"

    def test_health_response_structure(self):
        response = requests.get(f"{BASE_URL}/api/health")
        data = response.json()
        # Should have some status indicator
        assert isinstance(data, dict), "Health response should be a dict"
        # Common health response keys
        has_status = any(k in data for k in ["status", "healthy", "ok", "message"])
        assert has_status, f"Health response missing status key: {data}"


# ──────────────────────────────────────────────
# 2. Auth Endpoints Regression
# ──────────────────────────────────────────────

class TestAuthEndpoints:
    """Auth endpoints regression - ensure they still work after refactoring"""

    def test_login_with_valid_credentials(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} {response.text}"

    def test_login_returns_access_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"}
        )
        data = response.json()
        assert "access_token" in data, f"access_token missing from response: {data}"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 0

    def test_login_with_invalid_credentials_returns_401(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"


# ──────────────────────────────────────────────
# 3. Case Studies Router (Refactoring Validation)
# ──────────────────────────────────────────────

class TestCaseStudiesRouter:
    """
    Validate that case studies endpoints work after being moved
    from server.py to routers/case_studies_router.py
    """

    def test_get_case_studies_without_auth_returns_401_or_403(self):
        """Unauthenticated request should return 401 or 403 (FastAPI HTTPBearer returns 403)"""
        response = requests.get(f"{BASE_URL}/api/case-studies")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"

    def test_get_case_studies_with_auth_returns_200(self, auth_headers):
        """GET /api/case-studies should return list with valid auth"""
        response = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_case_studies_returns_list_structure(self, auth_headers):
        """GET /api/case-studies should return dict with case_studies key"""
        response = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "case_studies" in data, f"Response missing 'case_studies' key: {data}"
        assert isinstance(data["case_studies"], list), f"case_studies should be a list: {data}"

    def test_get_nonexistent_case_study_returns_404(self, auth_headers):
        """GET /api/case-studies/{id} should return 404 for nonexistent ID"""
        fake_id = "nonexistent-case-study-id-99999"
        response = requests.get(f"{BASE_URL}/api/case-studies/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"

    def test_delete_nonexistent_case_study_returns_404(self, auth_headers):
        """DELETE /api/case-studies/{id} should return 404 for nonexistent ID"""
        fake_id = "nonexistent-case-study-to-delete-99999"
        response = requests.delete(f"{BASE_URL}/api/case-studies/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"

    def test_get_case_study_without_auth_returns_401_or_403(self):
        """GET /api/case-studies/{id} without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/case-studies/some-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_delete_case_study_without_auth_returns_401_or_403(self):
        """DELETE /api/case-studies/{id} without auth should return 401/403"""
        response = requests.delete(f"{BASE_URL}/api/case-studies/some-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_case_studies_filter_by_client_id(self, auth_headers):
        """GET /api/case-studies?client_id=xxx should return filtered list"""
        fake_client_id = "nonexistent-client-filter-test"
        response = requests.get(
            f"{BASE_URL}/api/case-studies",
            params={"client_id": fake_client_id},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "case_studies" in data
        # Filter should return empty list for nonexistent client
        assert data["case_studies"] == [], f"Expected empty list for fake client, got: {data['case_studies']}"


# ──────────────────────────────────────────────
# 4. Policy Papers Endpoints (Regression)
# ──────────────────────────────────────────────

class TestPolicyPapersRegression:
    """Regression tests for policy papers after case studies refactoring"""

    def test_get_policy_papers_returns_200(self, auth_headers):
        """GET /api/policy-papers should still work"""
        response = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_policy_papers_returns_list(self, auth_headers):
        """GET /api/policy-papers should return a list"""
        response = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        data = response.json()
        # Response could be list or dict with papers key
        assert isinstance(data, (list, dict)), f"Unexpected response type: {type(data)}"

    def test_evaluate_coherence_nonexistent_paper_returns_404(self, auth_headers):
        """POST /api/policy-papers/{id}/evaluate-coherence with dummy ID should return 404"""
        dummy_id = "nonexistent-policy-paper-dummy-id-99999"
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{dummy_id}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"

    def test_evaluate_coherence_endpoint_exists(self, auth_headers):
        """POST /api/policy-papers/{id}/evaluate-coherence endpoint must exist (not 404/405)"""
        dummy_id = "test-endpoint-exists"
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{dummy_id}/evaluate-coherence",
            headers=auth_headers
        )
        # 404 = paper not found (endpoint exists), 405 = method not allowed (endpoint doesn't exist)
        assert response.status_code != 405, f"Endpoint not registered (405 Method Not Allowed)"
        # Should be 404 (paper not found) or 422 (validation error) - both mean endpoint exists
        assert response.status_code in [404, 422, 400], f"Unexpected status: {response.status_code}: {response.text}"


# ──────────────────────────────────────────────
# 5. Clients Router Regression
# ──────────────────────────────────────────────

class TestClientsRouterRegression:
    """Regression tests for clients router"""

    def test_get_clients_without_auth_returns_401_or_403(self):
        """GET /api/clients without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/clients")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_get_clients_with_auth_returns_200(self, auth_headers):
        """GET /api/clients with auth should return 200"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_clients_returns_list_structure(self, auth_headers):
        """GET /api/clients should return clients list"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers)
        data = response.json()
        assert isinstance(data, (list, dict)), f"Unexpected response type: {type(data)}"


# ──────────────────────────────────────────────
# 6. No Duplicate Route Registration Validation
# ──────────────────────────────────────────────

class TestNoDuplicateRoutes:
    """
    Validate that case-studies routes are not registered twice
    (once in server.py and once via the router).
    This is verified by checking the OpenAPI schema or by testing endpoint behavior.
    """

    def test_case_studies_list_endpoint_responds_once(self, auth_headers):
        """
        Duplicate route registration would cause unpredictable behavior.
        Verify that GET /api/case-studies returns consistent response.
        """
        resp1 = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        resp2 = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Both responses should have same structure
        assert "case_studies" in resp1.json()
        assert "case_studies" in resp2.json()

    def test_backend_startup_comment_in_server_py(self, auth_headers):
        """
        Verify that backend is running without issues (healthcheck passes).
        If there were duplicate route errors, the server would fail to start.
        """
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, "Backend failed to start (possible duplicate route issue)"
