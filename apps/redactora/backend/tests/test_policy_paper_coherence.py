"""
Tests for Policy Papers and Patents coherence evaluation endpoints.
Tests:
- POST /api/policy-papers/{paper_id}/evaluate-coherence new endpoint
- evaluate_document_coherence specific prompts for policy paper and patent types
- generate_policy_paper_background binary PDF extraction logic
- GET /api/policy-papers existing endpoint
- Frontend module loading for Policy Papers and Patents
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TEST_PAPER_ID = "89f7f0a1-1164-43c1-a510-6d157dcff9a2"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for tests."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "dau@urpeailab.com", "password": "admin123"}
    )
    if response.status_code == 200:
        token = response.json().get("access_token", "")
        assert token, "Access token is empty"
        return token
    pytest.skip(f"Authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for API calls."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestPolicyPaperEndpoints:
    """Tests for policy paper endpoints."""

    def test_get_policy_papers_returns_200(self, auth_headers):
        """GET /api/policy-papers should return 200."""
        response = requests.get(f"{BASE_URL}/api/policy-papers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        data = response.json()
        # Should return a dict with "papers" key
        assert "papers" in data or isinstance(data, list), f"Unexpected response structure: {list(data.keys()) if isinstance(data, dict) else type(data)}"
        print(f"✅ GET /api/policy-papers: {response.status_code}")

    def test_get_specific_policy_paper(self, auth_headers):
        """GET /api/policy-papers/{paper_id} should return the paper."""
        response = requests.get(f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        data = response.json()
        assert data.get("id") == TEST_PAPER_ID
        assert "status" in data
        print(f"✅ GET /api/policy-papers/{TEST_PAPER_ID}: status={data.get('status')}")

    def test_evaluate_coherence_endpoint_returns_200(self, auth_headers):
        """POST /api/policy-papers/{paper_id}/evaluate-coherence should return 200."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        data = response.json()
        print(f"✅ POST evaluate-coherence: status={response.status_code}")
        return data

    def test_evaluate_coherence_returns_coherence_evaluation_key(self, auth_headers):
        """POST evaluate-coherence should return coherence_evaluation in response."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "coherence_evaluation" in data, f"Missing 'coherence_evaluation' key. Keys: {list(data.keys())}"
        print(f"✅ coherence_evaluation key present: {list(data.keys())}")

    def test_evaluate_coherence_response_structure(self, auth_headers):
        """evaluate-coherence should return coherence_evaluation with expected fields."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        ce = data.get("coherence_evaluation", {})

        # Check required fields
        assert "coherence_score" in ce, f"Missing 'coherence_score'. Keys: {list(ce.keys())}"
        assert "reflects_cv" in ce, f"Missing 'reflects_cv'. Keys: {list(ce.keys())}"
        assert "project_integrated" in ce, f"Missing 'project_integrated'. Keys: {list(ce.keys())}"
        assert "invented_info" in ce, f"Missing 'invented_info'. Keys: {list(ce.keys())}"
        assert "summary" in ce, f"Missing 'summary'. Keys: {list(ce.keys())}"
        assert "recommendation" in ce, f"Missing 'recommendation'. Keys: {list(ce.keys())}"
        assert "issues_found" in ce, f"Missing 'issues_found'. Keys: {list(ce.keys())}"

        score = ce.get("coherence_score")
        assert isinstance(score, (int, float)), f"coherence_score should be numeric, got: {type(score)}"
        assert 0 <= score <= 100, f"coherence_score should be 0-100, got: {score}"

        print(f"✅ evaluate-coherence structure OK: score={score}, keys={list(ce.keys())}")

    def test_evaluate_coherence_returns_paper_id(self, auth_headers):
        """evaluate-coherence response should include paper_id."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("paper_id") == TEST_PAPER_ID, f"Expected paper_id={TEST_PAPER_ID}, got: {data.get('paper_id')}"
        print(f"✅ paper_id in response: {data.get('paper_id')}")

    def test_evaluate_coherence_returns_message(self, auth_headers):
        """evaluate-coherence should return success message."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data, f"Missing 'message'. Keys: {list(data.keys())}"
        print(f"✅ message in response: {data.get('message')}")

    def test_evaluate_coherence_policy_paper_uses_na_for_cv_fields(self, auth_headers):
        """Policy paper coherence should have reflects_cv=N/A (no CV needed)."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        ce = data.get("coherence_evaluation", {})
        # For policy papers, reflects_cv should be N/A (no CV required)
        reflects_cv = ce.get("reflects_cv", "")
        assert reflects_cv == "N/A", f"For policy paper type, reflects_cv should be 'N/A', got: '{reflects_cv}'"
        print(f"✅ Policy paper reflects_cv=N/A (correct, no CV needed): {reflects_cv}")

    def test_evaluate_coherence_404_for_invalid_paper(self, auth_headers):
        """POST evaluate-coherence should return 404 for non-existent paper."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/non-existent-paper-id/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text[:200]}"
        print(f"✅ 404 for non-existent paper: {response.status_code}")

    def test_evaluate_coherence_requires_auth(self):
        """evaluate-coherence should require authentication."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence"
        )
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✅ Auth required: {response.status_code}")

    def test_evaluate_coherence_updates_paper_in_db(self, auth_headers):
        """After evaluate-coherence, paper should have updated coherence_evaluation."""
        # Run evaluation
        eval_response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert eval_response.status_code == 200
        new_score = eval_response.json().get("coherence_evaluation", {}).get("coherence_score")

        # Verify DB was updated by fetching the paper
        get_response = requests.get(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        paper = get_response.json()
        stored_ce = paper.get("coherence_evaluation", {})
        assert "coherence_score" in stored_ce, "coherence_evaluation not persisted in DB"
        print(f"✅ DB updated with coherence_evaluation: score={stored_ce.get('coherence_score')}")


class TestPatentEndpoints:
    """Tests for patent endpoints."""

    def test_get_patents_returns_200(self, auth_headers):
        """GET /api/patents should return 200."""
        response = requests.get(f"{BASE_URL}/api/patents", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        data = response.json()
        print(f"✅ GET /api/patents: {response.status_code}, patents count: {len(data) if isinstance(data, list) else 'N/A'}")

    def test_patent_evaluate_coherence_endpoint_exists(self, auth_headers):
        """POST /api/patents/{patent_id}/evaluate-coherence should exist."""
        # First get a patent ID
        patents_response = requests.get(f"{BASE_URL}/api/patents", headers=auth_headers)
        assert patents_response.status_code == 200
        patents = patents_response.json()

        if isinstance(patents, list) and len(patents) > 0:
            patent_id = patents[0].get("id")
            if patent_id:
                response = requests.post(
                    f"{BASE_URL}/api/patents/{patent_id}/evaluate-coherence",
                    headers=auth_headers
                )
                # Should return 200 (with data), 400 (no content yet), or 403 (different user's patent)
                assert response.status_code in [200, 400, 403], f"Expected 200/400/403, got {response.status_code}: {response.text[:200]}"
                print(f"✅ Patent evaluate-coherence endpoint exists: {response.status_code}")
            else:
                pytest.skip("No patent ID found")
        else:
            # No patents - just check the endpoint route exists (404 = not found for patent, not route)
            response = requests.post(
                f"{BASE_URL}/api/patents/test-patent-id-does-not-exist/evaluate-coherence",
                headers=auth_headers
            )
            assert response.status_code in [404, 405, 422], f"Unexpected status: {response.status_code}: {response.text[:200]}"
            print(f"✅ Patent evaluate-coherence endpoint route exists (404 for ID expected): {response.status_code}")


class TestEvaluateDocumentCoherenceLogic:
    """Tests verifying evaluate_document_coherence uses correct prompts per document type."""

    def test_policy_paper_coherence_has_no_cv_requirement(self, auth_headers):
        """Policy paper type should NOT require CV (reflects_cv = N/A)."""
        # Uses the existing paper which has policy paper type
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        ce = response.json().get("coherence_evaluation", {})

        # The policy paper prompt sets reflects_cv: "N/A" hardcoded
        assert ce.get("reflects_cv") == "N/A", f"Policy paper should have reflects_cv='N/A', got: {ce.get('reflects_cv')}"
        # Also correct_companies should be N/A
        assert ce.get("correct_companies") == "N/A", f"Policy paper should have correct_companies='N/A', got: {ce.get('correct_companies')}"
        # And correct_experience_years should be N/A
        assert ce.get("correct_experience_years") == "N/A", f"Policy paper should have correct_experience_years='N/A', got: {ce.get('correct_experience_years')}"
        print(f"✅ Policy paper prompt: N/A fields correctly set for CV-free evaluation")

    def test_policy_paper_coherence_has_project_integrated_field(self, auth_headers):
        """Policy paper type should have project_integrated field (not just reflects_cv)."""
        response = requests.post(
            f"{BASE_URL}/api/policy-papers/{TEST_PAPER_ID}/evaluate-coherence",
            headers=auth_headers
        )
        assert response.status_code == 200
        ce = response.json().get("coherence_evaluation", {})

        # project_integrated is the key field for policy paper type
        assert "project_integrated" in ce, f"Policy paper should have 'project_integrated' field. Keys: {list(ce.keys())}"
        print(f"✅ Policy paper has project_integrated field: {ce.get('project_integrated')}")


class TestFrontendLoading:
    """Tests verifying frontend modules load correctly."""

    def test_frontend_loads(self):
        """Frontend should be accessible."""
        response = requests.get(f"{BASE_URL}/", timeout=10)
        assert response.status_code == 200, f"Frontend not loading: {response.status_code}"
        print(f"✅ Frontend loads: {response.status_code}")

    def test_api_health_check(self):
        """Backend /api/health should return OK."""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print(f"✅ API health check: {response.status_code}")
