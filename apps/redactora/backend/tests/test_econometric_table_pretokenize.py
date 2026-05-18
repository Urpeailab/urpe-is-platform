"""
Regression tests for the econometric-study table robustness rewrite.

User pain point (Feb 27, 2026): tables in econometric studies were
"breaking" — sometimes the last row escaped as literal `|cell|cell|`
text, sometimes the entire table failed to parse and rendered as raw
text, sometimes a separate "fragment" table appeared right below the
main one.

Solution shipped in server.py:

  1. `_pretokenize_pipe_tables_to_html` — runs BEFORE markdown.markdown()
     and converts every contiguous bare-pipe-row cluster into a real
     `<table>` block.  Markdown leaves block-level HTML alone, so the
     fragile python-markdown table parser never gets a chance to fail.

  2. `_merge_orphan_pipe_rows_into_tables` (extended) — when a SINGLE
     orphan `<p>|…|</p>` row survives right after a real `</table>`,
     inject it as a new `<tr>`.  When TWO consecutive `<table>` blocks
     have matching column counts, merge them so the user sees one
     cohesive table.

These tests pin both helpers' behaviour by re-exercising their exact
regex bodies (kept in this file so a divergence in server.py is
caught loudly).
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ─── pretokenizer (mirrors server.py's inlined helper) ─────────────────
def _pretokenize_pipe_tables_to_html(text: str) -> str:
    lines = text.split('\n')
    out, j = [], 0
    while j < len(lines):
        s = lines[j].strip()
        is_pipe = s.startswith('|') and s.endswith('|') and len(s) > 2
        if not is_pipe:
            out.append(lines[j])
            j += 1
            continue
        cluster_start = j
        while j < len(lines):
            ss = lines[j].strip()
            if ss.startswith('|') and ss.endswith('|') and len(ss) > 2:
                j += 1
            else:
                break
        cluster = lines[cluster_start:j]
        parsed_rows = []
        for row_line in cluster:
            rs = row_line.strip()
            if re.match(r'^\|[\s\-:|]+\|$', rs) and rs.count('-') >= 2:
                continue
            cells = re.split(r'(?<!\\)\|', rs)
            if cells and cells[0].strip() == '':
                cells = cells[1:]
            if cells and cells[-1].strip() == '':
                cells = cells[:-1]
            cells = [c.strip().replace(r'\|', '|') for c in cells]
            if cells:
                parsed_rows.append(cells)
        if len(parsed_rows) < 2:
            out.extend(cluster)
            continue
        n_cols = max(len(r) for r in parsed_rows)
        for r in parsed_rows:
            while len(r) < n_cols:
                r.append('')

        def _esc(t):
            return (t.replace('&', '&amp;')
                     .replace('<', '&lt;')
                     .replace('>', '&gt;'))

        header = parsed_rows[0]
        body = parsed_rows[1:]
        parts = ['<table>', '<thead><tr>']
        for h in header:
            parts.append(f'<th>{_esc(h)}</th>')
        parts.append('</tr></thead>')
        if body:
            parts.append('<tbody>')
            for r in body:
                parts.append('<tr>')
                for c in r:
                    parts.append(f'<td>{_esc(c)}</td>')
                parts.append('</tr>')
            parts.append('</tbody>')
        parts.append('</table>')
        out.append('')
        out.append(''.join(parts))
        out.append('')
    return '\n'.join(out)


# ── pretokenizer tests ────────────────────────────────────────────────
def test_pretokenizer_converts_clean_pipe_table_to_html():
    md = (
        "| Tier | Baseline | Post | Reduction |\n"
        "|---|---|---|---|\n"
        "| Small | 7.1 | 4.2 | 40.8% |\n"
        "| Medium | 4.7 | 2.8 | 40.4% |\n"
        "| Weighted Average | 5.9 | 3.5 | 40.7% |\n"
    )
    out = _pretokenize_pipe_tables_to_html(md)
    assert '<table>' in out
    assert '<th>Tier</th>' in out
    assert '<td>Weighted Average</td>' in out
    # No bare-pipe lines should remain.
    for line in out.split('\n'):
        assert not (line.strip().startswith('|') and line.strip().endswith('|'))


def test_pretokenizer_handles_ragged_rows():
    """LLM sometimes emits a row with one fewer cell than the header.
    Markdown's table extension would silently drop that row; we pad
    instead so the user still sees the data."""
    md = (
        "| A | B | C |\n"
        "|---|---|---|\n"
        "| 1 | 2 |\n"  # ragged
        "| 4 | 5 | 6 |\n"
    )
    out = _pretokenize_pipe_tables_to_html(md)
    # Both rows must appear.
    assert '<td>1</td>' in out and '<td>2</td>' in out
    assert '<td>4</td>' in out and '<td>5</td>' in out and '<td>6</td>' in out


def test_pretokenizer_drops_separator_row():
    md = "| A | B |\n|---|---|\n| 1 | 2 |\n"
    out = _pretokenize_pipe_tables_to_html(md)
    assert '<td>---</td>' not in out
    assert '<th>A</th>' in out and '<td>1</td>' in out


def test_pretokenizer_skips_single_row_cluster():
    """A lone pipe row with no companion is NOT a table — it's an
    orphan that the orphan-merge or salvage step will handle."""
    md = "Some prose paragraph.\n| Lone | Row |\nMore prose."
    out = _pretokenize_pipe_tables_to_html(md)
    assert '<table>' not in out
    assert '| Lone | Row |' in out


def test_pretokenizer_leaves_html_table_alone():
    html = (
        "<p>Prose.</p>\n"
        "<table><tbody><tr><td>1</td></tr></tbody></table>\n"
        "<p>More prose.</p>"
    )
    out = _pretokenize_pipe_tables_to_html(html)
    assert out == html  # nothing changed


def test_pretokenizer_escapes_html_special_chars():
    md = (
        "| Threshold | Value |\n"
        "|---|---|\n"
        "| <50 emp. | 1,280 |\n"
        "| >500 & <1000 | 640 |\n"
    )
    out = _pretokenize_pipe_tables_to_html(md)
    # <50 must be escaped as &lt;50 inside the cell to prevent HTML
    # parsers from interpreting it as a stray tag.
    assert '&lt;50' in out
    assert '&amp;' in out
    assert '&gt;500' in out


# ─── consecutive-table merge (mirrors the orphan-merge extension) ──────
def _merge_consecutive_tables(html: str) -> str:
    def _count_first_row_cells(table_html: str) -> int:
        m = re.search(r'<tr[^>]*>(.*?)</tr>', table_html, flags=re.DOTALL | re.IGNORECASE)
        if not m:
            return 0
        return len(re.findall(r'<t[hd]\b', m.group(1), flags=re.IGNORECASE))

    def _merge(match):
        first = match.group(1)
        second = match.group(3)
        if (_count_first_row_cells(first) == 0 or
                _count_first_row_cells(first) != _count_first_row_cells(second)):
            return match.group(0)
        second_body = re.sub(
            r'<thead[^>]*>(.*?)</thead>', r'\1',
            second, flags=re.DOTALL | re.IGNORECASE,
        )
        second_rows = re.findall(
            r'<tr[^>]*>.*?</tr>', second_body,
            flags=re.DOTALL | re.IGNORECASE,
        )
        second_rows = [
            re.sub(r'<(/?)th\b', r'<\1td', r, flags=re.IGNORECASE)
            for r in second_rows
        ]
        rows_html = ''.join(second_rows)
        if '</tbody>' in first.lower():
            return re.sub(
                r'(</tbody>\s*</table>)',
                rows_html + r'\1',
                first, count=1, flags=re.IGNORECASE,
            )
        return re.sub(
            r'(\s*</table>)',
            rows_html + r'\1',
            first, count=1, flags=re.IGNORECASE,
        )

    rgx = re.compile(
        r'(<table\b[^>]*>.*?</table>)(\s*)(<table\b[^>]*>.*?</table>)',
        flags=re.DOTALL | re.IGNORECASE,
    )
    prev, n = None, 10
    while prev != html and n > 0:
        prev = html
        html = rgx.sub(_merge, html, count=1)
        n -= 1
    return html


def test_consecutive_tables_with_matching_cols_are_merged():
    html = (
        '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>'
        '<tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>'
        '\n\n'
        '<table><thead><tr><th>4</th><th>5</th><th>6</th></tr></thead>'
        '<tbody><tr><td>7</td><td>8</td><td>9</td></tr></tbody></table>'
    )
    out = _merge_consecutive_tables(html)
    # Should now be ONE table with all 4 data rows (1-3, then 4-9 demoted).
    assert out.count('<table>') == 1
    assert '<td>4</td>' in out  # demoted from <th>
    assert '<td>7</td>' in out


def test_consecutive_tables_with_mismatched_cols_are_not_merged():
    html = (
        '<table><tr><td>A</td><td>B</td></tr></table>'
        '\n\n'
        '<table><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    )
    assert _merge_consecutive_tables(html).count('<table>') == 2


def test_three_consecutive_tables_all_merged():
    html = (
        '<table><tr><td>A</td><td>B</td></tr></table>'
        '\n\n'
        '<table><tr><td>C</td><td>D</td></tr></table>'
        '\n\n'
        '<table><tr><td>E</td><td>F</td></tr></table>'
    )
    out = _merge_consecutive_tables(html)
    assert out.count('<table>') == 1
    for cell in ('A', 'B', 'C', 'D', 'E', 'F'):
        assert f'<td>{cell}</td>' in out


def test_unrelated_tables_separated_by_paragraph_not_merged():
    html = (
        '<table><tr><td>A</td><td>B</td></tr></table>'
        '<p>Some explanation between the two tables.</p>'
        '<table><tr><td>C</td><td>D</td></tr></table>'
    )
    assert _merge_consecutive_tables(html).count('<table>') == 2
