"""
Regression test for markdown-heading detection across all PDF-generating modules.

User reported `#### Import Operations Management` appearing LITERALLY in the
Policy Paper PDF. Root cause: `startswith('#### ')` (with required space)
failed when the LLM produced `####Import...` or `####   Import...` variants.

This test simulates the heading-detection regex used in:
  • routers/policy_papers_router.py   (lines ~599-614 after fix)
  • routers/case_studies_router.py    (lines ~412-424 after fix)
  • server.py (book/generic PDF paths) (lines ~4201, ~5805 after fix)
  • routers/intent_letters_router.py  (lines ~720 — already robust)

Run with:   pytest backend/tests/test_pdf_markdown_cleanup.py -v
"""
import re
import pytest


HEADING_RE = re.compile(r'^(#{1,6})\s*(.+?)\s*$')


@pytest.mark.parametrize(
    "line, expected_level, expected_text",
    [
        # Happy path: hash + space + text
        ("# Title", 1, "Title"),
        ("## Subtitle", 2, "Subtitle"),
        ("### Section", 3, "Section"),
        ("#### Subsection", 4, "Subsection"),
        ("##### Deep", 5, "Deep"),
        ("###### Deepest", 6, "Deepest"),

        # Missing space between hashes and text (LLM quirk)
        ("####Import Operations Management", 4, "Import Operations Management"),
        ("###Tight subsection", 3, "Tight subsection"),
        ("#Tight title", 1, "Tight title"),

        # Extra spaces after hashes
        ("####    Extra spaces", 4, "Extra spaces"),
        ("##     Padded", 2, "Padded"),

        # Trailing whitespace
        ("### Section   ", 3, "Section"),
        ("#### Subsection\t", 4, "Subsection"),

        # Bold markers inside heading (should still match; bold handled by convert_bold)
        ("#### **Bold heading**", 4, "**Bold heading**"),
    ],
)
def test_heading_detection_positive(line, expected_level, expected_text):
    match = HEADING_RE.match(line)
    assert match is not None, f"Expected {line!r} to be detected as heading"
    hashes, text = match.groups()
    assert len(hashes) == expected_level, (
        f"Expected {expected_level} hashes but got {len(hashes)} for line={line!r}"
    )
    assert text == expected_text, (
        f"Expected text {expected_text!r} but got {text!r} for line={line!r}"
    )


@pytest.mark.parametrize(
    "line",
    [
        "Normal paragraph text.",
        "Text with a trailing # hash.",
        "- Bullet item",
        "1. Numbered item",
        "",  # empty line
        "   ",  # whitespace only
    ],
)
def test_heading_detection_negative(line):
    """Lines that should NOT be treated as headings."""
    if not line.strip():
        # Empty/whitespace lines aren't passed through the regex in production
        return
    match = HEADING_RE.match(line.strip())
    # Paragraphs without leading # should not match
    assert match is None, f"{line!r} was incorrectly detected as heading"


def test_7_plus_hashes_fallback():
    """7+ hashes shouldn't match as standard heading (markdown only supports 1-6)."""
    match = HEADING_RE.match("####### too deep")
    # Our regex matches 1-6 hashes, then treats rest (including the 7th) as
    # leftover. Since it matches "######" + "# too deep", we should get level=6
    # and text="# too deep". Downstream code strips leading # again.
    assert match is not None
    hashes, text = match.groups()
    assert len(hashes) == 6
    # Production code does `.lstrip('#').strip()` on text, which would yield "too deep"
    assert text.lstrip('#').strip() == "too deep"


def test_policy_papers_module_uses_robust_regex():
    """Smoke test: verify the policy_papers_router source contains our new regex."""
    from pathlib import Path
    src = Path("/app/backend/routers/policy_papers_router.py").read_text()
    assert r"re.match(r'^(#{1,6})\s*(.+?)\s*$'" in src, (
        "policy_papers_router.py doesn't have the robust heading regex"
    )


def test_case_studies_module_uses_robust_regex():
    """Smoke test: verify case_studies_router uses the robust regex."""
    from pathlib import Path
    src = Path("/app/backend/routers/case_studies_router.py").read_text()
    assert r"re.match(r'^(#{1,6})\s*(.+?)\s*$'" in src, (
        "case_studies_router.py doesn't have the robust heading regex"
    )


def test_server_py_uses_robust_regex():
    """Smoke test: verify server.py has the robust regex in BOTH PDF paths."""
    from pathlib import Path
    src = Path("/app/backend/server.py").read_text()
    count = src.count(r"re.match(r'^(#{1,6})\s*(.+?)\s*$'")
    assert count >= 2, (
        f"server.py should have robust heading regex in ≥2 places; found {count}"
    )
