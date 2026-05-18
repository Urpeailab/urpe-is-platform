"""
Regression test for Business Plan prompt improvements addressing the USCIS
evaluation feedback on a real rejected-risk business plan:

  1. STRUCTURAL URGENT: content was being assigned to the WRONG prong section
     (Prong 2 qualifications appeared in Prong 1, etc.). USCIS evaluators
     reject petitions where arguments aren't where they expect them.
  2. PRONG 2 CRITICAL: absence of QUANTIFIED & verifiable achievements
     (X companies formalized, Y jobs created, Z programs in W municipalities).
     Without numbers, "well-positioned" is speculative and vulnerable to RFE.
  3. PRONG 3 CRITICAL: no explicit waiver argument. Dhanasar requires an
     affirmative balance of three factors — (i) impracticality of PERM,
     (ii) urgency/substantial benefit lost, (iii) national-interest justification.

These tests don't invoke the LLM — they validate that the prompt SCAFFOLDING
forces the LLM to address each gap in the correct section.

Run with:   pytest backend/tests/test_business_plan_prompt_uscis_gaps.py -v
"""
import sys
sys.path.insert(0, '/app/backend')
import pytest
from business_plan_prompt_v3 import get_section_prompt_v3


PROJECT_DATA = {
    "project_title": "Small-Business Regulatory Compliance Advisory",
    "industry": "Regulatory advisory",
    "state": "Florida",
}
AUTHOR_DATA = {
    "author_name": "Maria Gonzalez",
    "cv_summary": "12 years of compliance experience in Colombia.",
}


def _prompt(section_number: int) -> str:
    return get_section_prompt_v3(section_number, "test", PROJECT_DATA, AUTHOR_DATA)


# ── 1. STRUCTURAL — prong mapping must be in every section ───────────────

def test_base_context_has_prong_mapping():
    """Every section gets the base_context, which must teach the LLM the
    Prong → Section mapping so content goes where USCIS expects it."""
    for sn in (1, 2, 3, 4, 5, 6, 7, 8):
        p = _prompt(sn)
        assert "DHANASAR PRONG MAPPING" in p, (
            f"Section {sn} prompt is missing the DHANASAR PRONG MAPPING rule — "
            f"content could be assigned to wrong prong"
        )
        assert "EXCLUSIVE home" in p, (
            f"Section {sn} prompt is missing the EXCLUSIVE section assignment guidance"
        )


# ── 2. PRONG 2 — Section 4 must mandate QUANTIFIED achievements ──────────

def test_section4_opens_with_prong2_banner():
    p = _prompt(4)
    # Banner must appear so USCIS evaluator immediately sees Prong 2 scope
    assert "Dhanasar Prong 2" in p, "Section 4 missing Prong 2 banner"
    assert "Well-Positioned" in p, "Section 4 missing 'Well-Positioned' keyword"


def test_section4_mandates_quantified_track_record():
    p = _prompt(4)
    assert "QUANTIFIED Track Record" in p, (
        "Section 4 subsection 4.2 no longer requires QUANTIFIED Track Record"
    )
    assert "MANDATORY QUANTIFICATION" in p, (
        "Section 4 missing MANDATORY QUANTIFICATION enforcement header"
    )
    # Must require specific number + unit + organization + date + source
    for col in ("Achievement", "Metric", "Organization", "Date Range", "Verification Source"):
        assert col in p, f"Verifiable Track Record table missing column: {col}"
    assert "MINIMUM 5 UNIQUE rows" in p, (
        "Verifiable Track Record must require at least 5 quantified rows"
    )


def test_section4_has_prong2_closing_statement():
    p = _prompt(4)
    assert "Prong 2 Closing Statement" in p, (
        "Section 4 must end with an explicit Prong 2 pronouncement so evaluator "
        "can locate the well-positioned conclusion"
    )


# ── 3. PRONG 3 — Section 7 must construct the affirmative waiver ─────────

def test_section7_opens_with_prong3_banner():
    p = _prompt(7)
    assert "Dhanasar Prong 3" in p, "Section 7 missing Prong 3 banner"
    assert "Affirmative Waiver Argument" in p, (
        "Section 7 missing 'Affirmative Waiver Argument' framing"
    )


def test_section7_addresses_three_dhanasar_factors():
    """Dhanasar Prong 3 requires balancing THREE factors — all must be present
    as explicit subsections."""
    p = _prompt(7)
    for factor in ("Factor (i)", "Factor (ii)", "Factor (iii)"):
        assert factor in p, (
            f"Section 7 is missing {factor} — Prong 3 legal sufficiency is broken"
        )
    # Specific legal language that Dhanasar decision uses
    assert "impracticality of labor certification" in p.lower()
    assert "urgency" in p.lower() and "substantial benefit" in p.lower()
    assert "national-interest justification" in p.lower() or "national interest" in p.lower()


def test_section7_has_balancing_closing_statement():
    p = _prompt(7)
    assert "Balancing Statement" in p or "balance of equities" in p.lower() or "on balance" in p.lower(), (
        "Section 7 must explicitly PERFORM the Dhanasar balancing — evaluator "
        "cannot grant waiver without seeing the balance test applied"
    )


# ── 4. PRONG 1 — Section 6 must mark itself as Prong 1 completion ────────

def test_section6_opens_with_prong1_banner():
    p = _prompt(6)
    assert "Dhanasar Prong 1" in p, "Section 6 missing Prong 1 banner"


# ── 5. ANTI-CONTAMINATION — prong sections don't pre-empt other prongs ───

def test_prong_sections_forbid_cross_contamination():
    """Each Prong-home section should explicitly forbid restating other prongs."""
    # Section 4 (Prong 2) must forbid Prong 1 / Prong 3 intrusion
    p4 = _prompt(4)
    assert "do NOT address national importance" in p4 or "do NOT address" in p4.lower(), (
        "Section 4 must forbid leaking Prong 1/3 content"
    )
    # Section 7 (Prong 3) must forbid restating Prongs 1/2
    p7 = _prompt(7)
    assert "Do NOT restate Prong 1" in p7 or "NEVER restate Prong" in p7, (
        "Section 7 must forbid restating Prong 1/2 content"
    )
