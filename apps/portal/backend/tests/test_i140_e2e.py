"""
E2E Test: I-140 N8N Form - from client pre-validation to PDF download
Tests the complete flow:
1. Admin creates a shared pre-validation form for I-140
2. Client fills 6 questions via public link
3. Admin opens I-140 with pre-filled answers
4. Admin generates and downloads PDF
"""
import pytest
import httpx
import json
import os

API_URL = os.environ.get("API_URL", "http://localhost:8001")

# Test data matching what a real client would fill
CLIENT_PREVALIDATION_ANSWERS = [
    {"question": "1.a. Apellido del Beneficiario", "answer": "GONZALEZ GOMEZ"},
    {"question": "1.b. Nombre del Beneficiario", "answer": "KAREN"},
    {"question": "1.c. Segundo Nombre del Beneficiario", "answer": "MARIA"},
    {"question": "3. Fecha de Nacimiento", "answer": "15/03/1989"},
    {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "CARACAS"},
    {"question": "5. Estado o Provincia de Nacimiento", "answer": "DISTRITO CAPITAL"},
    {"question": "6. País de Nacimiento", "answer": "VENEZUELA"},
    {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "VENEZUELA"},
]

# Full form answers that a coordinator would complete (including Signatario section)
COORDINATOR_FULL_ANSWERS = [
    # Beneficiary info (from pre-validation)
    {"question": "1.a. Apellido del Beneficiario", "answer": "GONZALEZ GOMEZ"},
    {"question": "1.b. Nombre del Beneficiario", "answer": "KAREN"},
    {"question": "1.c. Segundo Nombre del Beneficiario", "answer": "MARIA"},
    {"question": "3. Fecha de Nacimiento", "answer": "15/03/1989"},
    {"question": "4. Ciudad/Pueblo de Nacimiento", "answer": "CARACAS"},
    {"question": "5. Estado o Provincia de Nacimiento", "answer": "DISTRITO CAPITAL"},
    {"question": "6. País de Nacimiento", "answer": "VENEZUELA"},
    {"question": "7. País de Ciudadanía o Nacionalidad", "answer": "VENEZUELA"},
    # Petitioner info
    {"question": "1.a. Apellido (si es individuo)", "answer": "GONZALEZ GOMEZ"},
    {"question": "1.b. Nombre (si es individuo)", "answer": "KAREN"},
    # Part 4 - Processing
    {"question": "¿Dónde procesará la visa el beneficiario?", "answer": "2.a. En EEUU - Ajuste de Estatus"},
    {"question": "2.b. País de residencia actual del beneficiario", "answer": "ESTADOS UNIDOS"},
    # Part 6 - Employment
    {"question": "Part 6 - 1. Job Title", "answer": "BUSINESS ADMINISTRATOR"},
    {"question": "Part 6 - 2. SOC Code", "answer": "11-1021"},
    {"question": "Part 6 - 3. Nontechnical Job Description", "answer": "Manages business operations and strategic planning"},
    {"question": "Part 6 - 5. Hours per week", "answer": "40"},
    {"question": "Part 6 - 8. Wages", "answer": "85000"},
    {"question": "Part 6 - 8. Wages Per", "answer": "Year"},
    # Signatario (Part 8/9)
    {"question": "1.a. Apellido del Signatario", "answer": "GONZALEZ GOMEZ"},
    {"question": "1.b. Nombre del Signatario", "answer": "KAREN"},
    {"question": "2. Título del Signatario", "answer": "ADMINISTRADOR DE EMPRESAS"},
    {"question": "3. Teléfono de Día", "answer": "2817714597"},
    {"question": "4. Teléfono Móvil", "answer": "2817714597"},
    {"question": "5. Dirección de Email", "answer": "karengonza1989@gmail.com"},
    {"question": "6.b. Fecha de Firma", "answer": "19/02/2026"},
]


@pytest.fixture
def admin_token():
    r = httpx.post(f"{API_URL}/api/admin/auth/login", json={"email": "admin@urpe.com", "password": "urpe2024"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture
def template_id():
    """Get the I-140 template ID."""
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "test_database")]
    t = db.uscis_templates.find_one({"form_code": "I-140"})
    assert t is not None, "I-140 template not found in DB"
    return str(t["_id"])


class TestI140E2EFlow:
    """End-to-end test of the I-140 N8N form flow."""

    def test_1_create_shared_form(self, admin_token, template_id):
        """Step 1: Admin creates a shared pre-validation form."""
        r = httpx.post(
            f"{API_URL}/api/uscis-forms/shared-forms",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "template_id": template_id,
                "client_name": "PRUEBA E2E KAREN",
                "client_email": "karengonza1989@gmail.com",
                "form_type": "pre_validation",
            },
        )
        assert r.status_code == 200, f"Create shared form failed: {r.text}"
        data = r.json()
        assert data.get("token") or data.get("_id"), f"No token returned: {data}"
        token = data.get("token") or data.get("_id")
        # Store for next tests
        self.__class__.shared_token = token
        print(f"Shared form created: {token}")

    def test_2_client_accesses_form(self):
        """Step 2: Client accesses the public form."""
        token = self.__class__.shared_token
        r = httpx.get(f"{API_URL}/api/uscis-forms/public/form/{token}")
        assert r.status_code == 200, f"Public form access failed: {r.text}"
        data = r.json()
        assert data["form_code"] == "I-140"
        assert data["form_type"] == "pre_validation"
        print(f"Client can access form: {data['name']}")

    def test_3_client_submits_prevalidation(self):
        """Step 3: Client fills and submits the 6 pre-validation questions."""
        token = self.__class__.shared_token
        r = httpx.post(
            f"{API_URL}/api/uscis-forms/public/form/{token}/submit",
            json={
                "answers": CLIENT_PREVALIDATION_ANSWERS,
                "client_name": "PRUEBA E2E KAREN",
                "client_email": "karengonza1989@gmail.com",
            },
        )
        assert r.status_code == 200, f"Submit failed: {r.text}"
        data = r.json()
        submission_id = data.get("submission_id") or data.get("id")
        assert submission_id, f"No submission_id: {data}"
        self.__class__.submission_id = submission_id
        print(f"Pre-validation submitted: {submission_id}")

    def test_4_admin_loads_submission(self, admin_token):
        """Step 4: Admin loads the submission answers."""
        sid = self.__class__.submission_id
        r = httpx.get(
            f"{API_URL}/api/uscis-forms/client-submissions/{sid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, f"Load submission failed: {r.text}"
        data = r.json()
        assert len(data["answers"]) >= 6, f"Expected 6+ answers, got {len(data['answers'])}"
        print(f"Loaded {len(data['answers'])} pre-validation answers")

    def test_5_admin_generates_pdf(self, admin_token, template_id):
        """Step 5: Admin generates the PDF with all answers (pre-validation + manual)."""
        r = httpx.post(
            f"{API_URL}/api/uscis-forms/fill",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "template_id": template_id,
                "answers_json": json.dumps(COORDINATOR_FULL_ANSWERS),
                "client_name": "PRUEBA E2E KAREN",
            },
            timeout=30.0,
        )
        assert r.status_code == 200, f"PDF generation failed: {r.status_code} {r.text[:500]}"
        
        content_type = r.headers.get("content-type", "")
        assert "pdf" in content_type or "html" in content_type, f"Unexpected content type: {content_type}"
        
        # Verify we got actual content
        assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"
        
        # Save PDF for inspection
        with open("/tmp/i140_e2e_test.pdf", "wb") as f:
            f.write(r.content)
        
        print(f"PDF generated: {len(r.content)} bytes, saved to /tmp/i140_e2e_test.pdf")

    def test_6_verify_date_format(self):
        """Step 6: Verify date formatting handles DD/MM/YYYY correctly."""
        from data.i140_n8n_pdf_mapping import format_date
        
        # DD/MM/YYYY where day > 12 should swap
        assert format_date("19/02/2026") == "02/19/2026", f"Got: {format_date('19/02/2026')}"
        # MM/DD/YYYY where month <= 12 stays as-is
        assert format_date("02/19/2026") == "02/19/2026"
        # ISO format
        assert format_date("1989-03-15") == "03/15/1989"
        # Empty
        assert format_date("") == ""
        print("Date formatting OK")

    def test_7_n8n_mapping_no_errors(self):
        """Step 7: Verify N8N mapping doesn't throw errors with full form data."""
        from data.i140_n8n_pdf_mapping import fill_i140_form_n8n
        
        answers_dict = {a["question"]: a["answer"] for a in COORDINATOR_FULL_ANSWERS}
        
        result = fill_i140_form_n8n(answers_dict)
        fields = result["fields"]
        
        assert len(fields) > 30, f"Too few fields: {len(fields)}"
        
        # Verify no empty fieldNames
        for f in fields:
            assert f.get("fieldName"), f"Empty fieldName: {f}"
        
        print(f"N8N mapping OK: {len(fields)} fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
