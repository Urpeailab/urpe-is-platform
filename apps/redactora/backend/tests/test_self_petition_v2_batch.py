"""
Test Self-Petition V2 Batch Processing Endpoints
Tests the new batch processing system for document classification in Self-Petition V2 flow.

Endpoints tested:
- POST /api/self-petition-v2/create-session - Create classification session
- GET /api/self-petition-v2/{session_id}/batch-status - Get batch processing status
- POST /api/self-petition-v2/{session_id}/force-continue - Force continue if stuck
- POST /api/self-petition-v2/{session_id}/upload-document - Upload document
- POST /api/self-petition-v2/{session_id}/start-classification - Start classification
- GET /api/self-petition-v2/{session_id}/status - Get session status
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testletter1767975068@test.com"
TEST_PASSWORD = "Test1234!"


class TestSelfPetitionV2Batch:
    """Test Self-Petition V2 Batch Processing Endpoints"""
    
    auth_token = None
    session_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
    
    def test_01_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✅ Health check passed: {data}")
    
    def test_02_login_user(self):
        """Login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert 'access_token' in data, f"No access_token in response: {data}"
        TestSelfPetitionV2Batch.auth_token = data['access_token']
        print(f"✅ Login successful for {TEST_EMAIL}")
    
    def test_03_create_session(self):
        """Test POST /api/self-petition-v2/create-session"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/create-session",
            headers=headers
        )
        
        assert response.status_code == 200, f"Create session failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert 'session_id' in data, f"No session_id in response: {data}"
        assert 'status' in data, f"No status in response: {data}"
        assert data['status'] == 'uploading', f"Unexpected status: {data['status']}"
        
        TestSelfPetitionV2Batch.session_id = data['session_id']
        print(f"✅ Session created: {data['session_id']}")
        print(f"   Status: {data['status']}")
        print(f"   Message: {data.get('message', 'N/A')}")
    
    def test_04_get_batch_status_empty_session(self):
        """Test GET /api/self-petition-v2/{session_id}/batch-status for empty session"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/batch-status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get batch status failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert 'session_id' in data, f"No session_id in response: {data}"
        assert 'total_files' in data, f"No total_files in response: {data}"
        assert 'classified' in data, f"No classified in response: {data}"
        assert 'remaining' in data, f"No remaining in response: {data}"
        assert 'batch_size' in data, f"No batch_size in response: {data}"
        assert 'total_batches' in data, f"No total_batches in response: {data}"
        assert 'completed_batches' in data, f"No completed_batches in response: {data}"
        assert 'all_processed' in data, f"No all_processed in response: {data}"
        
        # Verify empty session values
        assert data['total_files'] == 0, f"Expected 0 files, got {data['total_files']}"
        assert data['batch_size'] == 7, f"Expected batch_size 7, got {data['batch_size']}"
        
        print(f"✅ Batch status for empty session:")
        print(f"   Total files: {data['total_files']}")
        print(f"   Classified: {data['classified']}")
        print(f"   Remaining: {data['remaining']}")
        print(f"   Batch size: {data['batch_size']}")
        print(f"   All processed: {data['all_processed']}")
    
    def test_05_get_session_status(self):
        """Test GET /api/self-petition-v2/{session_id}/status"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get session status failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert 'session_id' in data, f"No session_id in response: {data}"
        assert 'status' in data, f"No status in response: {data}"
        assert 'progress' in data, f"No progress in response: {data}"
        assert 'total_files' in data, f"No total_files in response: {data}"
        assert 'classifications' in data, f"No classifications in response: {data}"
        assert 'batch_summaries' in data, f"No batch_summaries in response: {data}"
        
        print(f"✅ Session status:")
        print(f"   Status: {data['status']}")
        print(f"   Progress: {data['progress']}%")
        print(f"   Total files: {data['total_files']}")
        print(f"   Completed batches: {data.get('completed_batches', 0)}")
    
    def test_06_force_continue_on_non_classifying_session(self):
        """Test POST /api/self-petition-v2/{session_id}/force-continue on non-classifying session"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/force-continue",
            headers=headers
        )
        
        assert response.status_code == 200, f"Force continue failed: {response.text}"
        data = response.json()
        
        # Should return message that session is not in classifying mode
        assert 'message' in data or 'status' in data, f"Unexpected response: {data}"
        
        print(f"✅ Force continue response (non-classifying session):")
        print(f"   Message: {data.get('message', 'N/A')}")
        print(f"   Status: {data.get('status', 'N/A')}")
    
    def test_07_upload_test_document(self):
        """Test POST /api/self-petition-v2/{session_id}/upload-document"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        
        # Create a simple test document
        test_content = b"This is a test document for EB-2 NIW petition. The applicant has exceptional ability in their field."
        files = {
            'file': ('test_document.txt', test_content, 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/upload-document",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload document failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert 'file_id' in data, f"No file_id in response: {data}"
        assert 'filename' in data, f"No filename in response: {data}"
        assert 'status' in data, f"No status in response: {data}"
        assert data['status'] == 'uploaded', f"Unexpected status: {data['status']}"
        
        print(f"✅ Document uploaded:")
        print(f"   File ID: {data['file_id']}")
        print(f"   Filename: {data['filename']}")
        print(f"   Size: {data.get('size', 'N/A')} bytes")
    
    def test_08_batch_status_after_upload(self):
        """Test batch status after uploading a document"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/batch-status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get batch status failed: {response.text}"
        data = response.json()
        
        # Verify file count increased
        assert data['total_files'] >= 1, f"Expected at least 1 file, got {data['total_files']}"
        
        print(f"✅ Batch status after upload:")
        print(f"   Total files: {data['total_files']}")
        print(f"   Remaining: {data['remaining']}")
        print(f"   Total batches needed: {data['total_batches']}")
    
    def test_09_start_classification_no_files_error(self):
        """Test start classification returns proper error when no files"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        
        # Create a new empty session
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/create-session",
            headers=headers
        )
        assert response.status_code == 200
        empty_session_id = response.json()['session_id']
        
        # Try to start classification on empty session
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{empty_session_id}/start-classification",
            headers=headers
        )
        
        # Should return 400 error for no documents
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✅ Correctly returns 400 when no documents to classify")
    
    def test_10_batch_status_nonexistent_session(self):
        """Test batch status returns 404 for non-existent session"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        fake_session_id = str(uuid.uuid4())
        
        response = requests.get(
            f"{BASE_URL}/api/self-petition-v2/{fake_session_id}/batch-status",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✅ Correctly returns 404 for non-existent session")
    
    def test_11_force_continue_nonexistent_session(self):
        """Test force continue returns 404 for non-existent session"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        fake_session_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{fake_session_id}/force-continue",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✅ Correctly returns 404 for non-existent session")
    
    def test_12_start_classification_batch_mode(self):
        """Test POST /api/self-petition-v2/{session_id}/start-classification with batch mode"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        
        # Start classification in batch mode (default)
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/start-classification",
            headers=headers,
            params={"use_batch_mode": True}
        )
        
        assert response.status_code == 200, f"Start classification failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert 'session_id' in data, f"No session_id in response: {data}"
        assert 'status' in data, f"No status in response: {data}"
        assert 'mode' in data, f"No mode in response: {data}"
        assert data['mode'] == 'batch', f"Expected batch mode, got {data['mode']}"
        
        print(f"✅ Classification started in batch mode:")
        print(f"   Session ID: {data['session_id']}")
        print(f"   Status: {data['status']}")
        print(f"   Mode: {data['mode']}")
        print(f"   Batch size: {data.get('batch_size', 'N/A')}")
        print(f"   Total files: {data.get('total_files', 'N/A')}")
    
    def test_13_verify_classification_progress(self):
        """Verify classification is progressing after start"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        
        # Wait a bit for classification to start
        time.sleep(3)
        
        response = requests.get(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        
        # Status should be classifying or reviewing (if already done)
        valid_statuses = ['classifying', 'reviewing', 'batch_complete', 'completed']
        assert data['status'] in valid_statuses, f"Unexpected status: {data['status']}"
        
        print(f"✅ Classification progress:")
        print(f"   Status: {data['status']}")
        print(f"   Progress: {data['progress']}%")
        print(f"   Progress message: {data.get('progress_message', 'N/A')}")
        print(f"   Classified count: {data.get('classified_count', 0)}")
        print(f"   Needs retry count: {data.get('needs_retry_count', 0)}")
    
    def test_14_force_continue_during_classification(self):
        """Test force continue during classification"""
        assert TestSelfPetitionV2Batch.auth_token, "No auth token available"
        assert TestSelfPetitionV2Batch.session_id, "No session_id available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2Batch.auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{TestSelfPetitionV2Batch.session_id}/force-continue",
            headers=headers
        )
        
        assert response.status_code == 200, f"Force continue failed: {response.text}"
        data = response.json()
        
        # Should return status info
        assert 'session_id' in data or 'message' in data or 'status' in data, f"Unexpected response: {data}"
        
        print(f"✅ Force continue response:")
        print(f"   Status: {data.get('status', 'N/A')}")
        print(f"   Message: {data.get('message', 'N/A')}")
        print(f"   Classified so far: {data.get('classified_so_far', 'N/A')}")
        print(f"   Remaining: {data.get('remaining', 'N/A')}")


class TestSelfPetitionV2BatchEdgeCases:
    """Test edge cases for Self-Petition V2 Batch Processing"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
        
        # Login if not already
        if not TestSelfPetitionV2BatchEdgeCases.auth_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            if response.status_code == 200:
                TestSelfPetitionV2BatchEdgeCases.auth_token = response.json().get('access_token')
    
    def test_unauthorized_access_create_session(self):
        """Test create session without auth returns 401/403"""
        response = requests.post(f"{BASE_URL}/api/self-petition-v2/create-session")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Correctly returns {response.status_code} for unauthorized create-session")
    
    def test_unauthorized_access_batch_status(self):
        """Test batch status without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/self-petition-v2/test-session/batch-status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Correctly returns {response.status_code} for unauthorized batch-status")
    
    def test_unauthorized_access_force_continue(self):
        """Test force continue without auth returns 401/403"""
        response = requests.post(f"{BASE_URL}/api/self-petition-v2/test-session/force-continue")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Correctly returns {response.status_code} for unauthorized force-continue")
    
    def test_process_next_batch_endpoint(self):
        """Test POST /api/self-petition-v2/{session_id}/process-next-batch"""
        assert TestSelfPetitionV2BatchEdgeCases.auth_token, "No auth token available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2BatchEdgeCases.auth_token}"}
        
        # Create a new session
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/create-session",
            headers=headers
        )
        assert response.status_code == 200
        session_id = response.json()['session_id']
        
        # Try to process next batch on empty session
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{session_id}/process-next-batch",
            headers=headers
        )
        
        # Should return 200 with all_processed status or 400 error
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Process next batch response: {data.get('status', 'N/A')}")
        else:
            print(f"✅ Process next batch correctly returns error for empty session")
    
    def test_start_batch_classification_endpoint(self):
        """Test POST /api/self-petition-v2/{session_id}/start-batch-classification"""
        assert TestSelfPetitionV2BatchEdgeCases.auth_token, "No auth token available"
        
        headers = {"Authorization": f"Bearer {TestSelfPetitionV2BatchEdgeCases.auth_token}"}
        
        # Create a new session
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/create-session",
            headers=headers
        )
        assert response.status_code == 200
        session_id = response.json()['session_id']
        
        # Try to start batch classification on empty session
        response = requests.post(
            f"{BASE_URL}/api/self-petition-v2/{session_id}/start-batch-classification",
            headers=headers
        )
        
        # Should return 400 for no documents
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✅ Start batch classification correctly returns 400 for empty session")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
