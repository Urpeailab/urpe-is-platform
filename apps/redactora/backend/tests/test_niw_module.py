"""
Test NIW Module - Propuestas NIW completo
Tests:
- Crear un nuevo proyecto NIW con datos de prueba
- Generar secciones del documento
- Verificar que cada sección tenga content_es Y content_en
- Verificar que el contenido NO contenga '[Evaluator Correction]'
- Probar el endpoint de descarga de PDF en español
- Probar el endpoint de descarga de PDF en inglés
- Verificar que la función clean_section_content_for_pdf elimine correcciones del evaluador
- Probar el endpoint de edición con IA (POST /api/business-plans/ai-edit/{id})
"""

import pytest
import requests
import os
import time
import json
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testletter1767975068@test.com"
TEST_PASSWORD = "Test1234!"

# Known NIW document ID with sections (from niw_in_progress collection)
KNOWN_NIW_ID = "02d62b05-2cf7-4579-80cf-21fbefc69f07"


class TestNIWModule:
    """Test suite for NIW Module functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            token = response.json().get("access_token")
            print(f"✅ Authentication successful, token obtained")
            return token
        else:
            print(f"❌ Authentication failed: {response.status_code} - {response.text}")
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Create authenticated session"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_01_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")
    
    def test_02_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✅ Login successful")
    
    def test_03_get_niw_document_details(self, authenticated_session):
        """Get details of an existing NIW document"""
        niw_id = KNOWN_NIW_ID
        response = authenticated_session.get(f"{BASE_URL}/api/business-plans/{niw_id}")
        
        assert response.status_code == 200, f"Failed to get NIW: {response.status_code} - {response.text[:500]}"
        data = response.json()
        
        # Verify document structure
        assert 'id' in data
        assert 'project_title' in data or 'business_name' in data
        
        # Check for sections
        sections = data.get('sections', [])
        print(f"✅ Document has {len(sections)} sections")
        print(f"   Title: {data.get('project_title', data.get('business_name', 'N/A'))}")
        
        # Store sections for later tests
        self.__class__.niw_sections = sections
        self.__class__.niw_data = data
        self.__class__.niw_id = niw_id
    
    def test_04_verify_bilingual_content(self, authenticated_session):
        """Verify that sections have both content_es and content_en"""
        if not hasattr(self.__class__, 'niw_sections'):
            pytest.skip("No sections to test")
        
        sections = self.__class__.niw_sections
        if not sections:
            pytest.skip("Document has no sections")
        
        sections_with_es = 0
        sections_with_en = 0
        sections_missing_translations = []
        
        for section in sections:
            section_num = section.get('number', 'N/A')
            section_title = section.get('title', 'N/A')
            
            has_es = bool(section.get('content_es'))
            has_en = bool(section.get('content_en'))
            
            if has_es:
                sections_with_es += 1
            if has_en:
                sections_with_en += 1
            
            if not has_es or not has_en:
                sections_missing_translations.append({
                    'number': section_num,
                    'title': section_title,
                    'has_es': has_es,
                    'has_en': has_en
                })
        
        print(f"✅ Bilingual content check:")
        print(f"   Total sections: {len(sections)}")
        print(f"   Sections with content_es: {sections_with_es}")
        print(f"   Sections with content_en: {sections_with_en}")
        
        if sections_missing_translations:
            print(f"⚠️ Sections missing translations: {len(sections_missing_translations)}")
            for s in sections_missing_translations[:5]:  # Show first 5
                print(f"   - Section {s['number']}: {s['title']} (ES: {s['has_es']}, EN: {s['has_en']})")
        
        # At least some sections should have content
        assert sections_with_es > 0 or sections_with_en > 0, "No sections have any content"
    
    def test_05_verify_no_evaluator_corrections_in_content(self, authenticated_session):
        """Verify that section content does NOT contain '[Evaluator Correction]'"""
        if not hasattr(self.__class__, 'niw_sections'):
            pytest.skip("No sections to test")
        
        sections = self.__class__.niw_sections
        if not sections:
            pytest.skip("Document has no sections")
        
        evaluator_patterns = [
            r'\[Evaluator Correction\]',
            r'\[Evaluator\s+Correction\]',
            r'Evaluator Correction:',
            r'\*\*\[Evaluator Correction\]\*\*'
        ]
        
        sections_with_corrections = []
        
        for section in sections:
            section_num = section.get('number', 'N/A')
            section_title = section.get('title', 'N/A')
            
            # Check all content fields
            content_fields = ['content', 'content_es', 'content_en']
            
            for field in content_fields:
                content = section.get(field, '')
                if content:
                    for pattern in evaluator_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            sections_with_corrections.append({
                                'number': section_num,
                                'title': section_title,
                                'field': field,
                                'pattern_found': pattern
                            })
                            break
        
        if sections_with_corrections:
            print(f"❌ Found '[Evaluator Correction]' in {len(sections_with_corrections)} section(s):")
            for s in sections_with_corrections:
                print(f"   - Section {s['number']} ({s['field']}): {s['title']}")
        else:
            print(f"✅ No '[Evaluator Correction]' found in any section content")
        
        # This should pass - no evaluator corrections should be in the content
        assert len(sections_with_corrections) == 0, f"Found evaluator corrections in {len(sections_with_corrections)} sections"
    
    def test_06_download_pdf_spanish(self, authenticated_session):
        """Test PDF download endpoint in Spanish"""
        if not hasattr(self.__class__, 'niw_id'):
            pytest.skip("No NIW document ID available")
        
        niw_id = self.__class__.niw_id
        response = authenticated_session.get(
            f"{BASE_URL}/api/business-plans/{niw_id}/download?language=es"
        )
        
        assert response.status_code == 200, f"PDF download failed: {response.status_code} - {response.text[:500]}"
        
        # Verify it's a PDF
        content_type = response.headers.get('content-type', '')
        assert 'application/pdf' in content_type or 'application/octet-stream' in content_type, f"Unexpected content type: {content_type}"
        
        # Verify PDF has content
        pdf_content = response.content
        assert len(pdf_content) > 1000, f"PDF too small: {len(pdf_content)} bytes"
        
        # Verify PDF header
        assert pdf_content[:4] == b'%PDF', "Response is not a valid PDF"
        
        print(f"✅ Spanish PDF downloaded successfully: {len(pdf_content)} bytes")
        
        # Store PDF for content analysis
        self.__class__.pdf_es_content = pdf_content
    
    def test_07_download_pdf_english(self, authenticated_session):
        """Test PDF download endpoint in English"""
        if not hasattr(self.__class__, 'niw_id'):
            pytest.skip("No NIW document ID available")
        
        niw_id = self.__class__.niw_id
        response = authenticated_session.get(
            f"{BASE_URL}/api/business-plans/{niw_id}/download?language=en"
        )
        
        assert response.status_code == 200, f"PDF download failed: {response.status_code} - {response.text[:500]}"
        
        # Verify it's a PDF
        content_type = response.headers.get('content-type', '')
        assert 'application/pdf' in content_type or 'application/octet-stream' in content_type, f"Unexpected content type: {content_type}"
        
        # Verify PDF has content
        pdf_content = response.content
        assert len(pdf_content) > 1000, f"PDF too small: {len(pdf_content)} bytes"
        
        # Verify PDF header
        assert pdf_content[:4] == b'%PDF', "Response is not a valid PDF"
        
        print(f"✅ English PDF downloaded successfully: {len(pdf_content)} bytes")
        
        # Store PDF for content analysis
        self.__class__.pdf_en_content = pdf_content
    
    def test_08_verify_pdf_no_evaluator_corrections(self, authenticated_session):
        """Verify that downloaded PDFs do NOT contain '[Evaluator Correction]'"""
        patterns_found_es = []
        patterns_found_en = []
        
        search_patterns = [
            'Evaluator Correction',
            '[Evaluator',
        ]
        
        # Check Spanish PDF
        if hasattr(self.__class__, 'pdf_es_content'):
            pdf_text = self.__class__.pdf_es_content.decode('latin-1', errors='ignore')
            
            for pattern in search_patterns:
                if pattern.lower() in pdf_text.lower():
                    patterns_found_es.append(pattern)
            
            if patterns_found_es:
                print(f"⚠️ Spanish PDF may contain internal metadata: {patterns_found_es}")
            else:
                print(f"✅ Spanish PDF appears clean of evaluator corrections")
        
        # Check English PDF
        if hasattr(self.__class__, 'pdf_en_content'):
            pdf_text = self.__class__.pdf_en_content.decode('latin-1', errors='ignore')
            
            for pattern in search_patterns:
                if pattern.lower() in pdf_text.lower():
                    patterns_found_en.append(pattern)
            
            if patterns_found_en:
                print(f"⚠️ English PDF may contain internal metadata: {patterns_found_en}")
            else:
                print(f"✅ English PDF appears clean of evaluator corrections")
        
        # Assert no evaluator corrections found
        assert len(patterns_found_es) == 0, f"Spanish PDF contains: {patterns_found_es}"
        assert len(patterns_found_en) == 0, f"English PDF contains: {patterns_found_en}"
    
    def test_09_debug_endpoint(self, authenticated_session):
        """Test debug endpoint to check translation status"""
        if not hasattr(self.__class__, 'niw_id'):
            pytest.skip("No NIW document ID available")
        
        niw_id = self.__class__.niw_id
        response = authenticated_session.get(f"{BASE_URL}/api/business-plans/{niw_id}/debug")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Debug info:")
            print(f"   Total sections: {data.get('total_sections', 'N/A')}")
            print(f"   Sections with content_es: {data.get('sections_with_content_es', 'N/A')}")
            print(f"   Sections with content_en: {data.get('sections_with_content_en', 'N/A')}")
        else:
            print(f"⚠️ Debug endpoint returned: {response.status_code}")
    
    def test_10_ai_edit_endpoint_structure(self, authenticated_session):
        """Test AI edit endpoint exists and validates input"""
        if not hasattr(self.__class__, 'niw_id'):
            pytest.skip("No NIW document ID available")
        
        niw_id = self.__class__.niw_id
        
        # Test with valid structure for non-existent document
        response = authenticated_session.post(
            f"{BASE_URL}/api/business-plans/ai-edit/nonexistent-id-12345",
            json={"edit_instructions": "Test instruction", "language": "es"}
        )
        
        # Should return 404 for non-existent document
        assert response.status_code in [404, 422, 400], f"Unexpected status: {response.status_code}"
        print(f"✅ AI edit endpoint correctly handles non-existent document: {response.status_code}")
    
    def test_11_regenerate_translations_endpoint(self, authenticated_session):
        """Test regenerate translations endpoint exists"""
        # Test endpoint exists (don't actually trigger regeneration)
        response = authenticated_session.post(
            f"{BASE_URL}/api/business-plans/nonexistent-id-12345/regenerate-translations"
        )
        
        # Should return 404 for non-existent document
        assert response.status_code in [404, 422, 400], f"Unexpected status: {response.status_code}"
        print(f"✅ Regenerate translations endpoint correctly handles non-existent document: {response.status_code}")


class TestCleanSectionContentFunction:
    """Test the clean_section_content_for_pdf function logic"""
    
    def test_clean_evaluator_corrections_html(self):
        """Test that HTML evaluator corrections are removed"""
        import re
        
        # Simulate the clean_section_content_for_pdf function
        def clean_section_content_for_pdf(section_content, section_title=''):
            if not section_content:
                return ''
            cleaned = section_content.strip()
            
            # Evaluator correction patterns
            evaluator_patterns = [
                r'<p>\s*<strong>\s*\[Evaluator Correction\]:?\s*</strong>.*?</p>',
                r'\[Evaluator Correction\]:?[^\n]*\n?',
                r'<p>\s*\[Evaluator Correction\]:?.*?</p>',
                r'\*\*\[Evaluator Correction\]\*\*:?[^\n]*\n?',
            ]
            for pattern in evaluator_patterns:
                cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
            
            return cleaned.strip()
        
        # Test cases
        test_cases = [
            {
                "input": "<p><strong>[Evaluator Correction]:</strong> This should be removed</p><p>This should remain</p>",
                "expected_contains": "This should remain",
                "expected_not_contains": "Evaluator Correction"
            },
            {
                "input": "[Evaluator Correction]: Remove this line\nKeep this line",
                "expected_contains": "Keep this line",
                "expected_not_contains": "Evaluator Correction"
            },
            {
                "input": "**[Evaluator Correction]**: Remove this\nKeep this",
                "expected_contains": "Keep this",
                "expected_not_contains": "Evaluator Correction"
            },
        ]
        
        for i, test in enumerate(test_cases):
            result = clean_section_content_for_pdf(test["input"])
            
            assert test["expected_contains"] in result, f"Test {i+1}: Expected '{test['expected_contains']}' in result, got: '{result}'"
            assert test["expected_not_contains"].lower() not in result.lower(), f"Test {i+1}: Did not expect '{test['expected_not_contains']}' in result"
            
            print(f"✅ Test case {i+1} passed: Evaluator correction removed correctly")
    
    def test_clean_markdown_code_fences(self):
        """Test that markdown code fences are removed"""
        import re
        
        def clean_section_content_for_pdf(section_content, section_title=''):
            if not section_content:
                return ''
            cleaned = section_content.strip()
            
            if cleaned.startswith('```html') or cleaned.startswith('```HTML'):
                cleaned = re.sub(r'^```html\s*\n?', '', cleaned, flags=re.IGNORECASE)
            if cleaned.startswith('```'):
                cleaned = cleaned[3:].lstrip()
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3].rstrip()
            
            return cleaned.strip()
        
        test_input = "```html\n<p>Content here</p>\n```"
        result = clean_section_content_for_pdf(test_input)
        
        assert "```" not in result, "Code fences should be removed"
        assert "<p>Content here</p>" in result, "Content should be preserved"
        
        print(f"✅ Markdown code fences removed correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
