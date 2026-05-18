"""
Test Clients Router Activation - Verifies clients_router.py is properly activated
and all 8 client endpoints work correctly after removing duplicate code from server.py

Tests:
- POST /api/clients - Create client
- GET /api/clients - List clients
- GET /api/clients/search - Search clients
- GET /api/clients/{id} - Get client by ID
- PUT /api/clients/{id} - Update client
- DELETE /api/clients/{id} - Delete client
- GET /api/clients/{id}/stats - Get client statistics
- GET /api/clients/{id}/documents-detail - Get client documents
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://domain-relink-test.preview.emergentagent.com')
TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with authentication"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAuthEndpoints:
    """Test Auth Router endpoints"""
    
    def test_login_success(self):
        """Test /api/auth/login - successful login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print("✅ Auth login successful")
    
    def test_auth_me(self, auth_headers):
        """Test /api/auth/me - get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"✅ Auth /me returns user: {data.get('full_name', data.get('email'))}")


class TestClientsRouter:
    """Test all 8 endpoints from clients_router.py"""
    
    @pytest.fixture(autouse=True)
    def setup_test_client(self, auth_headers):
        """Create a test client for all tests in this class"""
        self.headers = auth_headers
        self.test_client_id = None
        self.unique_suffix = str(uuid.uuid4())[:8]
    
    def test_01_create_client(self, auth_headers):
        """Test POST /api/clients - Create new client"""
        unique_email = f"test_router_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "name": f"Test Router Client {uuid.uuid4().hex[:6]}",
            "email": unique_email,
            "phone": "+1234567890",
            "company": "Test Company",
            "country": "USA",
            "city": "New York",
            "industry": "Technology",
            "notes": "Test client created by router activation test"
        }
        response = requests.post(f"{BASE_URL}/api/clients", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create client failed: {response.text}"
        data = response.json()
        assert "client_id" in data
        assert "message" in data
        # Store for cleanup
        TestClientsRouter.created_client_id = data["client_id"]
        TestClientsRouter.created_client_email = unique_email
        print(f"✅ POST /api/clients - Created client ID: {data['client_id']}")
        return data["client_id"]
    
    def test_02_get_clients_list(self, auth_headers):
        """Test GET /api/clients - List all clients"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers)
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        data = response.json()
        assert "clients" in data
        assert "total" in data
        assert isinstance(data["clients"], list)
        print(f"✅ GET /api/clients - Found {data['total']} clients")
    
    def test_03_search_clients(self, auth_headers):
        """Test GET /api/clients/search - Search clients"""
        response = requests.get(f"{BASE_URL}/api/clients/search?q=test", headers=auth_headers)
        assert response.status_code == 200, f"Search clients failed: {response.text}"
        data = response.json()
        assert "clients" in data
        assert "total" in data
        print(f"✅ GET /api/clients/search - Found {data['total']} matching clients")
    
    def test_04_get_client_by_id(self, auth_headers):
        """Test GET /api/clients/{id} - Get client by ID"""
        client_id = getattr(TestClientsRouter, 'created_client_id', None)
        if not client_id:
            pytest.skip("No client created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=auth_headers)
        assert response.status_code == 200, f"Get client failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["id"] == client_id
        print(f"✅ GET /api/clients/{client_id} - Retrieved client successfully")
    
    def test_05_update_client(self, auth_headers):
        """Test PUT /api/clients/{id} - Update client"""
        client_id = getattr(TestClientsRouter, 'created_client_id', None)
        if not client_id:
            pytest.skip("No client created in previous test")
        
        update_payload = {
            "name": f"Updated Router Client {uuid.uuid4().hex[:6]}",
            "email": TestClientsRouter.created_client_email,
            "phone": "+9876543210",
            "company": "Updated Company",
            "country": "USA",
            "city": "Los Angeles",
            "industry": "Software"
        }
        response = requests.put(f"{BASE_URL}/api/clients/{client_id}", json=update_payload, headers=auth_headers)
        assert response.status_code == 200, f"Update client failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ PUT /api/clients/{client_id} - Updated client successfully")
    
    def test_06_get_client_stats(self, auth_headers):
        """Test GET /api/clients/{id}/stats - Get client statistics"""
        client_id = getattr(TestClientsRouter, 'created_client_id', None)
        if not client_id:
            pytest.skip("No client created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}/stats", headers=auth_headers)
        assert response.status_code == 200, f"Get client stats failed: {response.text}"
        data = response.json()
        # Verify stats structure
        assert "client" in data
        assert "niw_count" in data or "total_documents" in data
        print(f"✅ GET /api/clients/{client_id}/stats - Retrieved stats successfully")
    
    def test_07_get_client_documents_detail(self, auth_headers):
        """Test GET /api/clients/{id}/documents-detail - Get client documents"""
        client_id = getattr(TestClientsRouter, 'created_client_id', None)
        if not client_id:
            pytest.skip("No client created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/clients/{client_id}/documents-detail", headers=auth_headers)
        assert response.status_code == 200, f"Get client documents failed: {response.text}"
        data = response.json()
        assert "documents" in data
        assert "total" in data
        print(f"✅ GET /api/clients/{client_id}/documents-detail - Found {data['total']} documents")
    
    def test_08_delete_client(self, auth_headers):
        """Test DELETE /api/clients/{id} - Delete client (cleanup)"""
        client_id = getattr(TestClientsRouter, 'created_client_id', None)
        if not client_id:
            pytest.skip("No client created in previous test")
        
        response = requests.delete(f"{BASE_URL}/api/clients/{client_id}", headers=auth_headers)
        assert response.status_code == 200, f"Delete client failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ DELETE /api/clients/{client_id} - Deleted client successfully")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=auth_headers)
        assert verify_response.status_code == 404, "Client should not exist after deletion"
        print("✅ Verified: Client no longer exists after deletion")


class TestBusinessPlans:
    """Test Business Plans module"""
    
    def test_get_business_plans(self, auth_headers):
        """Test GET /api/business-plans"""
        response = requests.get(f"{BASE_URL}/api/business-plans", headers=auth_headers)
        assert response.status_code == 200, f"Get business plans failed: {response.text}"
        print("✅ GET /api/business-plans - Endpoint working")
    
    def test_start_interactive_business_plan(self, auth_headers):
        """Test POST /api/business-plans/start-interactive"""
        payload = {
            "client_id": "test-client-id",
            "project_title": "Test Interactive Business Plan",
            "applicant_name": "Test User",
            "applicant_cv": "Test CV content",
            "project_idea": "Test project idea"
        }
        response = requests.post(f"{BASE_URL}/api/business-plans/start-interactive", json=payload, headers=auth_headers)
        # Should work or return validation error for missing/invalid fields
        assert response.status_code in [200, 201, 400, 404, 422], f"Start interactive failed: {response.text}"
        print(f"✅ POST /api/business-plans/start-interactive - Endpoint responding (status: {response.status_code})")


class TestPatents:
    """Test Patents module"""
    
    def test_get_patents(self, auth_headers):
        """Test GET /api/patents"""
        response = requests.get(f"{BASE_URL}/api/patents", headers=auth_headers)
        assert response.status_code == 200, f"Get patents failed: {response.text}"
        data = response.json()
        assert isinstance(data, (list, dict))
        print(f"✅ GET /api/patents - Endpoint working")


class TestBooks:
    """Test Books module"""
    
    def test_get_books(self, auth_headers):
        """Test GET /api/books"""
        response = requests.get(f"{BASE_URL}/api/books", headers=auth_headers)
        assert response.status_code == 200, f"Get books failed: {response.text}"
        print("✅ GET /api/books - Endpoint working")


class TestEconometricStudies:
    """Test Econometric Studies module"""
    
    def test_get_econometric_studies(self, auth_headers):
        """Test GET /api/econometric-studies"""
        response = requests.get(f"{BASE_URL}/api/econometric-studies", headers=auth_headers)
        assert response.status_code == 200, f"Get econometric studies failed: {response.text}"
        print("✅ GET /api/econometric-studies - Endpoint working")


class TestWhitepapers:
    """Test Whitepapers module"""
    
    def test_get_whitepapers(self, auth_headers):
        """Test GET /api/whitepapers"""
        response = requests.get(f"{BASE_URL}/api/whitepapers", headers=auth_headers)
        assert response.status_code == 200, f"Get whitepapers failed: {response.text}"
        data = response.json()
        # Verify response structure
        if isinstance(data, dict):
            assert "completed" in data or "whitepapers" in data or "total" in data
        print("✅ GET /api/whitepapers - Endpoint working")


class TestPromptManager:
    """Test Prompt Manager module (6 modules)"""
    
    def test_get_prompt_modules(self, auth_headers):
        """Test GET /api/admin/prompts/modules - Should return 6 modules"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts/modules", headers=auth_headers)
        assert response.status_code == 200, f"Get prompt modules failed: {response.text}"
        data = response.json()
        
        # Response can be a list directly or dict with modules key
        if isinstance(data, list):
            modules = data
        else:
            modules = data.get("modules", [])
        
        assert len(modules) >= 6, f"Expected at least 6 modules, got {len(modules)}"
        
        # Expected module names
        expected_modules = [
            "business_plan_v3",
            "business_plan_v1", 
            "whitepaper_niw",
            "econometric_study",
            "niw_plan_sections",
            "patent_uspto"
        ]
        
        module_ids = [m.get("id") or m.get("module_id") for m in modules]
        
        # Verify all expected modules are present
        for expected in expected_modules:
            assert expected in module_ids, f"Module '{expected}' not found in {module_ids}"
        
        print(f"✅ GET /api/admin/prompts/modules - Found {len(modules)} modules")
        print(f"   Modules: {module_ids}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
