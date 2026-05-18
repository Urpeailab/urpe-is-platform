"""
Clients CRUD Tests - Post-Refactoring Verification
Tests all clients endpoints to ensure they work correctly after refactoring.

Endpoints tested:
1. GET /api/clients - List all clients (paginated)
2. POST /api/clients - Create new client
3. GET /api/clients/{id} - Get single client
4. PUT /api/clients/{id} - Update client
5. DELETE /api/clients/{id} - Delete client
6. GET /api/clients/{id}/stats - Get client statistics
7. GET /api/clients/search - Search clients
"""

import pytest
import requests
import os
import uuid

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
# CLIENTS LIST AND SEARCH TESTS
# ============================================================================

class TestClientsListAndSearch:
    """Clients listing and search tests"""
    
    def test_get_clients_list(self, authenticated_client):
        """Test GET /api/clients - Returns paginated list"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "clients" in data, "Missing 'clients' key"
        assert "total" in data, "Missing 'total' key"
        assert "page" in data, "Missing 'page' key"
        assert "pages" in data, "Missing 'pages' key"
        assert isinstance(data["clients"], list), "clients should be a list"
        
        print(f"✅ GET /api/clients returned {len(data['clients'])} clients (total: {data['total']})")
    
    def test_get_clients_with_pagination(self, authenticated_client):
        """Test GET /api/clients with pagination parameters"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients?page=1&limit=5")
        assert response.status_code == 200, f"Get clients paginated failed: {response.text}"
        data = response.json()
        
        assert data["page"] == 1, "Page should be 1"
        assert len(data["clients"]) <= 5, "Should return max 5 clients"
        
        print(f"✅ GET /api/clients?page=1&limit=5 returned {len(data['clients'])} clients")
    
    def test_get_clients_filter_by_status(self, authenticated_client):
        """Test GET /api/clients with status filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients?status=active")
        assert response.status_code == 200, f"Get clients filtered failed: {response.text}"
        data = response.json()
        
        # All returned clients should have active status
        for client in data["clients"]:
            assert client.get("status") == "active", f"Client {client.get('id')} has wrong status"
        
        print(f"✅ GET /api/clients?status=active returned {len(data['clients'])} active clients")
    
    def test_search_clients(self, authenticated_client):
        """Test GET /api/clients/search"""
        response = authenticated_client.get(f"{BASE_URL}/api/clients/search?q=test")
        assert response.status_code == 200, f"Search clients failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "clients" in data, "Missing 'clients' key"
        assert "total" in data, "Missing 'total' key"
        
        print(f"✅ GET /api/clients/search?q=test returned {len(data['clients'])} matches")


# ============================================================================
# CLIENTS CRUD TESTS
# ============================================================================

class TestClientsCRUD:
    """Clients CRUD operations tests"""
    
    @pytest.fixture(scope="class")
    def test_client_data(self):
        """Generate unique test client data"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "name": f"TEST_Client_{unique_id}",
            "email": f"test_{unique_id}@testclient.com",
            "phone": "+1234567890",
            "company": "TEST Company Inc",
            "country": "United States",
            "city": "Test City",
            "state": "Test State",
            "industry": "Technology",
            "notes": "Test client created by pytest",
            "tags": ["test", "automated"]
        }
    
    def test_create_client(self, authenticated_client, test_client_data):
        """Test POST /api/clients - Create new client"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/clients",
            json=test_client_data
        )
        assert response.status_code == 200, f"Create client failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "client_id" in data or "client" in data, "Missing client_id or client in response"
        
        # Get the created client ID for next tests
        client_id = data.get("client_id") or data.get("client", {}).get("id")
        assert client_id, "No client ID returned"
        
        # Store client_id for later tests
        test_client_data["created_id"] = client_id
        
        print(f"✅ POST /api/clients created client: {client_id}")
        return client_id
    
    def test_get_client_by_id(self, authenticated_client, test_client_data):
        """Test GET /api/clients/{id} - Get single client"""
        client_id = test_client_data.get("created_id")
        if not client_id:
            pytest.skip("No client_id from create test")
        
        response = authenticated_client.get(f"{BASE_URL}/api/clients/{client_id}")
        assert response.status_code == 200, f"Get client by id failed: {response.text}"
        data = response.json()
        
        # Validate returned data matches what we created
        assert data.get("id") == client_id, "Client ID mismatch"
        assert data.get("name") == test_client_data["name"], "Name mismatch"
        assert data.get("email") == test_client_data["email"], "Email mismatch"
        
        print(f"✅ GET /api/clients/{client_id} returned correct client data")
    
    def test_update_client(self, authenticated_client, test_client_data):
        """Test PUT /api/clients/{id} - Update client"""
        client_id = test_client_data.get("created_id")
        if not client_id:
            pytest.skip("No client_id from create test")
        
        # Update data
        update_data = {
            "name": test_client_data["name"] + " UPDATED",
            "email": test_client_data["email"],
            "phone": "+9876543210",
            "company": "TEST Company Updated",
            "country": "United States",
            "city": "Updated City",
            "state": "Updated State",
            "industry": "Finance",
            "notes": "Updated by pytest",
            "tags": ["test", "updated"]
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/clients/{client_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Update client failed: {response.text}"
        
        # Verify update with GET request
        get_response = authenticated_client.get(f"{BASE_URL}/api/clients/{client_id}")
        assert get_response.status_code == 200, "Get after update failed"
        data = get_response.json()
        
        assert data.get("company") == "TEST Company Updated", "Company not updated"
        assert data.get("industry") == "Finance", "Industry not updated"
        
        print(f"✅ PUT /api/clients/{client_id} updated client successfully")
    
    def test_get_client_stats(self, authenticated_client, test_client_data):
        """Test GET /api/clients/{id}/stats - Get client statistics"""
        client_id = test_client_data.get("created_id")
        if not client_id:
            pytest.skip("No client_id from create test")
        
        response = authenticated_client.get(f"{BASE_URL}/api/clients/{client_id}/stats")
        assert response.status_code == 200, f"Get client stats failed: {response.text}"
        data = response.json()
        
        # Validate stats structure
        assert "client" in data, "Missing 'client' in stats"
        assert "total_documents" in data, "Missing 'total_documents' in stats"
        
        # Should have various count fields
        expected_counts = [
            "niw_count", "patent_count", "book_count", 
            "whitepaper_count", "study_count"
        ]
        for count_field in expected_counts:
            if count_field in data:
                assert isinstance(data[count_field], int), f"{count_field} should be integer"
        
        print(f"✅ GET /api/clients/{client_id}/stats returned total_documents: {data['total_documents']}")
    
    def test_delete_client(self, authenticated_client, test_client_data):
        """Test DELETE /api/clients/{id} - Delete client"""
        client_id = test_client_data.get("created_id")
        if not client_id:
            pytest.skip("No client_id from create test")
        
        response = authenticated_client.delete(f"{BASE_URL}/api/clients/{client_id}")
        assert response.status_code in [200, 204], f"Delete client failed: {response.text}"
        
        # Verify client is deleted
        get_response = authenticated_client.get(f"{BASE_URL}/api/clients/{client_id}")
        assert get_response.status_code == 404, f"Client should be deleted, got {get_response.status_code}"
        
        print(f"✅ DELETE /api/clients/{client_id} deleted client successfully")


# ============================================================================
# CLIENT VALIDATION TESTS
# ============================================================================

class TestClientValidation:
    """Client validation and edge case tests"""
    
    def test_create_client_duplicate_email(self, authenticated_client):
        """Test creating client with duplicate email fails"""
        # First create a client
        unique_id = str(uuid.uuid4())[:8]
        client_data = {
            "name": f"TEST_Duplicate_{unique_id}",
            "email": f"duplicate_{unique_id}@test.com",
            "company": "Test Company"
        }
        
        # Create first client
        response1 = authenticated_client.post(f"{BASE_URL}/api/clients", json=client_data)
        assert response1.status_code == 200, f"First create failed: {response1.text}"
        data1 = response1.json()
        client_id = data1.get("client_id") or data1.get("client", {}).get("id")
        
        # Try to create duplicate
        client_data["name"] = f"TEST_Duplicate2_{unique_id}"
        response2 = authenticated_client.post(f"{BASE_URL}/api/clients", json=client_data)
        # Should fail with 400 due to duplicate email
        assert response2.status_code == 400, f"Expected 400 for duplicate email, got {response2.status_code}"
        
        # Cleanup
        if client_id:
            authenticated_client.delete(f"{BASE_URL}/api/clients/{client_id}")
        
        print("✅ Duplicate email correctly rejected with 400")
    
    def test_get_nonexistent_client(self, authenticated_client):
        """Test getting non-existent client returns 404"""
        fake_id = str(uuid.uuid4())
        response = authenticated_client.get(f"{BASE_URL}/api/clients/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent client correctly returns 404")
    
    def test_update_nonexistent_client(self, authenticated_client):
        """Test updating non-existent client returns 404"""
        fake_id = str(uuid.uuid4())
        response = authenticated_client.put(
            f"{BASE_URL}/api/clients/{fake_id}",
            json={"name": "Test", "email": "test@test.com"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Update non-existent client correctly returns 404")
    
    def test_delete_nonexistent_client(self, authenticated_client):
        """Test deleting non-existent client returns 404"""
        fake_id = str(uuid.uuid4())
        response = authenticated_client.delete(f"{BASE_URL}/api/clients/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Delete non-existent client correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
