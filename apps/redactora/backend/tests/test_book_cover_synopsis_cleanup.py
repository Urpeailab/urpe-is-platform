"""
Regression test for the book cover synopsis bleeding LLM scaffolding bug.

User screenshot showed a book cover with the title "Safe Smiles: The
Community Dental Quality Audit Model" rendered correctly, but the synopsis
underneath read literally:

    3. [Public Health / Bilingual Technical-Informative Book]:
    **"Safe Smiles: Comprehensive Dental Audit Model for Clinics
    Serving Those in Greatest Need"** - This book, conceived as the
    reference work accompanying the project by Loor Lucio Dental
    Quality LLC, presents the first standardized and replic...

That text is the raw LLM scaffolding from a numbered options list. We
expect the cover to show ONLY the descriptive prose — no leading number,
no bracketed metadata tag, no markdown bold delimiters, and no duplicated
quoted title clause (since the title is already rendered in big type
right above the synopsis).

The fix is `_clean_synopsis_for_cover()` defined inside
`create_book_pdf_with_toc`. We exercise it end-to-end by rendering a
small PDF and extracting its text.
"""
import sys
import re
from pathlib import Path

import pdfplumber  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import create_book_pdf_with_toc  # noqa: E402


SAMPLE_DIRTY_SYNOPSIS = (
    '3. [Public Health / Bilingual Technical-Informative Book]: '
    '**"Safe Smiles: Comprehensive Dental Audit Model for Clinics '
    'Serving Those in Greatest Need"** - This book, conceived as the '
    'reference work accompanying the project by Loor Lucio Dental '
    'Quality LLC, presents the first standardized and replicable '
    'methodology for community dental audits.'
)


def _render_book_cover_text(synopsis: str) -> str:
    chapters = [{"title": "Chapter 1", "content_en": "Some content."}]
    pdf_bytes = create_book_pdf_with_toc(
        title="Safe Smiles: The Community Dental Quality Audit Model",
        author_name="Loor Lucio",
        chapters=chapters,
        synopsis=synopsis,
        language="en",
    )
    # Extract first-page text (cover)
    import io
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        cover = pdf.pages[0].extract_text() or ""
    return cover


def test_book_cover_strips_numbered_list_prefix():
    cover = _render_book_cover_text(SAMPLE_DIRTY_SYNOPSIS)
    # No leading "3." artifact at start of any line on the cover.
    for line in cover.splitlines():
        line = line.strip()
        if not line:
            continue
        assert not re.match(r'^\d+\s*[\.\)\-]\s*', line), (
            f"Cover line still starts with numbered-list prefix: {line!r}"
        )


def test_book_cover_strips_bracketed_metadata_tag():
    cover = _render_book_cover_text(SAMPLE_DIRTY_SYNOPSIS)
    assert "[Public Health" not in cover, (
        f"Bracketed metadata tag leaked into cover:\n{cover}"
    )
    assert "Bilingual Technical-Informative Book]" not in cover


def test_book_cover_strips_markdown_bold_delimiters():
    cover = _render_book_cover_text(SAMPLE_DIRTY_SYNOPSIS)
    assert "**" not in cover, f"Markdown ** leaked into cover:\n{cover}"


def test_book_cover_keeps_descriptive_prose():
    cover = _render_book_cover_text(SAMPLE_DIRTY_SYNOPSIS)
    # The actual descriptive sentence MUST still be present.
    # Normalize whitespace because pdfplumber may split long phrases across
    # rendered lines.
    cover_norm = re.sub(r'\s+', ' ', cover)
    assert "Loor Lucio Dental Quality LLC" in cover_norm, (
        f"Descriptive prose was wiped:\n{cover}"
    )


def test_clean_synopsis_handles_empty_and_none():
    # Should not crash on empty / None.
    chapters = [{"title": "Chapter 1", "content_en": "Some content."}]
    pdf_bytes = create_book_pdf_with_toc(
        title="Test",
        author_name="A",
        chapters=chapters,
        synopsis="",
        language="en",
    )
    assert pdf_bytes and len(pdf_bytes) > 1000


def test_book_cover_handles_pure_quoted_title_prefix():
    """Synopsis like '"Title" - description ...' should drop the leading
    quoted title clause because the title is already shown above."""
    synopsis = '"Safe Smiles" - A revolutionary methodology for community dental audits.'
    cover = _render_book_cover_text(synopsis)
    assert "revolutionary methodology" in cover
    # The redundant leading quoted title should be gone (we don't want the
    # word "Safe Smiles" appearing TWICE on the cover — once as the big
    # title and once as the start of the synopsis).
    cover_below_title = cover.split("Safe Smiles: The Community Dental Quality Audit Model", 1)
    if len(cover_below_title) == 2:
        below = cover_below_title[1]
        # Allow word inside the descriptive prose, but the synopsis must NOT
        # start with the quoted "Safe Smiles" prefix.
        below_trimmed = below.strip().lstrip('"').lstrip("“")
        assert not below_trimmed.startswith("Safe Smiles"), (
            f"Synopsis still starts with quoted title prefix:\n{below}"
        )


def test_book_cover_strips_genre_slash_category_prose():
    """Production-shape Spanish synopsis — 'No ficción / Servicio al
    Cliente: "Customer Success…"' — must not leak the genre prefix
    onto the PDF cover."""
    synopsis = (
        'No ficción / Servicio al Cliente & Ventas: '
        '"Customer Success Bilingüe: Cómo las Empresas Pueden Ganar…"'
    )
    cover = _render_book_cover_text(synopsis)
    assert 'No ficción' not in cover
    assert 'Servicio al Cliente & Ventas' not in cover
    # The alternate-title prose must still survive on the cover.
    cover_norm = re.sub(r'\s+', ' ', cover)
    assert 'Customer Success Bilingüe' in cover_norm


def test_book_chapter_heading_not_doubled_on_first_page():
    """If the LLM prepended '<h2>Chapter 1 - …</h2>' to content_en the
    PDF must still render the heading exactly once."""
    chapters = [{
        "title": "Chapter 1 - The Silent Leak",
        "content_en": (
            "<h2>Chapter 1 - The Silent Leak</h2>"
            "<p>Actual chapter body content here.</p>"
        ),
    }]
    pdf_bytes = create_book_pdf_with_toc(
        title="Test Book",
        author_name="Author",
        chapters=chapters,
        synopsis="",
        language="en",
    )
    import io as _io
    with pdfplumber.open(_io.BytesIO(pdf_bytes)) as pdf:
        # "Chapter N: Title" heading + body should appear on exactly one page;
        # and that page must NOT contain the text "Chapter 1: Chapter 1"
        for page in pdf.pages:
            text = page.extract_text() or ""
            assert "Chapter 1: Chapter 1" not in text, (
                f"Doubled heading on page: {text[:200]}"
            )
            assert "Chapter 1 - Chapter 1" not in text
