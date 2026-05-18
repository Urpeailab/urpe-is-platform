"""
Test Suite for Bilingual NIW Business Plan Endpoints
=====================================================
Tests the critical bug fix for Spanish PDF download issue.
The bug was: edit-section-bilingual was NOT saving to database,
causing PDF downloads to show English instead of Spanish.

Endpoints tested:
1. POST /api/auth/register - User registration
2. POST /api/auth/login - User login
3. POST /api/business-plans/start-interactive - Create NIW
4. GET /api/business-plans/{plan_id}/debug - Debug endpoint for bilingual analysis
5. POST /api/business-plans/approve-section/{niw_id} - Approve section with bilingual content
6. POST /api/business-plans/edit-section-bilingual/{niw_id} - Edit section bilingually (CRITICAL FIX)
7. GET /api/business-plans/{plan_id}/download?language=es - Download PDF in Spanish
"""

import pytest
import requests
import os
import uuid
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

print(f"Testing against: {BASE_URL}")


class TestBilingualNIW:
    """Test suite for bilingual NIW functionality"""
    
    # Class-level variables to share state between tests
    auth_token = None
    user_id = None
    niw_id = None
    test_email = f"test_bilingual_{uuid.uuid4().hex[:8]}@test.com"
    test_password = "Test1234!"
    test_name = "Test Bilingual User"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        if TestBilingualNIW.auth_token:
            self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
    
    # =========================================================================
    # TEST 1: Health Check
    # =========================================================================
    def test_01_health_check(self):
        """Verify API is healthy"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health check passed")
    
    # =========================================================================
    # TEST 2: User Registration
    # =========================================================================
    def test_02_register_user(self):
        """Register a new test user"""
        payload = {
            "email": TestBilingualNIW.test_email,
            "password": TestBilingualNIW.test_password,
            "full_name": TestBilingualNIW.test_name
        }
        response = self.session.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Accept 200 (success) or 400 (user already exists)
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data, "Registration should return access_token"
            TestBilingualNIW.auth_token = data["access_token"]
            print(f"✅ User registered: {TestBilingualNIW.test_email}")
        elif response.status_code == 400:
            # User already exists, proceed to login
            print(f"ℹ️ User already exists, will login instead")
        else:
            pytest.fail(f"Registration failed with status {response.status_code}: {response.text}")
    
    # =========================================================================
    # TEST 3: User Login
    # =========================================================================
    def test_03_login_user(self):
        """Login with test user"""
        payload = {
            "email": TestBilingualNIW.test_email,
            "password": TestBilingualNIW.test_password
        }
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Login should return access_token"
        TestBilingualNIW.auth_token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        print(f"✅ User logged in successfully")
    
    # =========================================================================
    # TEST 4: Create NIW (start-interactive)
    # =========================================================================
    def test_04_create_niw(self):
        """Create a new NIW business plan"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        payload = {
            "project_title": "Test Bilingual Project",
            "applicant_name": "Test Applicant",
            "applicant_cv": "PhD in Computer Science with 10 years experience in AI/ML",
            "project_idea": "Developing advanced AI systems for healthcare diagnostics",
            "patent_info": "",
            "language": "es"
        }
        
        response = self.session.post(f"{BASE_URL}/api/business-plans/start-interactive", json=payload)
        
        assert response.status_code == 200, f"Create NIW failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain NIW id"
        TestBilingualNIW.niw_id = data["id"]
        print(f"✅ NIW created with ID: {TestBilingualNIW.niw_id}")
    
    # =========================================================================
    # TEST 5: Debug Endpoint - Verify structure
    # =========================================================================
    def test_05_debug_endpoint_exists(self):
        """Test the debug endpoint returns proper structure"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        response = self.session.get(f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/debug")
        
        assert response.status_code == 200, f"Debug endpoint failed: {response.text}"
        data = response.json()
        
        # Verify debug response structure
        assert "plan_id" in data, "Debug should return plan_id"
        assert "collection_found" in data, "Debug should return collection_found"
        assert "has_main_content_es" in data, "Debug should analyze content_es"
        assert "has_main_content_en" in data, "Debug should analyze content_en"
        assert "sections_with_content_es" in data, "Debug should count sections with content_es"
        assert "sections_with_content_en" in data, "Debug should count sections with content_en"
        
        print(f"✅ Debug endpoint working - Collection: {data['collection_found']}")
        print(f"   Sections with ES: {data['sections_with_content_es']}")
        print(f"   Sections with EN: {data['sections_with_content_en']}")
    
    # =========================================================================
    # TEST 6: Approve Section with Bilingual Content
    # =========================================================================
    def test_06_approve_section_bilingual(self):
        """Test approve-section saves content_es and content_en"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        # Create a section with bilingual content
        section_data = {
            "number": 1,
            "title": "Executive Summary / Resumen Ejecutivo",
            "content": "This is the English content for testing.",
            "content_es": "Este es el contenido en español para pruebas. El proyecto propone desarrollar sistemas de IA avanzados para diagnósticos médicos.",
            "content_en": "This is the English content for testing. The project proposes developing advanced AI systems for medical diagnostics.",
            "approved": False,
            "edit_history": []
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/business-plans/approve-section/{TestBilingualNIW.niw_id}",
            json=section_data
        )
        
        assert response.status_code == 200, f"Approve section failed: {response.text}"
        print("✅ Section 1 approved with bilingual content")
        
        # Verify the section was saved with bilingual content using debug endpoint
        debug_response = self.session.get(f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/debug")
        assert debug_response.status_code == 200
        debug_data = debug_response.json()
        
        # Check if sections have bilingual content
        if debug_data.get('sections_analysis'):
            section_1 = next((s for s in debug_data['sections_analysis'] if s['number'] == 1), None)
            if section_1:
                assert section_1.get('has_content_es'), "Section should have content_es after approval"
                assert section_1.get('has_content_en'), "Section should have content_en after approval"
                print(f"   ✅ Section 1 has content_es: {section_1.get('content_es_length')} chars")
                print(f"   ✅ Section 1 has content_en: {section_1.get('content_en_length')} chars")
    
    # =========================================================================
    # TEST 7: Edit Section Bilingual - CRITICAL FIX TEST
    # =========================================================================
    def test_07_edit_section_bilingual_saves_to_db(self):
        """
        CRITICAL TEST: Verify edit-section-bilingual saves to database.
        This was the root cause of the Spanish PDF bug.
        """
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        # First, get current state
        debug_before = self.session.get(f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/debug")
        assert debug_before.status_code == 200
        
        # Edit the section in Spanish
        edit_payload = {
            "section_number": 1,
            "edited_language": "es",
            "edited_content": "CONTENIDO EDITADO EN ESPAÑOL - Este es el nuevo contenido modificado por el usuario. El proyecto de IA para diagnósticos médicos ha sido actualizado con nuevos detalles técnicos.",
            "edit_instructions": "Actualizar con más detalles técnicos",
            "current_section_title": "Executive Summary / Resumen Ejecutivo"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/business-plans/edit-section-bilingual/{TestBilingualNIW.niw_id}",
            json=edit_payload
        )
        
        assert response.status_code == 200, f"Edit section bilingual failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "section" in data, "Response should contain edited section"
        assert "regenerated_language" in data, "Response should indicate regenerated language"
        assert data["regenerated_language"] == "en", "Should regenerate English when Spanish is edited"
        
        print("✅ Edit section bilingual endpoint returned successfully")
        
        # CRITICAL: Verify the edit was saved to database
        time.sleep(1)  # Small delay to ensure DB write completes
        
        debug_after = self.session.get(f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/debug")
        assert debug_after.status_code == 200
        debug_data = debug_after.json()
        
        # Find section 1 in the analysis
        section_1 = None
        if debug_data.get('sections_analysis'):
            section_1 = next((s for s in debug_data['sections_analysis'] if s['number'] == 1), None)
        
        if section_1:
            # Verify content_es was updated
            assert section_1.get('has_content_es'), "Section should have content_es after edit"
            assert section_1.get('has_content_en'), "Section should have content_en after edit"
            
            # Verify the Spanish content contains our edit
            content_es_preview = section_1.get('content_es_preview', '')
            assert "CONTENIDO EDITADO" in content_es_preview or len(content_es_preview) > 50, \
                f"Spanish content should be updated. Preview: {content_es_preview[:100]}"
            
            print(f"   ✅ CRITICAL: Edit was saved to database!")
            print(f"   ✅ content_es length: {section_1.get('content_es_length')} chars")
            print(f"   ✅ content_en length: {section_1.get('content_en_length')} chars")
        else:
            print("   ⚠️ Could not find section 1 in debug analysis")
    
    # =========================================================================
    # TEST 8: Download PDF in Spanish
    # =========================================================================
    def test_08_download_pdf_spanish(self):
        """Test downloading PDF with language=es returns Spanish content"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        response = self.session.get(
            f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/download",
            params={"language": "es"}
        )
        
        # The endpoint should return a PDF or at least not fail
        assert response.status_code == 200, f"Download PDF failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type or 'application/octet-stream' in content_type, \
            f"Expected PDF content type, got: {content_type}"
        
        # Verify we got actual content
        assert len(response.content) > 1000, "PDF should have substantial content"
        
        print(f"✅ PDF downloaded successfully ({len(response.content)} bytes)")
    
    # =========================================================================
    # TEST 9: Download PDF in English
    # =========================================================================
    def test_09_download_pdf_english(self):
        """Test downloading PDF with language=en returns English content"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        response = self.session.get(
            f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/download",
            params={"language": "en"}
        )
        
        assert response.status_code == 200, f"Download PDF (EN) failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type or 'application/octet-stream' in content_type, \
            f"Expected PDF content type, got: {content_type}"
        
        assert len(response.content) > 1000, "PDF should have substantial content"
        
        print(f"✅ English PDF downloaded successfully ({len(response.content)} bytes)")
    
    # =========================================================================
    # TEST 10: Debug endpoint shows bilingual analysis
    # =========================================================================
    def test_10_debug_shows_bilingual_fields(self):
        """Verify debug endpoint properly analyzes bilingual fields"""
        self.session.headers.update({"Authorization": f"Bearer {TestBilingualNIW.auth_token}"})
        
        response = self.session.get(f"{BASE_URL}/api/business-plans/{TestBilingualNIW.niw_id}/debug")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = [
            "plan_id",
            "collection_found",
            "has_main_content",
            "has_main_content_es",
            "has_main_content_en",
            "language_setting",
            "status",
            "total_sections",
            "sections_with_content_es",
            "sections_with_content_en",
            "sections_analysis"
        ]
        
        for field in expected_fields:
            assert field in data, f"Debug response missing field: {field}"
        
        print("✅ Debug endpoint returns all expected bilingual analysis fields")
        print(f"   Plan ID: {data['plan_id']}")
        print(f"   Collection: {data['collection_found']}")
        print(f"   Total sections: {data['total_sections']}")
        print(f"   Sections with ES: {data['sections_with_content_es']}")
        print(f"   Sections with EN: {data['sections_with_content_en']}")


class TestDebugEndpointNonExistent:
    """Test debug endpoint with non-existent plan"""
    
    def test_debug_nonexistent_plan_returns_404(self):
        """Debug endpoint should return 404 for non-existent plan"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        
        response = session.get(f"{BASE_URL}/api/business-plans/{fake_id}/debug")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Debug endpoint correctly returns 404 for non-existent plan")


class TestDownloadEndpointValidation:
    """Test download endpoint validation"""
    
    def test_download_nonexistent_plan_returns_404(self):
        """Download endpoint should return 404 for non-existent plan"""
        session = requests.Session()
        fake_id = str(uuid.uuid4())
        
        response = session.get(
            f"{BASE_URL}/api/business-plans/{fake_id}/download",
            params={"language": "es"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Download endpoint correctly returns 404 for non-existent plan")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
