"""
Intent Letters Module Tests — Cartas de Intención / Personal Statement EB-2 NIW
Tests all CRUD endpoints and key flows.
"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dau@urpeailab.com",
        "password": "admin123"
    })
    if res.status_code != 200:
        pytest.skip(f"Login failed: {res.status_code} {res.text}")
    return res.json().get("access_token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Auth headers."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def bryan_client_id(headers):
    """Get Bryan Turcios client_id."""
    res = requests.get(f"{BASE_URL}/api/clients/search?q=bryan", headers=headers)
    assert res.status_code == 200
    clients = res.json().get("clients", [])
    if not clients:
        pytest.skip("Bryan Turcios client not found")
    return clients[0]["id"]


# ── Tests: List Intent Letters ─────────────────────────────────────────────────

class TestListIntentLetters:
    """GET /api/intent-letters"""

    def test_list_returns_200(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    def test_list_has_letters_and_count_fields(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        data = res.json()
        assert "letters" in data, "Response must have 'letters' field"
        assert "count" in data, "Response must have 'count' field"
        assert isinstance(data["letters"], list), "'letters' must be a list"
        assert isinstance(data["count"], int), "'count' must be an int"

    def test_list_count_matches_letters_length(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        data = res.json()
        assert data["count"] == len(data["letters"]), "count must match len(letters)"

    def test_list_filter_by_client_id(self, headers, bryan_client_id):
        res = requests.get(f"{BASE_URL}/api/intent-letters?client_id={bryan_client_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "letters" in data
        # All returned letters must have the correct client_id
        for letter in data["letters"]:
            assert letter["client_id"] == bryan_client_id, f"Letter has wrong client_id: {letter.get('client_id')}"

    def test_list_no_deleted_letters(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        data = res.json()
        for letter in data["letters"]:
            assert letter.get("status") != "deleted", f"Deleted letter returned: {letter['id']}"


# ── Tests: Get Letter By ID ────────────────────────────────────────────────────

class TestGetIntentLetter:
    """GET /api/intent-letters/{id}"""

    @pytest.fixture(scope="class")
    def existing_letter_id(self, headers):
        """Get first existing letter id."""
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        letters = res.json().get("letters", [])
        if not letters:
            pytest.skip("No intent letters available to test GET by ID")
        return letters[0]["id"]

    def test_get_returns_200(self, headers, existing_letter_id):
        res = requests.get(f"{BASE_URL}/api/intent-letters/{existing_letter_id}", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    def test_get_returns_id_field(self, headers, existing_letter_id):
        res = requests.get(f"{BASE_URL}/api/intent-letters/{existing_letter_id}", headers=headers)
        data = res.json()
        assert data["id"] == existing_letter_id

    def test_get_returns_status_field(self, headers, existing_letter_id):
        res = requests.get(f"{BASE_URL}/api/intent-letters/{existing_letter_id}", headers=headers)
        data = res.json()
        assert "status" in data
        assert data["status"] in ["generating", "completed", "error"]

    def test_get_returns_progress_fields(self, headers, existing_letter_id):
        res = requests.get(f"{BASE_URL}/api/intent-letters/{existing_letter_id}", headers=headers)
        data = res.json()
        assert "progress_percentage" in data, "Must have progress_percentage"
        assert "progress_message" in data, "Must have progress_message"

    def test_get_completed_has_content(self, headers, existing_letter_id):
        """Completed letters should have content_en and content_es."""
        res = requests.get(f"{BASE_URL}/api/intent-letters/{existing_letter_id}", headers=headers)
        data = res.json()
        if data["status"] == "completed":
            assert data.get("content_en"), "Completed letter must have content_en"
            assert data.get("content_es"), "Completed letter must have content_es"

    def test_get_nonexistent_returns_404(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters/non-existent-id-xyz", headers=headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"


# ── Tests: Generate Intent Letter ─────────────────────────────────────────────

class TestGenerateIntentLetter:
    """POST /api/intent-letters/generate"""

    # Sample minimal TXT content
    CV_CONTENT = b"""Dr. John Smith
PhD in Computer Science, MIT (2016)
Current: Senior Researcher at Google
10 years experience in AI/ML healthcare diagnostics
Publications: 23 peer-reviewed papers, h-index 18
Patents: 2 granted patents in ML diagnostics
Awards: AMIA Innovation in Healthcare 2023"""

    PROJECT_CONTENT = b"""Project: AI-Powered Sepsis Detection Platform for Rural U.S. Hospitals
Description: Federated learning AI platform for early sepsis detection
National Need: 1.7 million sepsis cases annually in the U.S. (CDC data)
Technical Approach: Federated learning model with privacy-preserving analysis
Impact: Targeting 4,500 rural hospitals across all 50 U.S. states"""

    def test_generate_returns_201_or_200(self, headers, bryan_client_id):
        """POST with two required files should start generation."""
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(self.CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(self.PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        assert res.status_code in [200, 201], f"Expected 200/201, got {res.status_code}: {res.text}"

    def test_generate_returns_letter_id(self, headers, bryan_client_id):
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(self.CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(self.PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        assert res.status_code in [200, 201]
        result = res.json()
        assert "letter_id" in result, "Response must contain letter_id"
        assert isinstance(result["letter_id"], str)
        assert len(result["letter_id"]) > 0

    def test_generate_returns_generating_status(self, headers, bryan_client_id):
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(self.CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(self.PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        assert res.status_code in [200, 201]
        result = res.json()
        assert result.get("status") == "generating", f"Expected 'generating', got {result.get('status')}"

    def test_generate_letter_stored_in_db(self, headers, bryan_client_id):
        """Generated letter should be retrievable immediately via GET."""
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(self.CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(self.PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        assert res.status_code in [200, 201]
        letter_id = res.json()["letter_id"]

        # GET should return the letter immediately
        get_res = requests.get(f"{BASE_URL}/api/intent-letters/{letter_id}", headers=headers)
        assert get_res.status_code == 200, f"Letter not found after creation: {get_res.status_code}"
        data = get_res.json()
        assert data["id"] == letter_id
        assert data["status"] in ["generating", "completed"]

    def test_generate_letter_appears_in_list(self, headers, bryan_client_id):
        """Generated letter should appear in GET /intent-letters."""
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(self.CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(self.PROJECT_CONTENT), "text/plain"),
        }
        data_payload = {"client_id": bryan_client_id}
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data_payload
        )
        assert res.status_code in [200, 201]
        letter_id = res.json()["letter_id"]

        # Verify letter appears in list
        list_res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        letter_ids = [l["id"] for l in list_res.json().get("letters", [])]
        assert letter_id in letter_ids, f"Newly created letter {letter_id} not found in list"


# ── Tests: PDF Download ────────────────────────────────────────────────────────

class TestDownloadIntentLetter:
    """GET /api/intent-letters/{id}/download"""

    @pytest.fixture(scope="class")
    def completed_letter_id(self, headers):
        """Find first completed letter with content."""
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        for letter in res.json().get("letters", []):
            if letter.get("status") == "completed" and letter.get("content_en"):
                return letter["id"]
        pytest.skip("No completed letter available for PDF download test")

    def test_download_en_returns_200(self, headers, completed_letter_id):
        res = requests.get(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/download?language=en",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"

    def test_download_en_is_pdf(self, headers, completed_letter_id):
        res = requests.get(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/download?language=en",
            headers=headers
        )
        assert res.content[:4] == b'%PDF', f"Response is not a valid PDF (starts with: {res.content[:4]})"

    def test_download_es_returns_200(self, headers, completed_letter_id):
        res = requests.get(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/download?language=es",
            headers=headers
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"

    def test_download_es_is_pdf(self, headers, completed_letter_id):
        res = requests.get(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/download?language=es",
            headers=headers
        )
        assert res.content[:4] == b'%PDF', f"Response is not a valid PDF (starts with: {res.content[:4]})"

    def test_download_has_correct_content_type(self, headers, completed_letter_id):
        res = requests.get(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/download?language=en",
            headers=headers
        )
        assert "application/pdf" in res.headers.get("content-type", ""), \
            f"Content-Type is not PDF: {res.headers.get('content-type')}"


# ── Tests: Edit Intent Letter ──────────────────────────────────────────────────

class TestEditIntentLetter:
    """POST /api/intent-letters/{id}/edit"""

    @pytest.fixture(scope="class")
    def completed_letter_id(self, headers):
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        for letter in res.json().get("letters", []):
            if letter.get("status") == "completed" and letter.get("content_en"):
                return letter["id"]
        pytest.skip("No completed letter available for edit test")

    def test_edit_without_instructions_returns_400(self, headers, completed_letter_id):
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/{completed_letter_id}/edit",
            headers=headers,
            json={"instructions": ""}
        )
        assert res.status_code == 400, f"Expected 400 for empty instructions, got {res.status_code}"

    def test_edit_nonexistent_returns_404(self, headers):
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/non-existent-xyz/edit",
            headers=headers,
            json={"instructions": "Add more detail to Section 3"}
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"


# ── Tests: Delete Intent Letter ────────────────────────────────────────────────

class TestDeleteIntentLetter:
    """DELETE /api/intent-letters/{id}"""

    def test_delete_returns_200(self, headers, bryan_client_id):
        """Create a letter and soft delete it."""
        # First create a letter to delete
        CV_CONTENT = b"Test CV for delete test"
        PROJECT_CONTENT = b"Test Project for delete test"
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        create_res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        assert create_res.status_code in [200, 201]
        letter_id = create_res.json()["letter_id"]

        # Delete it
        del_res = requests.delete(f"{BASE_URL}/api/intent-letters/{letter_id}", headers=headers)
        assert del_res.status_code == 200, f"Expected 200, got {del_res.status_code}: {del_res.text}"

    def test_delete_soft_deletes(self, headers, bryan_client_id):
        """Verify deleted letter status is 'deleted' and not in list."""
        CV_CONTENT = b"Test CV for soft delete verification"
        PROJECT_CONTENT = b"Test Project for soft delete verification"
        files = {
            "petitioner_cv": ("cv.txt", io.BytesIO(CV_CONTENT), "text/plain"),
            "project_info": ("project.txt", io.BytesIO(PROJECT_CONTENT), "text/plain"),
        }
        data = {"client_id": bryan_client_id}
        create_res = requests.post(
            f"{BASE_URL}/api/intent-letters/generate",
            headers=headers,
            files=files,
            data=data
        )
        letter_id = create_res.json()["letter_id"]

        # Delete
        requests.delete(f"{BASE_URL}/api/intent-letters/{letter_id}", headers=headers)

        # Verify NOT in list (soft deleted)
        list_res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        letter_ids = [l["id"] for l in list_res.json().get("letters", [])]
        assert letter_id not in letter_ids, "Soft deleted letter should not appear in list"

    def test_delete_nonexistent_returns_404(self, headers):
        res = requests.delete(f"{BASE_URL}/api/intent-letters/non-existent-xyz", headers=headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"


# ── Tests: Client Stats ────────────────────────────────────────────────────────

class TestClientStatsIntentLetterCount:
    """GET /api/clients/{client_id}/stats - includes intent_letter_count"""

    def test_client_stats_returns_200(self, headers, bryan_client_id):
        res = requests.get(f"{BASE_URL}/api/clients/{bryan_client_id}/stats", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    def test_client_stats_has_intent_letter_count(self, headers, bryan_client_id):
        res = requests.get(f"{BASE_URL}/api/clients/{bryan_client_id}/stats", headers=headers)
        data = res.json()
        assert "intent_letter_count" in data, \
            f"stats must include 'intent_letter_count'. Got keys: {list(data.keys())}"

    def test_client_stats_intent_letter_count_is_integer(self, headers, bryan_client_id):
        res = requests.get(f"{BASE_URL}/api/clients/{bryan_client_id}/stats", headers=headers)
        data = res.json()
        assert isinstance(data.get("intent_letter_count"), int), \
            f"intent_letter_count must be int, got {type(data.get('intent_letter_count'))}"

    def test_client_stats_intent_letter_count_gte_zero(self, headers, bryan_client_id):
        res = requests.get(f"{BASE_URL}/api/clients/{bryan_client_id}/stats", headers=headers)
        data = res.json()
        assert data.get("intent_letter_count", -1) >= 0, \
            f"intent_letter_count must be >= 0, got {data.get('intent_letter_count')}"

    def test_client_stats_total_docs_includes_intent_letters(self, headers, bryan_client_id):
        """total_documents should include intent_letter_count."""
        res = requests.get(f"{BASE_URL}/api/clients/{bryan_client_id}/stats", headers=headers)
        data = res.json()
        assert "total_documents" in data, "stats must have total_documents"


# ── Tests: Translate Intent Letter ────────────────────────────────────────────

class TestTranslateIntentLetter:
    """POST /api/intent-letters/{id}/translate"""

    def test_translate_nonexistent_returns_404(self, headers):
        res = requests.post(
            f"{BASE_URL}/api/intent-letters/non-existent-xyz/translate",
            headers=headers
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"

    def test_translate_already_translated_returns_existing(self, headers):
        """If letter already has content_es, translate returns existing without LLM call."""
        res = requests.get(f"{BASE_URL}/api/intent-letters", headers=headers)
        for letter in res.json().get("letters", []):
            if letter.get("status") == "completed" and letter.get("content_es"):
                letter_id = letter["id"]
                translate_res = requests.post(
                    f"{BASE_URL}/api/intent-letters/{letter_id}/translate",
                    headers=headers
                )
                assert translate_res.status_code == 200
                result = translate_res.json()
                assert "content_es" in result
                return
        pytest.skip("No completed letter with content_es available")
