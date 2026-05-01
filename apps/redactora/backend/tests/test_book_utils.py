"""
Regression tests for /app/backend/book_utils.py — the shared
synopsis/chapter-title/content cleaner used by BOTH the PDF and the
Word (.docx) exporters for the Book module.

Covers the three concrete bugs reported from the field:

  * Word export duplicated subtitles (chapter headings rendered twice).
  * Spanish text bleeding into the English Word export.
  * PDF cover showing literal LLM scaffolding as "subtitle with
    placeholders" (e.g. 'No ficción / Servicio al Cliente: "…"').
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from book_utils import (  # noqa: E402
    clean_book_synopsis,
    clean_book_chapter_title,
    strip_leading_chapter_heading,
    extract_leading_chapter_title,
)


# ── clean_book_synopsis ────────────────────────────────────────────────
def test_synopsis_strips_numbered_list_prefix():
    assert clean_book_synopsis('3. This book explores X.') == 'This book explores X.'
    assert clean_book_synopsis('1) First entry text.') == 'First entry text.'


def test_synopsis_strips_bracketed_genre_tag():
    syn = '[Public Health / Bilingual Book]: A revolutionary model for dental care.'
    out = clean_book_synopsis(syn)
    assert '[' not in out
    assert 'Bilingual Book]' not in out
    assert 'revolutionary model for dental care' in out


def test_synopsis_strips_genre_slash_category_before_quoted_title():
    """The exact pattern seen in production Spanish synopses."""
    syn = (
        'No ficción / Servicio al Cliente & Ventas: '
        '"Customer Success Bilingüe: Cómo las Empresas Pueden Ganar…"'
    )
    out = clean_book_synopsis(syn)
    assert 'No ficción' not in out
    assert 'Servicio al Cliente & Ventas' not in out
    # The actual alternate-title clause must survive.
    assert 'Customer Success Bilingüe' in out


def test_synopsis_strips_markdown_bold_and_italic():
    syn = '**"Safe Smiles"** - A *revolutionary* methodology.'
    out = clean_book_synopsis(syn)
    assert '**' not in out
    # The inline italic delimiters around a single word should go.
    assert '*revolutionary*' not in out
    assert 'revolutionary' in out


def test_synopsis_strips_leading_quoted_title_clause():
    syn = '"Safe Smiles" - A revolutionary methodology for dental audits.'
    out = clean_book_synopsis(syn)
    # The synopsis must NOT start with the quoted title clause — the
    # title is already shown above on the cover.
    assert not out.startswith('"')
    assert not out.startswith('Safe Smiles')
    assert 'revolutionary methodology' in out


def test_synopsis_preserves_colon_in_ordinary_prose():
    """A descriptive sentence that merely contains a colon must NOT be
    truncated — we only strip genre-prefix-colon patterns."""
    syn = 'This book argues: bilingual service is the future of retail.'
    assert clean_book_synopsis(syn) == (
        'This book argues: bilingual service is the future of retail.'
    )


def test_synopsis_handles_empty_and_none():
    assert clean_book_synopsis(None) == ''
    assert clean_book_synopsis('') == ''
    assert clean_book_synopsis('   ') == ''


# ── clean_book_chapter_title ───────────────────────────────────────────
def test_chapter_title_strips_colon_prefix():
    assert clean_book_chapter_title('Chapter 1: The Silent Leak', 1) == 'The Silent Leak'
    assert clean_book_chapter_title('Capítulo 2: Foo', 2, language='es') == 'Foo'


def test_chapter_title_strips_dash_prefix():
    """The exact bug seen in production — LLM returns
    'Chapter 1 - The Silent Leak' and the downstream renderer then
    builds 'Chapter 1: Chapter 1 - The Silent Leak'."""
    out = clean_book_chapter_title(
        'Chapter 1 - The Silent Leak: How Bad Service Bleeds Millions', 1
    )
    assert out == 'The Silent Leak: How Bad Service Bleeds Millions'


def test_chapter_title_strips_em_dash_prefix():
    out = clean_book_chapter_title('Chapter 3 — From Plant Floor to Cloud', 3)
    assert out == 'From Plant Floor to Cloud'


def test_chapter_title_cross_language_fallback():
    """A Spanish book shouldn't still show 'Chapter 1 - Foo' in Spanish
    mode — the English fallback regex must strip it."""
    out = clean_book_chapter_title('Chapter 1 - Foo', 1, language='es')
    assert out == 'Foo'


def test_chapter_title_returns_fallback_when_empty():
    assert clean_book_chapter_title('', 1, language='en') == 'Untitled'
    assert clean_book_chapter_title(None, 1, language='es') == 'Sin título'
    # Title that's ONLY the "Chapter N" prefix with no real content.
    assert clean_book_chapter_title('Chapter 1 -', 1) == 'Untitled'


def test_chapter_title_strips_html_tags():
    out = clean_book_chapter_title('<strong>Chapter 4: Leverage</strong>', 4)
    assert out == 'Leverage'


# ── strip_leading_chapter_heading ──────────────────────────────────────
def test_strip_leading_h2_chapter_heading():
    content = (
        '<h2>Chapter 1 - The Silent Leak: How Bad Service Bleeds Millions'
        '</h2>\n<p>Body paragraph.</p>'
    )
    out = strip_leading_chapter_heading(content)
    assert 'Chapter 1' not in out.split('<p>')[0]
    assert '<p>Body paragraph.</p>' in out


def test_strip_leading_h1_spanish_chapter_heading():
    content = '<h1>Capítulo 2: La Arquitectura</h1><p>Contenido.</p>'
    out = strip_leading_chapter_heading(content)
    assert 'Capítulo 2' not in out
    assert 'Contenido' in out


def test_strip_leading_markdown_heading():
    content = '# Chapter 3: Deep Dive\n\nThe body of chapter 3 starts here.'
    out = strip_leading_chapter_heading(content)
    assert out.startswith('The body of chapter 3')


def test_strip_leading_plain_text_chapter_heading():
    content = (
        '<p><strong>Chapter 5 - The Matrix</strong></p>'
        '<p>First real paragraph.</p>'
    )
    out = strip_leading_chapter_heading(content)
    assert 'The Matrix' not in out.split('<p>First real paragraph.')[0]
    assert 'First real paragraph' in out


def test_strip_keeps_content_intact_when_no_leading_heading():
    content = '<p>This chapter begins without a redundant heading.</p>'
    assert strip_leading_chapter_heading(content) == content


def test_strip_handles_empty_input():
    assert strip_leading_chapter_heading('') == ''
    assert strip_leading_chapter_heading(None) == ''


# ── extract_leading_chapter_title ──────────────────────────────────────
def test_extract_from_h2_html():
    out = extract_leading_chapter_title(
        '<h2>Chapter 1 - The Silent Leak: How Bad Service</h2>\n<p>Body.</p>'
    )
    assert out == 'Chapter 1 - The Silent Leak: How Bad Service'


def test_extract_from_spanish_h1():
    out = extract_leading_chapter_title(
        '<h1>Capítulo 2 - La Fuga Silenciosa</h1>\n<p>Contenido.</p>'
    )
    assert out == 'Capítulo 2 - La Fuga Silenciosa'


def test_extract_from_markdown_heading():
    out = extract_leading_chapter_title('# Chapter 3: Deep Dive\n\nBody here.')
    assert out == 'Chapter 3: Deep Dive'


def test_extract_returns_none_when_no_heading():
    assert extract_leading_chapter_title('<p>Just body text.</p>') is None
    assert extract_leading_chapter_title('') is None
    assert extract_leading_chapter_title(None) is None


def test_extract_returns_none_when_heading_is_not_chapter():
    # A non-chapter heading (e.g. section name) should not match.
    assert extract_leading_chapter_title(
        '<h2>Introduction</h2><p>Body.</p>'
    ) is None
