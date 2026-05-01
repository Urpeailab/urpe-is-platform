"""
Regression tests for the Patent "Detailed Description" subsection rendering bug.

User report: "después de la séptima sección que es [D]etailed Component
Description, después de esto no sigue la secuencia de los números y no
hace los saltos de línea correspondientes".

Root cause: The LLM was asked to emit 5 subsections of Section 9 as a
numbered markdown list ("1. **Overall**", "2. **Detailed Component
Descriptions**", ...). After the 2nd item, the markdown parser frequently
breaks numbering and collapses paragraph breaks, so in the PDF everything
after "Detailed Component Descriptions" runs together without numbers
or line breaks.

Fix: normalize_patent_detailed_description() converts any of those
numbered/bolded subsection headings into proper "### Heading" H3 blocks
with blank lines around them, and renumber_paragraphs_sequentially()
calls it automatically before ¶-numbering.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import (  # noqa: E402
    normalize_patent_detailed_description,
    renumber_paragraphs_sequentially,
)


SUBSECTIONS = [
    "Overall System Architecture",
    "Detailed Component Descriptions",
    "Operational Flow",
    "Technical Advantages",
    "Implementation Examples",
]


def _count_h3_subsections(content: str) -> int:
    import re
    count = 0
    for title in SUBSECTIONS:
        if re.search(rf'(?im)^\s*###\s+{re.escape(title)}\s*$', content):
            count += 1
    return count


def test_numbered_list_subsections_are_converted_to_h3():
    legacy = """DETAILED DESCRIPTION OF THE INVENTION

1. **Overall System Architecture**

The system comprises...

2. **Detailed Component Descriptions**

Each component...

3. **Operational Flow**

The operational flow...

4. **Technical Advantages**

Key advantages include...

5. **Implementation Examples**

Example use cases...
"""
    out = normalize_patent_detailed_description(legacy)
    assert _count_h3_subsections(out) == 5, (
        f"Expected 5 H3 subsections, got {_count_h3_subsections(out)}:\n{out}"
    )
    # No residual numbered-bold headings remain
    for title in SUBSECTIONS:
        assert f"**{title}**" not in out
        assert f"1. **{title}**" not in out


def test_bold_only_subsections_are_converted_to_h3():
    legacy = """DETAILED DESCRIPTION OF THE INVENTION

**Overall System Architecture**

text...

**Detailed Component Descriptions**

more text...

**Operational Flow**

flow text...
"""
    out = normalize_patent_detailed_description(legacy)
    assert _count_h3_subsections(out) >= 3


def test_blank_lines_injected_around_h3_headings():
    tight = (
        "some intro line\n"
        "### Overall System Architecture\nfirst line of content\n"
        "### Detailed Component Descriptions\nmore content"
    )
    out = normalize_patent_detailed_description(tight)
    # After normalization, both headings must be surrounded by blank lines.
    assert "\n\n### Overall System Architecture\n\n" in out
    assert "\n\n### Detailed Component Descriptions\n\n" in out


def test_renumber_paragraphs_applies_normalization():
    """renumber_paragraphs_sequentially must also normalize the subsections."""
    legacy = (
        "DETAILED DESCRIPTION OF THE INVENTION\n\n"
        "1. **Overall System Architecture**\n\n"
        "¶0001 The system...\n\n"
        "2. **Detailed Component Descriptions**\n\n"
        "¶0002 Each component...\n\n"
        "3. **Operational Flow**\n\n"
        "¶0003 The flow...\n"
    )
    out = renumber_paragraphs_sequentially(legacy)
    assert "### Overall System Architecture" in out
    assert "### Detailed Component Descriptions" in out
    assert "### Operational Flow" in out
    # ¶ numbering still works
    assert "&#182;0001" in out
    assert "&#182;0002" in out
    assert "&#182;0003" in out


def test_does_not_touch_unrelated_numbered_lists():
    content = (
        "Background of the invention:\n\n"
        "1. **Some other heading**\n\n"
        "2. **Another unrelated heading**\n"
    )
    out = normalize_patent_detailed_description(content)
    # These are NOT in the known subsection whitelist so they must be untouched.
    assert "1. **Some other heading**" in out
    assert "2. **Another unrelated heading**" in out


def test_singular_variant_also_normalized():
    legacy = "2. **Detailed Component Description**\n\nSome text"
    out = normalize_patent_detailed_description(legacy)
    assert "### Detailed Component Description" in out
    assert "2. **Detailed Component Description**" not in out
