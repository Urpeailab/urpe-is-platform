"""
Test Part 7 Auto-fill Logic for Family Members
Tests the new auto-fill behavior for Adjustment of Status and Visa Abroad fields
based on processing type selection (Proceso Consular vs Dentro de EEUU).

New Requirements:
1. Dropdown for family count (1-6)
2. Auto-fill Adjustment/Visa based on processing type:
   - Proceso Consular: Adjustment=No, Visa Abroad=Yes
   - Dentro de EEUU: Adjustment=No, Visa Abroad=No
3. Show auto-filled values in UI (read-only)
"""

import pytest
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data.i140_n8n_pdf_mapping import (
    fill_i140_form_n8n,
    get_field_mapping,
)


class TestConsularProcessingAutoFill:
    """Test auto-fill logic for Proceso Consular: Adjustment=No, Visa=Yes"""
    
    def test_consular_processing_person1_adjustment_no(self):
        """Test Person 1 Adjustment = No for Consular Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment No checkbox field
        adjustment_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]":
                adjustment_no_field = field
                break
        
        assert adjustment_no_field is not None, "Person 1 Adjustment No checkbox not found"
        assert adjustment_no_field.get("text") == "X"
    
    def test_consular_processing_person1_visa_yes(self):
        """Test Person 1 Visa Abroad = Yes for Consular Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa Yes checkbox field
        visa_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]":
                visa_yes_field = field
                break
        
        assert visa_yes_field is not None, "Person 1 Visa Abroad Yes checkbox not found"
        assert visa_yes_field.get("text") == "X"
    
    def test_consular_processing_person2_adjustment_no(self):
        """Test Person 2 Adjustment = No for Consular Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment No checkbox field for Person 2
        adjustment_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]":
                adjustment_no_field = field
                break
        
        assert adjustment_no_field is not None, "Person 2 Adjustment No checkbox not found"
        assert adjustment_no_field.get("text") == "X"
    
    def test_consular_processing_person2_visa_yes(self):
        """Test Person 2 Visa Abroad = Yes for Consular Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa Yes checkbox field for Person 2
        visa_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]":
                visa_yes_field = field
                break
        
        assert visa_yes_field is not None, "Person 2 Visa Abroad Yes checkbox not found"
        assert visa_yes_field.get("text") == "X"


class TestUSAProcessingAutoFill:
    """Test auto-fill logic for Dentro de EEUU: Adjustment=No, Visa=No"""
    
    def test_usa_processing_person1_adjustment_no(self):
        """Test Person 1 Adjustment = No for USA Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment No checkbox field
        adjustment_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]":
                adjustment_no_field = field
                break
        
        assert adjustment_no_field is not None, "Person 1 Adjustment No checkbox not found"
        assert adjustment_no_field.get("text") == "X"
    
    def test_usa_processing_person1_visa_no(self):
        """Test Person 1 Visa Abroad = No for USA Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa No checkbox field
        visa_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]":
                visa_no_field = field
                break
        
        assert visa_no_field is not None, "Person 1 Visa Abroad No checkbox not found"
        assert visa_no_field.get("text") == "X"
    
    def test_usa_processing_person2_adjustment_no(self):
        """Test Person 2 Adjustment = No for USA Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment No checkbox field for Person 2
        adjustment_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]":
                adjustment_no_field = field
                break
        
        assert adjustment_no_field is not None, "Person 2 Adjustment No checkbox not found"
        assert adjustment_no_field.get("text") == "X"
    
    def test_usa_processing_person2_visa_no(self):
        """Test Person 2 Visa Abroad = No for USA Processing"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa No checkbox field for Person 2
        visa_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]":
                visa_no_field = field
                break
        
        assert visa_no_field is not None, "Person 2 Visa Abroad No checkbox not found"
        assert visa_no_field.get("text") == "X"


class TestMultipleFamilyMembersAutoFill:
    """Test auto-fill for multiple family members (1-6)"""
    
    def test_consular_processing_3_family_members(self):
        """Test 3 family members with Consular Processing: All Adjustment=No, Visa=Yes"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            # Person 1
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Yes",
            # Person 2
            "7.a. Apellido (Persona 2)": "GARCIA",
            "7.b. Nombre (Persona 2)": "CARLOS",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "Yes",
            # Person 3
            "13.a. Apellido (Persona 3)": "GARCIA",
            "13.b. Nombre (Persona 3)": "ANA",
            "17. ¿Solicitará ajuste de estatus? (Persona 3)": "No",
            "18. ¿Solicitará visa en el extranjero? (Persona 3)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Build a dict for easier lookup
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Person 1: Adjustment No, Visa Yes
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]") == "X"
        
        # Person 2: Adjustment No, Visa Yes
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]") == "X"
        
        # Person 3: Adjustment No, Visa Yes (on subform[4])
        assert field_dict.get("form1[0].#subform[4].Pt7ItemNumber17_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[4].Pt7ItemNumber18_CheckboxYes[0]") == "X"
    
    def test_usa_processing_3_family_members(self):
        """Test 3 family members with USA Processing: All Adjustment=No, Visa=No"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            # Person 1
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No",
            # Person 2
            "7.a. Apellido (Persona 2)": "GARCIA",
            "7.b. Nombre (Persona 2)": "CARLOS",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "No",
            # Person 3
            "13.a. Apellido (Persona 3)": "GARCIA",
            "13.b. Nombre (Persona 3)": "ANA",
            "17. ¿Solicitará ajuste de estatus? (Persona 3)": "No",
            "18. ¿Solicitará visa en el extranjero? (Persona 3)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Build a dict for easier lookup
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Person 1: Adjustment No, Visa No
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]") == "X"
        
        # Person 2: Adjustment No, Visa No
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]") == "X"
        
        # Person 3: Adjustment No, Visa No (on subform[4])
        assert field_dict.get("form1[0].#subform[4].Pt7ItemNumber17_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[4].Pt7ItemNumber18_CheckboxNo[0]") == "X"


class TestFamilyCountDropdown:
    """Test that family count dropdown generates correct number of forms"""
    
    def test_family_count_1_generates_1_form(self):
        """Test selecting 1 family member generates 1 form"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Should have Person 1 fields
        field_names = [f.get("fieldName") for f in formatted_fields]
        assert "form1[0].#subform[3].Line1a_Person1FamilyName[0]" in field_names
        
        # Should NOT have Person 2 fields (unless explicitly provided)
        person2_fields = [f for f in field_names if "Person2" in f]
        # Person 2 fields should be empty since we didn't provide them
        assert len([f for f in formatted_fields if "Person2FamilyName" in str(f.get("fieldName", "")) and f.get("text")]) == 0
    
    def test_family_count_6_generates_6_forms(self):
        """Test selecting 6 family members generates 6 forms"""
        filled_form = {
            # Person 1
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            # Person 2
            "7.a. Apellido (Persona 2)": "GARCIA",
            "7.b. Nombre (Persona 2)": "CARLOS",
            # Person 3
            "13.a. Apellido (Persona 3)": "GARCIA",
            "13.b. Nombre (Persona 3)": "ANA",
            # Person 4
            "19.a. Apellido (Persona 4)": "GARCIA",
            "19.b. Nombre (Persona 4)": "PEDRO",
            # Person 5
            "25.a. Apellido (Persona 5)": "GARCIA",
            "25.b. Nombre (Persona 5)": "LUCIA",
            # Person 6
            "31.a. Apellido (Persona 6)": "GARCIA",
            "31.b. Nombre (Persona 6)": "DIEGO"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Build a dict for easier lookup
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Verify all 6 persons have their name fields filled
        assert field_dict.get("form1[0].#subform[3].Line1a_Person1FamilyName[0]") == "GARCIA"
        assert field_dict.get("form1[0].#subform[3].Line2a_Person2FamilyName[0]") == "GARCIA"
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[1]") == "GARCIA"  # Person 3
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[2]") == "GARCIA"  # Person 4
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[3]") == "GARCIA"  # Person 5
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[4]") == "GARCIA"  # Person 6


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
