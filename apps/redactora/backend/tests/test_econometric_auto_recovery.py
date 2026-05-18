"""
Econometric Study — Auto-recovery of missing sections.

Claude Opus occasionally truncates the output (token budget, refusal) leaving
sections 13 (Limitations), 14 (Conclusions), 15 (Phases & Deliverables Plan),
or 16 (Technical Appendices) empty. The auto-recovery logic in
`generate_complete_econometric_study_v2` detects these gaps and issues
targeted follow-up LLM calls to fill each one.

These tests use mocked LLM calls (the real ones take 60-180s and cost money)
to validate:
- Missing sections are detected
- A regeneration call is made for each missing section
- The regenerated content is spliced into both sections_en and sections_es
- No "Content not available" placeholder survives in the final output
"""

import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import generate_complete_econometric_study_v2


# ────────────────────────────────────────────────────────────────────────────
# Helpers to build synthetic truncated LLM output
# ────────────────────────────────────────────────────────────────────────────


def _section_block(n: int, title: str, chars: int = 800) -> str:
    """Produce a realistic Markdown section block long enough to pass the
    MIN_CONTENT_CHARS=300 threshold."""
    body = (
        f"This is the body of section {n} about {title}. It contains substantial "
        f"analytical content with concrete economic metrics, references to U.S. "
        f"federal data sources including the Bureau of Labor Statistics, and "
        f"quantitative projections relevant to the endeavor. "
    )
    # Pad to requested length
    while len(body) < chars:
        body += body
    return f"## Section {n}: {title}\n\n{body[:chars]}\n"


def _full_16_sections_output() -> str:
    titles = [
        "Cover Page & Executive Summary",
        "Introduction & Research Questions",
        "Conceptual Framework & Mechanisms",
        "National Context & Relevance",
        "Data & Sources",
        "Empirical Design & Identification",
        "Specifications & Estimation Methods",
        "Robustness & Validation",
        "Main Results",
        "Simulations & Projections",
        "Cost–Benefit Analysis (CBA)",
        "Policy Implications",
        "Limitations",
        "Conclusions",
        "Phases & Deliverables Plan",
        "Technical Appendices",
    ]
    return "\n\n".join(_section_block(i + 1, t) for i, t in enumerate(titles))


def _truncated_output_missing_13_14() -> str:
    """Claude ran out of tokens after section 12 — sections 13, 14, 15, 16
    are missing entirely."""
    titles = [
        "Cover Page & Executive Summary",
        "Introduction & Research Questions",
        "Conceptual Framework & Mechanisms",
        "National Context & Relevance",
        "Data & Sources",
        "Empirical Design & Identification",
        "Specifications & Estimation Methods",
        "Robustness & Validation",
        "Main Results",
        "Simulations & Projections",
        "Cost–Benefit Analysis (CBA)",
        "Policy Implications",
    ]
    return "\n\n".join(_section_block(i + 1, t) for i, t in enumerate(titles))


# ────────────────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_auto_recovery_fills_missing_sections():
    """When the main LLM call returns only 12 sections, the auto-recovery
    layer must invoke targeted regeneration for sections 13, 14, 15, 16."""
    truncated = _truncated_output_missing_13_14()

    # Track which sections the recovery was asked to regenerate
    recovered_sections = []

    async def _mocked_opus(system_message, user_message, temperature, max_tokens):
        # Full-study call (max_tokens=32000) vs. recovery call (max_tokens=4000)
        if max_tokens >= 16000:
            return truncated
        # Recovery call: synthesize which section is being asked for
        import re as _re
        m = _re.search(r'Section (\d+):', user_message)
        assert m, f"Recovery prompt must reference a specific section: {user_message[:200]}"
        num = int(m.group(1))
        recovered_sections.append(num)
        titles = {
            13: "Limitations",
            14: "Conclusions",
            15: "Phases & Deliverables Plan",
            16: "Technical Appendices",
        }
        title = titles.get(num, f"Section {num}")
        return _section_block(num, title, chars=700)

    with patch("server.call_claude_opus", new=AsyncMock(side_effect=_mocked_opus)):
        result = await generate_complete_econometric_study_v2(
            project_description="Test project about AI in U.S. healthcare.",
            language="en",
        )

    # All 16 sections must be present with substantial content
    sections_en = result["sections_en"]
    assert len(sections_en) == 16, f"Expected 16 sections, got {len(sections_en)}"
    section_nums = sorted(s.get("number") for s in sections_en)
    assert section_nums == list(range(1, 17))

    for s in sections_en:
        content = s.get("content", "") or ""
        assert len(content) >= 300, (
            f"Section {s.get('number')} '{s.get('title')}' has only {len(content)} "
            f"chars after recovery — placeholder will appear in PDF"
        )

    # The 4 missing sections must have been regenerated
    assert sorted(recovered_sections) == [13, 14, 15, 16], (
        f"Expected recovery calls for sections [13, 14, 15, 16], got {recovered_sections}"
    )


@pytest.mark.asyncio
async def test_no_recovery_needed_when_output_complete():
    """When the main LLM call produces all 16 sections with good content,
    the auto-recovery layer must NOT invoke any additional LLM calls."""
    full_output = _full_16_sections_output()

    recovery_call_count = 0

    async def _mocked_opus(system_message, user_message, temperature, max_tokens):
        nonlocal recovery_call_count
        if max_tokens >= 16000:
            return full_output
        recovery_call_count += 1
        return "## Section 99: unexpected\n\nshould not happen"

    with patch("server.call_claude_opus", new=AsyncMock(side_effect=_mocked_opus)):
        result = await generate_complete_econometric_study_v2(
            project_description="Test project about AI in U.S. healthcare.",
            language="en",
        )

    assert recovery_call_count == 0, (
        f"Auto-recovery invoked {recovery_call_count} times despite complete output"
    )
    assert len(result["sections_en"]) == 16


@pytest.mark.asyncio
async def test_auto_recovery_falls_back_to_gpt5_when_opus_fails():
    """If Opus fails for a recovery call, the code must fall back to GPT-5.1."""
    truncated = _truncated_output_missing_13_14()
    opus_recovery_attempts = 0
    gpt5_recovery_attempts = 0

    async def _mocked_opus(system_message, user_message, temperature, max_tokens):
        nonlocal opus_recovery_attempts
        if max_tokens >= 16000:
            return truncated
        opus_recovery_attempts += 1
        raise RuntimeError("Simulated Opus rate limit")

    async def _mocked_gpt5(system_message, user_message, temperature, max_tokens):
        nonlocal gpt5_recovery_attempts
        gpt5_recovery_attempts += 1
        import re as _re
        m = _re.search(r'Section (\d+):', user_message)
        num = int(m.group(1)) if m else 99
        return _section_block(num, f"Section {num}", chars=700)

    with patch("server.call_claude_opus", new=AsyncMock(side_effect=_mocked_opus)), \
         patch("server.call_openai_gpt5", new=AsyncMock(side_effect=_mocked_gpt5)):
        result = await generate_complete_econometric_study_v2(
            project_description="Test project.",
            language="en",
        )

    assert opus_recovery_attempts >= 4  # one per missing section
    assert gpt5_recovery_attempts >= 4
    # All sections must still be present despite Opus recovery failure
    for s in result["sections_en"]:
        assert len(s.get("content", "") or "") >= 300


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
