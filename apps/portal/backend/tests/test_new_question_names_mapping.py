"""
Test Backend Mapping with New Question Names Format
Tests that the new question format 'Persona X - Apellido' etc. maps correctly to PDF fields.

New Question Format (from PreValidationFormContent.js):
- 'Persona 1 - Apellido' instead of '1.a. Apellido (Persona 1)'
- 'Persona 1 - Nombre' instead of '1.b. Nombre (Persona 1)'
- 'Persona 1 - Adjustment of Status' (auto-filled, not visible in UI)
- 'Persona 1 - Visa Abroad' (auto-filled, not visible in UI)

Auto-fill Logic:
- Proceso Consular: Adjustment=No, Visa=Sí
- Dentro EEUU: Adjustment=No, Visa=No
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


class TestNewQuestionNamesMapping:
    """Test that new question name format maps correctly to PDF fields"""
    
    def test_persona1_apellido_maps_correctly(self):
        """Test 'Persona 1 - Apellido' maps to correct PDF field"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        # Build a dict for easier lookup
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Should map to Person 1 Family Name field
        assert field_dict.get("form1[0].#subform[3].Line1a_Person1FamilyName[0]") == "GARCIA"
    
    def test_persona1_nombre_maps_correctly(self):
        """Test 'Persona 1 - Nombre' maps to correct PDF field"""
        filled_form = {
            "Persona 1 - Nombre": "MARIA"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[3].Line1b_Person1GivenName[0]") == "MARIA"
    
    def test_persona1_segundo_nombre_maps_correctly(self):
        """Test 'Persona 1 - Segundo Nombre' maps to correct PDF field (requires name)"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",  # Required to trigger processing
            "Persona 1 - Segundo Nombre": "ELENA"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[3].Line1c_Person1MiddleName[0]") == "ELENA"
    
    def test_persona1_fecha_nacimiento_maps_correctly(self):
        """Test 'Persona 1 - Fecha de Nacimiento' maps to correct PDF field (requires name)"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",  # Required to trigger processing
            "Persona 1 - Fecha de Nacimiento": "1990-05-15"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Date should be formatted as MM/DD/YYYY
        assert field_dict.get("form1[0].#subform[3].Line1d_Person1DateOfBirth[0]") == "05/15/1990"
    
    def test_persona1_pais_nacimiento_maps_correctly(self):
        """Test 'Persona 1 - País de Nacimiento' maps to correct PDF field (requires name)"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",  # Required to trigger processing
            "Persona 1 - País de Nacimiento": "Colombia"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Country normalization returns full official name
        assert field_dict.get("form1[0].#subform[3].Line1e_CountryOfBirth[0]") == "REPUBLIC OF COLOMBIA"
    
    def test_persona1_relacion_maps_correctly(self):
        """Test 'Persona 1 - Relación con el Beneficiario' maps to correct PDF field (requires name)"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",  # Required to trigger processing
            "Persona 1 - Relación con el Beneficiario": "Spouse"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[3].Line1f_Relationship[0]") == "Spouse"


class TestNewQuestionNamesAdjustmentVisa:
    """Test Adjustment/Visa auto-fill with new question names"""
    
    def test_persona1_adjustment_no_consular(self):
        """Test 'Persona 1 - Adjustment of Status' = No for Consular Processing"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",
            "Persona 1 - Nombre": "MARIA",
            "Persona 1 - Adjustment of Status": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Should mark the No checkbox
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]") == "X"
    
    def test_persona1_visa_yes_consular(self):
        """Test 'Persona 1 - Visa Abroad' = Sí for Consular Processing"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",
            "Persona 1 - Nombre": "MARIA",
            "Persona 1 - Visa Abroad": "Sí"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Should mark the Yes checkbox
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]") == "X"
    
    def test_persona1_visa_no_usa(self):
        """Test 'Persona 1 - Visa Abroad' = No for USA Processing"""
        filled_form = {
            "Persona 1 - Apellido": "GARCIA",
            "Persona 1 - Nombre": "MARIA",
            "Persona 1 - Visa Abroad": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Should mark the No checkbox
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]") == "X"


class TestNewQuestionNamesPersona2to6:
    """Test new question names for Personas 2-6"""
    
    def test_persona2_fields_map_correctly(self):
        """Test Persona 2 fields map to correct PDF fields"""
        filled_form = {
            "Persona 2 - Apellido": "LOPEZ",
            "Persona 2 - Nombre": "JUAN",
            "Persona 2 - Fecha de Nacimiento": "1985-03-20",
            "Persona 2 - País de Nacimiento": "México",
            "Persona 2 - Relación con el Beneficiario": "Child"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[3].Line2a_Person2FamilyName[0]") == "LOPEZ"
        assert field_dict.get("form1[0].#subform[3].Line2b_Person2GivenName[0]") == "JUAN"
        assert field_dict.get("form1[0].#subform[3].Line2d_DateOfBirth[0]") == "03/20/1985"
        # Country normalization preserves accents for Spanish countries
        assert field_dict.get("form1[0].#subform[3].Line2e_CountryOfBirth[0]") == "MÉXICO"
        assert field_dict.get("form1[0].#subform[3].Line2f_Relationship[0]") == "Child"
    
    def test_persona3_fields_map_correctly(self):
        """Test Persona 3 fields map to correct PDF fields"""
        filled_form = {
            "Persona 3 - Apellido": "MARTINEZ",
            "Persona 3 - Nombre": "ANA"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[1]") == "MARTINEZ"
        assert field_dict.get("form1[0].#subform[4].Line2b_Person2GivenName[1]") == "ANA"
    
    def test_persona4_fields_map_correctly(self):
        """Test Persona 4 fields map to correct PDF fields"""
        filled_form = {
            "Persona 4 - Apellido": "RODRIGUEZ",
            "Persona 4 - Nombre": "PEDRO"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[2]") == "RODRIGUEZ"
        assert field_dict.get("form1[0].#subform[4].Line2b_Person2GivenName[2]") == "PEDRO"
    
    def test_persona5_fields_map_correctly(self):
        """Test Persona 5 fields map to correct PDF fields"""
        filled_form = {
            "Persona 5 - Apellido": "SANCHEZ",
            "Persona 5 - Nombre": "LUCIA"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[3]") == "SANCHEZ"
        assert field_dict.get("form1[0].#subform[4].Line2b_Person2GivenName[3]") == "LUCIA"
    
    def test_persona6_fields_map_correctly(self):
        """Test Persona 6 fields map to correct PDF fields"""
        filled_form = {
            "Persona 6 - Apellido": "FERNANDEZ",
            "Persona 6 - Nombre": "DIEGO"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        assert field_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[4]") == "FERNANDEZ"
        assert field_dict.get("form1[0].#subform[4].Line2b_Person2GivenName[4]") == "DIEGO"


class TestConsularProcessingAutoFillNewFormat:
    """Test Consular Processing auto-fill with new question format"""
    
    def test_consular_2_family_members_adjustment_visa(self):
        """Test 2 family members with Consular: Adjustment=No, Visa=Sí"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
            # Person 1 - new format
            "Persona 1 - Apellido": "GARCIA",
            "Persona 1 - Nombre": "MARIA",
            "Persona 1 - Adjustment of Status": "No",
            "Persona 1 - Visa Abroad": "Sí",
            # Person 2 - new format
            "Persona 2 - Apellido": "GARCIA",
            "Persona 2 - Nombre": "CARLOS",
            "Persona 2 - Adjustment of Status": "No",
            "Persona 2 - Visa Abroad": "Sí"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Person 1: Adjustment No, Visa Yes
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxYes[0]") == "X"
        
        # Person 2: Adjustment No, Visa Yes
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber12_CheckboxYes[0]") == "X"


class TestUSAProcessingAutoFillNewFormat:
    """Test USA Processing auto-fill with new question format"""
    
    def test_usa_2_family_members_adjustment_visa(self):
        """Test 2 family members with USA: Adjustment=No, Visa=No"""
        filled_form = {
            "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
            # Person 1 - new format
            "Persona 1 - Apellido": "GARCIA",
            "Persona 1 - Nombre": "MARIA",
            "Persona 1 - Adjustment of Status": "No",
            "Persona 1 - Visa Abroad": "No",
            # Person 2 - new format
            "Persona 2 - Apellido": "GARCIA",
            "Persona 2 - Nombre": "CARLOS",
            "Persona 2 - Adjustment of Status": "No",
            "Persona 2 - Visa Abroad": "No"
        }
        
        result = fill_i140_form_n8n(filled_form)
        formatted_fields = result.get("fields", [])
        
        field_dict = {f.get("fieldName"): f.get("text") for f in formatted_fields}
        
        # Person 1: Adjustment No, Visa No
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber5_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber6_CheckboxNo[0]") == "X"
        
        # Person 2: Adjustment No, Visa No
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber11_CheckboxNo[0]") == "X"
        assert field_dict.get("form1[0].#subform[3].Pt7ItemNumber12_CheckboxNo[0]") == "X"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
