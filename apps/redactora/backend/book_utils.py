"""
book_utils.py — Shared helpers for the Book module (PDF + DOCX).

These helpers guarantee that both `create_book_pdf_with_toc` (ReportLab PDF)
and the `/books/{id}/download-docx` endpoint (python-docx) produce
identically clean output:

  * `clean_book_synopsis`   — strip LLM scaffolding from the synopsis so
                              the book cover never shows numbered-list
                              prefixes, bracketed genre tags, markdown
                              delimiters, genre-slash-category prose or
                              duplicated quoted titles.
  * `clean_book_chapter_title` — normalise a raw chapter title so the
                              rendered heading is always
                              `Chapter N: Title` (never doubled).
  * `strip_leading_chapter_heading` — remove the `<h1>/<h2>Chapter N ...`
                              that LLMs often prepend to chapter content,
                              so the PDF/DOCX do not render the title
                              twice.

Kept in its own module (and not inside `create_book_pdf_with_toc`) so we
can unit-test every regex in isolation and reuse the exact same rules
from the `.docx` exporter — without which the Word download would
re-introduce the very bugs the PDF already fixed.
"""
from __future__ import annotations

import re
from typing import Optional


# ── Synopsis sanitizer ─────────────────────────────────────────────────
def clean_book_synopsis(raw_synopsis: Optional[str]) -> str:
    """Return a cover-ready synopsis with LLM scaffolding stripped.

    Handles, in order:
      1. Leading enumeration prefix  ("3. ", "1) ", "2 - ").
      2. Leading bracketed/parenthetic genre/category tag
         ("[Public Health / Bilingual Book]: ", "(Technical Manual) - ").
      3. Leading plain-text genre-slash-category prose before a quoted
         or markdown-bold title  ('No ficción / Servicio al Cliente:
         "Customer Success..."').
      4. Markdown bold/italic delimiters.
      5. Leading quoted-title clause that duplicates the book title
         shown right above on the cover  ('"Safe Smiles" — A revolutionary…').
      6. Collapsed whitespace and stray leading punctuation.
    """
    if not raw_synopsis:
        return ""
    s = str(raw_synopsis).strip()

    # 1. Leading numbered/lettered list prefix.
    s = re.sub(r'^\s*\d+\s*[\.\)\-]\s*', '', s)

    # 2. Leading bracketed or parenthetic metadata tag.
    s = re.sub(r'^\s*[\[\(][^\]\)]{1,120}[\]\)]\s*[:\-–—]?\s*', '', s)

    # 3. Leading "Genre / Subgenre:" prose immediately followed by a
    #    quoted or markdown-bold title (common in Spanish synopses such as
    #    'No ficción / Servicio al Cliente: "Customer Success…"').  We
    #    only strip if the prefix ends with ":" AND the very next non-
    #    whitespace glyph is a quote, smart-quote, or '**' — so a regular
    #    descriptive sentence that happens to contain a colon is NOT
    #    chopped.
    s = re.sub(
        r'^\s*[^:"\[\(\n]{1,120}:\s*(?=[“”"\'‘’]|\*\*)',
        '',
        s,
    )

    # 4. Markdown bold/italic delimiters around any embedded title.
    s = re.sub(r'\*{2,}', '', s)
    s = re.sub(r'(?<!\w)\*(.+?)\*(?!\w)', r'\1', s)

    # 5. Leading quoted-title clause followed by a dash/colon separator.
    #    The book title is already rendered in big type on the cover, so
    #    we don't want it repeated as the first words of the synopsis.
    s = re.sub(
        r'^\s*[“”"\'‘’](.{1,200}?)[“”"\'‘’]\s*[-–—:]\s*',
        '',
        s,
    )

    # 6. Collapse whitespace and strip stray leading punctuation.
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^[\s:\-–—,.]+', '', s).strip()
    return s


# ── Chapter title cleaner ─────────────────────────────────────────────
def clean_book_chapter_title(
    raw_title: Optional[str],
    chapter_num: int,
    language: str = 'en',
) -> str:
    """Return a chapter-title string stripped of any leading
    ``Chapter N:`` / ``Chapter N -`` / ``Capítulo N.`` noise.

    The downstream rendering code prepends its own `Chapter N:` prefix,
    so if the LLM-generated title already contains one we end up with a
    doubled title (``Chapter 1: Chapter 1 - Foo``).  This helper makes
    sure we ALWAYS emit only the human-readable part.
    """
    if not raw_title:
        return "Sin título" if language == 'es' else "Untitled"

    # Strip any HTML tags the LLM may have wrapped around the title.
    text = re.sub(r'<[^>]+>', '', str(raw_title)).strip()

    chapter_label = "Capítulo" if language == 'es' else "Chapter"

    patterns = [
        # "Capítulo 1:" / "Chapter 1:" / "Capítulo 1."
        rf'^{chapter_label}\s*{chapter_num}\s*[:.]\s*',
        # "Chapter 1 - " / "Chapter 1 – " / "Chapter 1 —"  (dash variants)
        rf'^{chapter_label}\s*{chapter_num}\s*[-–—]\s*',
        # "Capítulo 1 Title"  (just a space)
        rf'^{chapter_label}\s*{chapter_num}\s+',
        # Cross-language fallbacks (e.g. Spanish book stored a Chapter N prefix).
        rf'^Chapter\s*{chapter_num}\s*[:.\-–—]\s*',
        rf'^Cap[íi]tulo\s*{chapter_num}\s*[:.\-–—]\s*',
    ]
    for pattern in patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # Strip stray leading/trailing separator punctuation.
    text = re.sub(r'^\s*[:\-–—]+\s*', '', text)
    text = re.sub(r'\s*[:\-–—]+\s*$', '', text)
    text = text.strip()

    if not text:
        return "Sin título" if language == 'es' else "Untitled"
    return text


# ── Strip LLM-prepended chapter heading from content ───────────────────
def extract_leading_chapter_title(content: Optional[str]) -> Optional[str]:
    """Return the text of a leading ``<hN>Chapter|Capítulo N …</hN>``
    heading if the LLM prepended one — used by the exporter to show the
    RIGHT-language heading on Spanish/English downloads when the stored
    `chapter.title` field is only available in one language.

    Returns None if no such heading is found.
    """
    if not content:
        return None

    # 1. HTML heading.
    m = re.match(
        r'^\s*<(h[1-4])[^>]*>\s*((?:Chapter|Cap[íi]tulo)\s*\d+[^<]*)</\1>',
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m:
        return re.sub(r'\s+', ' ', m.group(2)).strip()

    # 2. Markdown heading.
    m = re.match(
        r'^\s*#{1,4}\s*((?:Chapter|Cap[íi]tulo)\s*\d+[^\n]*)',
        content,
        flags=re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()

    # 3. Plain-text "Chapter N - Title" at the very top.
    m = re.match(
        r'^\s*(?:<p[^>]*>\s*)?(?:<strong>\s*)?'
        r'((?:Chapter|Cap[íi]tulo)\s*\d+\s*[:\-–—]\s*[^<\n]+)',
        content,
        flags=re.IGNORECASE,
    )
    if m:
        return re.sub(r'<[^>]+>', '', m.group(1)).strip()

    return None


def strip_leading_chapter_heading(content: Optional[str]) -> str:
    """Remove a leading `<hN>Chapter N …</hN>` or plain-text
    ``Chapter N - Title`` that the LLM prepended to chapter content.

    Without this, chapter content rendered right after the page's
    ``Chapter N: Title`` heading would show the same title a second time.
    """
    if not content:
        return content or ""

    c = content

    # 1. Leading <h1>..<h4> that starts with Chapter|Capítulo N.
    c = re.sub(
        r'^\s*<(h[1-4])[^>]*>\s*(?:Chapter|Cap[íi]tulo)\s*\d+[^<]*</\1>\s*',
        '',
        c,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )

    # 2. Leading plain-text / <p>/<strong>-wrapped "Chapter N - Title".
    c = re.sub(
        r'^\s*(?:<p[^>]*>\s*)?(?:<strong>\s*)?'
        r'(?:Chapter|Cap[íi]tulo)\s*\d+\s*[:\-–—]\s*[^<\n]+'
        r'(?:</strong>\s*)?(?:</p>\s*)?',
        '',
        c,
        count=1,
        flags=re.IGNORECASE,
    )

    # 3. Leading markdown ``# Chapter N …`` / ``## Chapter N …`` heading.
    c = re.sub(
        r'^\s*#{1,4}\s*(?:Chapter|Cap[íi]tulo)\s*\d+[^\n]*\n+',
        '',
        c,
        count=1,
        flags=re.IGNORECASE,
    )

    return c.lstrip()


__all__ = [
    "clean_book_synopsis",
    "clean_book_chapter_title",
    "strip_leading_chapter_heading",
    "extract_leading_chapter_title",
]
