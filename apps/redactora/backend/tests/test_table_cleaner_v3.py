"""
Unit tests for clean_garbage_table_rows v3.
Tests specifically against V13 evaluation patterns.

Run with: pytest /app/backend/tests/test_table_cleaner_v3.py -v
"""
import sys
sys.path.insert(0, '/app/backend')

from server import clean_garbage_table_rows
import re


def make_table(headers: list, rows: list) -> str:
    """Build minimal HTML table for testing."""
    th_row = "<tr>" + "".join(f"<th>{h}</th>" for h in headers) + "</tr>"
    data_rows = ""
    for row in rows:
        data_rows += "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>"
    return f"<table>{th_row}{data_rows}</table>"


def get_rows_from_html(html: str) -> list:
    """Extract data rows (non-header) from cleaned HTML."""
    rows = re.findall(r'<tr>(.*?)</tr>', html, re.S | re.I)
    data_rows = []
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S | re.I)
        cell_texts = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
        is_header = bool(cells) and all(re.search(r'^<th', c.strip(), re.I) for c in cells)
        if not is_header and cell_texts:
            data_rows.append(cell_texts)
    return data_rows


# ──────────────────────────────────────────────────────────────────────────────
# V13 Pattern 1: Implementation Table — rows with old years
# ──────────────────────────────────────────────────────────────────────────────

def test_impl_table_v13_year_2018():
    """V13: '| 1 | 2018 | 1.00% of budget | 100,000 | In 2018... |' must be removed."""
    garbage_row = ["1", "2018", "1.00% of budget", "100,000", "In 2018, initial setup", "1.00%"]
    good_row = ["Phase 1", "Foundation", "Months 1-12", "$250,000", "Establish operations", "25%"]

    html = make_table(
        ["#", "Year", "Budget %", "Amount", "Description", "Completion"],
        [garbage_row, good_row]
    )
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["#", "Year"]]  # skip header

    assert any(r[0] == "Phase 1" for r in data_rows), "Good phase row should be kept"
    assert not any(r[0] == "1" and r[1] == "2018" for r in data_rows), \
        f"Year-2018 garbage row should be removed. Got: {data_rows}"


def test_impl_table_year_2008():
    """V13 Risk Matrix: '2008' in cell should also be caught (was missing from PAST_YEARS)."""
    garbage_row = ["Market adoption challenges", "1.00", "Likelihood", "Improved SMEs", "2008"]
    good_row = ["Slow client acquisition in fire protection sector", "Medium", "Targeted outreach to 50 FM firms", "Partnership development", "Months 1-6"]

    html = make_table(
        ["Risk", "Likelihood", "Impact", "Mitigation", "Timeline"],
        [garbage_row, good_row]
    )
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["Risk"]]

    assert any("fire protection" in r[0] for r in data_rows), "Good risk row should be kept"
    assert not any("2008" in str(r) for r in data_rows), \
        f"2008 garbage row should be removed. Got: {data_rows}"


# ──────────────────────────────────────────────────────────────────────────────
# V13 Pattern 2: Risk Matrix — column headers as data values
# ──────────────────────────────────────────────────────────────────────────────

def test_risk_matrix_likelihood_as_value():
    """V13: '| Market adoption challenges | 1.00 | Likelihood | Improved SMEs | 2008 |'."""
    # "Likelihood" appears as a data value in the Impact column → garbage
    garbage_rows = [
        ["Market adoption challenges", "1.00", "Likelihood", "Improved SMEs", "2008"],
        ["Regulatory compliance", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Financial constraints", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Operational execution", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Operational execution", "0.00", "Likelihood", "Improved SMEs", "2008"],  # duplicate
    ]
    good_rows = [
        ["Slow initial client acquisition due to conservative procurement cycles", "Medium", "High", "Targeted outreach and pilot programs", "Months 1-12"],
        ["Changes to NFPA 25 or EPA standards requiring methodology updates", "Low", "High", "Quarterly regulatory monitoring", "Ongoing"],
        ["Insufficient working capital constraining scaling", "Medium", "High", "Revenue-based credit line", "Year 2-3"],
        ["Technical integration with legacy fluid control systems pre-1985", "Medium", "Medium", "Compatibility testing protocols", "Year 1"],
        ["Economic downturn reducing capex among small water utilities", "Low", "High", "Diversified client portfolio", "Ongoing"],
    ]

    html = make_table(
        ["Risk", "Likelihood", "Impact", "Mitigation", "Timeline"],
        garbage_rows + good_rows
    )
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["Risk", "Likelihood"]]

    print(f"\nKept rows after cleaning: {len(data_rows)}")
    for r in data_rows:
        print(f"  {r[:2]}")

    # All 5 garbage rows should be removed
    assert not any("Likelihood" in str(r) for r in data_rows), \
        f"Rows with 'Likelihood' as value should be removed. Got: {data_rows}"
    # All 5 good rows should be kept
    assert len(data_rows) == 5, f"Expected 5 good rows, got {len(data_rows)}: {data_rows}"


def test_risk_matrix_impact_as_value():
    """'Impact' appearing as data value should also be flagged."""
    garbage_row = ["Compliance risk", "0.00", "Impact", "None specified", "2015"]
    html = make_table(["Risk", "Prob", "Impact", "Mitigation", "Year"], [garbage_row])
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] != "Risk"]
    assert len(data_rows) == 0, f"'Impact' as value garbage row should be removed. Got: {data_rows}"


# ──────────────────────────────────────────────────────────────────────────────
# V13 Pattern 3: Innovation Matrix — all identical value cells
# ──────────────────────────────────────────────────────────────────────────────

def test_innovation_matrix_all_identical():
    """V13: '| Data | Data Management | Data Management | Data Management |' must be removed."""
    garbage_rows = [
        ["Data", "Data Management", "Data Management", "Data Management"],
        ["Data", "Data Management", "Data Management", "Data Management"],
        ["Data", "Data Management", "Data Management", "Data Management"],
    ]
    good_rows = [
        ["AI-Driven Anomaly Detection", "Reduces pump failure risk by 40%", "Predictive maintenance algorithms", "Industry-leading accuracy"],
        ["IoT Sensor Integration", "Real-time monitoring of 200+ data points", "Proprietary sensor fusion protocol", "4x faster response vs. manual"],
    ]

    html = make_table(
        ["Innovation Area", "Value Proposition", "Technical Approach", "Differentiator"],
        garbage_rows + good_rows
    )
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["Innovation Area"]]

    print(f"\nKept rows after cleaning: {len(data_rows)}")
    for r in data_rows:
        print(f"  {r[:3]}")

    # Garbage rows removed
    assert not any(r[1] == "Data Management" for r in data_rows), \
        f"All-identical 'Data Management' rows should be removed. Got: {data_rows}"
    # Good rows kept
    assert len(data_rows) == 2, f"Expected 2 good rows, got {len(data_rows)}: {data_rows}"


def test_innovation_matrix_legitimate_identical_amounts():
    """Rows where value cells are identical DOLLAR AMOUNTS should be KEPT (not false positive)."""
    # A startup costs table might legitimately have identical values in some columns
    good_row = ["Technology License", "$5,000", "$5,000", "$5,000"]  # same cost each quarter
    html = make_table(["Item", "Q1", "Q2", "Q3"], [good_row])
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] != "Item"]
    # Dollar amounts should NOT be removed as false positives
    assert len(data_rows) == 1, f"Legitimate identical dollar amounts should be kept. Got: {data_rows}"


# ──────────────────────────────────────────────────────────────────────────────
# V13 Pattern 4: Duplicate Risk Matrix rows
# ──────────────────────────────────────────────────────────────────────────────

def test_duplicate_first_column_removed():
    """Duplicate rows with same first-column key should only keep the first occurrence."""
    rows = [
        ["Slow client acquisition in fire protection sector", "Medium", "High", "Outreach", "Y1"],
        ["Changes to NFPA 25 standards", "Low", "High", "Monitoring", "Ongoing"],
        ["Slow client acquisition in fire protection sector", "Medium", "High", "Outreach", "Y1"],  # duplicate
    ]
    html = make_table(["Risk", "L", "I", "M", "T"], rows)
    cleaned = clean_garbage_table_rows(html)
    clean_rows = get_rows_from_html(cleaned)
    data_rows = [r for r in clean_rows if r[0] != "Risk"]

    first_col_values = [r[0] for r in data_rows]
    assert first_col_values.count("Slow client acquisition in fire protection sector") == 1, \
        f"Duplicate row should be removed. Got: {data_rows}"


# ──────────────────────────────────────────────────────────────────────────────
# Regression tests — previously working patterns must still work
# ──────────────────────────────────────────────────────────────────────────────

def test_version_noise_still_caught():
    """Regression: version-noise cells (1.1.1.2.1) must still be removed."""
    garbage_row = ["Innovation 1", "1.1.2.1.3", "0.5.2.1", "AI platform"]
    html = make_table(["Area", "Score", "Metric", "Description"], [garbage_row])
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] != "Area"]
    assert len(data_rows) == 0, f"Version-noise row should be removed. Got: {data_rows}"


def test_phantom_phase_still_caught():
    """Regression: 'Phase 6', 'retention' phases must still be removed."""
    garbage_row = ["Phase 6: Retention", "Months 61-72", "$500,000", "Scale and retain clients"]
    good_row = ["Phase 1: Foundation", "Months 1-12", "$250,000", "Establish operations"]
    html = make_table(["Phase", "Timeline", "Budget", "Goals"], [garbage_row, good_row])
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["Phase"]]
    assert not any("Phase 6" in r[0] for r in data_rows), "Phase 6 should be removed"
    assert any("Phase 1" in r[0] for r in data_rows), "Phase 1 should be kept"


def test_all_zeros_still_caught():
    """Regression: rows where all value columns are 0/1 must still be removed."""
    garbage_row = ["Market adoption challenges", "0", "0", "1"]
    html = make_table(["Risk", "P", "I", "S"], [garbage_row])
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] != "Risk"]
    assert len(data_rows) == 0, f"All-zeros row should be removed. Got: {data_rows}"


def test_good_financial_table_not_touched():
    """Regression: legitimate financial tables must NOT have rows removed."""
    good_rows = [
        ["Office Lease (12 months)", "$2,400", "$28,800", "Shared co-working space, Year 1"],
        ["Initial Equipment & Tools", "$15,000", "$15,000", "Laptops, software licenses"],
        ["Marketing & Branding", "$5,000", "$5,000", "Website, materials"],
        ["Total", "$22,400", "$48,800", "Year 1 total expenditure"],
    ]
    html = make_table(["Expense", "Monthly", "Annual", "Notes"], good_rows)
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] != "Expense"]
    assert len(data_rows) == 4, f"All 4 good financial rows should be kept. Got: {len(data_rows)}: {data_rows}"


def test_full_v13_risk_matrix_scenario():
    """
    Full V13 scenario: 5 garbage rows + 5 good rows = 10 total.
    After cleaning: only 5 good rows remain.
    """
    garbage_rows = [
        ["Market adoption challenges", "1.00", "Likelihood", "Improved SMEs", "2008"],
        ["Regulatory compliance", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Financial constraints", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Operational execution", "0.00", "Likelihood", "Improved SMEs", "2008"],
        ["Operational execution", "0.00", "Likelihood", "Improved SMEs", "2008"],  # dup
    ]
    good_rows = [
        ["Slow initial client acquisition due to conservative procurement cycles in water and fire protection sectors", "Medium", "High", "Targeted outreach to 50 facility management firms and water utilities in Year 1", "Months 1-12"],
        ["Changes to NFPA 25 or EPA water quality standards requiring significant methodology updates", "Low", "High", "Quarterly regulatory monitoring and advisory committee participation", "Ongoing"],
        ["Insufficient working capital constraining hiring pace during scaling from 15 to 45 clients", "Medium", "High", "Revenue-based credit line and milestone-gated hiring plan", "Year 2-3"],
        ["Technical integration challenges with legacy fluid control systems manufactured before 1985", "Medium", "Medium", "Compatibility testing protocols and modular adaptation layer", "Year 1 pilot"],
        ["Economic downturn reducing capital expenditure among small water utilities and industrial facilities", "Low", "High", "Diversified client portfolio across municipal, industrial and commercial sectors", "Ongoing"],
    ]

    html = make_table(
        ["Risk Factor", "Likelihood", "Impact", "Mitigation Strategy", "Timeline"],
        garbage_rows + good_rows
    )
    cleaned = clean_garbage_table_rows(html)
    rows = get_rows_from_html(cleaned)
    data_rows = [r for r in rows if r[0] not in ["Risk Factor", "Likelihood"]]

    print(f"\n[Full V13 Risk Matrix] Kept {len(data_rows)} rows (expected 5):")
    for r in data_rows:
        print(f"  {r[0][:60]}")

    assert len(data_rows) == 5, f"Expected exactly 5 good rows after cleaning, got {len(data_rows)}: {[r[0][:40] for r in data_rows]}"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v", "--tb=short"])
