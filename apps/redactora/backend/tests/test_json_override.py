"""
Test suite for Admin Prompt Manager - JSON Override feature.
Tests: GET, PUT, DELETE /api/admin/json-override/{module_id}
Admin credentials: dau@urpeailab.com / admin123
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test module to use for JSON override tests
TEST_MODULE = "business_plan_v3"

# Sample valid JSON content for testing
VALID_JSON = json.dumps({
    "system_prompt": "TEST_JSON_OVERRIDE: You are an expert NIW business plan writer.",
    "absolute_prohibitions": "TEST_JSON_OVERRIDE: NEVER invent statistics or citations.",
    "section_1_instructions": "TEST_JSON_OVERRIDE: Write the Executive Summary focusing on impact.",
    "section_2_instructions": "TEST_JSON_OVERRIDE: Write the National Problem section.",
    "section_3_instructions": "TEST_JSON_OVERRIDE: Write the Endeavor section.",
})

INVALID_JSON = '{"broken": "json", missing_quote: "value"}'
ARRAY_JSON = '[{"key": "value"}, {"another": "item"}]'


# ── Shared fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Get JWT token for the admin user dau@urpeailab.com"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dau@urpeailab.com",
        "password": "admin123"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(autouse=True)
def cleanup_json_override(admin_headers):
    """Cleanup: remove JSON override for the test module before and after each test"""
    # Make sure no override exists before each test
    requests.delete(f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}", headers=admin_headers)
    yield
    # Cleanup after each test
    requests.delete(f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}", headers=admin_headers)


# ── Auth / No-Auth Tests ───────────────────────────────────────────────────────

class TestJsonOverrideAuth:
    """Test authentication and authorization for JSON override endpoints"""

    def test_get_json_override_without_auth_returns_401_or_403(self):
        """GET without auth should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}")
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 for no-auth GET, got {resp.status_code}: {resp.text}"
        )
        print(f"✅ No-auth GET correctly rejected with {resp.status_code}")

    def test_put_json_override_without_auth_returns_401_or_403(self):
        """PUT without auth should return 401 or 403"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON}
        )
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 for no-auth PUT, got {resp.status_code}: {resp.text}"
        )
        print(f"✅ No-auth PUT correctly rejected with {resp.status_code}")

    def test_delete_json_override_without_auth_returns_401_or_403(self):
        """DELETE without auth should return 401 or 403"""
        resp = requests.delete(f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}")
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 for no-auth DELETE, got {resp.status_code}: {resp.text}"
        )
        print(f"✅ No-auth DELETE correctly rejected with {resp.status_code}")

    def test_get_json_override_with_invalid_token_returns_401(self):
        """Invalid token should be rejected"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers={"Authorization": "Bearer fake_invalid_token_xyz"}
        )
        assert resp.status_code in [401, 403], (
            f"Expected 401/403 for invalid token, got {resp.status_code}"
        )
        print(f"✅ Invalid token correctly rejected with {resp.status_code}")


# ── GET JSON Override ──────────────────────────────────────────────────────────

class TestGetJsonOverride:
    """Test GET /api/admin/json-override/{module_id}"""

    def test_get_returns_has_override_false_when_no_override(self, admin_headers):
        """When no override exists, should return has_override: false"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "has_override" in data, f"'has_override' missing from response: {data}"
        assert data["has_override"] is False, f"Expected has_override=False, got: {data}"
        print(f"✅ GET returns has_override=False when no override: {data}")

    def test_get_response_has_required_fields(self, admin_headers):
        """GET response should include has_override, json_content, updated_at, key_count"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        required_fields = ["has_override", "json_content", "updated_at", "key_count"]
        for field in required_fields:
            assert field in data, f"Missing field '{field}' in GET response: {data}"
        print(f"✅ GET response has all required fields: {list(data.keys())}")

    def test_get_returns_has_override_true_after_save(self, admin_headers):
        """After saving an override, GET should return has_override: true"""
        # First save
        put_resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )
        assert put_resp.status_code == 200, f"PUT failed: {put_resp.text}"

        # Now GET
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["has_override"] is True, f"Expected has_override=True, got: {data}"
        assert data["json_content"] != "", f"Expected non-empty json_content, got: {data}"
        print(f"✅ GET returns has_override=True after save. key_count={data['key_count']}")

    def test_get_returns_correct_key_count_after_save(self, admin_headers):
        """After saving, key_count in GET response should match number of keys in JSON"""
        valid_json_obj = json.loads(VALID_JSON)
        expected_key_count = len(valid_json_obj)

        # Save
        requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )

        # GET
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["key_count"] == expected_key_count, (
            f"Expected key_count={expected_key_count}, got {data['key_count']}"
        )
        print(f"✅ GET returns correct key_count={data['key_count']} (expected {expected_key_count})")


# ── PUT JSON Override ──────────────────────────────────────────────────────────

class TestPutJsonOverride:
    """Test PUT /api/admin/json-override/{module_id}"""

    def test_put_valid_json_returns_success(self, admin_headers):
        """Saving valid JSON returns success=True"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Expected success=True, got: {data}"
        print(f"✅ PUT valid JSON returns success=True: {data}")

    def test_put_valid_json_returns_key_count(self, admin_headers):
        """Saving valid JSON returns correct key_count"""
        valid_json_obj = json.loads(VALID_JSON)
        expected_key_count = len(valid_json_obj)

        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "key_count" in data, f"Missing 'key_count' in response: {data}"
        assert data["key_count"] == expected_key_count, (
            f"Expected key_count={expected_key_count}, got {data['key_count']}"
        )
        print(f"✅ PUT returns correct key_count={data['key_count']}")

    def test_put_with_notes_succeeds(self, admin_headers):
        """Saving JSON with optional notes should succeed"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON, "notes": "TEST: JSON override with notes"},
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        print(f"✅ PUT with notes returns success=True")

    def test_put_invalid_json_returns_400(self, admin_headers):
        """Saving invalid JSON string should return 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": INVALID_JSON},
            headers=admin_headers
        )
        assert resp.status_code == 400, f"Expected 400 for invalid JSON, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data, f"Expected 'detail' in error response: {data}"
        print(f"✅ PUT invalid JSON returns 400: {data.get('detail', '')[:80]}")

    def test_put_json_array_returns_400(self, admin_headers):
        """Saving a JSON array (not an object) should return 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": ARRAY_JSON},
            headers=admin_headers
        )
        assert resp.status_code == 400, (
            f"Expected 400 for JSON array, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert "detail" in data, f"Expected 'detail' in error response: {data}"
        print(f"✅ PUT JSON array returns 400: {data.get('detail', '')[:80]}")

    def test_put_empty_content_returns_400(self, admin_headers):
        """Saving empty JSON content should return 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": "   "},
            headers=admin_headers
        )
        assert resp.status_code == 400, f"Expected 400 for empty content, got {resp.status_code}: {resp.text}"
        print(f"✅ PUT empty content returns 400")

    def test_put_persists_override(self, admin_headers):
        """After PUT, GET should return the same content"""
        put_resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )
        assert put_resp.status_code == 200

        # Verify persistence with GET
        get_resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["has_override"] is True
        # The stored content should parse to the same object
        stored = json.loads(data["json_content"])
        original = json.loads(VALID_JSON)
        assert stored == original, f"Stored content doesn't match saved content"
        print(f"✅ PUT persists correctly — GET returns same content")

    def test_put_upsert_updates_existing_override(self, admin_headers):
        """Second PUT should update (not duplicate) the override"""
        new_json = json.dumps({
            "system_prompt": "TEST_UPDATED: New system prompt after update.",
            "extra_key": "TEST_UPDATED: Extra key to verify update.",
        })

        # First save
        requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )

        # Second save (update)
        resp2 = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": new_json},
            headers=admin_headers
        )
        assert resp2.status_code == 200
        assert resp2.json().get("key_count") == 2, f"Expected key_count=2 after update"

        # GET should return the updated content
        get_resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        data = get_resp.json()
        stored = json.loads(data["json_content"])
        assert "TEST_UPDATED" in stored.get("system_prompt", ""), "Expected updated content"
        print(f"✅ Second PUT updates override correctly (key_count={data['key_count']})")


# ── DELETE JSON Override ───────────────────────────────────────────────────────

class TestDeleteJsonOverride:
    """Test DELETE /api/admin/json-override/{module_id}"""

    def test_delete_existing_override_returns_success(self, admin_headers):
        """Deleting an existing override returns success=True"""
        # First create one
        requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )

        # Now delete
        resp = requests.delete(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Expected success=True, got: {data}"
        print(f"✅ DELETE returns success=True: {data.get('message', '')}")

    def test_delete_removes_override(self, admin_headers):
        """After DELETE, GET should return has_override=False"""
        # Create
        requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON},
            headers=admin_headers
        )

        # Delete
        requests.delete(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )

        # Verify removal
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_override"] is False, f"Expected has_override=False after DELETE, got: {data}"
        print(f"✅ GET shows has_override=False after DELETE")

    def test_delete_when_no_override_returns_success(self, admin_headers):
        """Deleting when no override exists should still return success=True (idempotent)"""
        # cleanup_json_override fixture already deleted any existing override
        resp = requests.delete(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Expected success=True for no-op DELETE, got: {data}"
        print(f"✅ DELETE with no existing override returns success=True (idempotent)")


# ── Full CRUD Lifecycle ────────────────────────────────────────────────────────

class TestJsonOverrideLifecycle:
    """Test full lifecycle: no override → create → verify → update → delete → verify"""

    def test_full_lifecycle(self, admin_headers):
        """Complete GET → PUT → GET → DELETE → GET lifecycle"""
        module = TEST_MODULE

        # Step 1: GET — should have no override
        r1 = requests.get(f"{BASE_URL}/api/admin/json-override/{module}", headers=admin_headers)
        assert r1.status_code == 200
        assert r1.json()["has_override"] is False, "Should start with no override"
        print(f"Step 1 ✅ GET shows no override initially")

        # Step 2: PUT — save override
        r2 = requests.put(
            f"{BASE_URL}/api/admin/json-override/{module}",
            json={"json_content": VALID_JSON, "notes": "TEST: Full lifecycle test"},
            headers=admin_headers
        )
        assert r2.status_code == 200
        assert r2.json().get("success") is True
        expected_keys = len(json.loads(VALID_JSON))
        assert r2.json()["key_count"] == expected_keys
        print(f"Step 2 ✅ PUT saves override with {expected_keys} keys")

        # Step 3: GET — should now have override
        r3 = requests.get(f"{BASE_URL}/api/admin/json-override/{module}", headers=admin_headers)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["has_override"] is True
        assert d3["key_count"] == expected_keys
        assert d3["json_content"] != ""
        print(f"Step 3 ✅ GET shows override active with {d3['key_count']} keys")

        # Step 4: DELETE — remove override
        r4 = requests.delete(f"{BASE_URL}/api/admin/json-override/{module}", headers=admin_headers)
        assert r4.status_code == 200
        assert r4.json().get("success") is True
        print(f"Step 4 ✅ DELETE returns success")

        # Step 5: GET — should have no override again
        r5 = requests.get(f"{BASE_URL}/api/admin/json-override/{module}", headers=admin_headers)
        assert r5.status_code == 200
        assert r5.json()["has_override"] is False, "Should have no override after DELETE"
        print(f"Step 5 ✅ GET shows no override after DELETE — lifecycle complete")
