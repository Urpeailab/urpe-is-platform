"""
Test I-140 N8N PDF Backend Mapping - Iteration 18
Tests the specific backend mapping requirements:
1. Part 6 items 4, 6, 7 = Yes (hardcoded)
2. Part 4 item 7 = No (hardcoded)
3. Part 3 items 11.b and 15 swapped correctly
4. Country of birth copied to nationality
5. Family members (spouse/children) mapped correctly
"""
import pytest
import sys
import os

# Add backend path for imports
sys.path.insert(0, '/app/backend/data')

from i140_n8n_pdf_mapping import fill_i140_form_n8n, get_field_mapping, normalize_country, format_date


class TestPart6HardcodedYes:
    """Test Part 6 items 4, 6, 7 are always Yes"""
    
    def test_part6_item4_fulltime_yes(self):
        """Part 6 - 4. Is this a full-time position? = Yes (hardcoded)"""
        result = fill_i140_form_n8n({})
        fields = result.get("fields", [])
        
        # Find the fulltime YES field
        fulltime_yes_field = "form1[0].#subform[3].Line4_Yes1[0]"
        found = False
        for field in fields:
            if field.get("fieldName") == fulltime_yes_field:
                assert field.get("text") == "X", f"Part 6 item 4 should be 'X' (Yes), got: {field.get('text')}"
                found = True
                print(f"✅ Part 6 item 4 (Full-time position) = Yes (X)")
                break
        
        assert found, f"Part 6 item 4 (Full-time) YES field not found: {fulltime_yes_field}"
    
    def test_part6_item6_permanent_yes(self):
        """Part 6 - 6. Is this a permanent position? = Yes (hardcoded)"""
        result = fill_i140_form_n8n({})
        fields = result.get("fields", [])
        
        # Find the permanent YES field
        permanent_yes_field = "form1[0].#subform[3].Line6_Yes1[0]"
        found = False
        for field in fields:
            if field.get("fieldName") == permanent_yes_field:
                assert field.get("text") == "X", f"Part 6 item 6 should be 'X' (Yes), got: {field.get('text')}"
                found = True
                print(f"✅ Part 6 item 6 (Permanent position) = Yes (X)")
                break
        
        assert found, f"Part 6 item 6 (Permanent) YES field not found: {permanent_yes_field}"
    
    def test_part6_item7_new_position_yes(self):
        """Part 6 - 7. Is this a new position? = Yes (hardcoded)"""
        result = fill_i140_form_n8n({})
        fields = result.get("fields", [])
        
        # Find the new position YES field
        new_position_yes_field = "form1[0].#subform[3].Line7_Yes1[0]"
        found = False
        for field in fields:
            if field.get("fieldName") == new_position_yes_field:
                assert field.get("text") == "X", f"Part 6 item 7 should be 'X' (Yes), got: {field.get('text')}"
                found = True
                print(f"✅ Part 6 item 7 (New position) = Yes (X)")
                break
        
        assert found, f"Part 6 item 7 (New position) YES field not found: {new_position_yes_field}"


class TestPart4Item7HardcodedNo:
    """Test Part 4 item 7 is always No"""
    
    def test_part4_item7_deportation_no(self):
        """Part 4 - Item 7: Is beneficiary in removal/deportation proceedings? = No (hardcoded)"""
        result = fill_i140_form_n8n({})
        fields = result.get("fields", [])
        
        # Find the deportation NO field
        deportation_no_field = "form1[0].#subform[2].Line5_No[0]"
        found = False
        for field in fields:
            if field.get("fieldName") == deportation_no_field:
                assert field.get("text") == "X", f"Part 4 item 7 should be 'X' (No), got: {field.get('text')}"
                found = True
                print(f"✅ Part 4 item 7 (Deportation proceedings) = No (X)")
                break
        
        assert found, f"Part 4 item 7 (Deportation) NO field not found: {deportation_no_field}"


class TestPart3FieldSwap:
    """Test Part 3 items 11.b and 15 are swapped correctly"""
    
    def test_field_mapping_11b_and_15_swapped(self):
        """Verify field mapping has 11.b and 15 correctly mapped"""
        field_mapping = get_field_mapping()
        
        # 11.b. Fecha de Vencimiento de Estadía Autorizada en I-94 -> Line14e_ExpDate[1]
        field_11b = field_mapping.get("11.b. Fecha de Vencimiento de Estadía Autorizada en I-94")
        assert field_11b == "form1[0].#subform[1].Line14e_ExpDate[1]", \
            f"11.b should map to Line14e_ExpDate[1], got: {field_11b}"
        print(f"✅ 11.b maps to: {field_11b}")
        
        # 15. Fecha de Vencimiento del Pasaporte o Documento de Viaje -> Line14e_ExpDate[0]
        field_15 = field_mapping.get("15. Fecha de Vencimiento del Pasaporte o Documento de Viaje")
        assert field_15 == "form1[0].#subform[1].Line14e_ExpDate[0]", \
            f"15 should map to Line14e_ExpDate[0], got: {field_15}"
        print(f"✅ 15 maps to: {field_15}")
        
        # Verify they are different (swapped)
        assert field_11b != field_15, "11.b and 15 should map to different fields"
        print(f"✅ 11.b and 15 are correctly swapped (different PDF fields)")
    
    def test_fill_form_with_11b_and_15_data(self):
        """Test filling form with 11.b and 15 data"""
        test_data = {
            "11.b. Fecha de Vencimiento de Estadía Autorizada en I-94": "12/31/2025",
            "15. Fecha de Vencimiento del Pasaporte o Documento de Viaje": "06/15/2030"
        }
        
        result = fill_i140_form_n8n(test_data)
        fields = result.get("fields", [])
        
        # Check 11.b is mapped to Line14e_ExpDate[1]
        found_11b = False
        found_15 = False
        
        for field in fields:
            field_name = field.get("fieldName", "")
            text = field.get("text", "")
            
            if field_name == "form1[0].#subform[1].Line14e_ExpDate[1]":
                assert text == "12/31/2025", f"11.b value should be '12/31/2025', got: {text}"
                found_11b = True
                print(f"✅ 11.b (I-94 expiration) = {text}")
            
            if field_name == "form1[0].#subform[1].Line14e_ExpDate[0]":
                assert text == "06/15/2030", f"15 value should be '06/15/2030', got: {text}"
                found_15 = True
                print(f"✅ 15 (Passport expiration) = {text}")
        
        assert found_11b, "11.b field not found in output"
        assert found_15, "15 field not found in output"


class TestCountryOfBirthToNationality:
    """Test country of birth is copied to nationality"""
    
    def test_country_of_birth_copies_to_nationality(self):
        """Country of Birth (item 6) should be copied to Country of Citizenship (item 7)"""
        test_data = {
            "6. País de Nacimiento": "Colombia"
        }
        
        result = fill_i140_form_n8n(test_data)
        fields = result.get("fields", [])
        
        # PDF fields:
        # Line8_Country[0] = Country of Birth (item 6)
        # Line9_Country[0] = Country of Citizenship/Nationality (item 7)
        
        country_of_birth_field = "form1[0].#subform[1].Line8_Country[0]"
        nationality_field = "form1[0].#subform[1].Line9_Country[0]"
        
        found_birth = False
        found_nationality = False
        birth_value = None
        nationality_value = None
        
        for field in fields:
            field_name = field.get("fieldName", "")
            text = field.get("text", "")
            
            if field_name == country_of_birth_field:
                birth_value = text
                found_birth = True
                print(f"✅ Country of Birth (item 6) = {text}")
            
            if field_name == nationality_field:
                nationality_value = text
                found_nationality = True
                print(f"✅ Country of Citizenship (item 7) = {text}")
        
        assert found_birth, f"Country of Birth field not found: {country_of_birth_field}"
        assert found_nationality, f"Nationality field not found: {nationality_field}"
        
        # Both should have the same normalized value
        assert birth_value == nationality_value, \
            f"Country of Birth ({birth_value}) should equal Nationality ({nationality_value})"
        
        # Should be normalized to "REPUBLIC OF COLOMBIA"
        assert "COLOMBIA" in birth_value.upper(), f"Expected Colombia, got: {birth_value}"
        print(f"✅ Country of Birth correctly copied to Nationality: {birth_value}")
    
    def test_various_countries_normalize_correctly(self):
        """Test various countries normalize and copy correctly"""
        test_countries = [
            ("Mexico", "MEXICO"),
            ("Argentina", "ARGENTINA"),
            ("Venezuela", "VENEZUELA"),
            ("Peru", "PERU"),
            ("Chile", "CHILE"),
        ]
        
        for input_country, expected_output in test_countries:
            test_data = {"6. País de Nacimiento": input_country}
            result = fill_i140_form_n8n(test_data)
            fields = result.get("fields", [])
            
            # Find nationality field
            for field in fields:
                if field.get("fieldName") == "form1[0].#subform[1].Line9_Country[0]":
                    assert expected_output in field.get("text", "").upper(), \
                        f"Expected {expected_output} in nationality for {input_country}, got: {field.get('text')}"
                    print(f"✅ {input_country} -> {field.get('text')}")
                    break


class TestFamilyMemberMapping:
    """Test family members (spouse/children) are mapped correctly"""
    
    def test_single_family_member_spouse(self):
        """Test mapping a single spouse"""
        test_data = {
            "1.a. Apellido (Persona 1)": "RODRIGUEZ",
            "1.b. Nombre (Persona 1)": "ANA",
            "1.c. Segundo Nombre (Persona 1)": "MARIA",
            "2. Fecha de Nacimiento (Persona 1)": "1985-03-15",
            "3. País de Nacimiento (Persona 1)": "Colombia",
            "4. Relación (Persona 1)": "Cónyuge",
            "5. ¿Solicitará ajuste de estatus? (Persona 1)": "Sí",
            "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No"
        }
        
        result = fill_i140_form_n8n(test_data)
        fields = result.get("fields", [])
        
        # Expected PDF fields for Person 1
        expected_mappings = {
            "form1[0].#subform[3].Line1a_Person1FamilyName[0]": "RODRIGUEZ",
            "form1[0].#subform[3].Line1b_Person1GivenName[0]": "ANA",
            "form1[0].#subform[3].Line1c_Person1MiddleName[0]": "MARIA",
            "form1[0].#subform[3].Line1d_Person1DateOfBirth[0]": "03/15/1985",
            "form1[0].#subform[3].Line1f_Relationship[0]": "Spouse",
        }
        
        for expected_field, expected_value in expected_mappings.items():
            found = False
            for field in fields:
                if field.get("fieldName") == expected_field:
                    actual_value = field.get("text", "")
                    assert actual_value == expected_value, \
                        f"Field {expected_field}: expected '{expected_value}', got '{actual_value}'"
                    found = True
                    print(f"✅ {expected_field} = {actual_value}")
                    break
            assert found, f"Field not found: {expected_field}"
        
        # Check adjustment of status YES checkbox
        adj_yes_found = False
        for field in fields:
            if field.get("fieldName") == "form1[0].#subform[3].Pt7ItemNumber5_CheckboxYes[0]":
                assert field.get("text") == "X", "Adjustment of Status should be Yes (X)"
                adj_yes_found = True
                print(f"✅ Person 1 Adjustment of Status = Yes (X)")
                break
        assert adj_yes_found, "Person 1 Adjustment of Status YES checkbox not found"
    
    def test_multiple_family_members(self):
        """Test mapping multiple family members (spouse + children)"""
        test_data = {
            # Person 1 - Spouse
            "1.a. Apellido (Persona 1)": "MARTINEZ",
            "1.b. Nombre (Persona 1)": "LUCIA",
            "4. Relación (Persona 1)": "Cónyuge",
            
            # Person 2 - Child
            "7.a. Apellido (Persona 2)": "GARCIA",
            "7.b. Nombre (Persona 2)": "CARLOS",
            "10. Relación (Persona 2)": "Hijo",
            
            # Person 3 - Child
            "13.a. Apellido (Persona 3)": "GARCIA",
            "13.b. Nombre (Persona 3)": "SOFIA",
            "16. Relación (Persona 3)": "Hijo/a",
        }
        
        result = fill_i140_form_n8n(test_data)
        fields = result.get("fields", [])
        
        # Check Person 1 (Spouse)
        person1_found = False
        for field in fields:
            if field.get("fieldName") == "form1[0].#subform[3].Line1a_Person1FamilyName[0]":
                assert field.get("text") == "MARTINEZ"
                person1_found = True
                print(f"✅ Person 1 (Spouse): MARTINEZ")
                break
        assert person1_found, "Person 1 not found"
        
        # Check Person 2 (Child)
        person2_found = False
        for field in fields:
            if field.get("fieldName") == "form1[0].#subform[3].Line2a_Person2FamilyName[0]":
                assert field.get("text") == "GARCIA"
                person2_found = True
                print(f"✅ Person 2 (Child): GARCIA")
                break
        assert person2_found, "Person 2 not found"
        
        # Check Person 3 (Child)
        person3_found = False
        for field in fields:
            if field.get("fieldName") == "form1[0].#subform[4].Line2a_Person2FamilyName[1]":
                assert field.get("text") == "GARCIA"
                person3_found = True
                print(f"✅ Person 3 (Child): GARCIA")
                break
        assert person3_found, "Person 3 not found"
    
    def test_relationship_normalization(self):
        """Test relationship values are normalized correctly"""
        test_cases = [
            ("Cónyuge", "Spouse"),
            ("Spouse", "Spouse"),
            ("Hijo", "Child"),
            ("Hijo/a", "Child"),
            ("Child", "Child"),
        ]
        
        for input_rel, expected_rel in test_cases:
            test_data = {
                "1.a. Apellido (Persona 1)": "TEST",
                "1.b. Nombre (Persona 1)": "PERSON",
                "4. Relación (Persona 1)": input_rel
            }
            
            result = fill_i140_form_n8n(test_data)
            fields = result.get("fields", [])
            
            for field in fields:
                if field.get("fieldName") == "form1[0].#subform[3].Line1f_Relationship[0]":
                    assert field.get("text") == expected_rel, \
                        f"Relationship '{input_rel}' should normalize to '{expected_rel}', got: {field.get('text')}"
                    print(f"✅ Relationship '{input_rel}' -> '{expected_rel}'")
                    break


class TestDebugOutput:
    """Test debug output from fill_i140_form_n8n"""
    
    def test_debug_info_present(self):
        """Test that debug info is present in output"""
        result = fill_i140_form_n8n({})
        
        assert "fields" in result, "No 'fields' key in result"
        assert "debug" in result, "No 'debug' key in result"
        
        debug = result.get("debug", {})
        print(f"✅ Debug info: {debug}")
        
        # Check fields count
        fields = result.get("fields", [])
        assert len(fields) > 0, "No fields generated"
        print(f"✅ Generated {len(fields)} fields")


class TestHardcodedCheckboxes:
    """Test all hardcoded checkboxes are set correctly"""
    
    def test_all_hardcoded_checkboxes(self):
        """Verify all hardcoded checkboxes are present"""
        result = fill_i140_form_n8n({})
        fields = result.get("fields", [])
        
        # Expected hardcoded checkboxes
        expected_checkboxes = {
            # Part 2, 1.h: NIW
            "form1[0].#subform[1].prt2PetitionType[6]": "X",
            # Part 4 - Questions 6.a, 8, 9, 10 = No
            "form1[0].#subform[2].Line4_No[0]": "X",  # 6.a
            "form1[0].#subform[2].Line6_No[0]": "X",  # 8
            "form1[0].#subform[2].Line7_No[0]": "X",  # 9
            "form1[0].#subform[2].Line8_No[0]": "X",  # 10
            # Part 4, Item 7: Deportation = No
            "form1[0].#subform[2].Line5_No[0]": "X",
            # Part 5, 1.b: Self
            "form1[0].#subform[2].Line1b_Self[0]": "X",
            # Part 6 - Items 4, 6, 7 = Yes
            "form1[0].#subform[3].Line4_Yes1[0]": "X",  # Full-time
            "form1[0].#subform[3].Line6_Yes1[0]": "X",  # Permanent
            "form1[0].#subform[3].Line7_Yes1[0]": "X",  # New position
        }
        
        for expected_field, expected_value in expected_checkboxes.items():
            found = False
            for field in fields:
                if field.get("fieldName") == expected_field:
                    assert field.get("text") == expected_value, \
                        f"Checkbox {expected_field}: expected '{expected_value}', got '{field.get('text')}'"
                    found = True
                    print(f"✅ {expected_field} = {expected_value}")
                    break
            assert found, f"Hardcoded checkbox not found: {expected_field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
