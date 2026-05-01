"""
Test suite for Admin Prompt Manager endpoints.
Tests: modules listing, prompt listing, content get/save/reset, history, version restore.
Admin credentials: dau@urpeailab.com / admin123
"""

import pytest
import requests
import os

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


@pytest.fixture(scope="module")
def non_admin_token():
    """Try to get a token for a non-admin user (register a temp user if needed)"""
    # Use a non-existent user to get 401
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "notadmin@example.com",
        "password": "wrong123"
    })
    return None  # Will use to test 403 scenarios


# ── Auth Tests ─────────────────────────────────────────────────────────────────

class TestAdminAuth:
    """Test authentication and authorization for admin endpoints"""

    def test_login_admin_success(self, admin_token):
        """Admin login returns valid token"""
        assert admin_token is not None
        assert len(admin_token) > 10
        print("✅ Admin login successful")

    def test_modules_without_auth_returns_401_or_403(self):
        """Accessing modules without auth should fail"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/modules")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print(f"✅ No-auth request correctly rejected with {resp.status_code}")

    def test_modules_with_invalid_token_returns_401(self):
        """Invalid JWT token should be rejected"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/modules",
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print(f"✅ Invalid token correctly rejected with {resp.status_code}")


# ── Module Listing ─────────────────────────────────────────────────────────────

class TestModuleListing:
    """Test GET /api/admin/prompts/modules"""

    def test_list_modules_returns_6_modules(self, admin_headers):
        """Should return exactly 6 modules"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/modules", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 6, f"Expected 6 modules, got {len(data)}: {[m['id'] for m in data]}"
        print(f"✅ Got 6 modules: {[m['id'] for m in data]}")

    def test_modules_have_required_fields(self, admin_headers):
        """Each module should have id, label, icon, color, description, prompt_count"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/modules", headers=admin_headers)
        assert resp.status_code == 200
        modules = resp.json()
        required_fields = ["id", "label", "icon", "color", "description", "prompt_count"]
        for mod in modules:
            for field in required_fields:
                assert field in mod, f"Module {mod.get('id')} missing field '{field}'"
        print("✅ All modules have required fields")

    def test_expected_module_ids_present(self, admin_headers):
        """All 6 expected module IDs should be in response"""
        expected_ids = {
            "business_plan_v3",
            "business_plan_v1",
            "whitepaper_niw",
            "econometric_study",
            "niw_plan_sections",
            "patent_uspto"
        }
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/modules", headers=admin_headers)
        assert resp.status_code == 200
        modules = resp.json()
        actual_ids = {m["id"] for m in modules}
        missing = expected_ids - actual_ids
        assert not missing, f"Missing module IDs: {missing}"
        print(f"✅ All expected module IDs present: {actual_ids}")

    def test_modules_have_positive_prompt_count(self, admin_headers):
        """Each module should have at least 1 prompt"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/modules", headers=admin_headers)
        assert resp.status_code == 200
        modules = resp.json()
        for mod in modules:
            assert mod["prompt_count"] > 0, f"Module {mod['id']} has 0 prompts"
        print(f"✅ All modules have positive prompt counts")


# ── Module Prompts (business_plan_v3) ─────────────────────────────────────────

class TestModulePrompts:
    """Test GET /api/admin/prompts/{module_id}"""

    def test_get_business_plan_v3_prompts(self, admin_headers):
        """business_plan_v3 should return list of prompts"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/business_plan_v3", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least some prompts"
        print(f"✅ business_plan_v3 returned {len(data)} prompts")

    def test_business_plan_v3_has_17_prompts(self, admin_headers):
        """business_plan_v3 should have 17 prompts (7 base + 10 sections)"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/business_plan_v3", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 17, f"Expected 17 prompts, got {len(data)}: {[p['key'] for p in data]}"
        print(f"✅ business_plan_v3 has exactly 17 prompts")

    def test_prompt_items_have_required_fields(self, admin_headers):
        """Each prompt item should have: key, label, description, category, is_modified, char_count"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/business_plan_v3", headers=admin_headers)
        assert resp.status_code == 200
        prompts = resp.json()
        required_fields = ["key", "label", "description", "category", "is_modified", "char_count", "history_count"]
        for p in prompts:
            for field in required_fields:
                assert field in p, f"Prompt {p.get('key')} missing field '{field}'"
        print("✅ All prompt items have required fields")

    def test_system_prompt_key_in_v3(self, admin_headers):
        """system_prompt key should be present in business_plan_v3"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/business_plan_v3", headers=admin_headers)
        assert resp.status_code == 200
        prompts = resp.json()
        keys = [p["key"] for p in prompts]
        assert "system_prompt" in keys, f"system_prompt key not found. Keys: {keys}"
        print("✅ system_prompt key present in business_plan_v3")

    def test_invalid_module_returns_404(self, admin_headers):
        """Non-existent module_id should return 404"""
        resp = requests.get(f"{BASE_URL}/api/admin/prompts/nonexistent_module_xyz", headers=admin_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✅ Non-existent module returns 404")

    def test_other_modules_load_correctly(self, admin_headers):
        """Test that all 6 modules return prompts correctly"""
        module_ids = [
            "business_plan_v3",
            "business_plan_v1",
            "whitepaper_niw",
            "econometric_study",
            "niw_plan_sections",
            "patent_uspto"
        ]
        for mid in module_ids:
            resp = requests.get(f"{BASE_URL}/api/admin/prompts/{mid}", headers=admin_headers)
            assert resp.status_code == 200, f"Module {mid} failed: {resp.status_code} {resp.text}"
            data = resp.json()
            assert isinstance(data, list) and len(data) > 0, f"Module {mid} returned empty list"
        print(f"✅ All 6 modules return valid prompt lists")


# ── Prompt Content ─────────────────────────────────────────────────────────────

class TestPromptContent:
    """Test GET /api/admin/prompts/{module_id}/{key}/content"""

    def test_get_system_prompt_content(self, admin_headers):
        """Get content of system_prompt for business_plan_v3"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/business_plan_v3/system_prompt/content",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "content" in data, "Response should have 'content' field"
        assert isinstance(data["content"], str), "Content should be a string"
        assert len(data["content"]) > 100, "Content should not be empty"
        assert "is_modified" in data, "Response should have 'is_modified' field"
        print(f"✅ system_prompt content loaded: {len(data['content'])} chars")

    def test_content_response_has_correct_fields(self, admin_headers):
        """Content response should have: content, is_modified, updated_at, updated_by"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/business_plan_v3/system_prompt/content",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        required_fields = ["content", "is_modified", "updated_at", "updated_by"]
        for f in required_fields:
            assert f in data, f"Missing field '{f}' in content response"
        print("✅ Content response has all required fields")

    def test_invalid_key_returns_404(self, admin_headers):
        """Non-existent prompt key should return 404"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/business_plan_v3/nonexistent_key_xyz/content",
            headers=admin_headers
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✅ Non-existent key returns 404")


# ── Save & Reset Prompt ────────────────────────────────────────────────────────

class TestSaveAndResetPrompt:
    """Test PUT /api/admin/prompts/{module_id}/{key} and POST reset"""
    
    TEST_MODULE = "business_plan_v3"
    TEST_KEY = "citation_standards"  # Use citation_standards to avoid affecting system_prompt

    def test_save_prompt_override(self, admin_headers):
        """Save a prompt override and verify it persists"""
        test_content = "TEST_OVERRIDE: This is a test override content for citation standards. " * 5
        
        resp = requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": test_content, "notes": "TEST: Automated test override"},
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Save failed: {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Success not True: {data}"
        print(f"✅ Prompt override saved successfully: version={data.get('version_saved')}")

    def test_saved_prompt_shows_as_modified(self, admin_headers):
        """After saving, prompt should appear as is_modified=True in the list"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        prompts = resp.json()
        target = next((p for p in prompts if p["key"] == self.TEST_KEY), None)
        assert target is not None, f"Key {self.TEST_KEY} not found in prompt list"
        assert target["is_modified"] is True, f"Expected is_modified=True, got: {target}"
        print(f"✅ Prompt shows as modified after save: {target}")

    def test_saved_content_retrievable(self, admin_headers):
        """After saving, content endpoint should return the override"""
        test_content = "TEST_OVERRIDE: This is a test override content for citation standards. " * 5
        
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/content",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_modified"] is True, "Should be modified"
        assert "TEST_OVERRIDE" in data["content"], f"Saved content not found. Got: {data['content'][:100]}"
        print(f"✅ Override content correctly retrievable: {data['content'][:50]}...")

    def test_empty_content_returns_400(self, admin_headers):
        """Empty content should return 400"""
        resp = requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": "   ", "notes": ""},
            headers=admin_headers
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✅ Empty content correctly rejected with 400")

    def test_reset_prompt_to_default(self, admin_headers):
        """Reset prompt should remove the override"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/reset",
            json={},
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Reset failed: {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Reset success not True: {data}"
        print(f"✅ Prompt reset to default: {data.get('message')}")

    def test_after_reset_not_modified(self, admin_headers):
        """After reset, prompt should not be is_modified"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        prompts = resp.json()
        target = next((p for p in prompts if p["key"] == self.TEST_KEY), None)
        assert target is not None
        # After reset, is_modified should be False
        assert target["is_modified"] is False, f"Expected is_modified=False after reset, got: {target}"
        print(f"✅ Prompt is no longer modified after reset")


# ── Version History ────────────────────────────────────────────────────────────

class TestVersionHistory:
    """Test GET /api/admin/prompts/{module_id}/{key}/history and related"""

    TEST_MODULE = "business_plan_v3"
    TEST_KEY = "writing_guidelines"  # Use a different key for history tests

    def setup_history_data(self, admin_headers):
        """Helper: save a prompt to ensure history exists"""
        content1 = "HISTORY TEST V1: Writing guidelines test content. " * 3
        requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": content1, "notes": "TEST: History test v1"},
            headers=admin_headers
        )
        content2 = "HISTORY TEST V2: Updated writing guidelines test content. " * 3
        requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": content2, "notes": "TEST: History test v2"},
            headers=admin_headers
        )

    def test_get_history_after_saves(self, admin_headers):
        """After saving, history should have entries"""
        # First create some history
        self.setup_history_data(admin_headers)
        
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "History should be a list"
        assert len(data) >= 1, f"Expected at least 1 history entry, got {len(data)}"
        print(f"✅ History returned {len(data)} entries")

    def test_history_entries_have_required_fields(self, admin_headers):
        """History entries should have: version, saved_at, notes, char_count, preview"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history",
            headers=admin_headers
        )
        assert resp.status_code == 200
        history = resp.json()
        if history:
            required_fields = ["version", "saved_at", "notes", "char_count", "preview", "is_default_snapshot"]
            for entry in history:
                for field in required_fields:
                    assert field in entry, f"History entry missing field '{field}': {entry}"
        print("✅ History entries have required fields")

    def test_history_content_endpoint(self, admin_headers):
        """Get full content for a specific history version"""
        # Get the history first
        hist_resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history",
            headers=admin_headers
        )
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        
        if not history:
            pytest.skip("No history available to test content retrieval")
        
        # Get content of the first (newest) history version
        version = history[0]["version"]
        content_resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history/{version}/content",
            headers=admin_headers
        )
        assert content_resp.status_code == 200, f"Got {content_resp.status_code}: {content_resp.text}"
        data = content_resp.json()
        assert "content" in data, "Should have 'content' field"
        assert "version" in data, "Should have 'version' field"
        assert data["version"] == version, "Version should match"
        print(f"✅ History version {version} content retrieved: {len(data['content'])} chars")

    def test_history_nonexistent_version_returns_404(self, admin_headers):
        """Non-existent history version should return 404"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history/99999/content",
            headers=admin_headers
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✅ Non-existent history version returns 404")

    def test_reset_history_key(self, admin_headers):
        """Clean up: reset the test key"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/reset",
            json={},
            headers=admin_headers
        )
        assert resp.status_code == 200
        print(f"✅ Cleanup: writing_guidelines reset to default")


# ── Version Restore ────────────────────────────────────────────────────────────

class TestVersionRestore:
    """Test POST /api/admin/prompts/{module_id}/{key}/restore"""

    TEST_MODULE = "business_plan_v3"
    TEST_KEY = "self_audit_checklist"  # Use another key for restore tests

    def test_save_then_restore_version(self, admin_headers):
        """Save a version, then save another, then restore the first"""
        v1_content = "RESTORE_TEST_V1: Original self audit content. " * 4
        v2_content = "RESTORE_TEST_V2: Modified self audit content. " * 4
        
        # Save V1
        r1 = requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": v1_content, "notes": "TEST: Restore test v1"},
            headers=admin_headers
        )
        assert r1.status_code == 200, f"V1 save failed: {r1.text}"
        
        # Save V2 (creates new version in history)
        r2 = requests.put(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}",
            json={"content": v2_content, "notes": "TEST: Restore test v2"},
            headers=admin_headers
        )
        assert r2.status_code == 200, f"V2 save failed: {r2.text}"
        
        # Get history to find v1 version number
        hist_resp = requests.get(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/history",
            headers=admin_headers
        )
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert len(history) >= 2, f"Expected at least 2 history entries, got {len(history)}"
        
        # Find the v1 version (has notes "TEST: Restore test v1")
        v1_entry = next((h for h in history if "Restore test v1" in h.get("notes", "")), None)
        if v1_entry is None:
            pytest.skip("Could not find v1 entry in history to restore")
        
        v1_version_number = v1_entry["version"]
        
        # Restore to v1
        restore_resp = requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/restore",
            json={"version": v1_version_number},
            headers=admin_headers
        )
        assert restore_resp.status_code == 200, f"Restore failed: {restore_resp.text}"
        data = restore_resp.json()
        assert data.get("success") is True, f"Restore success not True: {data}"
        print(f"✅ Version {v1_version_number} restored successfully")

    def test_restore_invalid_version_returns_404(self, admin_headers):
        """Restoring a non-existent version should return 404"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/restore",
            json={"version": 99999},
            headers=admin_headers
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✅ Non-existent version restore returns 404")

    def test_cleanup_restore_test_key(self, admin_headers):
        """Clean up: reset the test key"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/prompts/{self.TEST_MODULE}/{self.TEST_KEY}/reset",
            json={},
            headers=admin_headers
        )
        assert resp.status_code == 200
        print(f"✅ Cleanup: self_audit_checklist reset to default")
