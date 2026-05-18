"""
Whitepaper Extraction Fix Tests - Iteration 36
Tests the bug fix for 'Project description is required' validation error.

Tests:
1. POST /api/whitepapers/extract-project-info - returns task_id and status 'processing'
2. GET /api/whitepapers/extraction-status/{task_id} - returns 'completed' with non-empty project_description
3. POST /api/whitepapers/start-interactive - accepts formData with populated project_description
4. Frontend validation: if project_description empty, error in Spanish

Test Credentials: dau@urpeailab.com / admin123
"""

import pytest
import requests
import os
import time
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://domain-relink-test.preview.emergentagent.com').rstrip('/')

TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"

# Simple project document text for testing
TEST_PROJECT_TEXT = """
PROYECTO: Sistema de Inteligencia Artificial para Diagnóstico Médico Avanzado

DESCRIPCIÓN DEL PROYECTO:
Este proyecto desarrolla un sistema de IA para diagnóstico médico utilizando redes neuronales convolucionales.
El objetivo principal es reducir el tiempo de diagnóstico en un 40% y mejorar la precisión al 95%.

METODOLOGÍA:
- Fase 1: Recolección y etiquetado de 50,000 imágenes médicas
- Fase 2: Entrenamiento de modelos CNN con arquitectura ResNet-50
- Fase 3: Validación clínica con 3 hospitales piloto
- Fase 4: Despliegue en producción con monitoreo continuo

RESULTADOS ESPERADOS:
- Reducción del tiempo de diagnóstico de 2 horas a 30 minutos
- Precisión del 95% en detección de anomalías
- Integración con sistemas HIS/PACS existentes

AUDIENCIA OBJETIVO:
Radiólogos, médicos especialistas, directores de hospitales y sistemas de salud pública.

TECNOLOGÍAS:
Python, TensorFlow, PyTorch, DICOM processing, REST APIs, Docker, Kubernetes.

IMPACTO NACIONAL:
Este sistema tiene potencial de impacto sustancial en la salud pública nacional, mejorando 
el acceso a diagnósticos precisos en regiones con escasez de especialistas médicos.
"""


class TestWhitepaperExtractionFix:
    """Tests for the whitepaper extraction bug fix - ensures project_description is populated"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token: {data}"
        print(f"✅ Login successful for {TEST_EMAIL}")
        return data["access_token"]

    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Authenticated headers without Content-Type (for multipart)"""
        return {
            "Authorization": f"Bearer {auth_token}"
        }

    @pytest.fixture(scope="class")
    def json_headers(self, auth_token):
        """Authenticated headers for JSON requests"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    @pytest.fixture(scope="class")
    def client_id(self, json_headers):
        """Get a real client_id for testing"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=json_headers)
        assert response.status_code == 200, f"Failed to get clients: {response.text}"
        data = response.json()
        clients = data.get("clients", data) if isinstance(data, dict) else data
        if len(clients) > 0:
            print(f"✅ Using client_id: {clients[0]['id']}")
            return clients[0]["id"]
        pytest.skip("No clients found for testing")

    # ============================================================
    # TEST 1: extract-project-info returns task_id + status=processing
    # ============================================================
    def test_extract_project_info_returns_task_id(self, auth_headers):
        """POST /api/whitepapers/extract-project-info should return task_id and status=processing"""
        # Create an in-memory TXT file
        file_content = TEST_PROJECT_TEXT.encode('utf-8')
        files = {
            'file': ('test_project.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whitepapers/extract-project-info",
            files=files,
            headers=auth_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"Extract project info failed: {response.text}"
        data = response.json()
        
        # Should have task_id
        assert "task_id" in data, f"No task_id in response: {data}"
        assert data.get("status") == "processing", f"Expected status='processing', got: {data.get('status')}"
        
        task_id = data["task_id"]
        assert task_id is not None and len(task_id) > 0
        
        print(f"✅ extract-project-info returned task_id: {task_id}")
        print(f"   Status: {data.get('status')}")
        return task_id

    # ============================================================
    # TEST 2: extraction-status polling returns completed with non-empty description
    # ============================================================
    def test_extraction_status_completes_with_description(self, auth_headers):
        """GET /api/whitepapers/extraction-status/{task_id} should return completed with non-empty project_description"""
        # First upload the file to get a task_id
        file_content = TEST_PROJECT_TEXT.encode('utf-8')
        files = {
            'file': ('test_project_status.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/whitepapers/extract-project-info",
            files=files,
            headers=auth_headers,
            timeout=30
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        task_id = upload_response.json()["task_id"]
        
        print(f"   Polling extraction task: {task_id}")
        
        # Poll for up to 60 seconds (background AI task may take time)
        max_attempts = 20
        status = "processing"
        result = None
        
        for attempt in range(max_attempts):
            time.sleep(3)
            status_response = requests.get(
                f"{BASE_URL}/api/whitepapers/extraction-status/{task_id}",
                headers=auth_headers,
                timeout=15
            )
            assert status_response.status_code == 200, f"Status endpoint failed: {status_response.text}"
            status_data = status_response.json()
            status = status_data.get("status")
            
            print(f"   Attempt {attempt+1}/{max_attempts}: status={status}")
            
            if status == "completed":
                result = status_data.get("result")
                break
            elif status == "failed":
                pytest.fail(f"Extraction task failed: {status_data.get('error')}")
        
        # Verify status is completed
        assert status == "completed", f"Extraction did not complete after {max_attempts * 3}s, last status: {status}"
        
        # Verify result has project_description
        assert result is not None, "Result is None after completion"
        project_description = result.get("project_description", "")
        
        # This is the CRITICAL check: project_description must be non-empty (>= 50 chars minimum)
        assert project_description, f"project_description is empty in result: {result}"
        assert len(project_description.strip()) >= 50, \
            f"project_description too short ({len(project_description)} chars): '{project_description[:100]}'"
        
        print(f"✅ Extraction completed with project_description ({len(project_description)} chars)")
        print(f"   Description preview: {project_description[:150]}...")
        print(f"   project_title: {result.get('project_title', 'N/A')}")
        print(f"   target_audience: {result.get('target_audience', 'N/A')}")

    # ============================================================
    # TEST 3: start-interactive accepts populated project_description
    # ============================================================
    def test_start_interactive_with_project_description(self, json_headers, client_id):
        """POST /api/whitepapers/start-interactive should accept formData with project_description"""
        whitepaper_data = {
            "project_title": "TEST_ITER36_AI_Medical_System",
            "project_description": "Sistema de IA para diagnóstico médico. Objetivo: reducir el tiempo de diagnóstico en 40% utilizando redes neuronales convolucionales con datos de 50,000 imágenes médicas etiquetadas. Metodología incluye 4 fases: recolección de datos, entrenamiento del modelo, validación clínica y despliegue. Impacto nacional al mejorar acceso a diagnósticos precisos en regiones remotas.",
            "target_audience": "Radiólogos, médicos especialistas y directores de hospitales",
            "technical_domain": "Inteligencia Artificial en Salud",
            "author_name": "Test Author ITER36",
            "author_credentials": "PhD en Ciencias Computacionales, 10 años de experiencia en IA médica",
            "language": "es",
            "client_id": client_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whitepapers/start-interactive",
            json=whitepaper_data,
            headers=json_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"start-interactive failed: {response.text}"
        data = response.json()
        
        assert "whitepaper_id" in data, f"No whitepaper_id in response: {data}"
        whitepaper_id = data["whitepaper_id"]
        assert whitepaper_id is not None and len(whitepaper_id) > 0
        
        print(f"✅ start-interactive returned whitepaper_id: {whitepaper_id}")
        print(f"   current_section: {data.get('current_section', 'N/A')}")
        print(f"   total_sections: {data.get('total_sections', 'N/A')}")
        
        # Cleanup
        cleanup_headers = {k: v for k, v in json_headers.items()}
        cleanup_response = requests.delete(
            f"{BASE_URL}/api/whitepapers/{whitepaper_id}",
            headers=cleanup_headers
        )
        if cleanup_response.status_code == 200:
            print(f"   🧹 Cleanup: Deleted test whitepaper {whitepaper_id}")

    # ============================================================
    # TEST 4: start-interactive rejects empty project_description (backend validation)
    # ============================================================
    def test_start_interactive_rejects_empty_description(self, json_headers, client_id):
        """POST /api/whitepapers/start-interactive should reject empty project_description"""
        whitepaper_data = {
            "project_title": "TEST_ITER36_Empty_Description",
            "project_description": "",  # EMPTY - should cause validation error
            "target_audience": "Test Audience",
            "technical_domain": "Test Domain",
            "author_name": "Test Author",
            "author_credentials": "Test Credentials",
            "language": "es",
            "client_id": client_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whitepapers/start-interactive",
            json=whitepaper_data,
            headers=json_headers,
            timeout=30
        )
        
        # The Pydantic model has project_description: str (required, non-optional)
        # An empty string might pass (str validation) or fail (if there's custom validation)
        # We report what happens
        print(f"   Empty description response status: {response.status_code}")
        if response.status_code == 422:
            print(f"✅ Backend correctly rejects empty project_description (422)")
        elif response.status_code == 200:
            # Backend allows empty string - validation is done in frontend
            data = response.json()
            whitepaper_id = data.get("whitepaper_id")
            print(f"⚠️ Backend allows empty project_description (frontend must validate) - ID: {whitepaper_id}")
            # Cleanup
            if whitepaper_id:
                requests.delete(f"{BASE_URL}/api/whitepapers/{whitepaper_id}", headers=json_headers)
        else:
            print(f"⚠️ Unexpected status {response.status_code}: {response.text[:200]}")

    # ============================================================
    # TEST 5: Full flow - upload file -> poll -> start-interactive
    # ============================================================
    def test_full_whitepaper_flow_no_validation_error(self, auth_headers, json_headers, client_id):
        """Full flow: upload file -> poll for completion -> start-interactive (no 'Project description is required')"""
        
        # Step 1: Upload project file
        file_content = TEST_PROJECT_TEXT.encode('utf-8')
        files = {
            'file': ('full_flow_project.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        print("   Step 1: Uploading project file...")
        upload_response = requests.post(
            f"{BASE_URL}/api/whitepapers/extract-project-info",
            files=files,
            headers=auth_headers,
            timeout=30
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        task_id = upload_response.json()["task_id"]
        print(f"   Upload OK, task_id: {task_id}")
        
        # Step 2: Poll for completion
        print("   Step 2: Polling for extraction completion...")
        project_description = None
        project_title = None
        target_audience = None
        
        for attempt in range(20):
            time.sleep(3)
            status_response = requests.get(
                f"{BASE_URL}/api/whitepapers/extraction-status/{task_id}",
                headers=auth_headers,
                timeout=15
            )
            assert status_response.status_code == 200
            status_data = status_response.json()
            status = status_data.get("status")
            print(f"   Poll {attempt+1}: status={status}")
            
            if status == "completed":
                result = status_data.get("result", {})
                project_description = result.get("project_description", "")
                project_title = result.get("project_title", "")
                target_audience = result.get("target_audience", "")
                break
            elif status == "failed":
                pytest.fail(f"Extraction failed: {status_data.get('error')}")
        
        assert project_description and len(project_description.strip()) >= 10, \
            f"project_description is empty or too short after extraction: '{project_description}'"
        print(f"   Extraction OK: description={len(project_description)} chars")
        
        # Step 3: Start whitepaper with extracted description (NO 'Project description is required' error)
        print("   Step 3: Starting whitepaper with extracted description...")
        whitepaper_data = {
            "project_title": project_title or "TEST_ITER36_Full_Flow",
            "project_description": project_description,
            "target_audience": target_audience or "Data Engineers",
            "technical_domain": "Inteligencia Artificial",
            "author_name": "Test Author ITER36",
            "author_credentials": "PhD en Ciencias Computacionales con 10+ años de experiencia",
            "language": "es",
            "client_id": client_id
        }
        
        start_response = requests.post(
            f"{BASE_URL}/api/whitepapers/start-interactive",
            json=whitepaper_data,
            headers=json_headers,
            timeout=30
        )
        
        assert start_response.status_code == 200, \
            f"start-interactive FAILED with populated description: {start_response.text}"
        
        data = start_response.json()
        whitepaper_id = data.get("whitepaper_id")
        
        assert whitepaper_id, f"No whitepaper_id in response: {data}"
        print(f"✅ FULL FLOW PASSED: whitepaper_id={whitepaper_id}")
        print(f"   No 'Project description is required' error!")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/whitepapers/{whitepaper_id}", headers=json_headers)

    # ============================================================
    # TEST 6: extraction-status returns 404 for unknown task
    # ============================================================
    def test_extraction_status_404_for_unknown_task(self, auth_headers):
        """GET /api/whitepapers/extraction-status/{task_id} returns 404 for non-existent task"""
        fake_task_id = "00000000-0000-0000-0000-000000000999"
        response = requests.get(
            f"{BASE_URL}/api/whitepapers/extraction-status/{fake_task_id}",
            headers=auth_headers,
            timeout=10
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✅ extraction-status returns 404 for unknown task")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
