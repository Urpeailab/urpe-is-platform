"""
Backend API Tests - Post-Refactoring Verification
Tests all modules to ensure imports are working correctly after code refactoring.

Modules tested:
1. Auth endpoints: /api/auth/login, /api/auth/register, /api/auth/me
2. Business Plans (NIW): listing, creation
3. Patents: listing, creation
4. Books: listing
5. Econometric Studies: listing, creation
6. Whitepapers: listing
7. Prompt Manager: all 6 modules
8. Clients: listing
"""

import pytest
import requests
import os

# Get BASE_URL from environment variable
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ============================================================================
# HEALTH CHECK TESTS
# ============================================================================

class TestHealthCheck:
    """Health check endpoint tests - verify backend is running"""
    
    def test_api_health(self, api_client):
        """Test /api/health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        print(f"✅ Health check passed: {data}")


# ============================================================================
# AUTH MODULE TESTS
# ============================================================================

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_auth_login(self, api_client):
        """Test /api/auth/login endpoint"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token"
        assert "token_type" in data, "Missing token_type"
        assert "user" in data, "Missing user"
        assert data["token_type"] == "bearer"
        
        # Validate user data
        user = data["user"]
        assert user["email"] == TEST_EMAIL
        assert "id" in user
        assert "role" in user
        print(f"✅ Login successful for {user['email']} (role: {user['role']})")
    
    def test_auth_login_invalid_credentials(self, api_client):
        """Test /api/auth/login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid login correctly rejected with 401")
    
    def test_auth_me(self, authenticated_client):
        """Test /api/auth/me endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        
        # Validate user data
        assert data["email"] == TEST_EMAIL
        assert "id" in data
        assert "role" in data
        assert "full_name" in data
        print(f"✅ Auth/me returned user: {data['full_name']} ({data['email']})")
    
    def test_auth_me_without_token(self, api_client):
        """Test /api/auth/me without authentication"""
        # Create a new session without auth header
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Auth/me correctly rejected without token")


# ============================================================================
# BUSINESS PLANS (NIW) MODULE TESTS
# ============================================================================

class TestBusinessPlans:
    """Business Plans (NIW) endpoint tests"""
    
    def test_get_business_plans_list(self, authenticated_client):
        """Test GET /api/business-plans"""
        response = authenticated_client.get(f"{BASE_URL}/api/business-plans")
        assert response.status_code == 200, f"Get business plans failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Business plans list returned {len(data)} items")
    
    def test_get_business_plans_in_progress(self, authenticated_client):
        """Test GET /api/business-plans/in-progress"""
        response = authenticated_client.get(f"{BASE_URL}/api/business-plans/in-progress")
        assert response.status_code == 200, f"Get in-progress failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Business plans in-progress returned {len(data)} items")
    
    def test_start_interactive_business_plan(self, authenticated_client):
        """Test POST /api/business-plans/start-interactive - creates a new NIW
        Note: Requires project_title, applicant_name, applicant_cv, project_idea fields
        """
        response = authenticated_client.post(f"{BASE_URL}/api/business-plans/start-interactive", json={
            "project_title": "TEST Project Title",
            "applicant_name": "TEST User",
            "applicant_cv": "TEST CV content with education and experience",
            "project_idea": "TEST project idea for business plan generation",
            "language": "en"
        })
        assert response.status_code == 200, f"Start interactive failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Missing id in response"
        print(f"✅ Created NIW in progress with id: {data['id']}")
        
        # Clean up - delete the test NIW
        niw_id = data['id']
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/business-plans/{niw_id}")
        # Some endpoints may return 200 or 204 on delete
        assert delete_response.status_code in [200, 204, 404], f"Delete failed: {delete_response.text}"
        print(f"✅ Cleaned up test NIW: {niw_id}")


# ============================================================================
# PATENTS MODULE TESTS
# ============================================================================

class TestPatents:
    """Patents endpoint tests"""
    
    def test_get_patents_list(self, authenticated_client):
        """Test GET /api/patents"""
        response = authenticated_client.get(f"{BASE_URL}/api/patents")
        assert response.status_code == 200, f"Get patents failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Patents list returned {len(data)} items")
    
    def test_get_patents_in_progress(self, authenticated_client):
        """Test GET /api/patents/in-progress"""
        response = authenticated_client.get(f"{BASE_URL}/api/patents/in-progress")
        assert response.status_code == 200, f"Get patents in-progress failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Patents in-progress returned {len(data)} items")
    
    def test_start_interactive_patent(self, authenticated_client):
        """Test POST /api/patents/start-interactive - creates a new patent
        Note: Requires inventor_residence and invention_description fields
        """
        response = authenticated_client.post(f"{BASE_URL}/api/patents/start-interactive", json={
            "inventor_name": "TEST Inventor",
            "inventor_residence": "California, USA",
            "invention_title": "TEST Invention Title",
            "technical_field": "TEST Technical Field",
            "invention_description": "TEST detailed invention description with technical details",
            "language": "en"
        })
        assert response.status_code == 200, f"Start interactive patent failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Missing id in response"
        print(f"✅ Created patent in progress with id: {data['id']}")
        
        # Clean up
        patent_id = data['id']
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/patents/{patent_id}")
        assert delete_response.status_code in [200, 204, 404], f"Delete failed: {delete_response.text}"
        print(f"✅ Cleaned up test patent: {patent_id}")


# ============================================================================
# BOOKS MODULE TESTS
# ============================================================================

class TestBooks:
    """Books endpoint tests"""
    
    def test_get_books_list(self, authenticated_client):
        """Test GET /api/books"""
        response = authenticated_client.get(f"{BASE_URL}/api/books")
        assert response.status_code == 200, f"Get books failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Books list returned {len(data)} items")
    
    def test_get_books_in_progress(self, authenticated_client):
        """Test GET /api/books/in-progress"""
        response = authenticated_client.get(f"{BASE_URL}/api/books/in-progress")
        assert response.status_code == 200, f"Get books in-progress failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Books in-progress returned {len(data)} items")


# ============================================================================
# ECONOMETRIC STUDIES MODULE TESTS
# ============================================================================

class TestEconometricStudies:
    """Econometric Studies endpoint tests"""
    
    def test_get_econometric_studies_list(self, authenticated_client):
        """Test GET /api/econometric-studies - Returns {studies: [...]}"""
        response = authenticated_client.get(f"{BASE_URL}/api/econometric-studies")
        assert response.status_code == 200, f"Get econometric studies failed: {response.text}"
        data = response.json()
        # API returns {"studies": [...]} structure
        assert "studies" in data, "Expected 'studies' key in response"
        assert isinstance(data["studies"], list), "Expected studies to be a list"
        print(f"✅ Econometric studies list returned {len(data['studies'])} items")
    
    def test_get_econometric_studies_in_progress(self, authenticated_client):
        """Test GET /api/econometric-studies/in-progress"""
        response = authenticated_client.get(f"{BASE_URL}/api/econometric-studies/in-progress")
        assert response.status_code == 200, f"Get econometric in-progress failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ Econometric studies in-progress returned {len(data)} items")
    
    def test_start_econometric_study(self, authenticated_client):
        """Test POST /api/econometric-studies/start - creates a new study
        Note: Requires client_id field
        """
        # First, get a valid client_id
        clients_response = authenticated_client.get(f"{BASE_URL}/api/clients")
        assert clients_response.status_code == 200, "Cannot get clients list"
        clients_data = clients_response.json()
        
        if not clients_data.get("clients") or len(clients_data["clients"]) == 0:
            pytest.skip("No clients available for testing")
        
        client_id = clients_data["clients"][0]["id"]
        
        response = authenticated_client.post(f"{BASE_URL}/api/econometric-studies/start", json={
            "client_id": client_id,
            "applicant_name": "TEST Author",
            "project_description": "TEST Project Description for econometric analysis",
            "language": "en"
        })
        assert response.status_code == 200, f"Start econometric study failed: {response.text}"
        data = response.json()
        
        # Validate response structure - API returns study_id, not id
        assert "study_id" in data, "Missing study_id in response"
        print(f"✅ Created econometric study in progress with id: {data['study_id']}")
        
        # Clean up
        study_id = data['study_id']
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/econometric-studies/{study_id}")
        assert delete_response.status_code in [200, 204, 404], f"Delete failed: {delete_response.text}"
        print(f"✅ Cleaned up test study: {study_id}")


# ============================================================================
# WHITEPAPERS MODULE TESTS
# ============================================================================

class TestWhitepapers:
    """Whitepapers endpoint tests"""
    
    def test_get_whitepapers_list(self, authenticated_client):
        """Test GET /api/whitepapers - Returns {completed: [], in_progress: [], total: N}"""
        response = authenticated_client.get(f"{BASE_URL}/api/whitepapers")
        assert response.status_code == 200, f"Get whitepapers failed: {response.text}"
        data = response.json()
        # API returns {"completed": [], "in_progress": [], "total": N} structure
        assert "completed" in data or "in_progress" in data, "Expected completed or in_progress in response"
        total_items = data.get("total", 0)
        print(f"✅ Whitepapers list returned total: {total_items} items")


# ============================================================================
# PROMPT MANAGER MODULE TESTS
# ============================================================================

class TestPromptManager:
    """Prompt Manager endpoint tests - Tests all 6 modules"""
    
    EXPECTED_MODULES = [
        "business_plan_v3",
        "business_plan_v1", 
        "whitepaper_niw",
        "econometric_study",
        "niw_plan_sections",
        "patent_uspto"
    ]
    
    def test_get_prompt_modules(self, authenticated_client):
        """Test GET /api/admin/prompts/modules"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/modules")
        assert response.status_code == 200, f"Get modules failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list response"
        assert len(data) >= 6, f"Expected at least 6 modules, got {len(data)}"
        
        # Extract module IDs
        module_ids = [m.get("id") for m in data]
        
        # Verify all expected modules are present
        for expected_module in self.EXPECTED_MODULES:
            assert expected_module in module_ids, f"Missing module: {expected_module}"
        
        print(f"✅ Prompt modules returned {len(data)} modules")
        print(f"   Modules: {module_ids}")
    
    def test_get_business_plan_v3_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/business_plan_v3 - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/business_plan_v3")
        assert response.status_code == 200, f"Get business_plan_v3 prompts failed: {response.text}"
        data = response.json()
        # API returns list of prompt objects
        assert isinstance(data, list), "Expected list response"
        print(f"✅ business_plan_v3 module has {len(data)} prompts")
    
    def test_get_business_plan_v1_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/business_plan_v1 - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/business_plan_v1")
        assert response.status_code == 200, f"Get business_plan_v1 prompts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ business_plan_v1 module has {len(data)} prompts")
    
    def test_get_whitepaper_niw_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/whitepaper_niw - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/whitepaper_niw")
        assert response.status_code == 200, f"Get whitepaper_niw prompts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ whitepaper_niw module has {len(data)} prompts")
    
    def test_get_econometric_study_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/econometric_study - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/econometric_study")
        assert response.status_code == 200, f"Get econometric_study prompts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ econometric_study module has {len(data)} prompts")
    
    def test_get_niw_plan_sections_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/niw_plan_sections - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/niw_plan_sections")
        assert response.status_code == 200, f"Get niw_plan_sections prompts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ niw_plan_sections module has {len(data)} prompts")
    
    def test_get_patent_uspto_prompts(self, authenticated_client):
        """Test GET /api/admin/prompts/patent_uspto - Returns list of prompt objects"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/prompts/patent_uspto")
        assert response.status_code == 200, f"Get patent_uspto prompts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ patent_uspto module has {len(data)} prompts")
    
    def test_get_json_override_all_modules(self, authenticated_client):
        """Test GET /api/admin/json-override/{module_id} for all modules"""
        for module_id in self.EXPECTED_MODULES:
            response = authenticated_client.get(f"{BASE_URL}/api/admin/json-override/{module_id}")
            assert response.status_code == 200, f"Get json-override for {module_id} failed: {response.text}"
            data = response.json()
            # API returns {"has_override": bool, "json_content": str, ...} structure
            assert "has_override" in data, f"Missing has_override in {module_id} response"
            print(f"✅ JSON override for {module_id}: has_override={data.get('has_override', False)}")


# ============================================================================
# CLIENTS MODULE TESTS
# ============================================================================

class TestClients:
    """Clients endpoint tests"""
    
    def test_get_clients_list(self, authenticated_client):
        """Test GET /api/clients - Returns {clients: [], page: N, pages: N, total: N}"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        data = response.json()
        # API returns {"clients": [...], "page": N, "pages": N, "total": N} structure
        assert "clients" in data, "Expected 'clients' key in response"
        assert isinstance(data["clients"], list), "Expected clients to be a list"
        print(f"✅ Clients list returned {len(data['clients'])} items (total: {data.get('total', 'N/A')})")
    
    def test_get_clients_with_pagination(self, authenticated_client):
        """Test GET /api/clients with pagination"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients?limit=10&page=1")
        assert response.status_code == 200, f"Get clients paginated failed: {response.text}"
        data = response.json()
        # API returns paginated structure
        assert "clients" in data, "Expected 'clients' key in response"
        assert "page" in data, "Expected 'page' key in response"
        print(f"✅ Clients paginated (limit=10, page=1) returned {len(data['clients'])} items")


# ============================================================================
# ADDITIONAL IMPORT VERIFICATION TESTS
# ============================================================================

class TestImportVerification:
    """Tests to verify imports are working correctly after refactoring"""
    
    def test_auth_router_import(self, authenticated_client):
        """Verify auth router is properly imported and initialized"""
        # The /api/auth/me endpoint uses the auth_get_current_user dependency
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth router import verification failed: {response.text}"
        print("✅ Auth router properly imported and working")
    
    def test_admin_users_endpoint(self, authenticated_client):
        """Test GET /api/admin/users - requires admin"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/users")
        # Should return 200 if admin, 403 if not admin
        assert response.status_code in [200, 403], f"Admin users endpoint failed: {response.text}"
        print(f"✅ Admin users endpoint returned status {response.status_code}")
    
    def test_deployment_check(self, authenticated_client):
        """Test GET /api/deployment-check"""
        response = authenticated_client.get(f"{BASE_URL}/api/deployment-check")
        assert response.status_code == 200, f"Deployment check failed: {response.text}"
        data = response.json()
        print(f"✅ Deployment check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
