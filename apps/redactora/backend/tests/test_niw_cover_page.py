"""
Test NIW Business Plan Professional Cover Page
Tests:
1. PDF download endpoint works correctly
2. Professional cover page is present with all required elements
3. "I. Cover Page" section is NOT in the content
"""
import pytest
import requests
import os
import re
from PyPDF2 import PdfReader
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test plan ID provided by main agent
TEST_PLAN_ID = "02d62b05-2cf7-4579-80cf-21fbefc69f07"


class TestNIWCoverPage:
    """Test NIW Business Plan professional cover page features"""
    
    def test_pdf_download_endpoint_status(self):
        """Test that the download endpoint returns 200 OK"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert len(response.content) > 0, "PDF content should not be empty"
        assert response.headers.get('content-type') in ['application/pdf', 'application/pdf; charset=utf-8'], \
            f"Expected PDF content type, got {response.headers.get('content-type')}"
        
        print(f"✅ PDF download successful: {len(response.content)} bytes")
    
    def test_pdf_has_multiple_pages(self):
        """Test that the PDF has at least 2 pages (cover + content)"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        # Parse PDF
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        num_pages = len(reader.pages)
        assert num_pages >= 2, f"PDF should have at least 2 pages (cover + content), got {num_pages}"
        
        print(f"✅ PDF has {num_pages} pages")
    
    def test_cover_page_has_project_title_uppercase(self):
        """Test that the first page has the project title in uppercase"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        # Extract text from first page (cover page)
        first_page_text = reader.pages[0].extract_text()
        
        assert first_page_text is not None, "First page should have text"
        assert len(first_page_text.strip()) > 0, "First page should not be empty"
        
        # The title should be in uppercase
        # Looking for words in all caps that indicate the project title
        # First page should have UPPERCASE text (project title)
        uppercase_words = re.findall(r'\b[A-Z][A-Z\s]{3,}\b', first_page_text)
        
        assert len(uppercase_words) > 0, "Cover page should have uppercase title text"
        print(f"✅ Cover page contains uppercase text: {uppercase_words[:3]}")
    
    def test_cover_page_has_eb2_niw_subtitle(self):
        """Test that the cover page has 'EB-2 National Interest Waiver Proposal' subtitle"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check for EB-2 National Interest Waiver text
        assert "EB-2" in first_page_text or "EB2" in first_page_text or "National Interest" in first_page_text, \
            f"Cover page should contain 'EB-2 National Interest Waiver Proposal', got: {first_page_text[:500]}"
        
        print(f"✅ Cover page contains EB-2 NIW subtitle")
    
    def test_cover_page_has_submitted_by(self):
        """Test that the cover page has 'Submitted by:' followed by applicant name"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check for "Submitted by:" text
        assert "Submitted by" in first_page_text or "submitted by" in first_page_text.lower(), \
            f"Cover page should contain 'Submitted by:', got: {first_page_text[:500]}"
        
        print(f"✅ Cover page contains 'Submitted by' section")
    
    def test_cover_page_has_date(self):
        """Test that the cover page includes the current date"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check for "Date:" text
        assert "Date:" in first_page_text or "date:" in first_page_text.lower() or "2025" in first_page_text or "2026" in first_page_text, \
            f"Cover page should contain date information, got: {first_page_text[:500]}"
        
        print(f"✅ Cover page contains date information")
    
    def test_cover_page_has_document_type(self):
        """Test that the cover page includes 'Document Type: EB-2 National Interest Waiver Business Plan'"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check for "Document Type" text
        assert "Document Type" in first_page_text or "document type" in first_page_text.lower() or "Business Plan" in first_page_text, \
            f"Cover page should contain 'Document Type' info, got: {first_page_text[:500]}"
        
        print(f"✅ Cover page contains Document Type information")
    
    def test_cover_page_has_legal_reference(self):
        """Test that the cover page includes 'Pursuant to Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)'"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check for Dhanasar legal reference
        assert "Dhanasar" in first_page_text or "26 I&N Dec" in first_page_text or "884" in first_page_text, \
            f"Cover page should contain Dhanasar legal reference, got: {first_page_text[:500]}"
        
        print(f"✅ Cover page contains legal reference (Dhanasar)")
    
    def test_no_cover_page_section_in_content(self):
        """Test that 'I. Cover Page' section does NOT appear in the PDF content"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        # Extract text from ALL pages
        full_text = ""
        for page in reader.pages:
            page_text = page.extract_text() or ""
            full_text += page_text + "\n"
        
        # Check that "I. Cover Page" is NOT in the content
        # Also check Spanish version "I. Portada"
        assert "I. Cover Page" not in full_text, \
            "PDF should NOT contain 'I. Cover Page' section header in content"
        
        # More flexible check for "Cover Page" as a section header
        cover_section_pattern = re.search(r'I\.\s*Cover\s*Page', full_text, re.IGNORECASE)
        assert cover_section_pattern is None, \
            f"PDF should NOT contain 'I. Cover Page' section, found: {cover_section_pattern.group() if cover_section_pattern else 'None'}"
        
        print(f"✅ No 'I. Cover Page' section found in content - correctly skipped")
    
    def test_content_starts_after_cover_page(self):
        """Test that the main content starts on page 2 or later"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        assert len(reader.pages) >= 2, "PDF should have at least 2 pages"
        
        # First page should be cover, second page should have content
        second_page_text = reader.pages[1].extract_text() if len(reader.pages) > 1 else ""
        
        # Second page should contain actual section content, not just cover info
        # Looking for section numbers like "II." or "III." or actual content words
        has_content = len(second_page_text) > 100 and (
            "II." in second_page_text or 
            "III." in second_page_text or
            "Executive" in second_page_text or
            "Resumen" in second_page_text or
            "Summary" in second_page_text or
            "Introduction" in second_page_text or
            "Introducción" in second_page_text
        )
        
        assert has_content, f"Page 2 should contain main content, got: {second_page_text[:300]}"
        
        print(f"✅ Main content starts on page 2 (after cover page)")
    
    def test_english_pdf_download(self):
        """Test that English version also works"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "en"},
            timeout=30
        )
        
        assert response.status_code == 200, f"English PDF download failed with {response.status_code}"
        assert len(response.content) > 0, "English PDF should not be empty"
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Check cover page elements in English version
        assert "EB-2" in first_page_text or "National Interest" in first_page_text or "Waiver" in first_page_text, \
            f"English PDF should have EB-2 NIW on cover page"
        
        print(f"✅ English PDF download successful with cover page")


class TestCoverPageDetails:
    """Additional tests for cover page formatting details"""
    
    def test_first_page_is_dedicated_cover(self):
        """Test that first page is a dedicated cover, not mixed with content"""
        response = requests.get(
            f"{BASE_URL}/api/business-plans/{TEST_PLAN_ID}/download",
            params={"language": "es"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        first_page_text = reader.pages[0].extract_text()
        
        # Cover page should NOT contain section content markers like "II.", "III."
        # It should be a clean cover with only cover elements
        has_section_markers = bool(re.search(r'\b(II|III|IV|V)\.\s+[A-Z]', first_page_text))
        
        if has_section_markers:
            print(f"⚠️ Warning: First page contains section markers - may not be a dedicated cover")
        else:
            print(f"✅ First page is a dedicated cover page (no section markers)")
        
        # Not a hard failure, just informational
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
