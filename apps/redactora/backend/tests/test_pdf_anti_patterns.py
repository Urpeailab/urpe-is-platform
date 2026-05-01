"""
PDF Rendering Anti-Patterns — Regression tests for Books / Case Studies / Policy Papers.

User-reported issues (Feb 2026):
1. **Books**: Black squares (■) appearing in PDFs — Unicode subscripts like CO₂, A₁
   were not being converted to ASCII in `html_to_paragraphs` (book PDF renderer).
2. **Case Studies**: Tables overflow the page width — no `colWidths` calculation,
   cells were plain strings instead of `Paragraph` so no word-wrapping happened.
3. **Policy Papers**: Triple-quote fences (''') sometimes leaked into the PDF —
   `preprocess_content` only stripped `\[...\]` LaTeX and internal tags.

These tests render real PDFs via the production code paths and assert the
artifacts are NOT present in the extracted text.
"""

import io
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ────────────────────────────────────────────────────────────────────────────
# Issue 1: Book PDF — Unicode subscripts → ASCII (no black squares)
# ────────────────────────────────────────────────────────────────────────────

class TestBookPDFSubscripts:
    def test_html_to_paragraphs_converts_unicode_subscripts(self):
        """`html_to_paragraphs` (inner fn of create_book_pdf_with_toc) must
        convert ₀₁₂…ₜ to ASCII. We exercise it end-to-end via the book PDF."""
        from server import create_book_pdf_with_toc

        chapters = [{
            "title": "Environmental Impact",
            "content_es": (
                "<p>El proyecto reduce las emisiones de CO₂ en 42% y mejora la "
                "concentración de H₂O₂ para tratamientos médicos. Variables: "
                "A₁=5, A₂=12, β₀=0.85, βₜ=0.12.</p>"
            ),
        }]
        pdf_bytes = create_book_pdf_with_toc(
            title="Test Book",
            author_name="Dr. Test",
            chapters=chapters,
            synopsis="Synopsis for testing",
            language="es",
        )
        assert len(pdf_bytes) > 2000

        # Extract text
        proc = subprocess.run(
            ['pdftotext', '-', '-'],
            input=pdf_bytes, capture_output=True, timeout=30,
        )
        text = proc.stdout.decode('utf-8', errors='ignore')

        # No black squares
        assert text.count('\u25A0') == 0, (
            "Black squares (■) found in book PDF — subscript conversion failed"
        )
        # Subscripts must have been replaced with ASCII
        assert 'CO2' in text, "CO₂ did not convert to CO2"
        assert 'H2O2' in text, "H₂O₂ did not convert to H2O2"
        assert 'A1' in text, "A₁ did not convert to A1"
        assert 'A2' in text, "A₂ did not convert to A2"

    def test_html_to_paragraphs_converts_superscripts(self):
        """Superscripts ⁴⁵⁶⁷⁸⁹ must also convert to ASCII."""
        from server import create_book_pdf_with_toc
        chapters = [{
            "title": "Math Chapter",
            "content_en": "<p>Area formula: πr² where r⁴ ≈ 16 for r=2. Also x⁵, y⁷, z⁹.</p>",
        }]
        pdf_bytes = create_book_pdf_with_toc(
            title="Math Book",
            author_name="Prof. Tests",
            chapters=chapters,
            synopsis="",
            language="en",
        )
        proc = subprocess.run(
            ['pdftotext', '-', '-'],
            input=pdf_bytes, capture_output=True, timeout=30,
        )
        text = proc.stdout.decode('utf-8', errors='ignore')
        assert text.count('\u25A0') == 0
        # r⁴ → r4, x⁵ → x5, y⁷ → y7, z⁹ → z9
        for needle in ['r4', 'x5', 'y7', 'z9']:
            assert needle in text, f"Superscript conversion missing: {needle!r}"


# ────────────────────────────────────────────────────────────────────────────
# Issue 2: Case Studies — Tables must fit page width (no overflow)
# ────────────────────────────────────────────────────────────────────────────

class TestCaseStudyTableOverflow:
    def test_wide_markdown_table_fits_page_via_colwidths(self):
        """A 6-column markdown table with long cell text must render
        within letter-size usable width (6.5 inches). Without colWidths
        + Paragraph-wrapped cells, ReportLab would grow the columns
        beyond the right margin."""
        from routers.case_studies_router import _generate_case_study_pdf

        wide_table_md = (
            "# Overview\n\n"
            "| Metric | Baseline | Year 1 | Year 3 | Year 5 | Cumulative Impact Description |\n"
            "|--------|----------|--------|--------|--------|---------------------------------|\n"
            "| Revenue (USD millions) | 0.00 | 1.85 | 8.45 | 22.7 | Cumulative revenue demonstrating substantial market penetration and client acquisition across multiple U.S. regions |\n"
            "| Jobs created (direct+indirect) | 0 | 18 | 92 | 250 | Total employment multiplier including ripple effects in the supply chain per BEA RIMS II |\n"
            "| Cost per beneficiary (USD) | N/A | 1250 | 820 | 510 | Significant reduction driven by scale economies and process automation |\n"
        )

        pdf_bytes = _generate_case_study_pdf(
            content=wide_table_md,
            client_name="Test Client",
            author_name="Test Author",
            language="en",
        )
        assert len(pdf_bytes) > 2000

        # Parse the PDF with pdfplumber to introspect table bounding boxes
        try:
            import pdfplumber
        except ImportError:
            pytest.skip("pdfplumber not installed — install to validate bounding boxes")

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            # Letter size = 612 x 792 points. Usable width with 1in margins = 468pt (6.5in)
            # Table right edge must be <= 612 - 72 (right margin) = 540pt
            usable_right_edge = 612 - 72 + 2  # 2pt tolerance
            for page in pdf.pages:
                tables = page.find_tables()
                for t in tables:
                    _, _, x1, _ = t.bbox  # (x0, top, x1, bottom) in points
                    assert x1 <= usable_right_edge, (
                        f"Table right edge x1={x1:.1f}pt exceeds usable right edge "
                        f"{usable_right_edge}pt — overflow not fixed"
                    )


# ────────────────────────────────────────────────────────────────────────────
# Issue 3: Policy Papers — Strip triple-quote fences (''') and ```
# ────────────────────────────────────────────────────────────────────────────

class TestPolicyPaperTripleQuotes:
    def test_generate_pdf_strips_triple_quote_fences(self):
        """The LLM occasionally wraps blocks in ''' or ``` — these must NOT
        appear in the final PDF text."""
        # _generate_policy_paper_pdf is the actual renderer used by the download endpoint
        from routers.policy_papers_router import _generate_policy_paper_pdf

        content_with_fences = """# Executive Summary

Some normal prose that survives cleanup.

'''
This block was wrapped in triple-single-quotes by the LLM.
The content should survive but the ''' markers must be stripped.
'''

Another normal paragraph.

```plaintext
This block was wrapped in Markdown fences.
```

Final paragraph.
"""

        pdf_bytes = _generate_policy_paper_pdf(
            content=content_with_fences,
            project_title="Triple Quote Regression Test",
            client_name="Test Client",
            author_name="Test Author",
            language="en",
        )
        assert len(pdf_bytes) > 1500

        proc = subprocess.run(
            ['pdftotext', '-', '-'],
            input=pdf_bytes, capture_output=True, timeout=30,
        )
        text = proc.stdout.decode('utf-8', errors='ignore')

        # The literal fence markers must NOT be in the PDF
        assert "'''" not in text, "Triple single-quote fence survived into PDF"
        assert '```' not in text, "Triple backtick fence survived into PDF"
        # The content inside the fences must still be present
        assert 'triple-single-quotes' in text, "Content inside '''...''' was lost"
        assert 'Markdown fences' in text, "Content inside ```...``` was lost"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
