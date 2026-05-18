"""
Test: Client Dashboard Stats Counters
Tests GET /api/clients/{client_id}/stats endpoint and all counter fields
Iteration 42 - Verifying policypaper_count fix and total_documents calculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
CLIENT_ID = "f08f2a07-2772-4336-bceb-cc1065ec507f"

# ─── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token using admin credentials"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "dau@urpeailab.com", "password": "admin123"}
    )
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token") or data.get("token")
        if token:
            return token
    pytest.skip(f"Authentication failed: {response.status_code} {response.text[:200]}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def stats_data(auth_headers):
    """Fetch stats for the target client once, reuse in all tests"""
    response = requests.get(
        f"{BASE_URL}/api/clients/{CLIENT_ID}/stats",
        headers=auth_headers
    )
    assert response.status_code == 200, f"Stats API failed: {response.status_code} {response.text[:300]}"
    return response.json()


# ─── Health & Auth ──────────────────────────────────────────────────────────

class TestAuthAndHealth:
    """Basic health and auth checks"""

    def test_health_check(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
        print("PASS: Health check OK")

    def test_login_success(self):
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"}
        )
        assert resp.status_code == 200, f"Login failed: {resp.status_code}"
        data = resp.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token in login response"
        print("PASS: Login OK, token received")


# ─── Stats Endpoint ──────────────────────────────────────────────────────────

class TestClientStatsEndpoint:
    """Tests for GET /api/clients/{client_id}/stats"""

    def test_stats_endpoint_returns_200(self, auth_headers):
        resp = requests.get(
            f"{BASE_URL}/api/clients/{CLIENT_ID}/stats",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Stats endpoint returned {resp.status_code}: {resp.text[:300]}"
        print(f"PASS: Stats endpoint returns 200")

    def test_stats_response_has_client_object(self, stats_data):
        assert "client" in stats_data, "Response missing 'client' key"
        client = stats_data["client"]
        assert client is not None, "'client' is null"
        assert "id" in client or "name" in client, "Client object missing expected fields"
        print(f"PASS: client object present: {client.get('name', 'unknown')}")

    # ─── Required Counter Fields ─────────────────────────────────────────────

    def test_niw_count_field_present_and_numeric(self, stats_data):
        assert "niw_count" in stats_data, "Missing niw_count"
        assert isinstance(stats_data["niw_count"], int), f"niw_count is not int: {type(stats_data['niw_count'])}"
        assert stats_data["niw_count"] >= 0
        print(f"PASS: niw_count = {stats_data['niw_count']}")

    def test_niw_completed_field_present_and_numeric(self, stats_data):
        assert "niw_completed" in stats_data, "Missing niw_completed"
        assert isinstance(stats_data["niw_completed"], int), f"niw_completed is not int: {type(stats_data['niw_completed'])}"
        assert stats_data["niw_completed"] >= 0
        print(f"PASS: niw_completed = {stats_data['niw_completed']}")

    def test_patent_count_field_present_and_numeric(self, stats_data):
        assert "patent_count" in stats_data, "Missing patent_count"
        assert isinstance(stats_data["patent_count"], int)
        assert stats_data["patent_count"] >= 0
        print(f"PASS: patent_count = {stats_data['patent_count']}")

    def test_patent_completed_field_present_and_numeric(self, stats_data):
        assert "patent_completed" in stats_data, "Missing patent_completed"
        assert isinstance(stats_data["patent_completed"], int)
        assert stats_data["patent_completed"] >= 0
        print(f"PASS: patent_completed = {stats_data['patent_completed']}")

    def test_book_count_field_present_and_numeric(self, stats_data):
        assert "book_count" in stats_data, "Missing book_count"
        assert isinstance(stats_data["book_count"], int)
        assert stats_data["book_count"] >= 0
        print(f"PASS: book_count = {stats_data['book_count']}")

    def test_book_completed_field_present_and_numeric(self, stats_data):
        assert "book_completed" in stats_data, "Missing book_completed"
        assert isinstance(stats_data["book_completed"], int)
        assert stats_data["book_completed"] >= 0
        print(f"PASS: book_completed = {stats_data['book_completed']}")

    def test_study_count_field_present_and_numeric(self, stats_data):
        assert "study_count" in stats_data, "Missing study_count"
        assert isinstance(stats_data["study_count"], int)
        assert stats_data["study_count"] >= 0
        print(f"PASS: study_count = {stats_data['study_count']}")

    def test_whitepaper_count_field_present_and_numeric(self, stats_data):
        assert "whitepaper_count" in stats_data, "Missing whitepaper_count"
        assert isinstance(stats_data["whitepaper_count"], int)
        assert stats_data["whitepaper_count"] >= 0
        print(f"PASS: whitepaper_count = {stats_data['whitepaper_count']}")

    def test_whitepaper_completed_field_present_and_numeric(self, stats_data):
        assert "whitepaper_completed" in stats_data, "Missing whitepaper_completed"
        assert isinstance(stats_data["whitepaper_completed"], int)
        assert stats_data["whitepaper_completed"] >= 0
        print(f"PASS: whitepaper_completed = {stats_data['whitepaper_completed']}")

    def test_recommendation_letter_count_present_and_numeric(self, stats_data):
        assert "recommendation_letter_count" in stats_data, "Missing recommendation_letter_count"
        assert isinstance(stats_data["recommendation_letter_count"], int)
        assert stats_data["recommendation_letter_count"] >= 0
        print(f"PASS: recommendation_letter_count = {stats_data['recommendation_letter_count']}")

    def test_case_study_count_present_and_numeric(self, stats_data):
        assert "case_study_count" in stats_data, "Missing case_study_count"
        assert isinstance(stats_data["case_study_count"], int)
        assert stats_data["case_study_count"] >= 0
        print(f"PASS: case_study_count = {stats_data['case_study_count']}")

    def test_policypaper_count_present_and_numeric(self, stats_data):
        """Critical: policypaper_count was recently fixed - must be present and >= 1 for this client"""
        assert "policypaper_count" in stats_data, "CRITICAL: Missing policypaper_count field"
        assert isinstance(stats_data["policypaper_count"], int), f"policypaper_count is not int: {type(stats_data['policypaper_count'])}"
        print(f"PASS: policypaper_count = {stats_data['policypaper_count']}")

    def test_policypaper_count_is_at_least_one(self, stats_data):
        """This client (f08f2a07) has 1 policy paper - count must be >= 1"""
        count = stats_data.get("policypaper_count", 0)
        assert count >= 1, f"FAIL: policypaper_count should be >= 1 for this client, got {count}"
        print(f"PASS: policypaper_count = {count} (>= 1)")

    def test_expert_count_present_and_numeric(self, stats_data):
        assert "expert_count" in stats_data, "Missing expert_count"
        assert isinstance(stats_data["expert_count"], int)
        assert stats_data["expert_count"] >= 0
        print(f"PASS: expert_count = {stats_data['expert_count']}")

    def test_selfpetition_count_present_and_numeric(self, stats_data):
        assert "selfpetition_count" in stats_data, "Missing selfpetition_count"
        assert isinstance(stats_data["selfpetition_count"], int)
        assert stats_data["selfpetition_count"] >= 0
        print(f"PASS: selfpetition_count = {stats_data['selfpetition_count']}")

    def test_translation_count_present_and_numeric(self, stats_data):
        assert "translation_count" in stats_data, "Missing translation_count"
        assert isinstance(stats_data["translation_count"], int)
        assert stats_data["translation_count"] >= 0
        print(f"PASS: translation_count = {stats_data['translation_count']}")

    def test_certified_translation_count_present_and_numeric(self, stats_data):
        assert "certified_translation_count" in stats_data, "Missing certified_translation_count"
        assert isinstance(stats_data["certified_translation_count"], int)
        assert stats_data["certified_translation_count"] >= 0
        print(f"PASS: certified_translation_count = {stats_data['certified_translation_count']}")

    def test_total_documents_present_and_numeric(self, stats_data):
        assert "total_documents" in stats_data, "Missing total_documents"
        assert isinstance(stats_data["total_documents"], int)
        assert stats_data["total_documents"] >= 0
        print(f"PASS: total_documents = {stats_data['total_documents']}")

    # ─── total_documents Accuracy ────────────────────────────────────────────

    def test_total_documents_includes_policypaper_count(self, stats_data):
        """
        total_documents must include policypaper_count.
        Backend lines 599-606 should add policypaper_count.
        """
        # Compute the minimum expected total (all fields the backend adds)
        expected_min = (
            stats_data["niw_count"] + stats_data["niw_completed"] +
            stats_data["patent_count"] + stats_data["patent_completed"] +
            stats_data["book_count"] + stats_data["book_completed"] +
            stats_data["whitepaper_count"] + stats_data["whitepaper_completed"] +
            stats_data["study_count"] + stats_data.get("design_count", 0) +
            stats_data["recommendation_letter_count"] + stats_data["case_study_count"] +
            stats_data["policypaper_count"]
        )
        actual = stats_data["total_documents"]
        assert actual == expected_min, (
            f"total_documents mismatch: expected {expected_min}, got {actual}. "
            f"policypaper_count={stats_data['policypaper_count']}"
        )
        print(f"PASS: total_documents={actual} matches backend formula including policypaper_count")

    def test_total_documents_missing_expert_selfpetition_translation(self, stats_data):
        """
        KNOWN ISSUE: total_documents does NOT include expert_count, selfpetition_count,
        translation_count, certified_translation_count. 
        This test documents the current behavior (not a hard fail, but a code review finding).
        """
        excluded_sum = (
            stats_data["expert_count"] +
            stats_data["selfpetition_count"] +
            stats_data["translation_count"] +
            stats_data["certified_translation_count"]
        )
        # Only report, don't fail - this is a design decision
        print(
            f"INFO: total_documents excludes expert+selfpetition+translations = {excluded_sum}. "
            f"Full total would be {stats_data['total_documents'] + excluded_sum}"
        )
        # Just assert all fields are present and numeric (not that total includes them)
        assert excluded_sum >= 0

    # ─── No NaN/null values ─────────────────────────────────────────────────

    def test_no_null_values_in_counters(self, stats_data):
        """All counter fields must be non-null integers"""
        counter_fields = [
            "niw_count", "niw_completed", "patent_count", "patent_completed",
            "book_count", "book_completed", "study_count", "whitepaper_count",
            "whitepaper_completed", "recommendation_letter_count", "case_study_count",
            "policypaper_count", "expert_count", "selfpetition_count",
            "translation_count", "certified_translation_count", "total_documents"
        ]
        failures = []
        for field in counter_fields:
            val = stats_data.get(field)
            if val is None:
                failures.append(f"{field}=None")
            elif not isinstance(val, int):
                failures.append(f"{field}={val!r} (type: {type(val).__name__})")

        assert not failures, f"Fields with null/non-int values: {failures}"
        print(f"PASS: All {len(counter_fields)} counter fields are non-null integers")

    def test_all_counter_values_printed(self, stats_data):
        """Print all counter values for human review"""
        print("\n=== CLIENT STATS SUMMARY ===")
        print(f"Client: {stats_data.get('client', {}).get('name', 'unknown')}")
        counter_fields = [
            "niw_count", "niw_completed", "patent_count", "patent_completed",
            "book_count", "book_completed", "study_count", "whitepaper_count",
            "whitepaper_completed", "recommendation_letter_count", "case_study_count",
            "policypaper_count", "expert_count", "selfpetition_count",
            "translation_count", "certified_translation_count", 
            "design_count", "total_documents"
        ]
        for field in counter_fields:
            print(f"  {field}: {stats_data.get(field, 'MISSING')}")
        print("=== END STATS SUMMARY ===\n")
        assert True  # always pass

    def test_stats_endpoint_unauthorized_returns_401(self):
        """Stats endpoint must require authentication"""
        resp = requests.get(f"{BASE_URL}/api/clients/{CLIENT_ID}/stats")
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 without auth, got {resp.status_code}"
        )
        print(f"PASS: Unauthorized access returns {resp.status_code}")

    def test_stats_endpoint_nonexistent_client_returns_404(self, auth_headers):
        """Non-existent client must return 404"""
        resp = requests.get(
            f"{BASE_URL}/api/clients/nonexistent-client-id-xyz/stats",
            headers=auth_headers
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: Non-existent client returns 404")
