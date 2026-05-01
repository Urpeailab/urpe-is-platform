"""
Regression test for the case-study horizontal-divider-line bug.

User explicitly requested: "en los casos de estudio elimina esas lineas
divisorias horizontales" (remove the horizontal divider lines that the
markdown `---` / `***` syntax was being rendered as thin grey HRFlowable
lines in the PDF).

The fix: in `case_studies_router.py` the markdown-horizontal-rule branch
now skips the line entirely instead of appending an HRFlowable to the
story. Section headings already provide visual structure.
"""
from pathlib import Path

ROUTER_PATH = (
    Path(__file__).resolve().parent.parent
    / "routers"
    / "case_studies_router.py"
)


def test_markdown_hr_does_not_emit_hrflowable_anymore():
    """The markdown horizontal-rule branch must NOT call HRFlowable."""
    src = ROUTER_PATH.read_text(encoding="utf-8")
    # Locate the regex match for the hr line (`^[\-\*_=]{3,}$`)
    marker = r"re.match(r'^[\-\*_=]{3,}$'"
    assert marker in src, (
        "Markdown horizontal-rule branch not found. The fix may have been "
        "removed."
    )
    # Find the small block after that marker (next ~6 lines)
    idx = src.index(marker)
    branch_block = src[idx: idx + 400]
    assert "HRFlowable" not in branch_block, (
        "The markdown horizontal-rule branch still appends HRFlowable.\n"
        "User explicitly asked to remove these visible divider lines.\n"
        "Block:\n" + branch_block
    )
    # And it should `continue` (i.e. drop the line).
    assert "continue" in branch_block, (
        "Markdown HR branch must skip the line via `continue`."
    )
