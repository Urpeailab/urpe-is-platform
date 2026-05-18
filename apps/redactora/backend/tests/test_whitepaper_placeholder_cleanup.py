"""
Regression test for whitepaper placeholder cleanup.

User reported `Finding: [pending information]` appearing in the final PDF of
their NIW EB-2 whitepaper. These placeholders must NEVER reach the final
document. The `clean_whitepaper_content()` function in server.py is responsible
for stripping every bracketed placeholder variant the LLM might emit.

Run with:   pytest backend/tests/test_whitepaper_placeholder_cleanup.py -v
"""
import re
import pytest


# Replicate the exact regex set used inside server.py clean_whitepaper_content
PLACEHOLDER_PATTERNS = [
    r'\[\s*pending[^\]]{0,80}\]',
    r'\[\s*NEEDED[^\]]{0,300}\]',
    r'\[\s*(?:TBD|TODO|FIXME|XXX)[^\]]{0,100}\]',
    r'\[\s*to\s+be\s+(?:determined|added|filled|completed|provided)[^\]]{0,100}\]',
    r'\[\s*placeholder[^\]]{0,100}\]',
    r'\[\s*insert[^\]]{0,100}\]',
    r'\[\s*add\s+(?:here|content|data)[^\]]{0,100}\]',
    r'\[\s*fill\s+in[^\]]{0,100}\]',
    r'\[\s*missing[^\]]{0,100}\]',
    r'\[\s*data\s+missing[^\]]{0,100}\]',
    r'\[\s*describe\s+(?:qualitatively|here|below)[^\]]{0,200}\]',
    # Generic prompt-template labels
    r'\[\s*(?:Organization|Company|Employer|Institution|Role|Role\s+Title|Job\s+Title|Position|Title|Name|Author|Person|Petitioner|Candidate|Beneficiary|'
    r'Start\s+Date|End\s+Date|Date|Year|Year\s+Range|Date\s+Range|Dates|Timeframe|Period|Duration|'
    r'Source|Citation|Reference|Publication|Journal|Volume|Issue|Page|Page\s+Number|'
    r'Country|State|City|Location|Region|Jurisdiction|Industry|Sector|Field|Domain|Specialty|'
    r'X|Y|Z|N|M|A|B|C|[A-Z]\d*|X%|Y%|Z%|A%|B%|C%|X\s+employees?|Y\s+clients?|'
    r'Metric|Metric\s+Name|Metric\s+Value|Baseline|Baseline\s+Value|Target|Target\s+Value|Value|Number|Amount|Range|'
    r'Description|Explanation|Rationale|Context|Detail|Details|Specify|Specific\s+[A-Za-z]+|Brief\s+[A-Za-z]+|Conservative\s+[A-Za-z]+|'
    r'Methodology\s+\d*\s*Name|Methodology\s+Name|Framework\s+Name|Strategy\s+Name|Model\s+Name|'
    r'Primary\s+User\s+Type|Secondary\s+User\s+Type|User\s+Type|'
    r'Specific\s+experience[^\]]*|Specific\s+credential[^\]]*|Specific\s+[a-z]+[^\]]*|'
    r'H/M/L|L/M/H|Low/Medium/High|P1/P2/P3|Yes/No|TRUE/FALSE)\s*\]',
    r'<em[^>]*>\s*\[[^\]]{0,200}\]\s*</em>',
    r'<i[^>]*>\s*\[[^\]]{0,200}\]\s*</i>',
    r'<strong[^>]*>\s*\[[^\]]{0,200}\]\s*</strong>',
]
PLACEHOLDER_LINE = r'(?:[A-Z][A-Za-z ]{0,30}:)?\s*\[[^\]]{0,200}\]'
ORPHAN_LABELS = r'(?:Finding|Target|Metric|Value|Result|Status|Note|Evidence|Document|Citation)'


def _run_cleanup(html: str) -> str:
    cleaned = html
    for p in PLACEHOLDER_PATTERNS:
        cleaned = re.sub(p, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    # Nuclear: whole container with just placeholder
    cleaned = re.sub(rf'<p[^>]*>\s*(?:<strong>\s*)?{PLACEHOLDER_LINE}(?:\s*</strong>)?\s*</p>',
                     '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(rf'<li[^>]*>\s*(?:<strong>\s*)?{PLACEHOLDER_LINE}(?:\s*</strong>)?\s*</li>',
                     '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(rf'<td[^>]*>\s*(?:<strong>\s*)?{PLACEHOLDER_LINE}(?:\s*</strong>)?\s*</td>',
                     '<td></td>', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(rf'<blockquote[^>]*>\s*(?:<strong>\s*)?{PLACEHOLDER_LINE}(?:\s*</strong>)?\s*</blockquote>',
                     '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    # Markdown residuals
    cleaned = re.sub(r'(?<![\*\w])\*{4,}(?![\*\w])', '', cleaned)
    cleaned = re.sub(r'\*\*[ \t\xa0]*(?:[A-Za-z][A-Za-z0-9 ]{0,40}:\s*)?[ \t\xa0]*\*\*', '', cleaned)
    cleaned = re.sub(r'<strong[^>]*>\s*</strong>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<b[^>]*>\s*</b>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'(?m)^\s*[-*]\s*$', '', cleaned)
    cleaned = re.sub(r'<li[^>]*>\s*(?:<strong>\s*</strong>\s*)?</li>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r'(?m)^\s*(?:\*{2,}|<strong[^>]*>\s*</strong>)\s*(?:\|\s*\[[^\]]{0,60}\]\s*){1,6}.*$',
        '', cleaned
    )
    # Orphan labels
    cleaned = re.sub(rf'<p[^>]*>\s*(?:<strong>\s*)?{ORPHAN_LABELS}:\s*(?:</strong>)?\s*</p>',
                     '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(rf'<li[^>]*>\s*(?:<strong>\s*)?{ORPHAN_LABELS}:\s*(?:</strong>)?\s*</li>',
                     '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<p[^>]*>\s*</p>', '', cleaned, flags=re.IGNORECASE)
    return cleaned


# ─── Cases that MUST be cleaned ──────────────────────────────────────────
@pytest.mark.parametrize("raw", [
    # Exact user-reported case
    "<p>Finding: [pending information]</p>",
    "<p><strong>Finding:</strong> [pending information]</p>",
    # Variants
    "<p>Finding: [pending data]</p>",
    "<p>Finding: [NEEDED: outcome metrics]</p>",
    "<p>Finding: [NEEDED]</p>",
    "<p>Finding: [TBD]</p>",
    "<p>Finding: [TODO]</p>",
    "<p>Finding: [to be determined based on exhibit review]</p>",
    "<p>Finding: [to be added]</p>",
    "<p>Finding: [placeholder for metrics]</p>",
    "<p>Finding: [missing data]</p>",
    "<p>Finding: [describe qualitatively in the report]</p>",
    "<li>Target: [NEEDED: specific figure]</li>",
    "<td>[NEEDED]</td>",
    "<p>The candidate achieved <em>[pending data]</em> milestones.</p>",  # should at least strip inner
    "<p>Finding:</p>",  # orphan label
    # NEW — Wendy Alejandra PDF residuals (generic prompt-template placeholders)
    "<p>Position: [Organization]</p>",
    "<p>Start: [Start Date]</p>",
    "<p>End: [End Date]</p>",
    "<p>Employer: [Company]</p>",
    "<p>Publication: [Journal], Volume [Volume]</p>",
    "<p>Baseline: [Baseline Value]</p>",
    "<p>Target: [X%] improvement</p>",
    # Markdown residuals (double asterisks with empty body, pipe rows)
    "<p>**Finding: **</p>",
    "<p>**Achievement 4: **</p>",
    "<p>****</p>",
    "**** | [Organization] | [Start Date] - [End Date]",
])
def test_placeholder_removed(raw):
    cleaned = _run_cleanup(raw)
    # Assert no bracketed placeholder remains
    placeholder_re = re.compile(
        r'\[\s*(?:pending|NEEDED|TBD|TODO|FIXME|XXX|placeholder|insert|missing|to be|add here|fill in|describe (?:qualitatively|here|below)|'
        r'Organization|Company|Employer|Start\s+Date|End\s+Date|Role|Role\s+Title|Job\s+Title|Year|Publication|Journal|Volume|Baseline|X%|Y%|Z%)',
        re.IGNORECASE,
    )
    assert not placeholder_re.search(cleaned), (
        f"Placeholder survived cleanup:\n  raw: {raw!r}\n  cleaned: {cleaned!r}"
    )
    # Also no literal **** should survive
    assert '****' not in cleaned, (
        f"**** markdown residual survived:\n  raw: {raw!r}\n  cleaned: {cleaned!r}"
    )


# ─── Cases that MUST be preserved ────────────────────────────────────────
@pytest.mark.parametrize("raw", [
    "<p>Finding: YES - Criterion 1 is satisfied.</p>",
    "<p><strong>Finding:</strong> The petitioner meets all six criteria.</p>",
    "<li>Target: Reach 500 U.S. workers within 24 months.</li>",
    "<p>Metric: 30% productivity improvement measured across the pilot cohort.</p>",
    "<p>The study cites [Patel, 2023] as supporting evidence.</p>",  # citation, not placeholder
    "<p>See Exhibit [A-1] for proof of achievement.</p>",  # exhibit ref
])
def test_valid_content_preserved(raw):
    cleaned = _run_cleanup(raw)
    # Assert key meaningful word is still there
    key_words = re.findall(r'[A-Za-z]{5,}', raw.lower())
    survived = all(kw in cleaned.lower() for kw in key_words[:3])
    assert survived, (
        f"Valid content was wrongly stripped:\n  raw: {raw!r}\n  cleaned: {cleaned!r}"
    )


# ─── Integration check: live function ────────────────────────────────────
def test_cleanup_wired_in_server_py():
    """Verify server.py download_whitepaper_pdf still calls clean_whitepaper_content."""
    from pathlib import Path
    src = Path("/app/backend/server.py").read_text()
    assert "clean_whitepaper_content(section_content" in src, (
        "clean_whitepaper_content is no longer invoked from download path"
    )
    assert r'\[\s*pending[^\]]{0,80}\]' in src, (
        "Broad pending-placeholder regex missing from clean_whitepaper_content"
    )
