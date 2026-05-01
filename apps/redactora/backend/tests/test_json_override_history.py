"""
Test suite for JSON Override History feature.
Tests:
 - PUT /api/admin/json-override/{module_id} creates history entry with 'version' field
 - GET /api/admin/json-override/{module_id}/history returns versions list
 - GET /api/admin/json-override/{module_id}/history/{version}/content returns full JSON
 - PATCH /api/admin/json-override/{module_id}/history/{version}/notes updates result_notes
 - POST /api/admin/json-override/{module_id}/history/{version}/restore creates new version
Admin credentials: dau@urpeailab.com / admin123
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TEST_MODULE = "business_plan_v3"
TEST_MODULE_NOTES = "TEST_HISTORY_MODULE_notes_only"

VALID_JSON_V1 = json.dumps({
    "system_prompt": "TEST_HIST_V1: Expert NIW business plan writer.",
    "section_1": "TEST_HIST_V1: Executive Summary.",
    "section_2": "TEST_HIST_V1: National Problem.",
})

VALID_JSON_V2 = json.dumps({
    "system_prompt": "TEST_HIST_V2: Updated expert business plan writer.",
    "section_1": "TEST_HIST_V2: Improved Executive Summary.",
    "section_2": "TEST_HIST_V2: Updated National Problem.",
    "section_3": "TEST_HIST_V2: New Endeavor section.",
})


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Get JWT token for admin user"""
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


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestPutCreatesHistoryVersion:
    """PUT endpoint creates history entry and returns version field"""

    def test_put_returns_version_field(self, admin_headers):
        """PUT /api/admin/json-override/{module_id} must return 'version' field"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON_V1, "notes": "TEST_HIST: initial save"},
            headers=admin_headers
        )
        assert resp.status_code == 200, f"PUT failed: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert "version" in data, f"Missing 'version' field in response: {data}"
        assert isinstance(data["version"], int), f"version should be int, got: {type(data['version'])}"
        assert data["version"] >= 1

    def test_put_creates_history_entry(self, admin_headers):
        """After PUT, GET /history should return at least one version"""
        # Save a new version
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON_V2, "notes": "TEST_HIST: second save"},
            headers=admin_headers
        )
        assert resp.status_code == 200
        saved_version = resp.json()["version"]

        # Verify history has entries
        hist_resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert isinstance(history, list)
        assert len(history) > 0, "History should have at least one entry after PUT"

        # The saved version should be in history
        versions = [v["version"] for v in history]
        assert saved_version in versions, f"Saved version {saved_version} not in history: {versions}"

    def test_put_increments_version(self, admin_headers):
        """Successive PUTs increment the version number"""
        resp1 = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON_V1, "notes": "TEST_HIST: increment test v1"},
            headers=admin_headers
        )
        assert resp1.status_code == 200
        v1 = resp1.json()["version"]

        resp2 = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON_V2, "notes": "TEST_HIST: increment test v2"},
            headers=admin_headers
        )
        assert resp2.status_code == 200
        v2 = resp2.json()["version"]

        assert v2 == v1 + 1, f"Expected v2={v1+1}, got {v2}"

    def test_put_invalid_json_returns_400(self, admin_headers):
        """PUT with invalid JSON content returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": '{"broken": json}'},
            headers=admin_headers
        )
        assert resp.status_code == 400

    def test_put_array_json_returns_400(self, admin_headers):
        """PUT with JSON array (not object) returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": '[{"key": "value"}]'},
            headers=admin_headers
        )
        assert resp.status_code == 400

    def test_put_without_auth_returns_401_or_403(self):
        """PUT without auth token returns 401 or 403"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}",
            json={"json_content": VALID_JSON_V1}
        )
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"


class TestGetHistory:
    """GET /api/admin/json-override/{module_id}/history"""

    def test_get_history_returns_list(self, admin_headers):
        """GET /history returns a list"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_history_version_fields(self, admin_headers):
        """Each version has required fields: version, notes, result_notes, saved_at, saved_by, key_count, doc_count, is_active"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) > 0, "Need at least one history entry"

        required_fields = ["version", "notes", "result_notes", "saved_at", "saved_by", "key_count", "doc_count", "is_active"]
        for field in required_fields:
            assert field in history[0], f"Missing field '{field}' in history entry: {history[0]}"

    def test_get_history_sorted_descending(self, admin_headers):
        """Versions are returned in descending order (newest first)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        if len(history) > 1:
            for i in range(len(history) - 1):
                assert history[i]["version"] > history[i+1]["version"], \
                    f"History not in descending order: {[v['version'] for v in history]}"

    def test_get_history_active_version_flag(self, admin_headers):
        """Exactly one version should be marked as is_active=True"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        active_versions = [v for v in history if v["is_active"]]
        # If there's an active json override, exactly one should be active
        if active_versions:
            assert len(active_versions) == 1, \
                f"Expected exactly 1 active version, got {len(active_versions)}: {[v['version'] for v in active_versions]}"

    def test_get_history_includes_restored_from_field(self, admin_headers):
        """restored_from field is present in each history entry (can be None)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        for v in history:
            assert "restored_from" in v, f"Missing 'restored_from' field in version v{v['version']}"

    def test_get_history_without_auth_returns_401_or_403(self):
        """GET /history without auth returns 401 or 403"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history"
        )
        assert resp.status_code in [401, 403]

    def test_get_history_empty_for_new_module(self, admin_headers):
        """GET /history for a module with no overrides returns empty list"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/nonexistent_module_xyz999/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetVersionContent:
    """GET /api/admin/json-override/{module_id}/history/{version}/content"""

    def test_get_version_content_returns_json_content(self, admin_headers):
        """GET version content returns json_content field"""
        # First get history to find a valid version
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) > 0, "Need history data for this test"

        version = hist[0]["version"]
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/content",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "json_content" in data
        assert "version" in data
        assert data["version"] == version
        # Verify json_content is valid JSON
        parsed = json.loads(data["json_content"])
        assert isinstance(parsed, dict)

    def test_get_version_content_fields(self, admin_headers):
        """Version content response has all required fields"""
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) > 0

        version = hist[0]["version"]
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/content",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        required = ["version", "json_content", "notes", "result_notes", "saved_at", "key_count"]
        for field in required:
            assert field in data, f"Missing field '{field}' in content response"

    def test_get_version_content_404_for_nonexistent(self, admin_headers):
        """GET content for nonexistent version returns 404"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/999999/content",
            headers=admin_headers
        )
        assert resp.status_code == 404

    def test_get_version_content_without_auth_returns_401_or_403(self):
        """GET content without auth returns 401 or 403"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/1/content"
        )
        assert resp.status_code in [401, 403]


class TestPatchResultNotes:
    """PATCH /api/admin/json-override/{module_id}/history/{version}/notes"""

    def test_patch_notes_updates_result_notes(self, admin_headers):
        """PATCH notes updates result_notes and returns success"""
        # Get a version to update
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) > 0

        version = hist[0]["version"]
        test_note = "TEST_HIST: This version worked well for NIW applications."

        resp = requests.patch(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/notes",
            json={"result_notes": test_note},
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_patch_notes_persists_to_history(self, admin_headers):
        """After PATCH, GET /history shows updated result_notes"""
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) > 0

        version = hist[0]["version"]
        unique_note = f"TEST_HIST: Unique note {version} for persistence test."

        requests.patch(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/notes",
            json={"result_notes": unique_note},
            headers=admin_headers
        )

        # Verify in history
        updated_hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        updated_v = next((v for v in updated_hist if v["version"] == version), None)
        assert updated_v is not None
        assert updated_v["result_notes"] == unique_note, \
            f"Expected result_notes='{unique_note}', got '{updated_v['result_notes']}'"

    def test_patch_notes_also_persists_in_content_endpoint(self, admin_headers):
        """After PATCH, GET /{version}/content also shows updated result_notes"""
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) > 0
        version = hist[0]["version"]
        unique_note = f"TEST_HIST: Content endpoint note for v{version}."

        requests.patch(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/notes",
            json={"result_notes": unique_note},
            headers=admin_headers
        )

        content_resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version}/content",
            headers=admin_headers
        )
        assert content_resp.status_code == 200
        assert content_resp.json()["result_notes"] == unique_note

    def test_patch_notes_without_auth_returns_401_or_403(self):
        """PATCH notes without auth returns 401 or 403"""
        resp = requests.patch(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/1/notes",
            json={"result_notes": "test"}
        )
        assert resp.status_code in [401, 403]


class TestRestoreVersion:
    """POST /api/admin/json-override/{module_id}/history/{version}/restore"""

    def test_restore_creates_new_version(self, admin_headers):
        """POST /restore creates a new history entry with restored_from set"""
        hist = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist) >= 2, "Need at least 2 history entries to test restore"

        # Restore the oldest version (lowest version number)
        oldest_version = min(v["version"] for v in hist)
        pre_count = len(hist)

        resp = requests.post(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{oldest_version}/restore",
            json={"notes": "TEST_HIST: Restore test"},
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True
        assert "new_version" in data
        assert "restored_from" in data
        assert data["restored_from"] == oldest_version

    def test_restore_new_version_is_active(self, admin_headers):
        """After restore, the new version should be marked is_active=True"""
        hist_before = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist_before) >= 1

        # Get a non-active version to restore
        non_active = next((v for v in hist_before if not v["is_active"]), None)
        if not non_active:
            pytest.skip("All versions are active or only 1 version - cannot test restore activation")

        restore_resp = requests.post(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{non_active['version']}/restore",
            json={},
            headers=admin_headers
        )
        assert restore_resp.status_code == 200
        new_version = restore_resp.json()["new_version"]

        # Check the new version is active
        hist_after = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        new_v = next((v for v in hist_after if v["version"] == new_version), None)
        assert new_v is not None, f"New version {new_version} not found in history"
        assert new_v["is_active"] is True, f"Restored version v{new_version} should be active"
        assert new_v["restored_from"] == non_active["version"], \
            f"Expected restored_from={non_active['version']}, got {new_v['restored_from']}"

    def test_restore_increases_history_count(self, admin_headers):
        """POST /restore adds a new entry to history"""
        hist_before = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        count_before = len(hist_before)
        assert count_before >= 1

        version_to_restore = hist_before[0]["version"]  # Use the most recent version (it will be a duplicate)
        resp = requests.post(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/{version_to_restore}/restore",
            json={},
            headers=admin_headers
        )
        assert resp.status_code == 200

        hist_after = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        ).json()
        assert len(hist_after) == count_before + 1, \
            f"Expected {count_before + 1} entries, got {len(hist_after)}"

    def test_restore_404_for_nonexistent_version(self, admin_headers):
        """POST /restore for nonexistent version returns 404"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/999999/restore",
            json={},
            headers=admin_headers
        )
        assert resp.status_code == 404

    def test_restore_without_auth_returns_401_or_403(self):
        """POST /restore without auth returns 401 or 403"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history/1/restore",
            json={}
        )
        assert resp.status_code in [401, 403]


class TestExistingTestData:
    """Validate existing test data in BD: business_plan_v3 has 3 versions"""

    def test_business_plan_v3_has_history(self, admin_headers):
        """business_plan_v3 module has history entries in the database"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) > 0, f"Expected history for {TEST_MODULE}, got empty list"

    def test_business_plan_v3_has_restored_version(self, admin_headers):
        """Among business_plan_v3 versions, at least one should have restored_from set"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-override/{TEST_MODULE}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        # The context notes say v3 was restored from v1
        restored = [v for v in history if v.get("restored_from") is not None]
        assert len(restored) >= 1, \
            f"Expected at least one restored version in history for {TEST_MODULE}, got 0. Full history: {history}"
