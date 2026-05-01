"""
Regression test for the policy-paper horizontal-divider-line bug.

User report (with screenshot of leidis pelaez Social Impact Report):
"los policy paper aun tienen la linea divisioria a descargar en el pdf".

The case-study fix had been applied earlier but policy papers had a
duplicate of the same code — markdown horizontal rules (`---`/`***`/
`___`/`===`) were still being rendered as a thin grey HRFlowable line.

Fix: in `policy_papers_router.py` the markdown-HR branch now skips the
line via `continue` instead of appending a Spacer + HRFlowable + Spacer.
"""
from pathlib import Path

ROUTER_PATH = (
    Path(__file__).resolve().parent.parent
    / "routers"
    / "policy_papers_router.py"
)


def test_markdown_hr_does_not_emit_hrflowable_anymore():
    src = ROUTER_PATH.read_text(encoding="utf-8")
    # Locate the regex match for the hr line.  The router uses
    # `re.match(r'^[-_=]{3,}\s*$', ls)` — find that.
    marker = "re.match(r'^[-_=]{3,}\\s*$', ls)"
    assert marker in src, (
        "Markdown horizontal-rule branch not found in policy_papers_router.py."
    )
    idx = src.index(marker)
    # Inspect the next ~400 chars (the elif body).
    branch_block = src[idx: idx + 400]
    assert "HRFlowable" not in branch_block, (
        "policy_papers_router still appends HRFlowable for markdown HR.\n"
        "Block:\n" + branch_block
    )
    assert "continue" in branch_block, (
        "Markdown HR branch must skip the line via `continue`."
    )
