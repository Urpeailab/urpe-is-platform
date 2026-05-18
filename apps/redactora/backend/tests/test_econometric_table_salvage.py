"""
Regression test for the econometric-study table salvage safety net.

User report: "algunas tablas en los estudios econometricos no se formatean
de forma adecuada lo que me arruina todo el documento, necesito una
solucion definitiva para esto".

Even though python-markdown's `tables` extension handles MOST tables
correctly, it silently fails on certain edge cases (mismatched column
counts, malformed alignment markers, exotic whitespace). When that
happens the pipe rows survive as literal `|` text in <p> tags and ruin
the PDF.

Fix: a `_salvage_failed_tables()` post-pass scans the HTML produced by
markdown.markdown() for any cluster of 2+ consecutive `<p>| ... |</p>`
paragraphs and manually converts them into a proper <table>. The
existing pipeline downstream already converts <table> HTML into a
ReportLab Table flowable, so the safety net is fully defensive and
doesn't depend on any other fix.

We exercise the salvage logic by feeding it HTML that mimics the failure
mode, and verify it produces a proper <table> with correct
header/body structure.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server  # noqa: E402  (import for side-effect setup)


def _extract_salvage_function():
    """Pull `_salvage_failed_tables` out of the closure in
    `download_econometric_study` so we can unit-test it in isolation."""
    import textwrap
    src_path = Path(server.__file__)
    src = src_path.read_text(encoding="utf-8")
    fn_start = src.index("def _salvage_failed_tables(html: str) -> str:")
    fn_end = src.index("\n            section_content = _salvage_failed_tables", fn_start)
    fn_src = src[fn_start:fn_end]
    fn_src_dedented = textwrap.dedent(fn_src)
    # The function uses `re`, `logging`, and `section_number` — provide stubs.
    namespace = {
        're': re,
        'logging': type('L', (), {'warning': lambda *a, **kw: None,
                                    'info':    lambda *a, **kw: None})(),
        'section_number': 9,
    }
    exec(compile(fn_src_dedented, "<salvage>", "exec"), namespace)
    return namespace["_salvage_failed_tables"]


salvage = _extract_salvage_function()


def test_salvage_recovers_failed_table():
    """3 consecutive pipe-rows that python-markdown failed to convert."""
    html = (
        "<p>Some prose paragraph.</p>\n"
        "<p>| Year | Revenue | Net Income |</p>\n"
        "<p>| 1 | 65,000 | (27,000) |</p>\n"
        "<p>| 2 | 145,000 | 3,000 |</p>\n"
        "<p>Subsequent prose.</p>"
    )
    out = salvage(html)
    # No literal pipe rows must survive.
    assert "<p>| Year" not in out
    assert "<p>| 1 |" not in out
    # A real <table> must have been produced.
    assert "<table>" in out
    assert "<th>Year</th>" in out
    assert "<th>Revenue</th>" in out
    assert "<th>Net Income</th>" in out
    assert "<td>1</td>" in out
    assert "<td>65,000</td>" in out
    assert "<td>(27,000)</td>" in out
    # The surrounding prose must be preserved.
    assert "Some prose paragraph." in out
    assert "Subsequent prose." in out


def test_salvage_skips_separator_row():
    html = (
        "<p>| Metric | Value |</p>\n"
        "<p>|--------|-------|</p>\n"
        "<p>| Total | 100 |</p>"
    )
    out = salvage(html)
    assert "<table>" in out
    # Separator row must NOT appear as a data row.
    assert "<td>--------</td>" not in out
    assert "<th>Metric</th>" in out
    assert "<th>Value</th>" in out
    assert "<td>Total</td>" in out
    assert "<td>100</td>" in out


def test_salvage_does_not_touch_clean_html():
    html = (
        "<h2>9.1 Findings</h2>\n"
        "<p>Some paragraph.</p>\n"
        "<table><thead><tr><th>X</th></tr></thead></table>\n"
        "<p>Another.</p>"
    )
    out = salvage(html)
    # Untouched.
    assert out.count("<table>") == 1
    assert "<h2>9.1 Findings</h2>" in out


def test_salvage_handles_single_pipe_row_safely():
    """A SINGLE pipe row is not a table — must not be salvaged."""
    html = "<p>Some text.</p>\n<p>| just one row | no header |</p>\n<p>more text.</p>"
    out = salvage(html)
    # Cluster size is 1, so the salvager must leave it alone.
    assert "<p>| just one row | no header |</p>" in out
    assert "<table>" not in out


def test_salvage_preserves_cell_inline_markdown_bold():
    """At salvage time, the upstream pipeline has already converted any
    raw <strong> inside cells to markdown ** ** (line ~29157). So the
    salvager will see markdown bold, not raw HTML, in cells. The
    downstream `**` → <strong> conversion (line ~29335) runs AFTER
    salvage and turns the markdown bold into proper HTML."""
    html = (
        "<p>| **Total** | **100** |</p>\n"
        "<p>| Subtotal | 50 |</p>"
    )
    out = salvage(html)
    assert "<table>" in out
    # The header cells should still contain the markdown ** markers (the
    # downstream regex will convert them to <strong> after salvage).
    assert "**Total**" in out
    assert "**100**" in out
    assert "<td>Subtotal</td>" in out


def test_salvage_handles_empty_cells():
    html = (
        "<p>| Header A | Header B | Header C |</p>\n"
        "<p>| 1 |  | 3 |</p>\n"
        "<p>| 2 | x |  |</p>"
    )
    out = salvage(html)
    assert "<table>" in out
    assert "<th>Header A</th>" in out
    assert "<td>1</td>" in out
    # An empty cell must still produce an empty <td></td>.
    assert "<td></td>" in out


def test_salvage_fixes_user_reported_pattern():
    """End-to-end: simulates the EXACT pattern from the user's screenshot
    where a multi-column financial table failed to convert."""
    # This is what we'd see if markdown.tables silently failed.
    html = (
        "<p>Applying the econometric model with M_o = 1.85:</p>\n"
        "<p>| Year | Direct Revenue ($) | Direct × M_o ($) | CTV ($) | FTR ($) | TEI ($) |</p>\n"
        "<p>|-----|-----------------|-----------------|--------|--------|--------|</p>\n"
        "<p>| 1 | 65,000 | 120,250 | 585,000 | 12,000 | 717,250 |</p>\n"
        "<p>| 2 | 850,000 | 1,572,500 | 7,650,000 | 156,000 | 9,378,500 |</p>\n"
        "<p>| 3 | 4,500,000 | 8,325,000 | 40,500,000 | 825,000 | 49,650,000 |</p>\n"
        "<p><strong>Cumulative Five-Year TEI:</strong> $234.6 million</p>"
    )
    out = salvage(html)
    assert "<table>" in out
    # 6 columns
    assert out.count("<th>") == 6
    # 3 data rows × 6 cells
    assert out.count("<td>") == 18
    # Surrounding prose preserved
    assert "Applying the econometric model" in out
    assert "Cumulative Five-Year TEI" in out
    # No surviving raw pipes
    assert "<p>| Year" not in out
    assert "<p>| 1 |" not in out
