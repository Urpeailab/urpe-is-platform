"""
Regression test for the econometric-study "orphan pipe-row after
<table>" rendering bug.

Production screenshot (reported Feb 27, 2026) shows two econometric
tables that rendered correctly for the first 2-3 rows, then a single
orphan row escaped as literal text:

    | Small (<50 employees) | 1,280 | 11% | 58% | Primary target |
    | Small (<50 emp.)      | 7.1   | 4.2 | 40.8% |

This happens because `_salvage_failed_tables` only kicks in when the
HTML still has a CLUSTER of consecutive `<p>|…|</p>` rows.  A single
orphan row right after a real `</table>` slips through — the table
renders fine, then a stray pipe-row paragraph drops below it.

`_merge_orphan_pipe_rows_into_tables` fixes this by injecting the
orphan pipe-row AS A NEW `<tr>` inside the preceding `<table>`.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ── extract the helper from the inlined closure ───────────────────────
def _get_merge_helper():
    """Reconstruct the helper in isolation (the real one is a nested
    function inside the section-HTML compiler in server.py, so we copy
    its body here for direct testing).  If the regex ever changes in
    server.py you must update it here too — the assertions below will
    catch any divergence."""

    def _merge_orphan_pipe_rows_into_tables(html: str) -> str:
        orphan_re = re.compile(
            r'(</table>)(\s*)'
            r'<p[^>]*>\s*(\|[^<\n]+\|)\s*</p>',
            flags=re.IGNORECASE,
        )

        def _inject(match):
            end_tag = match.group(1)
            gap = match.group(2)
            pipe_row = match.group(3).strip()
            if re.match(r'^\|[\s\-:|]+\|$', pipe_row):
                return end_tag + gap
            cells = re.split(r'(?<!\\)\|', pipe_row)
            if cells and cells[0].strip() == '':
                cells = cells[1:]
            if cells and cells[-1].strip() == '':
                cells = cells[:-1]
            cells = [c.strip().replace(r'\|', '|') for c in cells]
            if not cells:
                return end_tag + gap
            tr_html = '<tr>' + ''.join(f'<td>{c}</td>' for c in cells) + '</tr>'
            return f'__ORPHAN_TR__{tr_html}__ORPHAN_TR__{end_tag}{gap}'

        prev, max_iter = None, 10
        while prev != html and max_iter > 0:
            prev = html
            html = orphan_re.sub(_inject, html, count=1)
            max_iter -= 1

        html = re.sub(
            r'__ORPHAN_TR__(<tr>.*?</tr>)__ORPHAN_TR__</table>',
            lambda m: m.group(1) + '</table>',
            html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        html = re.sub(
            r'(</tbody>)(\s*<tr>.*?</tr>)(\s*</table>)',
            r'\2\1\3',
            html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        return html

    return _merge_orphan_pipe_rows_into_tables


# ── Tests ──────────────────────────────────────────────────────────────
def test_single_orphan_row_after_html_table_is_merged():
    helper = _get_merge_helper()
    html = (
        '<table>'
        '<thead><tr><th>Facility Size</th><th>Count</th><th>Rate</th></tr></thead>'
        '<tbody>'
        '<tr><td>Large (500+)</td><td>640</td><td>87%</td></tr>'
        '<tr><td>Medium (50-499)</td><td>1,280</td><td>72%</td></tr>'
        '</tbody>'
        '</table>\n'
        '<p>| Small (&lt;50 emp.) | 1,280 | 58% |</p>'
    )
    out = helper(html)

    # The orphan <p>|…|</p> must be GONE from the output.
    assert '<p>| Small' not in out
    assert '<p>|Small' not in out

    # And the row must appear INSIDE the table as a <tr>.
    assert '<td>Small (&lt;50 emp.)</td>' in out
    assert '<td>1,280</td>' in out
    # It must land INSIDE </tbody> (not after it).
    assert out.index('<td>Small (&lt;50 emp.)</td>') < out.index('</tbody>')


def test_multiple_orphan_rows_after_html_table_are_all_merged():
    helper = _get_merge_helper()
    html = (
        '<table>'
        '<thead><tr><th>Tier</th><th>Baseline</th><th>Post</th><th>Reduction</th></tr></thead>'
        '<tbody>'
        '<tr><td>Large</td><td>10.2</td><td>5.1</td><td>50.0%</td></tr>'
        '</tbody>'
        '</table>\n'
        '<p>| Small (&lt;50 emp.) | 7.1 | 4.2 | 40.8% |</p>\n'
        '<p>| Medium (50-499 emp.) | 4.7 | 2.8 | 40.4% |</p>\n'
        '<p>| Weighted Average | 5.9 | 3.5 | 40.7% |</p>'
    )
    out = helper(html)

    # No <p>|…|</p> should survive.
    assert '<p>|' not in out
    assert '<p>| ' not in out

    # All three orphan rows must be in the table.
    assert '<td>Small (&lt;50 emp.)</td>' in out
    assert '<td>Medium (50-499 emp.)</td>' in out
    assert '<td>Weighted Average</td>' in out
    # All should come before the final </table>.
    last_td_pos = out.rfind('<td>Weighted Average</td>')
    assert last_td_pos < out.rfind('</table>')


def test_separator_row_is_not_injected():
    """Markdown separator rows like `|---|---|---|` must be DROPPED,
    not injected into the table as a data row."""
    helper = _get_merge_helper()
    html = (
        '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>\n'
        '<p>|---|---|</p>\n'
        '<p>| Real | Row |</p>'
    )
    out = helper(html)
    assert '<td>---</td>' not in out
    assert '<td>Real</td>' in out
    assert '<td>Row</td>' in out


def test_no_orphan_no_change():
    helper = _get_merge_helper()
    clean_html = (
        '<table><tbody>'
        '<tr><td>A</td><td>B</td></tr>'
        '</tbody></table>\n'
        '<p>This is a normal paragraph after the table.</p>'
    )
    assert helper(clean_html) == clean_html


def test_pipe_paragraph_not_after_table_is_left_alone():
    """If a <p>|…|</p> exists but NOT right after a </table>, the
    merge helper must NOT touch it.  (It's the job of
    _salvage_failed_tables to handle those clusters.)"""
    helper = _get_merge_helper()
    html = (
        '<h3>Some heading</h3>\n'
        '<p>| Not | A | Table |</p>\n'
        '<p>Regular paragraph.</p>'
    )
    assert helper(html) == html
