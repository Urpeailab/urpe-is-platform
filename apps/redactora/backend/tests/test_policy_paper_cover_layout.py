"""
Regression test for the policy-paper cover page layout.

User concern: "no hay salto de linea esta bien esa estructura que todo
esta en la primera pagina pegado?" — i.e. the cover banner and the body
content (project title, project proponent, executive summary) were all
crammed onto page 1 with no page break.

Fix: a `PageBreak()` is now appended after the cover-page subtitle
("Prong 1 Analysis: Substantial Merit & National Importance"). The
body content starts on page 2, matching the layout of other
professional reports in the app.
"""
import io
import sys
from pathlib import Path

import pdfplumber  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routers.policy_papers_router import _generate_policy_paper_pdf  # noqa: E402


SAMPLE_CONTENT = """ECONOMIC IMPACT ANALYSIS

National CRM Optimization Framework for U.S. Small Businesses

**Project Proponent:** Leidis Pelaez

**Institutional Affiliation:** Independent Policy & Business Systems Analyst (NIW Self-Petitioner)

**Date:** April 23, 2026

**Classification:** Public / Immigration Petition Supporting Document

**Version:** 1.0 (Final)

# I. Executive Summary

This Economic Impact Analysis evaluates the National CRM Optimization Framework
for U.S. Small Businesses, an initiative designed to close the digital gap.

Small businesses represent 99.9% of U.S. firms.

# II. Introduction

Body section II content here.
"""


def _render(language: str = "en"):
    pdf = _generate_policy_paper_pdf(
        content=SAMPLE_CONTENT,
        project_title="leidis pelaez - National Interest Project",
        client_name="leidis pelaez",
        author_name="leidis pelaez",
        language=language,
    )
    pages = []
    with pdfplumber.open(io.BytesIO(pdf)) as p:
        for page in p.pages:
            pages.append(page.extract_text() or "")
    return pages


def test_cover_is_on_its_own_page():
    pages = _render()
    assert len(pages) >= 2, "PDF must have at least 2 pages (cover + body)"
    cover = pages[0]
    body = pages[1]

    # Cover-only content
    assert "ECONOMIC IMPACT ANALYSIS" in cover
    assert "leidis pelaez - National Interest Project" in cover
    assert "Prong 1 Analysis" in cover
    # Professional cover additions
    assert "Document Type" in cover
    assert "Matter of Dhanasar" in cover

    # Body content must NOT be on page 1.
    assert "I. Executive Summary" not in cover, (
        "Executive Summary leaked onto cover page — page break missing."
    )
    assert "Institutional Affiliation" not in cover, (
        "Body metadata leaked onto cover page."
    )

    # Body content must appear on page 2.
    assert "I. Executive Summary" in body or "Executive Summary" in body
    assert "National CRM Optimization Framework" in body


def test_duplicate_economic_impact_analysis_heading_is_stripped():
    """The LLM emitted 'ECONOMIC IMPACT ANALYSIS' as the first H1 of its
    content. It must NOT appear on page 2 (only as the cover banner)."""
    pages = _render()
    body = pages[1]
    # Page 2 must NOT start with the duplicate heading.
    body_first_line = body.lstrip().split('\n', 1)[0].strip()
    assert body_first_line.upper() != "ECONOMIC IMPACT ANALYSIS", (
        f"Duplicate heading still leaks into body. First body line: {body_first_line!r}"
    )


def test_no_horizontal_divider_lines_in_pdf():
    """Verify that markdown HR lines (---) don't render as visible HRFlowable
    in the final PDF (regression of an earlier user-reported bug)."""
    content_with_hr = SAMPLE_CONTENT + "\n---\n\n# III. Conclusion\n\nFinal text."
    pdf = _generate_policy_paper_pdf(
        content=content_with_hr,
        project_title="Test Project",
        client_name="Test Client",
        author_name="Test Author",
        language="en",
    )
    # We can't easily detect HRFlowable lines in extracted text, but we can
    # at least confirm the PDF generated without error and the dividers
    # were stripped from the markdown source (no "---" string remains).
    with pdfplumber.open(io.BytesIO(pdf)) as p:
        all_text = "\n".join((page.extract_text() or "") for page in p.pages)
    assert "---" not in all_text, (
        f"Markdown horizontal-rule string leaked into PDF text:\n{all_text}"
    )
