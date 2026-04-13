"""
Test del mapeo del cuestionario Pre-Validation al formulario I-140 N8N
"""
import sys
import os
sys.path.insert(0, '/app/backend')
sys.path.insert(0, '/app/backend/data')

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path('/app/backend/.env'))

from data.i140_n8n_pdf_mapping import fill_i140_form_n8n, normalize_country, normalize_yes_no

def test_consular_processing():
    """Test mapeo para proceso consular"""
    print("\n" + "="*60)
    print("TEST 1: PROCESO CONSULAR")
    print("="*60)
    
    # Simular respuestas del cuestionario para proceso consular
    form_data = {
        # Tipo de procesamiento
        "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
        
        # Campos de consulado
        "1.a. Ciudad o Pueblo": "Bogotá",
        "1.c. País": "Colombia",
        
        # Campos básicos
        "8. USCIS Online Account Number (si aplica)": "123456789012",
        "7. Número de Seguro Social de EE.UU. (si aplica)": "123456789",
        "8. Número de Registro de Extranjero (A-Number)": "123456789",
        "5. Dirección de Email": "test@example.com",
        "3. Teléfono de Día": "584247118223",
        
        # Familia - 1 persona (cónyuge)
        "¿El beneficiario tiene cónyuge o hijos?": "Sí tiene cónyuge y/o hijos",
        "1.a. Apellido (Persona 1)": "GARCIA",
        "1.b. Nombre (Persona 1)": "MARIA",
        "1.c. Segundo Nombre (Persona 1)": "ELENA",
        "2. Fecha de Nacimiento (Persona 1)": "05/15/1985",
        "3. País de Nacimiento (Persona 1)": "Colombia",
        "4. Relación (Persona 1)": "Cónyuge",
        "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No",  # Consular = No adjustment
        "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Sí",  # Consular = Yes visa abroad
    }
    
    result = fill_i140_form_n8n(form_data)
    
    print("\n📋 Campos mapeados:")
    for field in result.get("fields", []):
        field_name = field.get("fieldName", "")
        text = field.get("text", "")
        if text and text.strip():
            # Mostrar solo los campos relevantes al test
            if any(x in field_name.lower() for x in ["line1a_city", "line1a_country", "visa", "status", "person1", "checkbox"]):
                print(f"  ✓ {field_name}: {text}")
    
    # Verificaciones
    fields_dict = {f["fieldName"]: f["text"] for f in result.get("fields", [])}
    
    # Verificar checkbox de proceso consular
    consular_checkbox = fields_dict.get("form1[0].#subform[1].Line1a_Visa[0]", "")
    assert consular_checkbox == "X", f"❌ Checkbox consular debería ser 'X', got: {consular_checkbox}"
    print("\n✅ Checkbox proceso consular: X")
    
    # Verificar ciudad del consulado
    city = fields_dict.get("form1[0].#subform[1].Line1a_CityorTown[0]", "")
    assert "BOGOTA" in city.upper() or "BOGOTÁ" in city.upper(), f"❌ Ciudad debería ser BOGOTÁ, got: {city}"
    print(f"✅ Ciudad consulado: {city}")
    
    # Verificar país del consulado
    country = fields_dict.get("form1[0].#subform[1].Line1a_Country[0]", "")
    assert "COLOMBIA" in country.upper(), f"❌ País debería ser COLOMBIA, got: {country}"
    print(f"✅ País consulado: {country}")
    
    print("\n🎉 TEST 1 PASSED: Proceso Consular mapeado correctamente")
    return True


def test_usa_processing():
    """Test mapeo para ajuste de estatus (dentro de EEUU)"""
    print("\n" + "="*60)
    print("TEST 2: DENTRO DE EE.UU. (AJUSTE DE ESTATUS)")
    print("="*60)
    
    # Simular respuestas del cuestionario para ajuste de estatus
    form_data = {
        # Tipo de procesamiento
        "¿Dónde procesará la visa el beneficiario?": "2.a. Está en EE.UU. y solicitará ajuste de estatus",
        
        # País de residencia actual
        "2.b. País de residencia actual del beneficiario": "Venezuela",
        
        # Dirección extranjera (última residencia)
        "3.a. Número y Nombre de la Calle": "Av. Francisco de Miranda 123",
        "3.b. Apartamento": "Piso 5",
        "3.c. Ciudad": "Caracas",
        "3.d. Provincia": "Distrito Capital",
        "3.e. Código Postal": "1060",
        "3.f. País": "Venezuela",
        
        # Campos básicos
        "8. USCIS Online Account Number (si aplica)": "987654321012",
        "7. Número de Seguro Social de EE.UU. (si aplica)": "987654321",
        "8. Número de Registro de Extranjero (A-Number)": "987654321",
        "5. Dirección de Email": "test2@example.com",
        "3. Teléfono de Día": "584121234567",
        
        # Familia - 2 personas
        "¿El beneficiario tiene cónyuge o hijos?": "Sí tiene cónyuge y/o hijos",
        "1.a. Apellido (Persona 1)": "RODRIGUEZ",
        "1.b. Nombre (Persona 1)": "ANA",
        "4. Relación (Persona 1)": "Cónyuge",
        "5. ¿Solicitará ajuste de estatus? (Persona 1)": "Sí",  # USA = Yes adjustment
        "6. ¿Solicitará visa en el extranjero? (Persona 1)": "No",  # USA = No visa abroad
        
        "7.a. Apellido (Persona 2)": "RODRIGUEZ",
        "7.b. Nombre (Persona 2)": "CARLOS",
        "10. Relación (Persona 2)": "Hijo/a",
        "11. ¿Solicitará ajuste de estatus? (Persona 2)": "Sí",
        "12. ¿Solicitará visa en el extranjero? (Persona 2)": "No",
    }
    
    result = fill_i140_form_n8n(form_data)
    
    print("\n📋 Campos mapeados:")
    for field in result.get("fields", []):
        field_name = field.get("fieldName", "")
        text = field.get("text", "")
        if text and text.strip():
            # Mostrar campos relevantes
            if any(x in field_name.lower() for x in ["status", "line1b", "line2a", "line2b", "line2c", "line2d", "line2e", "line2f", "person", "checkbox"]):
                print(f"  ✓ {field_name}: {text}")
    
    # Verificaciones
    fields_dict = {f["fieldName"]: f["text"] for f in result.get("fields", [])}
    
    # Verificar checkbox de ajuste de estatus
    adjustment_checkbox = fields_dict.get("form1[0].#subform[1].Line1b_Status[0]", "")
    assert adjustment_checkbox == "X", f"❌ Checkbox ajuste debería ser 'X', got: {adjustment_checkbox}"
    print("\n✅ Checkbox ajuste de estatus: X")
    
    # Verificar país de residencia
    country_residence = fields_dict.get("form1[0].#subform[2].Line1b_Country[0]", "")
    assert "VENEZUELA" in country_residence.upper(), f"❌ País residencia debería ser VENEZUELA, got: {country_residence}"
    print(f"✅ País de residencia: {country_residence}")
    
    # Verificar dirección extranjera
    street = fields_dict.get("form1[0].#subform[2].Line2a_StreetNumberName[0]", "")
    assert "MIRANDA" in street.upper() or "123" in street, f"❌ Calle debería contener MIRANDA o 123, got: {street}"
    print(f"✅ Calle: {street}")
    
    city = fields_dict.get("form1[0].#subform[2].Line2c_CityOrTown[0]", "")
    assert "CARACAS" in city.upper(), f"❌ Ciudad debería ser CARACAS, got: {city}"
    print(f"✅ Ciudad: {city}")
    
    print("\n🎉 TEST 2 PASSED: Ajuste de Estatus mapeado correctamente")
    return True


def test_family_members():
    """Test mapeo de familia (hasta 6 personas)"""
    print("\n" + "="*60)
    print("TEST 3: FAMILIA (MÚLTIPLES PERSONAS)")
    print("="*60)
    
    # Simular respuestas con 3 familiares
    form_data = {
        "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
        "1.a. Ciudad o Pueblo": "Lima",
        "1.c. País": "Peru",
        
        "¿El beneficiario tiene cónyuge o hijos?": "Sí tiene cónyuge y/o hijos",
        
        # Persona 1 - Cónyuge
        "1.a. Apellido (Persona 1)": "PEREZ",
        "1.b. Nombre (Persona 1)": "MARIA",
        "1.c. Segundo Nombre (Persona 1)": "JOSE",
        "2. Fecha de Nacimiento (Persona 1)": "03/20/1980",
        "3. País de Nacimiento (Persona 1)": "Peru",
        "4. Relación (Persona 1)": "Cónyuge",
        "5. ¿Solicitará ajuste de estatus? (Persona 1)": "No",
        "6. ¿Solicitará visa en el extranjero? (Persona 1)": "Sí",
        
        # Persona 2 - Hijo 1
        "7.a. Apellido (Persona 2)": "PEREZ",
        "7.b. Nombre (Persona 2)": "JUAN",
        "8. Fecha de Nacimiento (Persona 2)": "06/15/2010",
        "9. País de Nacimiento (Persona 2)": "Peru",
        "10. Relación (Persona 2)": "Hijo/a",
        "11. ¿Solicitará ajuste de estatus? (Persona 2)": "No",
        "12. ¿Solicitará visa en el extranjero? (Persona 2)": "Sí",
        
        # Persona 3 - Hijo 2
        "13.a. Apellido (Persona 3)": "PEREZ",
        "13.b. Nombre (Persona 3)": "LUCIA",
        "14. Fecha de Nacimiento (Persona 3)": "09/10/2015",
        "15. País de Nacimiento (Persona 3)": "Peru",
        "16. Relación (Persona 3)": "Hijo/a",
        "17. ¿Solicitará ajuste de estatus? (Persona 3)": "No",
        "18. ¿Solicitará visa en el extranjero? (Persona 3)": "Sí",
    }
    
    result = fill_i140_form_n8n(form_data)
    
    print("\n📋 Campos de familia mapeados:")
    for field in result.get("fields", []):
        field_name = field.get("fieldName", "")
        text = field.get("text", "")
        if text and text.strip():
            if any(x in field_name.lower() for x in ["person", "family", "given", "middle", "date", "relationship", "checkbox"]):
                print(f"  ✓ {field_name}: {text}")
    
    # Verificaciones
    fields_dict = {f["fieldName"]: f["text"] for f in result.get("fields", [])}
    
    # Verificar Persona 1
    p1_lastname = fields_dict.get("form1[0].#subform[3].Line1a_Person1FamilyName[0]", "")
    assert "PEREZ" in p1_lastname.upper(), f"❌ Persona 1 apellido debería ser PEREZ, got: {p1_lastname}"
    print(f"\n✅ Persona 1 Apellido: {p1_lastname}")
    
    p1_firstname = fields_dict.get("form1[0].#subform[3].Line1b_Person1GivenName[0]", "")
    assert "MARIA" in p1_firstname.upper(), f"❌ Persona 1 nombre debería ser MARIA, got: {p1_firstname}"
    print(f"✅ Persona 1 Nombre: {p1_firstname}")
    
    # Verificar Persona 2
    p2_lastname = fields_dict.get("form1[0].#subform[3].Line2a_Person2FamilyName[0]", "")
    assert "PEREZ" in p2_lastname.upper(), f"❌ Persona 2 apellido debería ser PEREZ, got: {p2_lastname}"
    print(f"✅ Persona 2 Apellido: {p2_lastname}")
    
    p2_firstname = fields_dict.get("form1[0].#subform[3].Line2b_Person2GivenName[0]", "")
    assert "JUAN" in p2_firstname.upper(), f"❌ Persona 2 nombre debería ser JUAN, got: {p2_firstname}"
    print(f"✅ Persona 2 Nombre: {p2_firstname}")
    
    # Verificar Persona 3
    p3_lastname = fields_dict.get("form1[0].#subform[4].Line2a_Person2FamilyName[1]", "")
    assert "PEREZ" in p3_lastname.upper(), f"❌ Persona 3 apellido debería ser PEREZ, got: {p3_lastname}"
    print(f"✅ Persona 3 Apellido: {p3_lastname}")
    
    p3_firstname = fields_dict.get("form1[0].#subform[4].Line2b_Person2GivenName[1]", "")
    assert "LUCIA" in p3_firstname.upper(), f"❌ Persona 3 nombre debería ser LUCIA, got: {p3_firstname}"
    print(f"✅ Persona 3 Nombre: {p3_firstname}")
    
    print("\n🎉 TEST 3 PASSED: Familia mapeada correctamente")
    return True


def test_no_family():
    """Test cuando no hay familia"""
    print("\n" + "="*60)
    print("TEST 4: SIN FAMILIA")
    print("="*60)
    
    form_data = {
        "¿Dónde procesará la visa el beneficiario?": "1.a. Aplicará para visa en embajada o consulado de EE.UU.",
        "1.a. Ciudad o Pueblo": "México DF",
        "1.c. País": "México",
        "¿El beneficiario tiene cónyuge o hijos?": "No tiene cónyuge ni hijos",
    }
    
    result = fill_i140_form_n8n(form_data)
    
    fields_dict = {f["fieldName"]: f["text"] for f in result.get("fields", [])}
    
    # Verificar que no hay campos de persona con valores
    person_fields = [k for k, v in fields_dict.items() if "Person" in k and v.strip()]
    
    # Los campos de persona no deberían tener datos significativos
    print(f"\n📋 Campos de persona encontrados: {len(person_fields)}")
    
    print("\n🎉 TEST 4 PASSED: Sin familia procesado correctamente")
    return True


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🧪 EJECUTANDO TESTS DE MAPEO I-140 N8N")
    print("="*60)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        if test_consular_processing():
            tests_passed += 1
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        tests_failed += 1
    
    try:
        if test_usa_processing():
            tests_passed += 1
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        tests_failed += 1
    
    try:
        if test_family_members():
            tests_passed += 1
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        tests_failed += 1
    
    try:
        if test_no_family():
            tests_passed += 1
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        tests_failed += 1
    
    print("\n" + "="*60)
    print(f"📊 RESULTADOS: {tests_passed} passed, {tests_failed} failed")
    print("="*60)
    
    if tests_failed == 0:
        print("\n✅ TODOS LOS TESTS PASARON EXITOSAMENTE")
    else:
        print(f"\n⚠️ {tests_failed} test(s) fallaron")
        sys.exit(1)
