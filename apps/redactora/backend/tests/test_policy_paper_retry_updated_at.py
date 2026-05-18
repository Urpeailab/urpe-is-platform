"""
Regression test for the Policy Paper retry button "no comienza la
regeneración" bug.

User report: When the retry button is clicked on a stale ("Atascado")
policy paper, the toast says "Reintentando generación del reporte..."
but the user perceives that the regeneration never starts. The card
remains in the "Atascado" state with the message "Lleva más de 20 min
sin actualizar".

Root cause: the frontend marks any policy paper whose
`updated_at` is more than 20 minutes old AND whose `status` is
'generating' as stale. The retry endpoint correctly switched the status
back to 'generating' but did NOT bump `updated_at`. So the moment the
list reloaded, the card was re-classified as stale even though the
background task was genuinely running.

Fix: `retry_policy_paper_generation` now always sets `updated_at` to
the current UTC timestamp on retry, and the in-flight progress updates
inside the background task also refresh `updated_at` so long
generations stay fresh in the UI.

These tests exercise the regex/source-level invariants without needing
a live DB (the actual MongoDB call is exercised end-to-end in the
existing endpoint integration tests).
"""
from pathlib import Path

ROUTER_PATH = Path(__file__).resolve().parent.parent / "routers" / "policy_papers_router.py"


def _read_router():
    return ROUTER_PATH.read_text(encoding="utf-8")


def test_retry_endpoint_sets_updated_at():
    """The /retry endpoint must include `updated_at` in BOTH branches."""
    src = _read_router()
    # Find the retry endpoint and ensure both translation-only and full
    # regeneration branches set updated_at.
    retry_block_start = src.index('@router.post("/{paper_id}/retry")')
    retry_block_end = src.index('@router.', retry_block_start + 5)
    retry_src = src[retry_block_start:retry_block_end]

    # The retry block must reference updated_at inside its $set updates.
    quote_count = retry_src.count('"updated_at"')
    assert quote_count >= 2, (
        f"Expected updated_at in both retry branches, got {quote_count}.\n"
        "The frontend marks any policy paper as stale (>20min) if its "
        "updated_at is not refreshed on retry, so the user perceives the "
        "retry button as a no-op."
    )


def test_in_progress_progress_updates_set_updated_at():
    """Long-running generations must heartbeat updated_at so the UI does
    not flip the card to stale while the LLM is still working."""
    src = _read_router()
    # Find the body of generate_policy_paper_background.
    fn_start = src.index("async def generate_policy_paper_background")
    fn_end = src.index("\nasync def ", fn_start + 1)
    fn_src = src[fn_start:fn_end]

    # Each progress-bump update_one in the happy path should include updated_at.
    # We expect the 10%, 20%, and 60% intermediate updates to all bump updated_at.
    expected_progress_markers = [
        '"progress": 10',
        '"progress": 20',
        '"progress": 60',
    ]
    for marker in expected_progress_markers:
        # Find the $set block containing this progress value
        idx = fn_src.find(marker)
        assert idx > 0, f"Could not find progress marker {marker} in generator function"
        # Look for updated_at within ~250 chars of the marker (same $set block)
        window = fn_src[max(0, idx - 250): idx + 250]
        assert '"updated_at"' in window, (
            f"Progress update around `{marker}` does not refresh updated_at — "
            f"this will cause the UI to mark the doc as stale during long generations."
        )


def test_retry_translation_heartbeat_updates_at():
    """retry_policy_paper_translation must heartbeat updated_at on entry."""
    src = _read_router()
    fn_start = src.index("async def retry_policy_paper_translation")
    fn_end = src.index("\nasync def ", fn_start + 1) if "\nasync def " in src[fn_start + 1:] else src.index("\ndef ", fn_start + 1)
    fn_src = src[fn_start:fn_end]
    assert '"updated_at"' in fn_src, (
        "retry_policy_paper_translation must bump updated_at at task start "
        "so the UI does not mark the document as stale immediately after retry."
    )
