"""Unit tests for the patent-diagram layout validator (`analyze_layout`).

Backs the #1a fix: after a figure is rendered, its recorded component bounding
boxes are checked for overlaps and out-of-margin spills so the pipeline can
regenerate bad figures. These tests exercise the pure geometry (no rendering),
so they run anywhere `reportlab` is importable.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from patent_diagram_runner import analyze_layout  # noqa: E402

# US-Letter portrait drawable area = x∈[54,558], y∈[72,738]
PAGE = {"page_w": 612.0, "page_h": 792.0}


def _layout(*elements):
    return {**PAGE, "elements": list(elements)}


def _box(x, y, w, h, label="box", container=False, kind="box"):
    return {"kind": kind, "container": container, "x": x, "y": y, "w": w, "h": h, "label": label}


def test_clean_layout_has_no_issues():
    layout = _layout(
        _box(100, 600, 120, 40, "A"),
        _box(360, 600, 120, 40, "B"),
        _box(100, 400, 120, 40, "C"),
    )
    assert analyze_layout(layout) == []


def test_overlapping_solid_boxes_are_flagged():
    layout = _layout(
        _box(100, 600, 160, 60, "Box A"),
        _box(180, 580, 160, 60, "Box B"),  # overlaps Box A
    )
    issues = analyze_layout(layout)
    assert any("solap" in i.lower() for i in issues), issues


def test_touching_edges_not_flagged_as_overlap():
    # Boxes that merely share an edge (gap 0) must NOT be flagged.
    layout = _layout(
        _box(100, 600, 100, 40, "A"),
        _box(200, 600, 100, 40, "B"),  # starts exactly where A ends
    )
    assert analyze_layout(layout) == []


def test_box_past_right_margin_is_flagged():
    layout = _layout(_box(480, 600, 160, 40, "Wide"))  # x+w=640 > 558
    issues = analyze_layout(layout)
    assert any("derech" in i.lower() for i in issues), issues


def test_box_below_bottom_margin_is_flagged():
    layout = _layout(_box(100, 40, 120, 40, "Low"))  # y=40 < 72
    issues = analyze_layout(layout)
    assert any("inferior" in i.lower() for i in issues), issues


def test_dashed_container_around_boxes_is_not_a_false_positive():
    # A dashed container is EXPECTED to enclose solid boxes — must not count
    # as an overlap.
    layout = _layout(
        _box(90, 380, 200, 300, "Layer 1", container=True, kind="dashed_box"),
        _box(110, 600, 160, 40, "Inner A"),
        _box(110, 430, 160, 40, "Inner B"),
    )
    assert analyze_layout(layout) == []


def test_empty_or_none_layout_is_safe():
    assert analyze_layout(None) == []
    assert analyze_layout({}) == []
    assert analyze_layout(_layout()) == []


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
