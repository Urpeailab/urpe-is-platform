"""
Regression test for the duplicate "ECONOMIC IMPACT ANALYSIS" heading on
page 1 of policy paper PDFs.

User report: page 1 shows the cover banner "ECONOMIC IMPACT ANALYSIS"
(printed by the PDF generator) immediately followed by another heading
"ECONOMIC IMPACT ANALYSIS" (the first H1 of the LLM-generated content).
The user wants only ONE such heading on the cover.

Fix: `preprocess_content` now strips a leading "ECONOMIC IMPACT
ANALYSIS" (or its Spanish counterpart "ANÁLISIS DE IMPACTO ECONÓMICO")
heading from the LLM content, so the cover banner is the only one
shown.
"""
import re
from pathlib import Path

ROUTER_PATH = (
    Path(__file__).resolve().parent.parent
    / "routers"
    / "policy_papers_router.py"
)


def _extract_preprocess_content():
    """Pull the inner `preprocess_content` function from the router file
    and exec it as a standalone callable so we can unit-test the regex."""
    src = ROUTER_PATH.read_text(encoding="utf-8")
    # The function is nested inside `_generate_policy_paper_pdf`. Find
    # its def line and capture lines until the first non-indented line.
    fn_idx = src.index("def preprocess_content(raw: str) -> str:")
    # Capture roughly 4500 chars after the def, then truncate at the
    # closing `return raw` of the function.
    chunk = src[fn_idx: fn_idx + 6000]
    end_marker = "\n        return raw\n"
    end_idx = chunk.index(end_marker) + len(end_marker)
    fn_src = chunk[:end_idx]
    # Dedent so it parses at module level.
    import textwrap
    fn_src_dedented = textwrap.dedent(fn_src)
    namespace = {}
    exec(compile(fn_src_dedented, "<preprocess>", "exec"), namespace)
    return namespace["preprocess_content"]


def test_strips_leading_economic_impact_analysis_heading():
    fn = _extract_preprocess_content()
    sample = (
        "ECONOMIC IMPACT ANALYSIS\n\n"
        "National CRM Optimization Framework for U.S. Small Businesses\n\n"
        "**Project Proponent:** Leidis Pelaez\n"
    )
    out = fn(sample)
    # Must NOT start with the duplicate heading.
    assert not out.lstrip().lower().startswith("economic impact analysis"), (
        f"Leading duplicate heading was not stripped:\n{out[:300]}"
    )
    # The actual title must still be preserved.
    assert "National CRM Optimization Framework" in out


def test_strips_markdown_heading_form():
    fn = _extract_preprocess_content()
    sample = "# ECONOMIC IMPACT ANALYSIS\n\nBody text\n"
    out = fn(sample)
    assert not out.lstrip().lower().startswith("# economic"), out
    assert "Body text" in out


def test_strips_bold_form():
    fn = _extract_preprocess_content()
    sample = "**ECONOMIC IMPACT ANALYSIS**\n\nBody\n"
    out = fn(sample)
    assert "ECONOMIC IMPACT ANALYSIS" not in out.split('\n', 1)[0], out


def test_strips_roman_numeral_prefix_form():
    fn = _extract_preprocess_content()
    sample = "I. ECONOMIC IMPACT ANALYSIS\n\nBody\n"
    out = fn(sample)
    assert not out.lstrip().lower().startswith("i. economic"), out


def test_strips_spanish_variant():
    fn = _extract_preprocess_content()
    sample = "ANÁLISIS DE IMPACTO ECONÓMICO\n\nResumen ejecutivo\n"
    out = fn(sample)
    assert "ANÁLISIS DE IMPACTO" not in out.split('\n', 1)[0], out
    assert "Resumen ejecutivo" in out


def test_does_not_strip_later_occurrences():
    """Only the FIRST occurrence at the very top must be stripped — a later
    section heading that happens to share the title must be preserved."""
    fn = _extract_preprocess_content()
    sample = (
        "ECONOMIC IMPACT ANALYSIS\n\n"
        "Body of the cover.\n\n"
        "## Appendix A\n\n"
        "ECONOMIC IMPACT ANALYSIS by region\n\n"
        "More content\n"
    )
    out = fn(sample)
    # First should be gone.
    assert not out.lstrip().lower().startswith("economic impact analysis"), out
    # The later occurrence (different context) should still be there.
    assert "ECONOMIC IMPACT ANALYSIS by region" in out
