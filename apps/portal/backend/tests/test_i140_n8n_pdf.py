"""
Test I-140 N8N PDF Form Filling and Field Mapping
Tests the Part 4 Section 5 address fields (5.a - 5.g) mapping fix
"""
import pytest
import requests
import os
import json
from io import BytesIO

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://classic-cases-hub.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@urpe.com"
ADMIN_PASSWORD = "urpe2024"

# I-140 N8N Template ID
I140_N8N_TEMPLATE_ID = "317b5608-9729-4740-9553-dd021b09b494"


class TestI140N8NPDFMapping:
    """Test I-140 N8N PDF field mapping, especially Part 4 Section 5 address fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        assert token, "No token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"✅ Logged in successfully")
    
    def test_01_get_i140_n8n_template(self):
        """Test that I-140 N8N template exists and has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/uscis-forms/templates/{I140_N8N_TEMPLATE_ID}")
        
        assert response.status_code == 200, f"Failed to get template: {response.text}"
        
        template = response.json()
        assert template["name"] == "I-140 Formulario N8N", f"Wrong template name: {template['name']}"
        assert template["form_code"] == "I-140", f"Wrong form code: {template['form_code']}"
        
        # Check questions structure
        questions = template.get("questions", {})
        assert "sections" in questions, "No sections in questions"
        
        # Find Part 4 Section 5 address fields
        all_questions = []
        for section in questions.get("sections", []):
            all_questions.extend(section.get("questions", []))
        
        # Check for Part 4 Section 5 fields (5.a - 5.g)
        part4_fields = [
            "5.a. In Care Of Name (Peticionario)",
            "5.b. Street Number and Name (Peticionario)",
            "5.c. Suite/Apt/Floor Number (Peticionario)",
            "5.d. City or Town (Peticionario)",
            "5.e. State (Peticionario)",
            "5.f. ZIP Code (Peticionario)",
            "5.g. Country (Peticionario)"
        ]
        
        question_texts = [q.get("question", "") for q in all_questions]
        
        for field in part4_fields:
            assert field in question_texts, f"Missing Part 4 Section 5 field: {field}"
            print(f"✅ Found field: {field}")
        
        print(f"✅ Template has {len(all_questions)} questions")
    
    def test_02_fill_i140_form_with_part4_section5_data(self):
        """Test filling I-140 form with Part 4 Section 5 address data"""
        
        # Test data for Part 4 Section 5 address fields
        test_answers = [
            # Part 4 Section 5 Address Fields (5.a - 5.g) - THE KEY FIELDS TO TEST
            {"question": "5.a. In Care Of Name (Peticionario)", "answer": "TEST CARE OF NAME"},
            {"question": "5.b. Street Number and Name (Peticionario)", "answer": "123 TEST STREET"},
            {"question": "5.c. Suite/Apt/Floor Number (Peticionario)", "answer": "STE 456"},
            {"question": "5.d. City or Town (Peticionario)", "answer": "TEST CITY"},
            {"question": "5.e. State (Peticionario)", "answer": "FL"},
            {"question": "5.f. ZIP Code (Peticionario)", "answer": "33101"},
            {"question": "5.g. Country (Peticionario)", "answer": "THE UNITED STATES OF AMERICA"},
            
            # Beneficiary info (required for form)
            {"question": "1.a. Apellido del Beneficiario", "answer": "GARCIA"},
            {"question": "1.b. Nombre del Beneficiario", "answer": "MARIA"},
            {"question": "1.c. Segundo Nombre del Beneficiario", "answer": "ELENA"},
            {"question": "3. Fecha de Nacimiento", "answer": "01/15/1990"},
            {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "BOGOTA"},
            {"question": "6. País de Nacimiento", "answer": "Republic of Colombia"},
            {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "Republic of Colombia"},
        ]
        
        # Fill the form - use multipart form data
        # Remove Content-Type header to let requests set it for multipart
        headers = dict(self.session.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        
        response = requests.post(
            f"{BASE_URL}/api/uscis-forms/fill",
            headers=headers,
            data={
                "template_id": I140_N8N_TEMPLATE_ID,
                "answers_json": json.dumps(test_answers),
                "client_name": "Test Client - Part 4 Section 5"
            }
        )
        
        assert response.status_code == 200, f"Failed to fill form: {response.text}"
        
        # Check response headers
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got: {content_type}"
        
        # Check PDF content
        pdf_content = response.content
        assert len(pdf_content) > 1000, f"PDF too small: {len(pdf_content)} bytes"
        
        # Verify it's a valid PDF
        assert pdf_content[:4] == b'%PDF', "Response is not a valid PDF"
        
        # Save PDF for manual inspection
        with open("/tmp/test_i140_part4_section5.pdf", "wb") as f:
            f.write(pdf_content)
        
        print(f"✅ PDF generated successfully: {len(pdf_content)} bytes")
        print(f"✅ PDF saved to /tmp/test_i140_part4_section5.pdf")
        
        # Get history ID from response headers
        history_id = response.headers.get("X-History-Id")
        if history_id:
            print(f"✅ History ID: {history_id}")
    
    def test_03_verify_pdf_field_mapping_code(self):
        """Verify the PDF field mapping code has correct Line3 fields for Part 4 Section 5"""
        import sys
        sys.path.insert(0, '/app/backend/data')
        
        from i140_n8n_pdf_mapping import get_field_mapping, fill_i140_form_n8n
        
        field_mapping = get_field_mapping()
        
        # Verify Part 4 Section 5 fields use Line3 (not Line2)
        part4_mappings = {
            "PART4_PETITIONER_MAILING_CARE_OF": "form1[0].#subform[2].Line2a_InCareofName[1]",
            "PART4_PETITIONER_MAILING_STREET": "form1[0].#subform[2].Line3d_StreetNumberName[0]",
            "PART4_PETITIONER_MAILING_SUITE": "form1[0].#subform[2].Line3e_AptSteFlrNumber[0]",
            "PART4_PETITIONER_MAILING_CITY": "form1[0].#subform[2].Line3f_CityOrTown[0]",
            "PART4_PETITIONER_MAILING_PROVINCE": "form1[0].#subform[2].Line3h_Province[0]",
            "PART4_PETITIONER_MAILING_POSTAL": "form1[0].#subform[2].Line3g_PostalCode[0]",
            "PART4_PETITIONER_MAILING_COUNTRY": "form1[0].#subform[2].Line3i_Country[0]",
        }
        
        for key, expected_value in part4_mappings.items():
            actual_value = field_mapping.get(key)
            assert actual_value == expected_value, f"Wrong mapping for {key}: expected {expected_value}, got {actual_value}"
            print(f"✅ {key} -> {actual_value}")
        
        # Also verify the alias mappings
        alias_mappings = {
            "5.a. In Care Of Name (Peticionario)": "form1[0].#subform[2].Line2a_InCareofName[1]",
            "5.b. Street Number and Name (Peticionario)": "form1[0].#subform[2].Line3d_StreetNumberName[0]",
            "5.c. Suite/Apt/Floor Number (Peticionario)": "form1[0].#subform[2].Line3e_AptSteFlrNumber[0]",
            "5.d. City or Town (Peticionario)": "form1[0].#subform[2].Line3f_CityOrTown[0]",
            "5.e. State (Peticionario)": "form1[0].#subform[2].Line3h_Province[0]",
            "5.f. ZIP Code (Peticionario)": "form1[0].#subform[2].Line3g_PostalCode[0]",
            "5.g. Country (Peticionario)": "form1[0].#subform[2].Line3i_Country[0]",
        }
        
        for key, expected_value in alias_mappings.items():
            actual_value = field_mapping.get(key)
            assert actual_value == expected_value, f"Wrong alias mapping for {key}: expected {expected_value}, got {actual_value}"
            print(f"✅ Alias: {key} -> {actual_value}")
    
    def test_04_fill_form_function_output(self):
        """Test the fill_i140_form_n8n function directly"""
        import sys
        sys.path.insert(0, '/app/backend/data')
        
        from i140_n8n_pdf_mapping import fill_i140_form_n8n
        
        # Test data
        test_data = {
            "5.a. In Care Of Name (Peticionario)": "JOHN DOE",
            "5.b. Street Number and Name (Peticionario)": "456 MAIN STREET",
            "5.c. Suite/Apt/Floor Number (Peticionario)": "APT 789",
            "5.d. City or Town (Peticionario)": "MIAMI",
            "5.e. State (Peticionario)": "Florida",  # Should be normalized to FL
            "5.f. ZIP Code (Peticionario)": "33101",
            "5.g. Country (Peticionario)": "United States",  # Should be normalized
        }
        
        result = fill_i140_form_n8n(test_data)
        
        assert "fields" in result, "No fields in result"
        assert "debug" in result, "No debug info in result"
        
        fields = result["fields"]
        
        # Find the Part 4 Section 5 fields in the output
        part4_fields_found = {}
        for field in fields:
            field_name = field.get("fieldName", "")
            text = field.get("text", "")
            
            # Check for Line3 fields (Part 4 Section 5)
            if "Line3" in field_name or "Line2a_InCareofName[1]" in field_name:
                part4_fields_found[field_name] = text
                print(f"✅ Part 4 Section 5 field: {field_name} = {text}")
        
        # Verify the fields are populated
        assert len(part4_fields_found) > 0, "No Part 4 Section 5 fields found in output"
        
        # Check specific values
        expected_fields = {
            "form1[0].#subform[2].Line2a_InCareofName[1]": "JOHN DOE",
            "form1[0].#subform[2].Line3d_StreetNumberName[0]": "456 MAIN STREET",
            "form1[0].#subform[2].Line3e_AptSteFlrNumber[0]": "APT 789",
            "form1[0].#subform[2].Line3f_CityOrTown[0]": "MIAMI",
            "form1[0].#subform[2].Line3h_Province[0]": "FL",  # Normalized
            "form1[0].#subform[2].Line3g_PostalCode[0]": "33101",
        }
        
        for field_name, expected_value in expected_fields.items():
            found = False
            for field in fields:
                if field.get("fieldName") == field_name:
                    actual_value = field.get("text", "")
                    assert actual_value == expected_value, f"Wrong value for {field_name}: expected '{expected_value}', got '{actual_value}'"
                    found = True
                    break
            assert found, f"Field not found in output: {field_name}"
        
        print(f"✅ All Part 4 Section 5 fields correctly mapped")
        print(f"✅ Debug info: {result['debug']}")
    
    def test_05_list_templates(self):
        """Test listing all templates"""
        response = self.session.get(f"{BASE_URL}/api/uscis-forms/templates")
        
        assert response.status_code == 200, f"Failed to list templates: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        
        # Find I-140 N8N template
        i140_n8n = None
        for t in templates:
            if t.get("name") == "I-140 Formulario N8N":
                i140_n8n = t
                break
        
        assert i140_n8n is not None, "I-140 N8N template not found in list"
        assert i140_n8n["id"] == I140_N8N_TEMPLATE_ID, f"Wrong template ID: {i140_n8n['id']}"
        
        print(f"✅ Found {len(templates)} templates")
        print(f"✅ I-140 N8N template: {i140_n8n}")
    
    def test_06_form_history(self):
        """Test form filling history"""
        response = self.session.get(f"{BASE_URL}/api/uscis-forms/history")
        
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        history = response.json()
        assert isinstance(history, list), "History should be a list"
        
        print(f"✅ Found {len(history)} history entries")
        
        # Check if our test entry is in history
        for entry in history[:5]:  # Check last 5 entries
            print(f"  - {entry.get('form_code')} | {entry.get('client_name')} | {entry.get('created_at')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
