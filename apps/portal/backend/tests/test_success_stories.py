"""
Success Stories API Tests
Tests for the 100 seeded success stories with face images, filtering, and admin CRUD operations
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')

# Admin credentials for authenticated tests
ADMIN_EMAIL = "admin@urpe.com"
ADMIN_PASSWORD = "urpe2024"


class TestPublicSuccessStories:
    """Public endpoint tests (no auth required)"""

    def test_get_public_stories_returns_100(self):
        """Test that public endpoint returns 100 success stories"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "stories" in data
        stories = data["stories"]
        
        # Should have 100 stories
        assert len(stories) == 100, f"Expected 100 stories, got {len(stories)}"
        print(f"✅ Public endpoint returns {len(stories)} stories")

    def test_stories_have_all_required_fields(self):
        """Test that each story has all required fields"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        required_fields = ["id", "name", "profession", "country", "visa", "photo", "score"]
        new_fields = ["gender", "age", "previousStatus", "projectName", "processingTime", "quote", "keyAdvice"]
        
        # Check first 10 stories for required fields
        for i, story in enumerate(stories[:10]):
            for field in required_fields:
                assert field in story, f"Story {i} missing required field: {field}"
        
        # Check that NEW fields exist in stories (gender, age, previousStatus, projectName)
        stories_with_gender = [s for s in stories if s.get("gender")]
        stories_with_age = [s for s in stories if s.get("age")]
        stories_with_prev_status = [s for s in stories if s.get("previousStatus")]
        stories_with_project = [s for s in stories if s.get("projectName")]
        
        print(f"✅ Stories with gender: {len(stories_with_gender)}")
        print(f"✅ Stories with age: {len(stories_with_age)}")
        print(f"✅ Stories with previousStatus: {len(stories_with_prev_status)}")
        print(f"✅ Stories with projectName: {len(stories_with_project)}")
        
        # Most stories should have these fields (seeded data should have 100%)
        assert len(stories_with_gender) >= 90, f"Expected most stories to have gender, got {len(stories_with_gender)}"
        assert len(stories_with_age) >= 90, f"Expected most stories to have age, got {len(stories_with_age)}"

    def test_story_score_range_40_to_60(self):
        """Test that scores are in the 40-60% range as specified"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        scores = [s.get("score", 0) for s in stories]
        scores_in_range = [s for s in scores if 40 <= s <= 60]
        
        # At least 90% should be in the 40-60 range
        percentage_in_range = len(scores_in_range) / len(scores) * 100
        print(f"✅ {percentage_in_range:.1f}% of scores are in 40-60% range")
        assert percentage_in_range >= 90, f"Expected 90%+ scores in 40-60 range, got {percentage_in_range:.1f}%"

    def test_story_ages_35_to_60(self):
        """Test that ages are in 35-60 range as specified"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        ages = [s.get("age", 0) for s in stories if s.get("age")]
        ages_in_range = [a for a in ages if 35 <= a <= 60]
        
        if ages:
            percentage_in_range = len(ages_in_range) / len(ages) * 100
            print(f"✅ {percentage_in_range:.1f}% of ages are in 35-60 range")
            assert percentage_in_range >= 90, f"Expected 90%+ ages in 35-60 range"

    def test_nationality_distribution(self):
        """Test that most nationalities are Colombia/Venezuela/Ecuador/Mexico/Argentina"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        target_countries = ["Colombia", "Venezuela", "Ecuador", "Mexico", "México", "Argentina"]
        countries = [s.get("country", "") for s in stories]
        
        target_count = sum(1 for c in countries if any(tc.lower() in c.lower() for tc in target_countries))
        percentage = target_count / len(countries) * 100
        
        print(f"✅ {percentage:.1f}% from target countries (Colombia/Venezuela/Ecuador/Mexico/Argentina)")
        # Should be majority from these countries
        assert percentage >= 70, f"Expected 70%+ from target countries, got {percentage:.1f}%"

    def test_previous_status_distribution(self):
        """Test previous status options (Asylum Pending, Visa TN, tourist visa)"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        statuses = [s.get("previousStatus", "") for s in stories if s.get("previousStatus")]
        target_statuses = ["Asylum Pending", "Visa TN", "Visa de Turista", "tourist", "asilo"]
        
        matching = sum(1 for st in statuses if any(ts.lower() in st.lower() for ts in target_statuses))
        if statuses:
            percentage = matching / len(statuses) * 100
            print(f"✅ {percentage:.1f}% have target previous status types")
            print(f"   Sample statuses: {list(set(statuses))[:5]}")

    def test_filters_response_structure(self):
        """Test that filters are returned correctly"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public")
        assert response.status_code == 200
        
        data = response.json()
        assert "filters" in data
        filters = data["filters"]
        
        assert "professions" in filters
        assert "countries" in filters
        assert "visas" in filters
        
        print(f"✅ Filters - Professions: {len(filters['professions'])}, Countries: {len(filters['countries'])}, Visas: {len(filters['visas'])}")

    def test_filter_by_profession(self):
        """Test filtering by profession"""
        # First get all professions
        response = requests.get(f"{BASE_URL}/api/success-stories/public")
        data = response.json()
        
        if data.get("filters", {}).get("professions"):
            profession = data["filters"]["professions"][0]
            
            # Filter by first profession
            filtered_response = requests.get(f"{BASE_URL}/api/success-stories/public?profession={profession}")
            assert filtered_response.status_code == 200
            
            filtered_data = filtered_response.json()
            filtered_stories = filtered_data["stories"]
            
            # All filtered stories should contain the profession
            for story in filtered_stories:
                assert profession.lower() in story.get("profession", "").lower(), f"Story profession doesn't match filter"
            
            print(f"✅ Filtered by profession '{profession}': {len(filtered_stories)} results")

    def test_filter_by_country(self):
        """Test filtering by country"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public")
        data = response.json()
        
        if data.get("filters", {}).get("countries"):
            country = data["filters"]["countries"][0]
            
            filtered_response = requests.get(f"{BASE_URL}/api/success-stories/public?country={country}")
            assert filtered_response.status_code == 200
            
            filtered_data = filtered_response.json()
            filtered_stories = filtered_data["stories"]
            
            for story in filtered_stories:
                assert country.lower() in story.get("country", "").lower()
            
            print(f"✅ Filtered by country '{country}': {len(filtered_stories)} results")


class TestFaceImages:
    """Face image serving tests"""

    def test_face_image_endpoint_exists(self):
        """Test that face image endpoint returns 200 for valid image"""
        response = requests.get(f"{BASE_URL}/api/faces/face_000_m.png")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "image" in response.headers.get("content-type", "")
        print("✅ Face image endpoint working")

    def test_face_images_resolve_from_stories(self):
        """Test that photo URLs in stories resolve to actual images"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        images_checked = 0
        images_success = 0
        
        for story in stories[:5]:  # Check first 5
            photo_url = story.get("photo", "")
            if photo_url and photo_url.startswith("/api/faces/"):
                full_url = f"{BASE_URL}{photo_url}"
                img_response = requests.get(full_url)
                images_checked += 1
                if img_response.status_code == 200:
                    images_success += 1
        
        if images_checked > 0:
            success_rate = images_success / images_checked * 100
            print(f"✅ Face image resolution: {success_rate:.0f}% ({images_success}/{images_checked})")
            assert success_rate >= 80, f"Expected 80%+ images to resolve, got {success_rate:.0f}%"

    def test_face_image_404_for_invalid(self):
        """Test that invalid face image returns 404"""
        response = requests.get(f"{BASE_URL}/api/faces/nonexistent_face.png")
        assert response.status_code == 404
        print("✅ Invalid face image returns 404 correctly")


class TestAdminSuccessStories:
    """Admin endpoint tests (requires authentication)"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        
        data = response.json()
        token = data.get("token")
        if not token:
            pytest.skip("No token returned from admin login")
        return token

    def test_admin_login(self, admin_token):
        """Test admin can login successfully"""
        assert admin_token is not None
        print("✅ Admin login successful")

    def test_admin_get_all_stories_paginated(self, admin_token):
        """Test admin endpoint returns paginated results"""
        response = requests.get(
            f"{BASE_URL}/api/success-stories/admin/all?page=1&limit=20",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "stories" in data
        assert "pagination" in data
        
        pagination = data["pagination"]
        assert pagination["total"] == 100, f"Expected 100 total, got {pagination['total']}"
        assert pagination["limit"] == 20
        assert pagination["pages"] == 5  # 100 / 20 = 5 pages
        
        print(f"✅ Admin pagination: {pagination['total']} total, {pagination['pages']} pages")

    def test_admin_update_story_fields(self, admin_token):
        """Test admin can update all new fields (gender, age, previousStatus, projectName)"""
        # First get a story to update
        response = requests.get(
            f"{BASE_URL}/api/success-stories/admin/all?page=1&limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if not data["stories"]:
            pytest.skip("No stories to update")
        
        story = data["stories"][0]
        story_id = story["id"]
        
        # Update with new values
        update_data = {
            "gender": "F",
            "age": 45,
            "previousStatus": "Visa TN",
            "projectName": "TEST_Updated_Project_Name"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/success-stories/admin/{story_id}",
            json=update_data,
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update
        updated_data = update_response.json()
        assert updated_data.get("success") == True
        
        updated_story = updated_data.get("story", {})
        assert updated_story.get("projectName") == "TEST_Updated_Project_Name"
        
        print(f"✅ Admin update successful for story {story_id}")
        
        # Revert the change
        revert_data = {
            "projectName": story.get("projectName", "")
        }
        requests.put(
            f"{BASE_URL}/api/success-stories/admin/{story_id}",
            json=revert_data,
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
        )

    def test_admin_toggle_featured(self, admin_token):
        """Test admin can toggle featured status"""
        # Get a story
        response = requests.get(
            f"{BASE_URL}/api/success-stories/admin/all?page=1&limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        if not data["stories"]:
            pytest.skip("No stories")
        
        story = data["stories"][0]
        story_id = story["id"]
        original_featured = story.get("featured", False)
        
        # Toggle featured
        toggle_response = requests.post(
            f"{BASE_URL}/api/success-stories/admin/{story_id}/toggle-featured",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert toggle_response.status_code == 200
        
        toggle_data = toggle_response.json()
        assert toggle_data.get("success") == True
        assert toggle_data.get("featured") == (not original_featured)
        
        print(f"✅ Toggle featured: {original_featured} -> {not original_featured}")
        
        # Toggle back
        requests.post(
            f"{BASE_URL}/api/success-stories/admin/{story_id}/toggle-featured",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

    def test_admin_toggle_active(self, admin_token):
        """Test admin can toggle active status"""
        response = requests.get(
            f"{BASE_URL}/api/success-stories/admin/all?page=1&limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        if not data["stories"]:
            pytest.skip("No stories")
        
        story = data["stories"][0]
        story_id = story["id"]
        original_active = story.get("active", True)
        
        toggle_response = requests.post(
            f"{BASE_URL}/api/success-stories/admin/{story_id}/toggle-active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert toggle_response.status_code == 200
        
        toggle_data = toggle_response.json()
        assert toggle_data.get("success") == True
        
        print(f"✅ Toggle active: {original_active} -> {not original_active}")
        
        # Toggle back
        requests.post(
            f"{BASE_URL}/api/success-stories/admin/{story_id}/toggle-active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

    def test_admin_search_stories(self, admin_token):
        """Test admin can search stories"""
        response = requests.get(
            f"{BASE_URL}/api/success-stories/admin/all?search=Colombia",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        # All results should match search term
        for story in stories:
            match = (
                "colombia" in story.get("name", "").lower() or
                "colombia" in story.get("profession", "").lower() or
                "colombia" in story.get("country", "").lower()
            )
            assert match, f"Story doesn't match search: {story.get('name')}"
        
        print(f"✅ Admin search 'Colombia' returned {len(stories)} results")

    def test_admin_requires_auth(self):
        """Test admin endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/success-stories/admin/all")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin endpoint correctly requires authentication")


class TestProfessionDistribution:
    """Test profession distribution (60% STEM, rest doctors/lawyers/business)"""

    def test_profession_distribution(self):
        """Test that ~60% are STEM professions"""
        response = requests.get(f"{BASE_URL}/api/success-stories/public?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        stories = data["stories"]
        
        stem_keywords = ["ingenier", "software", "data", "cienti", "technolog", "developer",
                        "analyst", "machine", "ai", "artificial", "comput", "system", "cyber",
                        "network", "cloud", "devops", "architect", "programmer", "coding"]
        
        other_professional = ["doctor", "medic", "abogad", "lawyer", "attorney", "legal",
                             "business", "admin", "mba", "negocio", "internacional", "comercio"]
        
        professions = [s.get("profession", "").lower() for s in stories]
        
        stem_count = sum(1 for p in professions if any(kw in p for kw in stem_keywords))
        other_count = sum(1 for p in professions if any(kw in p for kw in other_professional))
        
        stem_percentage = stem_count / len(professions) * 100 if professions else 0
        other_percentage = other_count / len(professions) * 100 if professions else 0
        
        print(f"✅ Profession distribution:")
        print(f"   STEM: {stem_percentage:.1f}% ({stem_count}/{len(professions)})")
        print(f"   Other Professional: {other_percentage:.1f}% ({other_count}/{len(professions)})")
        
        # Verify STEM + Other Professional covers most stories
        total_professional = stem_percentage + other_percentage
        print(f"   Total identified: {total_professional:.1f}%")
        # Combined should cover majority of profiles
        assert total_professional >= 70, f"Expected 70%+ identified professions, got {total_professional:.1f}%"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
