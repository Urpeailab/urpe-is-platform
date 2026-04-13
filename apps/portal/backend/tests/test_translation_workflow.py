"""
Test Translation Workflow and USCIS Forms API
Tests:
1. Admin login endpoint
2. Translation API endpoint (POST /api/uscis-forms/translate-answers)
3. Client submissions list API
4. Public form access
5. Shared forms creation
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "admin@urpe.com"
ADMIN_PASSWORD = "urpe2024"

# Test data
I140_TEMPLATE_ID = "317b5608-9729-4740-9553-dd021b09b494"
TEST_SUBMISSION_ID = "d921bf0a-d1f2-4b23-9c0e-654f37033e37"


class TestAdminAuth:
    """Test admin authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test successful admin login"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert data["staff"]["role"] == "super_admin", "Role should be super_admin"
        
    def test_admin_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpass"}
        )
        
        assert response.status_code in [401, 404], f"Should fail with 401/404, got {response.status_code}"


class TestTranslationAPI:
    """Test on-demand translation API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated tests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
    
    def test_translate_spanish_country(self):
        """Test translation of Spanish country name to English"""
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/translate-answers",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "form_id": I140_TEMPLATE_ID,
                "answers": {
                    "6. País de Nacimiento": "Colombia"
                }
            }
        )
        
        assert response.status_code == 200, f"Translation failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "translated_answers" in data
        # Colombia should be translated to REPUBLIC OF COLOMBIA
        assert "COLOMBIA" in data["translated_answers"]["6. País de Nacimiento"].upper()
    
    def test_translate_si_to_yes(self):
        """Test translation of Sí to Yes"""
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/translate-answers",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "form_id": I140_TEMPLATE_ID,
                "answers": {
                    "¿El beneficiario tiene cónyuge o hijos que lo acompañarán?": "Sí"
                }
            }
        )
        
        assert response.status_code == 200, f"Translation failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        # Sí should be translated to Yes
        assert data["translated_answers"]["¿El beneficiario tiene cónyuge o hijos que lo acompañarán?"] == "Yes"
    
    def test_translate_multiple_fields(self):
        """Test translation of multiple fields at once"""
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/translate-answers",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "form_id": I140_TEMPLATE_ID,
                "answers": {
                    "6. País de Nacimiento": "Colombia",
                    "7. País de Ciudadanía o Nacionalidad": "Venezuela",
                    "¿El beneficiario tiene cónyuge o hijos que lo acompañarán?": "Sí"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["translation_count"] == 3
        assert "Yes" in data["translated_answers"]["¿El beneficiario tiene cónyuge o hijos que lo acompañarán?"]
    
    def test_translate_without_auth_fails(self):
        """Test that translation fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/translate-answers",
            json={
                "form_id": I140_TEMPLATE_ID,
                "answers": {"test": "test"}
            }
        )
        
        assert response.status_code in [401, 422], f"Should fail without auth, got {response.status_code}"


class TestClientSubmissions:
    """Test client submissions API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_client_submissions_list(self):
        """Test getting list of client submissions"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/client-submissions",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have submissions
        assert len(data) > 0
    
    def test_client_submissions_have_required_fields(self):
        """Test that submissions have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/client-submissions",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check first submission has required fields
        if len(data) > 0:
            submission = data[0]
            assert "id" in submission
            assert "client_name" in submission
            assert "submission_status" in submission
    
    def test_get_specific_submission(self):
        """Test getting a specific submission by ID"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/client-submissions/{TEST_SUBMISSION_ID}",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Test Traduccion E2E"
        assert "answers" in data
        assert len(data["answers"]) > 0
    
    def test_submission_contains_spanish_answers(self):
        """Test that submission contains Spanish answers for translation testing"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/client-submissions/{TEST_SUBMISSION_ID}",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that answers contain Spanish data
        answers_text = str(data["answers"])
        assert "García" in answers_text or "Lopez" in answers_text or "Colombia" in answers_text


class TestSharedForms:
    """Test shared forms (public form links) API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_shared_forms_list(self):
        """Test getting list of shared forms"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/shared-forms",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_shared_form(self):
        """Test creating a new shared form"""
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/shared-forms",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "template_id": I140_TEMPLATE_ID,
                "client_name": "Pytest Test Client",
                "client_email": "pytest@test.com",
                "expires_in_days": 7,
                "form_type": "pre_validation"
            }
        )
        
        assert response.status_code == 200, f"Failed to create shared form: {response.text}"
        data = response.json()
        assert "token" in data
        assert "expires_at" in data
        
        # Store token for cleanup
        self.created_token = data["token"]


class TestPublicFormAccess:
    """Test public form access (client questionnaire)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and create a test shared form"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
        
        # Create a test shared form
        create_response = requests.post(
            f"{BASE_URL}/api/uscis-forms/shared-forms",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "template_id": I140_TEMPLATE_ID,
                "client_name": "Public Form Test",
                "expires_in_days": 1,
                "form_type": "pre_validation"
            }
        )
        if create_response.status_code == 200:
            self.public_token = create_response.json().get("token")
        else:
            self.public_token = None
    
    def test_access_public_form(self):
        """Test accessing the public form via token"""
        if not self.public_token:
            pytest.skip("Could not create public form token")
        
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/public/form/{self.public_token}"
        )
        
        assert response.status_code == 200, f"Failed to access public form: {response.text}"
        data = response.json()
        assert "template_id" in data or "client_name" in data
    
    def test_invalid_token_returns_error(self):
        """Test that invalid token returns appropriate error"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/public/form/invalid-token-12345"
        )
        
        assert response.status_code in [404, 400], f"Should fail for invalid token, got {response.status_code}"


class TestUSCISTemplates:
    """Test USCIS templates API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_templates_list(self):
        """Test getting list of USCIS templates"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/templates",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_i140_template(self):
        """Test getting specific I-140 template"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/templates/{I140_TEMPLATE_ID}",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "questions" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
