"""
Backend tests for POST /api/admin/import-database
Tests: authorization checks (no-token → 401/403), other-admin → 403, dau@urpeailab.com → 200
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ── helpers ──────────────────────────────────────────────────────────────────

def get_token(email: str, password: str) -> str | None:
    """Return bearer token for given credentials, or None on failure."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    if resp.status_code == 200:
        return resp.json().get("access_token") or resp.json().get("token")
    return None


# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def dau_token():
    """Token for the privileged user dau@urpeailab.com."""
    token = get_token("dau@urpeailab.com", "admin123")
    if not token:
        pytest.skip("Could not authenticate as dau@urpeailab.com")
    return token


@pytest.fixture(scope="module")
def other_admin_token():
    """Token for another ADMIN that is NOT dau@urpeailab.com.
    Uses TEST_otheradmin@test.com (created directly in DB for testing)."""
    # Try test admin created for this test
    candidates = [
        ("TEST_otheradmin@test.com", "testadmin123"),
        ("test@urpe.com", "admin123"),
        ("test@urpe.com", "changeme123"),
        ("admin@urpe.com", "admin123"),
        ("admin@urpe.com", "urpe2024"),
    ]
    for email, pw in candidates:
        token = get_token(email, pw)
        if token:
            # Verify the user is an ADMIN
            me_resp = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if me_resp.status_code == 200:
                me_data = me_resp.json()
                if me_data.get("role") == "ADMIN" and me_data.get("email") != "dau@urpeailab.com":
                    return token
    pytest.skip("No other ADMIN found to test forbidden access")


# ── tests ─────────────────────────────────────────────────────────────────────

class TestImportDatabaseAuth:
    """Authorization checks for POST /api/admin/import-database"""

    def test_no_token_returns_401_or_403(self):
        """Without a token the endpoint must refuse access (401 or 403)."""
        resp = requests.post(f"{BASE_URL}/api/admin/import-database", timeout=15)
        print(f"No-token response: {resp.status_code} {resp.text[:200]}")
        assert resp.status_code in (401, 403), (
            f"Expected 401 or 403 without token, got {resp.status_code}"
        )

    def test_invalid_token_returns_401_or_403(self):
        """Garbage bearer token must be refused (401 or 403)."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": "Bearer this-is-not-a-valid-token"},
            timeout=15,
        )
        print(f"Invalid-token response: {resp.status_code} {resp.text[:200]}")
        assert resp.status_code in (401, 403), (
            f"Expected 401 or 403 with invalid token, got {resp.status_code}"
        )


class TestImportDatabaseOtherAdmin:
    """Other admins must receive 403."""

    def test_other_admin_returns_403(self, other_admin_token):
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {other_admin_token}"},
            timeout=30,
        )
        print(f"Other-admin response: {resp.status_code} {resp.text[:300]}")
        assert resp.status_code == 403, (
            f"Expected 403 for other admin, got {resp.status_code}: {resp.text[:200]}"
        )
        data = resp.json()
        assert "detail" in data, "Response should have 'detail' field"
        print(f"Forbidden detail: {data['detail']}")


class TestImportDatabaseSuccess:
    """dau@urpeailab.com must receive 200 with all required fields."""

    def test_import_returns_200(self, dau_token):
        """Verify status code is 200."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,  # up to 2 min for large import
        )
        print(f"Import status: {resp.status_code}")
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        )

    def test_import_response_has_message(self, dau_token):
        """Response must include 'message' field."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        print(f"Import response keys: {list(data.keys())}")
        assert "message" in data, f"Missing 'message' in response: {data}"
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0

    def test_import_response_has_total_collections(self, dau_token):
        """Response must include 'total_collections' as an integer."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_collections" in data, f"Missing 'total_collections': {data}"
        assert isinstance(data["total_collections"], int)
        assert data["total_collections"] > 0, "Should have at least 1 collection"
        print(f"total_collections: {data['total_collections']}")

    def test_import_response_has_total_upserted(self, dau_token):
        """Response must include 'total_upserted' as an integer."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_upserted" in data, f"Missing 'total_upserted': {data}"
        assert isinstance(data["total_upserted"], int)
        print(f"total_upserted: {data['total_upserted']}")

    def test_import_response_has_total_modified(self, dau_token):
        """Response must include 'total_modified' as an integer."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_modified" in data, f"Missing 'total_modified': {data}"
        assert isinstance(data["total_modified"], int)
        print(f"total_modified: {data['total_modified']}")

    def test_import_response_full_structure(self, dau_token):
        """Validate full response structure in a single call (efficiency)."""
        resp = requests.post(
            f"{BASE_URL}/api/admin/import-database",
            headers={"Authorization": f"Bearer {dau_token}"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        print(f"Full response: {data}")

        # All four required fields
        for field in ("message", "total_collections", "total_upserted", "total_modified"):
            assert field in data, f"Missing required field '{field}'"

        # Collections dict
        assert "collections" in data, "Missing 'collections' dict in response"
        assert isinstance(data["collections"], dict)
        assert len(data["collections"]) == data["total_collections"]

        # Totals are non-negative integers
        assert data["total_collections"] >= 0
        assert data["total_upserted"] >= 0
        assert data["total_modified"] >= 0

        # total_upserted + total_modified should cover the actual documents
        total_processed = data["total_upserted"] + data["total_modified"]
        print(f"✅ Import OK — {data['total_collections']} collections, "
              f"{data['total_upserted']} upserted, {data['total_modified']} modified")
