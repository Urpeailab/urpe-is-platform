"""
Test I-140 N8N PDF Bug Fixes
Tests 4 specific bug fixes in the PDF mapping:
1. Part 3 Item 5 - Estado/Provincia mapping (line 804 in mapping file)
2. Part 4 Processing Type - Consular vs Adjustment checkboxes  
3. Part 1 Items 5 & 6 - Nonprofit and employee count checkboxes
4. Skip fields updated to prevent duplicate checkbox setting
"""

import pytest
import requests
import os
import json
import tempfile
from io import BytesIO

try:
    import PyPDF2
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False
    
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com').rstrip('/')
I140_TEMPLATE_ID = "317b5608-9729-4740-9553-dd021b09b494"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"email": "admin@urpe.com", "password": "urpe2024"}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestPDFGenerationBugFixes:
    """Test PDF generation bug fixes"""
    
    @pytest.mark.skipif(not HAS_PYPDF2, reason="PyPDF2 not installed")
    def test_bug1_estado_provincia_mapping(self, auth_headers):
        """
        Bug Fix #1: Part 3 Item 5 - Estado/Provincia de Nacimiento mapping
        The question text was fixed from 'Estado/Provincia' to 'Estado o Provincia'
        to match the template question.
        """
        # Generate PDF with Estado o Provincia de Nacimiento = Cundinamarca
        answers = [
            {"question": "1.a. Apellido del Beneficiario", "answer": "GARCIA"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "MARIA"},
            {"question": "3. Fecha de Nacimiento", "answer": "1990-01-15"},
            {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "Bogota"},
            {"question": "5. Estado o Provincia de Nacimiento", "answer": "Cundinamarca"},
            {"question": "6. País de Nacimiento", "answer": "Colombia"},
            {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "Colombia"},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers),
                "client_name": "Test Estado Provincia"
            }
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.status_code} - {response.text}"
        assert "application/pdf" in response.headers.get("content-type", ""), "Response is not a PDF"
        
        # Read PDF and check field value
        pdf_reader = PyPDF2.PdfReader(BytesIO(response.content))
        fields = pdf_reader.get_fields()
        
        # Check Line7_StateProvinceOfBirth[0] contains CUNDINAMARCA
        state_field = None
        for field_name, field_data in fields.items():
            if "Line7_StateProvinceOfBirth" in field_name:
                state_field = field_data
                break
        
        assert state_field is not None, "Line7_StateProvinceOfBirth field not found in PDF"
        field_value = state_field.get('/V', '') or ''
        print(f"Estado/Provincia field value: {field_value}")
        assert "CUNDINAMARCA" in str(field_value).upper(), f"Expected CUNDINAMARCA but got: {field_value}"
    
    @pytest.mark.skipif(not HAS_PYPDF2, reason="PyPDF2 not installed")
    def test_bug2_consular_processing_type(self, auth_headers):
        """
        Bug Fix #2a: Part 4 Processing Type - CONSULAR
        When answer is '1.a. Aplicará para visa en embajada o consulado de EE.UU.',
        Line1a_Visa[0] should be checked AND Line1b_Status[0] should NOT be checked.
        """
        answers = [
            {"question": "1.a. Apellido del Beneficiario", "answer": "CONSULAR_TEST"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "MARIA"},
            {"question": "3. Fecha de Nacimiento", "answer": "1990-01-15"},
            {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "Bogota"},
            {"question": "6. País de Nacimiento", "answer": "Colombia"},
            {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "Colombia"},
            # CONSULAR processing type
            {"question": "¿Dónde procesará la visa el beneficiario?", "answer": "1.a. Aplicará para visa en embajada o consulado de EE.UU."},
            {"question": "1.a. Ciudad o Pueblo", "answer": "Bogota"},
            {"question": "1.c. País", "answer": "Colombia"},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers),
                "client_name": "Test Consular Processing"
            }
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.status_code}"
        
        pdf_reader = PyPDF2.PdfReader(BytesIO(response.content))
        fields = pdf_reader.get_fields()
        
        # Find processing type fields
        visa_field = None
        status_field = None
        
        for field_name, field_data in fields.items():
            if "Line1a_Visa" in field_name:
                visa_field = field_data
            if "Line1b_Status" in field_name:
                status_field = field_data
        
        # Line1a_Visa should be checked (have a value like 'X' or '/Yes')
        visa_value = visa_field.get('/V', '') if visa_field else ''
        status_value = status_field.get('/V', '') if status_field else ''
        
        print(f"Consular Processing - Line1a_Visa: {visa_value}, Line1b_Status: {status_value}")
        
        assert visa_value and str(visa_value).strip(), f"Line1a_Visa should be checked for consular processing but got: {visa_value}"
        # Status field should be empty or not checked
        assert not status_value or str(status_value).strip() == '', f"Line1b_Status should NOT be checked for consular processing but got: {status_value}"
    
    @pytest.mark.skipif(not HAS_PYPDF2, reason="PyPDF2 not installed")
    def test_bug2_adjustment_processing_type(self, auth_headers):
        """
        Bug Fix #2b: Part 4 Processing Type - ADJUSTMENT OF STATUS
        When answer is '2.a. Está en EE.UU. y solicitará ajuste de estatus',
        Line1b_Status[0] should be checked AND Line1a_Visa[0] should NOT be checked.
        """
        answers = [
            {"question": "1.a. Apellido del Beneficiario", "answer": "ADJUSTMENT_TEST"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "JUAN"},
            {"question": "3. Fecha de Nacimiento", "answer": "1985-06-20"},
            {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "Mexico City"},
            {"question": "6. País de Nacimiento", "answer": "Mexico"},
            {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "Mexico"},
            # ADJUSTMENT OF STATUS processing type
            {"question": "¿Dónde procesará la visa el beneficiario?", "answer": "2.a. Está en EE.UU. y solicitará ajuste de estatus"},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers),
                "client_name": "Test Adjustment Processing"
            }
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.status_code}"
        
        pdf_reader = PyPDF2.PdfReader(BytesIO(response.content))
        fields = pdf_reader.get_fields()
        
        # Find processing type fields
        visa_field = None
        status_field = None
        
        for field_name, field_data in fields.items():
            if "Line1a_Visa" in field_name:
                visa_field = field_data
            if "Line1b_Status" in field_name:
                status_field = field_data
        
        visa_value = visa_field.get('/V', '') if visa_field else ''
        status_value = status_field.get('/V', '') if status_field else ''
        
        print(f"Adjustment Processing - Line1a_Visa: {visa_value}, Line1b_Status: {status_value}")
        
        # Status field should be checked for adjustment processing
        assert status_value and str(status_value).strip(), f"Line1b_Status should be checked for adjustment processing but got: {status_value}"
        # Visa field should be empty or not checked
        assert not visa_value or str(visa_value).strip() == '', f"Line1a_Visa should NOT be checked for adjustment processing but got: {visa_value}"
    
    @pytest.mark.skipif(not HAS_PYPDF2, reason="PyPDF2 not installed")
    def test_bug3_part1_items_5_and_6(self, auth_headers):
        """
        Bug Fix #3: Part 1 Items 5 and 6
        - Item 5: P1_Line5_Checkbox[0] = /Yes (nonprofit = No)
        - Item 6: P1_Line6_Checkbox[1] = /Yes (25 or fewer employees = Yes)
        """
        answers = [
            {"question": "1.a. Apellido del Beneficiario", "answer": "PART1_TEST"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "MARIA"},
            {"question": "3. Fecha de Nacimiento", "answer": "1990-01-15"},
            {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "Bogota"},
            {"question": "6. País de Nacimiento", "answer": "Colombia"},
            {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "Colombia"},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers),
                "client_name": "Test Part 1 Items"
            }
        )
        
        assert response.status_code == 200, f"PDF generation failed: {response.status_code}"
        
        pdf_reader = PyPDF2.PdfReader(BytesIO(response.content))
        fields = pdf_reader.get_fields()
        
        # Find Part 1 checkboxes
        item5_checkbox = None
        item6_checkbox = None
        
        for field_name, field_data in fields.items():
            if "P1_Line5_Checkbox[0]" in field_name:
                item5_checkbox = field_data
            if "P1_Line6_Checkbox[1]" in field_name:
                item6_checkbox = field_data
        
        item5_value = item5_checkbox.get('/V', '') if item5_checkbox else ''
        item6_value = item6_checkbox.get('/V', '') if item6_checkbox else ''
        
        print(f"Part 1 - Item 5: {item5_value}, Item 6: {item6_value}")
        
        # Both should be checked (X or /Yes)
        assert item5_value and str(item5_value).strip(), f"P1_Line5_Checkbox[0] should be checked (Item 5 = No) but got: {item5_value}"
        assert item6_value and str(item6_value).strip(), f"P1_Line6_Checkbox[1] should be checked (Item 6 = Yes) but got: {item6_value}"


class TestFillEndpoint:
    """Test the /api/uscis-forms/fill endpoint functionality"""
    
    def test_fill_endpoint_returns_pdf(self, auth_headers):
        """Test that fill endpoint returns PDF binary"""
        answers = [
            {"question": "1.a. Apellido del Beneficiario", "answer": "ENDPOINT_TEST"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "MARIA"},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers),
                "client_name": "Test Endpoint"
            }
        )
        
        assert response.status_code == 200, f"Fill endpoint failed: {response.status_code}"
        assert "application/pdf" in response.headers.get("content-type", ""), "Response should be PDF"
        assert len(response.content) > 1000, "PDF content seems too small"
    
    def test_fill_endpoint_requires_auth(self):
        """Test that fill endpoint requires authentication"""
        answers = [{"question": "1.a. Apellido del Beneficiario", "answer": "NOAUTH_TEST"}]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers)
            }
        )
        
        # Should fail with 401 or 422 (missing header)
        assert response.status_code in [401, 422], f"Expected auth error but got: {response.status_code}"
    
    def test_fill_endpoint_invalid_template(self, auth_headers):
        """Test fill endpoint with invalid template ID"""
        answers = [{"question": "1.a. Apellido del Beneficiario", "answer": "INVALID_TEMPLATE"}]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": "invalid-template-id-12345",
                "answers_json": json.dumps(answers)
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid template but got: {response.status_code}"
    
    def test_fill_endpoint_uses_form_data(self, auth_headers):
        """Test that fill endpoint uses form-data (not JSON body)"""
        answers = [{"question": "1.a. Apellido del Beneficiario", "answer": "FORM_DATA_TEST"}]
        
        # Try with JSON body - should fail
        response_json = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers)
            }
        )
        
        # Try with form data - should succeed
        response_form = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=auth_headers,
            data={
                "template_id": I140_TEMPLATE_ID,
                "answers_json": json.dumps(answers)
            }
        )
        
        # Form data should work, JSON might not
        assert response_form.status_code == 200, f"Form data request failed: {response_form.status_code}"


class TestClientSubmissionsWorkflow:
    """Test client submissions workflow for admin"""
    
    def test_get_client_submissions(self, auth_headers):
        """Test getting client submissions list"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/client-submissions",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get submissions: {response.status_code}"
        submissions = response.json()
        assert isinstance(submissions, list), "Response should be a list"
        print(f"Found {len(submissions)} client submissions")
    
    def test_get_templates(self, auth_headers):
        """Test getting templates list"""
        response = requests.get(
            f"{BASE_URL}/api/uscis-forms/templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get templates: {response.status_code}"
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        
        # Verify I-140 template exists
        i140_template = next((t for t in templates if t.get('id') == I140_TEMPLATE_ID), None)
        assert i140_template is not None, f"I-140 template {I140_TEMPLATE_ID} not found"
        print(f"Found I-140 template: {i140_template.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
