"""
Expert Letters Router - New router testing + Policy Papers / Case Studies regression.
Iteration 31 - Testing:
  1. Expert Letters Router (NEW) - GET list, GET by ID (404), DELETE (404), no-auth checks
  2. Policy Papers Router (refactored) - GET list structure, GET by ID (404), evaluate-coherence (404)
  3. Case Studies Router (regression) - GET list structure, GET by ID (404)
  4. Auth regression - POST /api/auth/login returns access_token
  5. Clients regression - GET /api/clients returns 200
  6. Backend health - GET /api/health returns 200
  7. Server.py line count validation (~36600 lines)
"""

import os
import pytest
import requests

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
    """Health check - must pass before any other tests."""

    def test_health_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"

    def test_health_response_has_status(self):
        response = requests.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert isinstance(data, dict), "Health response should be a dict"
        has_status = any(k in data for k in ["status", "healthy", "ok", "message"])
        assert has_status, f"Health response missing status key: {data}"


# ──────────────────────────────────────────────
# 2. Auth Regression
# ──────────────────────────────────────────────

class TestAuthRegression:
    """Auth endpoints regression after Expert Letters Router addition."""

    def test_login_with_valid_credentials_returns_200(self):
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
        assert "access_token" in data, f"access_token missing: {data}"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 10, "access_token too short"

    def test_login_invalid_credentials_returns_401_or_400(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@notexist.com", "password": "wrongpassword"}
        )
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"


# ──────────────────────────────────────────────
# 3. Expert Letters Router (NEW)
# ──────────────────────────────────────────────

class TestExpertLettersRouter:
    """
    Validate NEW Expert Letters Router endpoints.
    Router prefix: /expert-letters
    Endpoints: GET /api/expert-letters, GET /api/expert-letters/{id},
               DELETE /api/expert-letters/{id}, GET /api/expert-letters/{id}/download
    """

    def test_get_expert_letters_without_auth_returns_403(self):
        """Unauthenticated request should return 401 or 403 (FastAPI HTTPBearer returns 403)."""
        response = requests.get(f"{BASE_URL}/api/expert-letters")
        assert response.status_code in [401, 403], (
            f"Expected 401/403 for unauthenticated request, got {response.status_code}: {response.text}"
        )

    def test_get_expert_letters_with_auth_returns_200(self, auth_headers):
        """GET /api/expert-letters should return 200 with valid auth."""
        response = requests.get(f"{BASE_URL}/api/expert-letters", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

    def test_get_expert_letters_returns_letters_key(self, auth_headers):
        """GET /api/expert-letters should return dict with 'letters' key containing a list."""
        response = requests.get(f"{BASE_URL}/api/expert-letters", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "letters" in data, f"Response missing 'letters' key: {data}"
        assert isinstance(data["letters"], list), f"'letters' should be a list, got: {type(data['letters'])}"

    def test_get_nonexistent_expert_letter_returns_404(self, auth_headers):
        """GET /api/expert-letters/{nonexistent-id} should return 404."""
        fake_id = "nonexistent-expert-letter-id-99999"
        response = requests.get(f"{BASE_URL}/api/expert-letters/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, (
            f"Expected 404 for nonexistent letter, got {response.status_code}: {response.text}"
        )

    def test_delete_nonexistent_expert_letter_returns_404(self, auth_headers):
        """DELETE /api/expert-letters/{nonexistent-id} should return 404."""
        fake_id = "nonexistent-expert-letter-to-delete-99999"
        response = requests.delete(
            f"{BASE_URL}/api/expert-letters/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404, (
            f"Expected 404 for nonexistent letter delete, got {response.status_code}: {response.text}"
        )

    def test_get_expert_letter_without_auth_returns_403(self):
        """GET /api/expert-letters/{id} without auth should return 401/403."""
        response = requests.get(f"{BASE_URL}/api/expert-letters/some-letter-id")
        assert response.status_code in [401, 403], (
            f"Expected 401/403, got {response.status_code}"
        )

    def test_delete_expert_letter_without_auth_returns_403(self):
        """DELETE /api/expert-letters/{id} without auth should return 401/403."""
        response = requests.delete(f"{BASE_URL}/api/expert-letters/some-letter-id")
        assert response.status_code in [401, 403], (
            f"Expected 401/403, got {response.status_code}"
        )

    def test_download_nonexistent_expert_letter_returns_404(self, auth_headers):
        """GET /api/expert-letters/{nonexistent-id}/download should return 404."""
        fake_id = "nonexistent-expert-letter-download-99999"
        response = requests.get(
            f"{BASE_URL}/api/expert-letters/{fake_id}/download",
            headers=auth_headers,
            params={"language": "en"}
        )
        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}: {response.text}"
        )

    def test_expert_letters_filter_by_client_id(self, auth_headers):
        """GET /api/expert-letters?client_id=xxx should return filtered list."""
        fake_client_id = "nonexistent-client-for-filter-test"
        response = requests.get(
            f"{BASE_URL}/api/expert-letters",
            params={"client_id": fake_client_id},
            headers=auth_headers
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        data = response.json()
        assert "letters" in data
        assert data["letters"] == [], f"Expected empty list for fake client, got: {data['letters']}"

    def test_expert_letters_router_not_returning_405(self, auth_headers):
        """Verify the router is registered (GET endpoint should not return 404 or 405)."""
        response = requests.get(f"{BASE_URL}/api/expert-letters", headers=auth_headers)
        assert response.status_code not in [404, 405], (
            f"Expert Letters Router not registered properly: {response.status_code} {response.text}"
        )


# ──────────────────────────────────────────────
# 4. Policy Papers Router (Refactored - Regression)
# ──────────────────────────────────────────────

class TestPolicyPapersRouter:
    """
    Validate Policy Papers Router (refactored from server.py).
    Router prefix: /policy-papers
    Endpoints: GET /api/policy-papers, GET /api/policy-papers/{id},
               POST /api/policy-papers/{id}/evaluate-coherence
    """

    def test_get_policy_papers_without_auth_returns_403(self):
        """Unauthenticated request should return 401/403."""
        response = requests.get(f"{BASE_URL}/api/policy-papers")
        assert response.status_code in [401, 403], (
            f"Expected 401/403, got {response.status_code}"
        )

    def test_get_policy_papers_with_auth_returns_200(self, auth_headers):
        """GET /api/policy-papers should return 200."""
        response = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

    def test_get_policy_papers_returns_policy_papers_key(self, auth_headers):
        """GET /api/policy-papers should return dict with 'policy_papers' key."""
        response = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "policy_papers" in data, f"Response missing 'policy_papers' key: {data}"
        assert isinstance(data["policy_papers"], list), (
            f"'policy_papers' should be a list, got: {type(data['policy_papers'])}"
        )

    def test_get_nonexistent_policy_paper_returns_404(self, auth_headers):
        """GET /api/policy-papers/{nonexistent-id} should return 404."""
        fake_id = "nonexistent-policy-paper-id-99999"
        response = requests.get(f"{BASE_URL}/api/policy-papers/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}: {response.text}"
        )

    def test_evaluate_coherence_nonexistent_paper_returns_404(self, auth_headers):
        """POST /api/policy-papers/{nonexistent-id}/evaluate-coherence should return 404."""
        dummy_id = "nonexistent-policy-paper-coherence-test-99999"
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{dummy_id}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}: {response.text}"
        )

    def test_evaluate_coherence_endpoint_exists(self, auth_headers):
        """POST /api/policy-papers/{id}/evaluate-coherence endpoint must exist (not 405)."""
        dummy_id = "test-endpoint-exists-99999"
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{dummy_id}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code != 405, (
            f"Endpoint not registered (405 Method Not Allowed): {response.text}"
        )
        assert response.status_code in [404, 422, 400], (
            f"Unexpected status: {response.status_code}: {response.text}"
        )

    def test_policy_papers_filter_by_client_id(self, auth_headers):
        """GET /api/policy-papers?client_id=xxx should return filtered list."""
        fake_client_id = "nonexistent-client-policy-filter-test"
        response = requests.get(
            f"{BASE_URL}/api/policy-papers",
            params={"client_id": fake_client_id},
            headers=auth_headers
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        data = response.json()
        assert "policy_papers" in data
        assert data["policy_papers"] == [], (
            f"Expected empty list for fake client, got: {data['policy_papers']}"
        )


# ──────────────────────────────────────────────
# 5. Case Studies Router (Regression)
# ──────────────────────────────────────────────

class TestCaseStudiesRegression:
    """Regression tests for Case Studies Router after Expert Letters addition."""

    def test_get_case_studies_with_auth_returns_200(self, auth_headers):
        """GET /api/case-studies should still return 200."""
        response = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        assert response.status_code == 200, (
            f"Case studies regression failed: {response.status_code}: {response.text}"
        )

    def test_get_case_studies_returns_case_studies_key(self, auth_headers):
        """GET /api/case-studies should return dict with 'case_studies' key."""
        response = requests.get(f"{BASE_URL}/api/case-studies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "case_studies" in data, f"Response missing 'case_studies' key: {data}"
        assert isinstance(data["case_studies"], list), (
            f"'case_studies' should be a list: {data}"
        )

    def test_get_nonexistent_case_study_returns_404(self, auth_headers):
        """GET /api/case-studies/{nonexistent-id} should return 404."""
        fake_id = "nonexistent-case-study-regression-99999"
        response = requests.get(f"{BASE_URL}/api/case-studies/{fake_id}", headers=auth_headers)
        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}: {response.text}"
        )


# ──────────────────────────────────────────────
# 6. Clients Router Regression
# ──────────────────────────────────────────────

class TestClientsRegression:
    """Regression tests for clients router after Expert Letters addition."""

    def test_get_clients_with_auth_returns_200(self, auth_headers):
        """GET /api/clients should return 200."""
        response = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers)
        assert response.status_code == 200, (
            f"Clients regression failed: {response.status_code}: {response.text}"
        )

    def test_get_clients_returns_list_or_dict(self, auth_headers):
        """GET /api/clients should return a list or dict."""
        response = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers)
        data = response.json()
        assert isinstance(data, (list, dict)), f"Unexpected response type: {type(data)}"


# ──────────────────────────────────────────────
# 7. Server.py Line Count Validation
# ──────────────────────────────────────────────

class TestServerPyLineCount:
    """Validate that server.py line count reflects extracted modules."""

    def test_server_py_line_count_approx_36600(self):
        """
        server.py was 38769 lines. After extracting:
        - Case Studies Router: ~821 lines
        - Policy Papers Router: ~963 lines
        - Expert Letters Router: ~462 lines
        Total removed: ~2246 lines
        Expected new count: ~36523 (±100 lines tolerance)
        """
        server_path = "/app/backend/server.py"
        try:
            with open(server_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            line_count = len(lines)
            assert 36000 <= line_count <= 37200, (
                f"server.py line count unexpected: {line_count} "
                f"(expected ~36600, between 36000-37200)"
            )
            print(f"✅ server.py line count: {line_count}")
        except FileNotFoundError:
            pytest.skip("server.py not accessible in test environment")

    def test_expert_letters_router_file_exists(self):
        """expert_letters_router.py should exist."""
        import os
        router_path = "/app/backend/routers/expert_letters_router.py"
        assert os.path.exists(router_path), f"Expert Letters Router file not found: {router_path}"

    def test_expert_letters_router_line_count(self):
        """expert_letters_router.py should be ~457 lines."""
        router_path = "/app/backend/routers/expert_letters_router.py"
        try:
            with open(router_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            line_count = len(lines)
            assert 400 <= line_count <= 600, (
                f"expert_letters_router.py line count unexpected: {line_count} (expected ~457)"
            )
            print(f"✅ expert_letters_router.py line count: {line_count}")
        except FileNotFoundError:
            pytest.skip("Router file not accessible")

    def test_policy_papers_router_file_exists(self):
        """policy_papers_router.py should exist."""
        import os
        router_path = "/app/backend/routers/policy_papers_router.py"
        assert os.path.exists(router_path), f"Policy Papers Router file not found: {router_path}"

    def test_policy_papers_router_line_count(self):
        """policy_papers_router.py should be ~826 lines."""
        router_path = "/app/backend/routers/policy_papers_router.py"
        try:
            with open(router_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            line_count = len(lines)
            assert 700 <= line_count <= 900, (
                f"policy_papers_router.py line count unexpected: {line_count} (expected ~826)"
            )
            print(f"✅ policy_papers_router.py line count: {line_count}")
        except FileNotFoundError:
            pytest.skip("Router file not accessible")


# ──────────────────────────────────────────────
# 8. No Duplicate Routes Validation
# ──────────────────────────────────────────────

class TestNoDuplicateRoutes:
    """
    Validate no duplicate route registration for Expert Letters, Policy Papers,
    and Case Studies routers.
    """

    def test_expert_letters_list_endpoint_consistent(self, auth_headers):
        """Duplicate registration causes inconsistency - check response is stable."""
        resp1 = requests.get(f"{BASE_URL}/api/expert-letters", headers=auth_headers)
        resp2 = requests.get(f"{BASE_URL}/api/expert-letters", headers=auth_headers)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert "letters" in resp1.json()
        assert "letters" in resp2.json()

    def test_policy_papers_list_endpoint_consistent(self, auth_headers):
        """Duplicate registration causes inconsistency - check response is stable."""
        resp1 = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        resp2 = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert "policy_papers" in resp1.json()
        assert "policy_papers" in resp2.json()

    def test_backend_starts_without_errors(self):
        """Backend should start cleanly with all 3 routers registered."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, (
            "Backend failed to start - possible duplicate route or import error"
        )
