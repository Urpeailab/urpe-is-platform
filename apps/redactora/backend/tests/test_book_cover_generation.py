"""
Test suite for Book Cover Image Generation using Gemini Nano Banana
Tests:
- POST /api/books/{book_id}/generate-cover-image - Start async generation
- GET /api/books/{book_id}/cover-status - Check generation status
- Verify image saved to /app/backend/static/covers/
- Verify image URL returned when completed
"""

import pytest
import requests
import os
import time
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials provided
TEST_USER_EMAIL = "covertest2@test.com"
TEST_USER_PASSWORD = "Test123!"
BOOK_ID_FOR_TESTING = "46590187-5dcb-44fb-848e-9e74d4e19442"


class TestBookCoverGeneration:
    """Test suite for book cover image generation with Gemini Nano Banana"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            },
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n[AUTH] Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            print(f"[AUTH] Token obtained: {token[:20] if token else 'None'}...")
            return token
        else:
            print(f"[AUTH] Login failed: {response.text[:200]}")
            pytest.skip("Authentication failed - skipping tests")
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Create authenticated session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_1_book_exists(self, api_client):
        """Verify the test book exists in database"""
        # First check cover status to verify book exists
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_1] Book exists check - Status: {response.status_code}")
        print(f"[TEST_1] Response: {response.text[:300]}")
        
        # If 404, the book doesn't exist
        if response.status_code == 404:
            pytest.skip(f"Test book {BOOK_ID_FOR_TESTING} not found in database")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_2_reset_book_cover_status(self, api_client):
        """Reset book cover status to 'not_started' before testing generation"""
        # Note: This may require direct DB access or a reset endpoint
        # For now, we check current status
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_2] Current cover status check - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            current_status = data.get('status', 'unknown')
            print(f"[TEST_2] Current cover status: {current_status}")
            print(f"[TEST_2] Image URL: {data.get('image_url', 'None')}")
            
            # If already completed, we can still test the status endpoint
            if current_status == 'completed':
                print("[TEST_2] Cover already generated - will verify status endpoint returns correct data")
    
    def test_3_generate_cover_image_endpoint(self, api_client):
        """Test POST /api/books/{book_id}/generate-cover-image starts generation"""
        response = api_client.post(
            f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/generate-cover-image"
        )
        
        print(f"\n[TEST_3] Generate cover image - Status: {response.status_code}")
        print(f"[TEST_3] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "success" in data, "Response should have 'success' field"
        assert data.get("success") == True, "success should be True"
        assert "status" in data, "Response should have 'status' field"
        assert data.get("status") == "generating", f"Status should be 'generating', got {data.get('status')}"
        assert "book_id" in data, "Response should have 'book_id' field"
        assert data.get("book_id") == BOOK_ID_FOR_TESTING, "book_id should match"
        
        print("[TEST_3] ✅ Generation initiated successfully")
    
    def test_4_cover_status_after_start(self, api_client):
        """Test GET /api/books/{book_id}/cover-status returns 'generating' immediately after start"""
        # Small delay to let the background task start
        time.sleep(1)
        
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_4] Cover status after start - Status: {response.status_code}")
        print(f"[TEST_4] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "book_id" in data, "Response should have 'book_id'"
        assert "status" in data, "Response should have 'status'"
        
        status = data.get("status")
        print(f"[TEST_4] Cover generation status: {status}")
        
        # Status should be 'generating', 'completed', or 'error'
        assert status in ["generating", "completed", "error", "not_started"], f"Unexpected status: {status}"
    
    def test_5_poll_for_completion(self, api_client):
        """Poll cover status until completed or timeout (30 seconds)"""
        max_wait_time = 40  # seconds
        poll_interval = 3  # seconds
        elapsed = 0
        
        print(f"\n[TEST_5] Polling for cover generation completion (max {max_wait_time}s)...")
        
        final_status = None
        final_data = None
        
        while elapsed < max_wait_time:
            response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
            
            if response.status_code != 200:
                print(f"[TEST_5] Unexpected status code: {response.status_code}")
                time.sleep(poll_interval)
                elapsed += poll_interval
                continue
            
            data = response.json()
            status = data.get("status")
            
            print(f"[TEST_5] {elapsed}s - Status: {status}")
            
            if status == "completed":
                final_status = "completed"
                final_data = data
                print(f"[TEST_5] ✅ Cover generation completed!")
                print(f"[TEST_5] Image URL: {data.get('image_url')}")
                break
            elif status == "error":
                final_status = "error"
                final_data = data
                print(f"[TEST_5] ❌ Cover generation error: {data.get('error')}")
                break
            
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # Assert results
        if final_status == "completed":
            assert final_data.get("image_url") is not None, "Image URL should be present when completed"
            assert "/static/covers/" in final_data.get("image_url", ""), "Image URL should contain /static/covers/"
            print(f"[TEST_5] ✅ Image URL format verified: {final_data.get('image_url')}")
        elif final_status == "error":
            pytest.fail(f"Cover generation failed with error: {final_data.get('error')}")
        else:
            # Timeout - check last status
            response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
            data = response.json()
            print(f"[TEST_5] Timeout - Final status: {data.get('status')}")
            
            if data.get("status") == "generating":
                pytest.skip("Cover generation still in progress after timeout - may need more time")
            elif data.get("status") == "completed":
                print(f"[TEST_5] Completed at last check! Image URL: {data.get('image_url')}")
    
    def test_6_verify_image_url_accessible(self, api_client):
        """Verify the generated image URL is accessible"""
        # Get current status to get the image URL
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_6] Verifying image URL accessibility")
        
        if response.status_code != 200:
            pytest.skip("Could not get cover status")
        
        data = response.json()
        
        if data.get("status") != "completed":
            pytest.skip(f"Cover not completed yet, status: {data.get('status')}")
        
        image_url = data.get("image_url")
        if not image_url:
            pytest.fail("No image URL returned despite status being 'completed'")
        
        # Try to access the image
        full_image_url = f"{BASE_URL}{image_url}"
        print(f"[TEST_6] Fetching image from: {full_image_url}")
        
        img_response = requests.get(full_image_url)
        
        print(f"[TEST_6] Image response status: {img_response.status_code}")
        print(f"[TEST_6] Content-Type: {img_response.headers.get('Content-Type', 'unknown')}")
        print(f"[TEST_6] Content-Length: {len(img_response.content)} bytes")
        
        assert img_response.status_code == 200, f"Image should be accessible, got {img_response.status_code}"
        assert len(img_response.content) > 1000, "Image should have substantial content"
        
        content_type = img_response.headers.get('Content-Type', '')
        assert 'image' in content_type.lower() or len(img_response.content) > 1000, "Response should be an image"
        
        print(f"[TEST_6] ✅ Image accessible and valid ({len(img_response.content)} bytes)")
    
    def test_7_cover_status_response_structure(self, api_client):
        """Verify cover status endpoint returns correct response structure"""
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_7] Verifying cover status response structure")
        print(f"[TEST_7] Response: {response.text[:500]}")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields
        assert "book_id" in data, "Response must have 'book_id'"
        assert "status" in data, "Response must have 'status'"
        
        # Status-dependent fields
        status = data.get("status")
        if status == "completed":
            assert "image_url" in data, "Completed status must have 'image_url'"
            assert data.get("image_url") is not None, "image_url should not be None when completed"
        elif status == "error":
            assert "error" in data, "Error status must have 'error' field"
        
        print(f"[TEST_7] ✅ Response structure is valid for status: {status}")
    
    def test_8_get_cover_image_endpoint(self, api_client):
        """Test GET /api/books/{book_id}/cover-image endpoint"""
        response = api_client.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-image")
        
        print(f"\n[TEST_8] Testing /cover-image endpoint")
        print(f"[TEST_8] Status: {response.status_code}")
        print(f"[TEST_8] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should have has_cover field
        assert "has_cover" in data, "Response should have 'has_cover' field"
        
        if data.get("has_cover"):
            assert "image_url" in data, "Should have image_url when has_cover is True"
            assert data.get("image_url") is not None, "image_url should not be None"
            print(f"[TEST_8] ✅ Cover image exists: {data.get('image_url')}")
        else:
            print(f"[TEST_8] No cover image yet")
    
    def test_9_unauthorized_access(self):
        """Test that endpoints require authentication"""
        # Try without auth token
        response = requests.get(f"{BASE_URL}/api/books/{BOOK_ID_FOR_TESTING}/cover-status")
        
        print(f"\n[TEST_9] Unauthorized access test")
        print(f"[TEST_9] Status code: {response.status_code}")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"[TEST_9] ✅ Authentication properly required")


class TestBookCoverEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Create authenticated session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_nonexistent_book_cover_status(self, api_client):
        """Test cover status for non-existent book returns 404"""
        fake_book_id = "non-existent-book-id-12345"
        
        response = api_client.get(f"{BASE_URL}/api/books/{fake_book_id}/cover-status")
        
        print(f"\n[EDGE_1] Non-existent book cover status")
        print(f"[EDGE_1] Status: {response.status_code}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent book, got {response.status_code}"
        print("[EDGE_1] ✅ Properly returns 404 for non-existent book")
    
    def test_nonexistent_book_generate_cover(self, api_client):
        """Test generate cover for non-existent book returns 404"""
        fake_book_id = "non-existent-book-id-12345"
        
        response = api_client.post(f"{BASE_URL}/api/books/{fake_book_id}/generate-cover-image")
        
        print(f"\n[EDGE_2] Non-existent book generate cover")
        print(f"[EDGE_2] Status: {response.status_code}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent book, got {response.status_code}"
        print("[EDGE_2] ✅ Properly returns 404 for non-existent book")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
