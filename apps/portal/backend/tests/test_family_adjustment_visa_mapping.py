"""
Test Family Member Adjustment of Status and Visa Abroad Mapping
Tests the new fields added to Part 7 of the I-140 form for family members.
"""

import pytest
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data.i140_n8n_pdf_mapping import (
    fill_i140_form_n8n,
    get_field_mapping,
    normalize_yes_no
)


class TestFamilyAdjustmentVisaMapping:
    """Test the new Adjustment of Status and Visa Abroad fields for family members"""
    
    def test_field_mapping_exists_for_person1_adjustment(self):
        """Test that Person 1 Adjustment of Status fields exist in mapping"""
        field_mapping = get_field_mapping()
        
        # Check Yes/No checkbox fields for Person 1 Adjustment
        assert "5. ¿Solicitará ajuste de estatus? (Persona 1)_Yes" in field_mapping
        assert "5. ¿Solicitará ajuste de estatus? (Persona 1)_No" in field_mapping
        
        # Verify PDF field names
        assert field_mapping["5. ¿Solicitará ajuste de estatus? (Persona 1)_Yes"] == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]"
        assert field_mapping["5. ¿Solicitará ajuste de estatus? (Persona 1)_No"] == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]"
    
    def test_field_mapping_exists_for_person1_visa_abroad(self):
        """Test that Person 1 Visa Abroad fields exist in mapping"""
        field_mapping = get_field_mapping()
        
        # Check Yes/No checkbox fields for Person 1 Visa Abroad
        assert "6. ¿Solicitará visa en el extranjero? (Persona 1)_Yes" in field_mapping
        assert "6. ¿Solicitará visa en el extranjero? (Persona 1)_No" in field_mapping
        
        # Verify PDF field names
        assert field_mapping["6. ¿Solicitará visa en el extranjero? (Persona 1)_Yes"] == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]"
        assert field_mapping["6. ¿Solicitará visa en el extranjero? (Persona 1)_No"] == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]"
    
    def test_field_mapping_exists_for_person2_adjustment(self):
        """Test that Person 2 Adjustment of Status fields exist in mapping (ItemNumber11)"""
        field_mapping = get_field_mapping()
        
        # Check Yes/No checkbox fields for Person 2 Adjustment
        assert "11. ¿Solicitará ajuste de estatus? (Persona 2)_Yes" in field_mapping
        assert "11. ¿Solicitará ajuste de estatus? (Persona 2)_No" in field_mapping
        
        # Verify PDF field names use ItemNumber11
        assert field_mapping["11. ¿Solicitará ajuste de estatus? (Persona 2)_Yes"] == "form1[0].#subform[3].Pt7ItemNumber11_CheckboxYes[0]"
        assert field_mapping["11. ¿Solicitará ajuste de estatus? (Persona 2)_No"] == "form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]"
    
    def test_field_mapping_exists_for_person2_visa_abroad(self):
        """Test that Person 2 Visa Abroad fields exist in mapping (ItemNumber12)"""
        field_mapping = get_field_mapping()
        
        # Check Yes/No checkbox fields for Person 2 Visa Abroad
        assert "12. ¿Solicitará visa en el extranjero? (Persona 2)_Yes" in field_mapping
        assert "12. ¿Solicitará visa en el extranjero? (Persona 2)_No" in field_mapping
        
        # Verify PDF field names use ItemNumber12
        assert field_mapping["12. ¿Solicitará visa en el extranjero? (Persona 2)_Yes"] == "form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]"
        assert field_mapping["12. ¿Solicitará visa en el extranjero? (Persona 2)_No"] == "form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]"
    
    def test_person1_adjustment_yes_mapping(self):
        """Test Person 1 Adjustment of Status = Yes maps correctly"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment checkbox field
        adjustment_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]":
                adjustment_yes_field = field
                break
        
        assert adjustment_yes_field is not None, "Person 1 Adjustment Yes checkbox not found"
        assert adjustment_yes_field.get("text") == "X"
    
    def test_person1_adjustment_no_mapping(self):
        """Test Person 1 Adjustment of Status = No maps correctly"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment checkbox field
        adjustment_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]":
                adjustment_no_field = field
                break
        
        assert adjustment_no_field is not None, "Person 1 Adjustment No checkbox not found"
        assert adjustment_no_field.get("text") == "X"
    
    def test_person1_visa_abroad_yes_mapping(self):
        """Test Person 1 Visa Abroad = Yes maps correctly"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa abroad checkbox field
        visa_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]":
                visa_yes_field = field
                break
        
        assert visa_yes_field is not None, "Person 1 Visa Abroad Yes checkbox not found"
        assert visa_yes_field.get("text") == "X"
    
    def test_person1_visa_abroad_no_mapping(self):
        """Test Person 1 Visa Abroad = No maps correctly"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa abroad checkbox field
        visa_no_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]":
                visa_no_field = field
                break
        
        assert visa_no_field is not None, "Person 1 Visa Abroad No checkbox not found"
        assert visa_no_field.get("text") == "X"
    
    def test_person2_adjustment_yes_mapping(self):
        """Test Person 2 Adjustment of Status = Yes maps to ItemNumber11"""
        filled_form = {
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the adjustment checkbox field for Person 2
        adjustment_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber11_CheckboxYes[0]":
                adjustment_yes_field = field
                break
        
        assert adjustment_yes_field is not None, "Person 2 Adjustment Yes checkbox (ItemNumber11) not found"
        assert adjustment_yes_field.get("text") == "X"
    
    def test_person2_visa_abroad_yes_mapping(self):
        """Test Person 2 Visa Abroad = Yes maps to ItemNumber12"""
        filled_form = {
            "7.a. Apellido (Persona 2)": "LOPEZ",
            "7.b. Nombre (Persona 2)": "JUAN",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Find the visa abroad checkbox field for Person 2
        visa_yes_field = None
        for field in formatted_fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]":
                visa_yes_field = field
                break
        
        assert visa_yes_field is not None, "Person 2 Visa Abroad Yes checkbox (ItemNumber12) not found"
        assert visa_yes_field.get("text") == "X"
    
    def test_normalize_yes_no_function(self):
        """Test the normalize_yes_no helper function"""
        # Test Spanish "Sí"
        assert normalize_yes_no("Sí") == "Yes"
        assert normalize_yes_no("sí") == "Yes"
        
        # Test English "Yes"
        assert normalize_yes_no("Yes") == "Yes"
        assert normalize_yes_no("yes") == "Yes"
        
        # Test "No"
        assert normalize_yes_no("No") == "No"
        assert normalize_yes_no("no") == "No"
        
        # Test empty
        assert normalize_yes_no("") == ""
        assert normalize_yes_no(None) == ""
    
    def test_complete_family_member_with_all_fields(self):
        """Test a complete family member with all required fields including new ones"""
        filled_form = {
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "1.c. Segundo Nombre (Persona 1)": "ELENA",
            "2. Fecha de Nacimiento (Persona 1)": "1990-05-15",
            "3. País de Nacimiento (Persona 1)": "Colombia",
            "4. Relación (Persona 1)": "Cónyuge",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "Yes",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Verify all fields are mapped
        field_names = [f.get("fieldName") for f in formatted_fields]
        
        # Check name fields
        assert "form1[0].#subform[3].Line1a_Person1FamilyName[0]" in field_names
        assert "form1[0].#subform[3].Line1b_Person1GivenName[0]" in field_names
        
        # Check adjustment and visa checkboxes
        assert "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]" in field_names
        assert "form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]" in field_names
    
    def test_multiple_family_members_with_different_choices(self):
        """Test multiple family members with different adjustment/visa choices"""
        filled_form = {
            # Person 1 - Adjustment Yes, Visa No
            "1.a. Apellido (Persona 1)": "GARCIA",
            "1.b. Nombre (Persona 1)": "MARIA",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "Yes",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No",
            
            # Person 2 - Adjustment No, Visa Yes
            "7.a. Apellido (Persona 2)": "GARCIA",
            "7.b. Nombre (Persona 2)": "CARLOS",
            "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No",
            "12. ¿Solicitará visa en el extranjero? (Persona 2)": "Yes"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Build a dict for easier lookup
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Person 1: Adjustment Yes, Visa No
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]") == "X"
        
        # Person 2: Adjustment No, Visa Yes
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]") == "X"


class TestFieldMappingConstants:
    """Test that the field mapping constants are correctly defined"""
    
    def test_person_adjustment_constants(self):
        """Test PERSON_ADJUSTMENT constants exist"""
        field_mapping = get_field_mapping()
        
        # Check all 6 persons have adjustment constants
        assert "PERSON1_ADJUSTMENT_YES" in field_mapping
        assert "PERSON1_ADJUSTMENT_NO" in field_mapping
        assert "PERSON2_ADJUSTMENT_YES" in field_mapping
        assert "PERSON2_ADJUSTMENT_NO" in field_mapping
        assert "PERSON3_ADJUSTMENT_YES" in field_mapping
        assert "PERSON3_ADJUSTMENT_NO" in field_mapping
        assert "PERSON4_ADJUSTMENT_YES" in field_mapping
        assert "PERSON4_ADJUSTMENT_NO" in field_mapping
        assert "PERSON5_ADJUSTMENT_YES" in field_mapping
        assert "PERSON5_ADJUSTMENT_NO" in field_mapping
        assert "PERSON6_ADJUSTMENT_YES" in field_mapping
        assert "PERSON6_ADJUSTMENT_NO" in field_mapping
    
    def test_person_visa_abroad_constants(self):
        """Test PERSON_VISA_ABROAD constants exist"""
        field_mapping = get_field_mapping()
        
        # Check all 6 persons have visa abroad constants
        assert "PERSON1_VISA_ABROAD_YES" in field_mapping
        assert "PERSON1_VISA_ABROAD_NO" in field_mapping
        assert "PERSON2_VISA_ABROAD_YES" in field_mapping
        assert "PERSON2_VISA_ABROAD_NO" in field_mapping
        assert "PERSON3_VISA_ABROAD_YES" in field_mapping
        assert "PERSON3_VISA_ABROAD_NO" in field_mapping
        assert "PERSON4_VISA_ABROAD_YES" in field_mapping
        assert "PERSON4_VISA_ABROAD_NO" in field_mapping
        assert "PERSON5_VISA_ABROAD_YES" in field_mapping
        assert "PERSON5_VISA_ABROAD_NO" in field_mapping
        assert "PERSON6_VISA_ABROAD_YES" in field_mapping
        assert "PERSON6_VISA_ABROAD_NO" in field_mapping
    
    def test_pdf_field_names_for_persons_3_to_6(self):
        """Test PDF field names for Persons 3-6 are on correct subform"""
        field_mapping = get_field_mapping()
        
        # Persons 3-6 should be on subform[4] (Page 5)
        assert "form1[0].#subform[4]" in field_mapping["PERSON3_ADJUSTMENT_YES"]
        assert "form1[0].#subform[4]" in field_mapping["PERSON4_ADJUSTMENT_YES"]
        assert "form1[0].#subform[4]" in field_mapping["PERSON5_ADJUSTMENT_YES"]
        assert "form1[0].#subform[4]" in field_mapping["PERSON6_ADJUSTMENT_YES"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
