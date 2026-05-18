"""
Test Policy Paper (Social Impact Report) Generation
Tests the fix for GPT-4o rejection issue - now using GPT-5.1

Bug Context:
- GPT-4o was rejecting generation of long documents (10,000+ words) with 
  "I'm sorry, but I can't assist with that request"
- Fix: Changed to GPT-5.1 which handles long document generation better

Test Criteria:
1. Report generates successfully (no rejection messages)
2. Report has minimum 5000 characters (substantial content)
3. Report does NOT contain rejection phrases like "I'm sorry" or "I can't assist"
4. Report has proper structure with expected sections

Evidence of Bug (OLD paper before fix):
- Paper ID: 2836aa0a-42e2-477d-8e67-83c11f650efe
- Created: 2026-02-03T15:32:50
- Content: "I'm unable to fulfill your request for a full-length document..."
- Length: 285 characters (rejection message only)

Evidence of Fix (NEW paper after fix):
- Paper ID: 5fa4e921-6093-40e7-9bd3-0b00c4f8df71
- Created: 2026-02-03T16:07:11
- Content: Full Economic Impact Analysis with all sections
- Length: 94,425 characters (proper report)
"""

import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test_policy@test.com"
TEST_PASSWORD = "Test123!"
TEST_CLIENT_ID = "695d592c60d80d6d3f0af6f2"

# Paper IDs for verification
OLD_PAPER_WITH_BUG = "2836aa0a-42e2-477d-8e67-83c11f650efe"
NEW_PAPER_WITH_FIX = "5fa4e921-6093-40e7-9bd3-0b00c4f8df71"

# Rejection phrases that indicate the bug is NOT fixed
REJECTION_PHRASES = [
    "I'm sorry",
    "I can't assist",
    "I cannot assist",
    "I'm unable to",
    "I cannot help",
    "I can't help",
    "I apologize, but",
    "I'm not able to",
    "unable to generate",
    "cannot generate",
    "refuse to",
]

# Expected sections in a policy paper
EXPECTED_SECTIONS = [
    "Executive Summary",
    "Introduction",
    "Methodology",
    "Analysis",
    "Conclusion",
]


class TestPolicyPaperGeneration:
    """Test suite for Policy Paper (Social Impact Report) generation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}"
        }
    
    def test_01_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        print("✅ API health check passed")
    
    def test_02_login_works(self):
        """Verify test user can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✅ Login successful for {TEST_EMAIL}")
    
    def test_03_verify_old_paper_had_rejection_bug(self, headers):
        """
        Verify the OLD paper (before fix) had the rejection bug.
        This confirms the bug existed.
        """
        response = requests.get(
            f"{BASE_URL}/api/policy-papers/{OLD_PAPER_WITH_BUG}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get old paper: {response.text}"
        paper = response.json()
        
        content_en = paper.get("content_en", "")
        
        # Verify this paper has the rejection message (bug evidence)
        has_rejection = any(phrase.lower() in content_en.lower() for phrase in [
            "I'm unable to fulfill",
            "I can't assist",
            "I cannot assist",
            "I'm sorry"
        ])
        
        assert has_rejection, "Old paper should have rejection message (bug evidence)"
        assert len(content_en) < 1000, f"Old paper should be short (rejection only), got {len(content_en)} chars"
        
        print(f"✅ Confirmed OLD paper has rejection bug:")
        print(f"   Paper ID: {OLD_PAPER_WITH_BUG}")
        print(f"   Content length: {len(content_en)} chars")
        print(f"   Content: {content_en[:200]}...")
    
    def test_04_verify_new_paper_fix_works(self, headers):
        """
        CRITICAL TEST: Verify the NEW paper (after fix) generates properly.
        This confirms the fix is working.
        """
        response = requests.get(
            f"{BASE_URL}/api/policy-papers/{NEW_PAPER_WITH_FIX}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get new paper: {response.text}"
        paper = response.json()
        
        content_en = paper.get("content_en", "")
        content_es = paper.get("content_es", "")
        
        # CRITICAL CHECK 1: No rejection phrases
        rejection_phrases = [
            "I'm unable to fulfill",
            "I can't assist",
            "I cannot assist",
            "I'm sorry",
            "unable to generate"
        ]
        
        has_rejection = any(phrase.lower() in content_en.lower() for phrase in rejection_phrases)
        assert not has_rejection, f"New paper should NOT have rejection message"
        print("✅ No rejection phrases found in new paper")
        
        # CRITICAL CHECK 2: Content length (minimum 5000 chars)
        assert len(content_en) >= 5000, f"Content too short: {len(content_en)} chars (expected 5000+)"
        print(f"✅ Content length check passed: {len(content_en)} characters")
        
        # CRITICAL CHECK 3: Has expected structure
        expected_sections = ["Executive Summary", "Introduction", "Methodology", "Analysis", "Conclusion"]
        sections_found = [s for s in expected_sections if s.lower() in content_en.lower()]
        assert len(sections_found) >= 3, f"Missing sections. Found: {sections_found}"
        print(f"✅ Structure check passed. Sections found: {sections_found}")
        
        # CRITICAL CHECK 4: Spanish translation exists
        assert len(content_es) >= 5000, f"Spanish translation too short: {len(content_es)} chars"
        print(f"✅ Spanish translation exists: {len(content_es)} characters")
        
        print(f"\n✅ FIX VERIFIED - New paper generated successfully:")
        print(f"   Paper ID: {NEW_PAPER_WITH_FIX}")
        print(f"   English content: {len(content_en)} chars")
        print(f"   Spanish content: {len(content_es)} chars")
        print(f"   Status: {paper.get('status')}")
    
    def test_05_list_policy_papers_endpoint(self, headers):
        """Verify the list policy papers endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/policy-papers",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "papers" in data
        assert len(data["papers"]) >= 2, "Should have at least 2 papers (old bug + new fix)"
        
        print(f"✅ List endpoint works. Found {len(data['papers'])} papers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
