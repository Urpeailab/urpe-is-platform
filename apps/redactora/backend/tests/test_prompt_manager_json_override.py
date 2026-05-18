"""
Test Prompt Manager JSON Override endpoints for all 6 modules.
Tests: GET, PUT, DELETE json-override and history endpoints.

Modules tested:
- business_plan_v3
- business_plan_v1  
- whitepaper_niw
- econometric_study
- niw_plan_sections
- patent_uspto
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "dau@urpeailab.com"
ADMIN_PASSWORD = "admin123"

# All 6 modules from prompt_registry.py
ALL_MODULES = [
    "business_plan_v3",
    "business_plan_v1",
    "whitepaper_niw",
    "econometric_study",
    "niw_plan_sections",
    "patent_uspto",
]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text[:200]}")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with authentication token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestJSONOverrideGetAllModules:
    """Test GET /api/admin/json-override/{module_id} for all 6 modules."""

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_get_json_override_returns_valid_response(self, auth_headers, module_id):
        """Each module should return a valid response structure."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/{module_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Module {module_id} failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "has_override" in data, f"Missing has_override for {module_id}"
        assert isinstance(data["has_override"], bool), f"has_override should be bool for {module_id}"
        
        if data["has_override"]:
            assert "json_content" in data, f"Missing json_content for {module_id} with override"
            assert "updated_at" in data, f"Missing updated_at for {module_id}"
            assert "key_count" in data, f"Missing key_count for {module_id}"
            assert data["key_count"] > 0, f"key_count should be > 0 for {module_id} with override"


class TestJSONOverridePutValidation:
    """Test PUT /api/admin/json-override/{module_id} validation."""

    def test_put_invalid_json_returns_400(self, auth_headers):
        """Putting invalid JSON should return 400 error."""
        response = requests.put(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3",
            headers=auth_headers,
            json={"json_content": "{ invalid json }", "notes": "Test invalid"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "JSON inválido" in response.text or "invalid" in response.text.lower()

    def test_put_array_json_returns_400(self, auth_headers):
        """Putting JSON array instead of object should return 400."""
        response = requests.put(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3",
            headers=auth_headers,
            json={"json_content": '["item1", "item2"]', "notes": "Test array"}
        )
        
        assert response.status_code == 400, f"Expected 400 for array, got {response.status_code}"

    def test_put_empty_json_returns_400(self, auth_headers):
        """Putting empty content should return 400."""
        response = requests.put(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3",
            headers=auth_headers,
            json={"json_content": "", "notes": "Test empty"}
        )
        
        assert response.status_code == 400, f"Expected 400 for empty, got {response.status_code}"


class TestJSONOverridePutAllModules:
    """Test PUT /api/admin/json-override/{module_id} for all modules."""

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_put_valid_json_override_saves_successfully(self, auth_headers, module_id):
        """Each module should accept valid JSON override."""
        # Create test JSON specific to module
        test_json = {
            f"test_prompt_{module_id}": f"Test content for {module_id}",
            "test_key_2": "Test value 2"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/json-override/{module_id}",
            headers=auth_headers,
            json={
                "json_content": json.dumps(test_json),
                "notes": f"Test override for {module_id}"
            }
        )
        
        assert response.status_code == 200, f"Module {module_id} PUT failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert data.get("success") == True, f"success should be True for {module_id}"
        assert "key_count" in data, f"Missing key_count for {module_id}"
        assert data["key_count"] == 2, f"key_count should be 2 for {module_id}"
        assert "version" in data, f"Missing version for {module_id}"
        assert "updated_at" in data, f"Missing updated_at for {module_id}"

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_get_after_put_returns_override(self, auth_headers, module_id):
        """After PUT, GET should return the saved override."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/{module_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"GET failed for {module_id}"
        data = response.json()
        
        # Should have override now (from previous test)
        assert data["has_override"] == True, f"Should have override for {module_id}"
        assert "json_content" in data, f"Missing json_content for {module_id}"
        assert data["key_count"] >= 2, f"key_count should be >= 2 for {module_id}"


class TestJSONOverrideHistory:
    """Test history endpoints for all modules."""

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_get_history_returns_list(self, auth_headers, module_id):
        """GET /api/admin/json-override/{module_id}/history should return version list."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/{module_id}/history",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"History GET failed for {module_id}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"History should be a list for {module_id}"
        
        if len(data) > 0:
            version = data[0]
            assert "version" in version, f"Missing version field for {module_id}"
            assert "saved_at" in version, f"Missing saved_at for {module_id}"
            assert "key_count" in version, f"Missing key_count for {module_id}"
            assert "is_active" in version, f"Missing is_active for {module_id}"

    def test_get_history_version_content(self, auth_headers):
        """GET /api/admin/json-override/{module_id}/history/{version}/content works."""
        # First get history to find a version
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3/history",
            headers=auth_headers
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            versions = response.json()
            version_num = versions[0]["version"]
            
            # Get version content
            content_response = requests.get(
                f"{BASE_URL}/api/admin/json-override/business_plan_v3/history/{version_num}/content",
                headers=auth_headers
            )
            
            assert content_response.status_code == 200, f"Get version content failed: {content_response.text}"
            data = content_response.json()
            
            assert "version" in data
            assert "json_content" in data
            assert data["version"] == version_num

    def test_get_nonexistent_version_returns_404(self, auth_headers):
        """GET nonexistent version should return 404."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3/history/99999/content",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestJSONOverrideDeleteAllModules:
    """Test DELETE /api/admin/json-override/{module_id} for all modules."""

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_delete_json_override_succeeds(self, auth_headers, module_id):
        """DELETE should remove the active override."""
        response = requests.delete(
            f"{BASE_URL}/api/admin/json-override/{module_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"DELETE failed for {module_id}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"success should be True for {module_id}"

    @pytest.mark.parametrize("module_id", ALL_MODULES)
    def test_get_after_delete_shows_no_override(self, auth_headers, module_id):
        """After DELETE, GET should show no active override."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/{module_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["has_override"] == False, f"Should have no override after delete for {module_id}"


class TestJSONOverrideUnauthorized:
    """Test endpoints require authentication."""

    @pytest.mark.parametrize("module_id", ALL_MODULES[:2])  # Test first 2 modules
    def test_get_without_auth_returns_401_or_403(self, module_id):
        """GET without auth should fail."""
        response = requests.get(
            f"{BASE_URL}/api/admin/json-override/{module_id}"
        )
        
        assert response.status_code in [401, 403, 422], f"Should deny unauthenticated access for {module_id}"

    def test_put_without_auth_returns_401_or_403(self):
        """PUT without auth should fail."""
        response = requests.put(
            f"{BASE_URL}/api/admin/json-override/business_plan_v3",
            json={"json_content": '{"test": "value"}', "notes": "Test"}
        )
        
        assert response.status_code in [401, 403, 422]


class TestModulesEndpoint:
    """Test modules listing endpoint."""

    def test_get_modules_returns_all_6_modules(self, auth_headers):
        """GET /api/admin/prompts/modules should return all 6 modules."""
        response = requests.get(
            f"{BASE_URL}/api/admin/prompts/modules",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Modules GET failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 6, f"Should have 6 modules, got {len(data)}"
        
        module_ids = [m["id"] for m in data]
        for expected in ALL_MODULES:
            assert expected in module_ids, f"Missing module: {expected}"

    def test_each_module_has_required_fields(self, auth_headers):
        """Each module should have label, icon, color, description."""
        response = requests.get(
            f"{BASE_URL}/api/admin/prompts/modules",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for module in data:
            assert "id" in module, f"Missing id for module"
            assert "label" in module, f"Missing label for {module.get('id')}"
            assert "icon" in module, f"Missing icon for {module.get('id')}"
            assert "color" in module, f"Missing color for {module.get('id')}"
            assert "description" in module, f"Missing description for {module.get('id')}"
            assert "prompt_count" in module, f"Missing prompt_count for {module.get('id')}"


class TestBusinessPlanV3SpecificPrompts:
    """Verify business_plan_v3 has the expected prompts."""

    def test_business_plan_v3_has_key_prompts(self, auth_headers):
        """V3 should have system_prompt, prohibitions, sections, etc."""
        response = requests.get(
            f"{BASE_URL}/api/admin/prompts/business_plan_v3",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get V3 prompts: {response.text}"
        data = response.json()
        
        prompt_keys = [p["key"] for p in data]
        
        # Key prompts that should exist
        expected_keys = [
            "system_prompt",
            "absolute_prohibitions",
            "citation_standards",
            "document_structure",
        ]
        
        for key in expected_keys:
            assert key in prompt_keys, f"Missing key {key} in business_plan_v3"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
