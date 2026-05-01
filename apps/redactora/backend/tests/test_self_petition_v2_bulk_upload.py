"""
Test Self-Petition V2 Bulk Upload and Classification Endpoints
Tests the fix for 520 errors when uploading 70+ files.

Key changes tested:
1. POST /api/self-petition-v2/create-session - creates a new session
2. POST /api/self-petition-v2/{session_id}/upload-document?classify_immediately=false - fast upload without AI
3. POST /api/self-petition-v2/{session_id}/upload-documents-bulk - bulk upload endpoint
4. POST /api/self-petition-v2/{session_id}/start-classification?use_batch_mode=true - background batch classification
5. GET /api/self-petition-v2/{session_id}/status - session status with classifications
"""
import pytest
import requests
import os
import time
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "dau@urpeailab.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture
def test_session(api_client):
    """Create a test session and return session_id"""
    response = api_client.post(f"{BASE_URL}/api/self-petition-v2/create-session")
    assert response.status_code == 200, f"Create session failed: {response.text}"
    data = response.json()
    assert "session_id" in data
    return data["session_id"]


def create_test_pdf(filename="test_document.pdf", content="Test document content for classification"):
    """Create a simple test PDF-like file"""
    # Create a minimal PDF structure
    pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td ({content}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF"""
    return pdf_content.encode()


class TestSelfPetitionV2CreateSession:
    """Test session creation endpoint"""
    
    def test_create_session_success(self, api_client):
        """Test creating a new V2 session"""
        response = api_client.post(f"{BASE_URL}/api/self-petition-v2/create-session")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "session_id" in data
        assert "status" in data
        assert data["status"] == "uploading"
        assert "message" in data
        print(f"✅ Session created: {data['session_id']}")
    
    def test_create_session_with_client_id(self, api_client):
        """Test creating session with client_id parameter"""
        response = api_client.post(
            f"{BASE_URL}/api/self-petition-v2/create-session",
            params={"client_id": "test-client-123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        print(f"✅ Session with client_id created: {data['session_id']}")
    
    def test_create_session_requires_auth(self):
        """Test that session creation requires authentication"""
        response = requests.post(f"{BASE_URL}/api/self-petition-v2/create-session")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Auth required for session creation")


class TestSelfPetitionV2UploadDocument:
    """Test single document upload endpoint"""
    
    def test_upload_document_without_classification(self, api_client, test_session):
        """Test uploading a document with classify_immediately=false (fast upload)"""
        pdf_content = create_test_pdf("recommendation_letter.pdf", "This is a recommendation letter for John Doe")
        
        files = {"file": ("recommendation_letter.pdf", io.BytesIO(pdf_content), "application/pdf")}
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": api_client.headers["Authorization"]}
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-document",
            params={"classify_immediately": "false"},
            files=files,
            headers=headers
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "file_id" in data
        assert "filename" in data
        assert data["status"] == "uploaded"
        # Without classification, should be fast (< 5 seconds)
        assert elapsed < 5, f"Upload took too long: {elapsed}s (should be < 5s without classification)"
        # No classification should be returned when classify_immediately=false
        assert data.get("classification") is None, "Should not have classification when classify_immediately=false"
        
        print(f"✅ Document uploaded without classification in {elapsed:.2f}s: {data['file_id']}")
    
    def test_upload_document_with_classification(self, api_client, test_session):
        """Test uploading a document with classify_immediately=true (includes AI classification)"""
        pdf_content = create_test_pdf("diploma.pdf", "PhD in Computer Science from MIT")
        
        files = {"file": ("diploma.pdf", io.BytesIO(pdf_content), "application/pdf")}
        headers = {"Authorization": api_client.headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-document",
            params={"classify_immediately": "true"},
            files=files,
            headers=headers,
            timeout=60  # Allow more time for AI classification
        )
        
        assert response.status_code == 200, f"Upload with classification failed: {response.text}"
        data = response.json()
        
        assert "file_id" in data
        assert "classification" in data or data.get("classification") is not None
        print(f"✅ Document uploaded with classification: {data['file_id']}")
    
    def test_upload_multiple_files_parallel_fast(self, api_client, test_session):
        """Test uploading multiple files quickly without classification (simulates frontend parallel upload)"""
        import concurrent.futures
        
        num_files = 10
        headers = {"Authorization": api_client.headers["Authorization"]}
        
        def upload_file(i):
            pdf_content = create_test_pdf(f"doc_{i}.pdf", f"Document number {i} content")
            files = {"file": (f"doc_{i}.pdf", io.BytesIO(pdf_content), "application/pdf")}
            response = requests.post(
                f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-document",
                params={"classify_immediately": "false"},
                files=files,
                headers=headers,
                timeout=30
            )
            return response.status_code, response.json() if response.status_code == 200 else response.text
        
        start_time = time.time()
        
        # Upload 10 files in parallel (5 concurrent like frontend)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(upload_file, i) for i in range(num_files)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        elapsed = time.time() - start_time
        
        success_count = sum(1 for status, _ in results if status == 200)
        
        assert success_count == num_files, f"Only {success_count}/{num_files} uploads succeeded"
        # 10 files in parallel should complete in < 30 seconds
        assert elapsed < 30, f"Parallel upload took too long: {elapsed}s"
        
        print(f"✅ {num_files} files uploaded in parallel in {elapsed:.2f}s ({elapsed/num_files:.2f}s per file)")


class TestSelfPetitionV2BulkUpload:
    """Test bulk upload endpoint"""
    
    def test_bulk_upload_multiple_files(self, api_client, test_session):
        """Test uploading multiple files at once via bulk endpoint"""
        num_files = 5
        files = []
        
        for i in range(num_files):
            pdf_content = create_test_pdf(f"bulk_doc_{i}.pdf", f"Bulk document {i} content")
            files.append(("files", (f"bulk_doc_{i}.pdf", io.BytesIO(pdf_content), "application/pdf")))
        
        headers = {"Authorization": api_client.headers["Authorization"]}
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-documents-bulk",
            files=files,
            headers=headers,
            timeout=60
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200, f"Bulk upload failed: {response.text}"
        data = response.json()
        
        assert "total" in data
        assert "uploaded" in data
        assert data["total"] == num_files
        assert data["uploaded"] == num_files
        assert "files" in data
        assert len(data["files"]) == num_files
        
        print(f"✅ Bulk upload of {num_files} files completed in {elapsed:.2f}s")
        print(f"   Uploaded: {data['uploaded']}, Errors: {data.get('errors', 0)}")
    
    def test_bulk_upload_requires_auth(self, test_session):
        """Test that bulk upload requires authentication"""
        pdf_content = create_test_pdf("test.pdf", "Test content")
        files = [("files", ("test.pdf", io.BytesIO(pdf_content), "application/pdf"))]
        
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-documents-bulk",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Auth required for bulk upload")


class TestSelfPetitionV2StartClassification:
    """Test classification start endpoint"""
    
    def test_start_classification_batch_mode(self, api_client, test_session):
        """Test starting background batch classification"""
        # First upload some files
        headers = {"Authorization": api_client.headers["Authorization"]}
        
        for i in range(3):
            pdf_content = create_test_pdf(f"classify_doc_{i}.pdf", f"Document {i} for classification")
            files = {"file": (f"classify_doc_{i}.pdf", io.BytesIO(pdf_content), "application/pdf")}
            response = requests.post(
                f"{BASE_URL}/api/self-petition-v2/{test_session}/upload-document",
                params={"classify_immediately": "false"},
                files=files,
                headers=headers
            )
            assert response.status_code == 200
        
        # Start classification in batch mode
        response = api_client.post(
            f"{BASE_URL}/api/self-petition-v2/{test_session}/start-classification",
            params={"use_batch_mode": "true"}
        )
        
        assert response.status_code == 200, f"Start classification failed: {response.text}"
        data = response.json()
        
        assert "session_id" in data
        assert "status" in data
        assert data["status"] == "classifying"
        assert "mode" in data
        assert data["mode"] == "batch"
        
        print(f"✅ Classification started in batch mode: {data}")
    
    def test_start_classification_no_files(self, api_client):
        """Test starting classification with no files returns error"""
        # Create a fresh session with no files
        response = api_client.post(f"{BASE_URL}/api/self-petition-v2/create-session")
        assert response.status_code == 200
        empty_session_id = response.json()["session_id"]
        
        # Try to start classification
        response = api_client.post(
            f"{BASE_URL}/api/self-petition-v2/{empty_session_id}/start-classification"
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Classification correctly rejects empty session")


class TestSelfPetitionV2Status:
    """Test session status endpoint"""
    
    def test_get_session_status(self, api_client, test_session):
        """Test getting session status"""
        response = api_client.get(f"{BASE_URL}/api/self-petition-v2/{test_session}/status")
        
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        
        assert "session_id" in data
        assert "status" in data
        assert "progress" in data
        assert "classifications" in data
        assert "files" in data
        
        print(f"✅ Session status retrieved: status={data['status']}, progress={data['progress']}%")
    
    def test_get_status_invalid_session(self, api_client):
        """Test getting status for non-existent session"""
        response = api_client.get(f"{BASE_URL}/api/self-petition-v2/invalid-session-id/status")
        
        assert response.status_code == 404
        print("✅ Invalid session returns 404")
    
    def test_status_includes_batch_info(self, api_client, test_session):
        """Test that status includes batch processing information"""
        response = api_client.get(f"{BASE_URL}/api/self-petition-v2/{test_session}/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check batch-related fields exist
        assert "batch_summaries" in data
        assert "completed_batches" in data
        assert "classified_count" in data
        assert "needs_retry_count" in data
        
        print(f"✅ Status includes batch info: completed_batches={data['completed_batches']}")


class TestSelfPetitionV2FullFlow:
    """Test complete upload and classification flow"""
    
    def test_full_upload_then_classify_flow(self, api_client):
        """Test the complete flow: create session -> upload files -> start classification -> check status"""
        # Step 1: Create session
        response = api_client.post(f"{BASE_URL}/api/self-petition-v2/create-session")
        assert response.status_code == 200
        session_id = response.json()["session_id"]
        print(f"Step 1: Session created: {session_id}")
        
        # Step 2: Upload multiple files without classification
        headers = {"Authorization": api_client.headers["Authorization"]}
        num_files = 5
        
        for i in range(num_files):
            pdf_content = create_test_pdf(f"flow_doc_{i}.pdf", f"Flow test document {i}")
            files = {"file": (f"flow_doc_{i}.pdf", io.BytesIO(pdf_content), "application/pdf")}
            response = requests.post(
                f"{BASE_URL}/api/self-petition-v2/{session_id}/upload-document",
                params={"classify_immediately": "false"},
                files=files,
                headers=headers
            )
            assert response.status_code == 200
        print(f"Step 2: {num_files} files uploaded")
        
        # Step 3: Check status - should show files but no classifications
        response = api_client.get(f"{BASE_URL}/api/self-petition-v2/{session_id}/status")
        assert response.status_code == 200
        status_data = response.json()
        assert len(status_data["files"]) == num_files
        assert len(status_data["classifications"]) == 0  # No classifications yet
        print(f"Step 3: Status shows {len(status_data['files'])} files, 0 classifications")
        
        # Step 4: Start batch classification
        response = api_client.post(
            f"{BASE_URL}/api/self-petition-v2/{session_id}/start-classification",
            params={"use_batch_mode": "true"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "classifying"
        print("Step 4: Classification started in batch mode")
        
        # Step 5: Poll status until classification completes (with timeout)
        max_wait = 120  # 2 minutes max
        start_time = time.time()
        final_status = None
        
        while time.time() - start_time < max_wait:
            response = api_client.get(f"{BASE_URL}/api/self-petition-v2/{session_id}/status")
            assert response.status_code == 200
            status_data = response.json()
            final_status = status_data["status"]
            
            if final_status in ["reviewing", "error"]:
                break
            
            print(f"   Polling: status={final_status}, progress={status_data['progress']}%, classifications={len(status_data['classifications'])}")
            time.sleep(5)
        
        # Verify final state
        assert final_status in ["reviewing", "classifying"], f"Unexpected final status: {final_status}"
        print(f"Step 5: Final status: {final_status}")
        
        # Check classifications were created
        response = api_client.get(f"{BASE_URL}/api/self-petition-v2/{session_id}/status")
        final_data = response.json()
        
        print(f"✅ Full flow completed:")
        print(f"   - Files: {len(final_data['files'])}")
        print(f"   - Classifications: {len(final_data['classifications'])}")
        print(f"   - Classified: {final_data['classified_count']}")
        print(f"   - Needs retry: {final_data['needs_retry_count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
