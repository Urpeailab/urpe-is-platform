"""
Test suite for Admin Prompt Manager - JSON Export feature.
Tests: GET /api/admin/json-export/{module_id}

This endpoint returns all active prompts for a module as a JSON dict,
with base defaults merged with any per-key overrides.

Admin credentials: dau@urpeailab.com / admin123
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


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


# ── Auth tests ─────────────────────────────────────────────────────────────────

class TestExportAuth:
    """Tests for authorization on GET /api/admin/json-export/{module_id}"""

    def test_no_auth_returns_401_or_403(self):
        """Without auth token, endpoint must return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/admin/json-export/business_plan_v1")
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {resp.status_code}: {resp.text[:200]}"
        )

    def test_invalid_token_returns_401_or_403(self):
        """With invalid/expired token, endpoint must return 401 or 403"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 with invalid token, got {resp.status_code}: {resp.text[:200]}"
        )


# ── Not-found test ─────────────────────────────────────────────────────────────

class TestExportNotFound:
    """Test 404 for non-existent module"""

    def test_non_existent_module_returns_404(self, admin_headers):
        """GET /api/admin/json-export/non_existent_module must return 404"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/non_existent_module",
            headers=admin_headers
        )
        assert resp.status_code == 404, (
            f"Expected 404 for unknown module, got {resp.status_code}: {resp.text[:200]}"
        )


# ── business_plan_v1 ───────────────────────────────────────────────────────────

class TestExportBusinessPlanV1:
    """Tests for GET /api/admin/json-export/business_plan_v1"""

    def test_returns_200(self, admin_headers):
        """Export endpoint returns 200 OK"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        )

    def test_returns_valid_json(self, admin_headers):
        """Export returns parseable JSON"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}: {str(data)[:100]}"

    def test_returns_5_keys(self, admin_headers):
        """business_plan_v1 must return exactly 5 keys (group1–group5)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5, (
            f"Expected 5 keys for business_plan_v1, got {len(data)}: {list(data.keys())}"
        )

    def test_contains_all_group_keys(self, admin_headers):
        """business_plan_v1 must contain all 5 group keys"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        expected_keys = {
            "group1_system_message",
            "group2_system_message",
            "group3_system_message",
            "group4_system_message",
            "group5_system_message",
        }
        actual_keys = set(data.keys())
        assert expected_keys == actual_keys, (
            f"Key mismatch. Expected: {expected_keys}, Got: {actual_keys}"
        )

    def test_values_are_non_empty_strings(self, admin_headers):
        """All values must be non-empty strings"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        for key, value in data.items():
            assert isinstance(value, str), f"Key '{key}' value is not a string: {type(value)}"
            assert len(value.strip()) > 0, f"Key '{key}' has empty value"

    def test_group1_contains_cv_coherence_rule(self, admin_headers):
        """group1_system_message must contain 'CV COHERENCE RULE' (English, not Spanish)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v1",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        group1 = data.get("group1_system_message", "")
        assert "CV COHERENCE" in group1, (
            f"Expected 'CV COHERENCE' in group1_system_message but got: {group1[:300]}"
        )
        # Also verify it is in English (not Spanish COHERENCIA)
        assert "COHERENCIA CON EL CV" not in group1, (
            f"'COHERENCIA CON EL CV' (Spanish) should NOT be present — prompts must be in English"
        )


# ── niw_plan_sections ─────────────────────────────────────────────────────────

class TestExportNiwPlanSections:
    """Tests for GET /api/admin/json-export/niw_plan_sections"""

    def test_returns_200(self, admin_headers):
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/niw_plan_sections",
            headers=admin_headers
        )
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        )

    def test_returns_1_key(self, admin_headers):
        """niw_plan_sections must return exactly 1 key (master_system_prompt)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/niw_plan_sections",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1, (
            f"Expected 1 key for niw_plan_sections, got {len(data)}: {list(data.keys())}"
        )
        assert "master_system_prompt" in data, (
            f"Expected key 'master_system_prompt', got: {list(data.keys())}"
        )

    def test_master_system_prompt_contains_master_instructions(self, admin_headers):
        """master_system_prompt must contain 'MASTER INSTRUCTIONS' (English)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/niw_plan_sections",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        content = data.get("master_system_prompt", "")
        assert "MASTER INSTRUCTIONS" in content, (
            f"Expected 'MASTER INSTRUCTIONS' in master_system_prompt, got: {content[:500]}"
        )


# ── business_plan_v3 ───────────────────────────────────────────────────────────

class TestExportBusinessPlanV3:
    """Tests for GET /api/admin/json-export/business_plan_v3"""

    def test_returns_200(self, admin_headers):
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v3",
            headers=admin_headers
        )
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        )

    def test_returns_multiple_keys(self, admin_headers):
        """business_plan_v3 must return more than 5 keys"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v3",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        assert len(data) > 5, (
            f"Expected more than 5 keys for business_plan_v3, got {len(data)}: {list(data.keys())}"
        )

    def test_has_system_prompt_key(self, admin_headers):
        """business_plan_v3 must contain 'system_prompt' key"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v3",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "system_prompt" in data, (
            f"Expected 'system_prompt' key in business_plan_v3, got: {list(data.keys())}"
        )

    def test_all_values_are_strings(self, admin_headers):
        """All values in business_plan_v3 export must be non-empty strings"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/business_plan_v3",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        for key, value in data.items():
            assert isinstance(value, str), f"Key '{key}' is not a string: {type(value)}"
            assert len(value.strip()) > 0, f"Key '{key}' has empty string value"


# ── Per-key override merge test ────────────────────────────────────────────────

class TestExportMergesOverrides:
    """Test that export merges per-key overrides (override takes precedence over base)"""

    OVERRIDE_MODULE = "business_plan_v1"
    OVERRIDE_KEY = "group1_system_message"
    OVERRIDE_CONTENT = "TEST_EXPORT_MERGE: Custom group1 system message for testing override merging."

    def _set_override(self, admin_headers):
        """Set a per-key override for OVERRIDE_KEY"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.OVERRIDE_MODULE}/{self.OVERRIDE_KEY}",
            json={"content": self.OVERRIDE_CONTENT},
            headers=admin_headers
        )
        return resp

    def _delete_override(self, admin_headers):
        """Remove the per-key override for OVERRIDE_KEY (reset to default)"""
        requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.OVERRIDE_MODULE}/{self.OVERRIDE_KEY}/reset",
            headers=admin_headers
        )

    def test_base_prompt_returned_when_no_override(self, admin_headers):
        """When no per-key override exists, export returns the base default"""
        # Ensure no override exists
        self._delete_override(admin_headers)

        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/{self.OVERRIDE_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        value = data.get(self.OVERRIDE_KEY, "")
        assert self.OVERRIDE_CONTENT not in value, (
            f"Override content found in base export — should not be there before setting override"
        )
        # The default should contain CV COHERENCE text
        assert "CV COHERENCE" in value, (
            f"Base prompt should contain 'CV COHERENCE': {value[:300]}"
        )

    def test_override_content_returned_after_setting_override(self, admin_headers):
        """When a per-key override exists, export returns the override content"""
        # Clean up first
        self._delete_override(admin_headers)

        # Set override
        put_resp = self._set_override(admin_headers)
        assert put_resp.status_code in (200, 204), (
            f"Setting override failed: {put_resp.status_code} {put_resp.text[:200]}"
        )

        try:
            # Export should now return the override content for that key
            resp = requests.get(
                f"{BASE_URL}/api/admin/json-export/{self.OVERRIDE_MODULE}",
                headers=admin_headers
            )
            assert resp.status_code == 200
            data = resp.json()
            value = data.get(self.OVERRIDE_KEY, "")
            assert self.OVERRIDE_CONTENT in value, (
                f"Expected override content in export for key '{self.OVERRIDE_KEY}', got: {value[:300]}"
            )
        finally:
            # Always clean up override after test
            self._delete_override(admin_headers)

    def test_base_returned_after_deleting_override(self, admin_headers):
        """After deleting override, export reverts to base default"""
        # Set then delete override
        self._set_override(admin_headers)
        self._delete_override(admin_headers)

        resp = requests.get(
            f"{BASE_URL}/api/admin/json-export/{self.OVERRIDE_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        value = data.get(self.OVERRIDE_KEY, "")
        assert self.OVERRIDE_CONTENT not in value, (
            f"Override content still present after deletion: {value[:300]}"
        )
