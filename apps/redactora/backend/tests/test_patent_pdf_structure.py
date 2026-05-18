"""
Patent PDF Structure Regression Tests.

Specifically validates the reported bug: after the "Detailed Description of
Embodiments" section (which includes a subsection called "Detailed Component
Description"), the subsection numbering stops being sequential and line breaks
between subsections are missing.

The tests use synthetic patent content that mirrors what Claude Opus / GPT-5
actually produces, then exercise the production rendering pipeline
(`renumber_paragraphs_sequentially` → `create_pdf`) end-to-end, and parse the
resulting PDF text to assert structural invariants.
"""

import io
import os
import re
import sys

import pytest

# Make the /app/backend package importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import subprocess
from server import (
    create_pdf,
    renumber_paragraphs_sequentially,
    PATENT_SECTIONS_EN,
    _promote_uspto_heading_in_content,
)


# ────────────────────────────────────────────────────────────────────────────
# Synthetic patent content mirroring real LLM output patterns.
#
# Claude Opus / GPT-5 commonly produce the Detailed Description section with
# inline numbered subsections:
#   1. Overall System Architecture
#   2. Detailed Component Descriptions   ← this is "section 7 detailed
#                                          component description" per user
#   3. Operational Flow
#   4. Technical Advantages
#   5. Implementation Examples
#
# The reported bug: after subsection 2, the LLM sometimes skips the numbered
# header of subsequent subsections OR merges them into the preceding paragraph
# with no <p> separation. The renderer must still produce a PDF where every
# subsection appears on its own line, and the paragraph numbering (¶XXXX)
# continues sequentially.
# ────────────────────────────────────────────────────────────────────────────


REALISTIC_DETAILED_DESCRIPTION = """
<p>¶0001 1. Overall System Architecture. The invention comprises a distributed
microservice cluster (100) hosting the core inference engine, a data ingestion
gateway (200) handling real-time telemetry, and a persistence layer (300)
backed by a NoSQL cluster.</p>

<p>¶0002 The system uses a publish-subscribe messaging bus (400) that decouples
the ingestion gateway from downstream consumers, enabling horizontal scaling
without coupling. Each microservice communicates via gRPC over mutual TLS.</p>

<p>¶0003 2. Detailed Component Descriptions. The inference engine (100)
incorporates a transformer-based neural network trained on a 2.1B parameter
language model. Component 101 performs feature extraction; component 102
runs batch inference; component 103 caches frequent predictions.</p>

<p>¶0004 The ingestion gateway (200) multiplexes telemetry from up to 10,000
simultaneous client devices. It uses lock-free ring buffers (201-205) to
absorb bursts without dropping events and enforces backpressure via credit
flow control (206).</p>

<p>¶0005 3. Operational Flow. On startup, the cluster coordinator (500)
registers all microservices with the service discovery layer, establishes
mutual TLS, and allocates shared memory regions for low-latency inter-service
communication.</p>

<p>¶0006 A client request first hits the ingestion gateway, is normalized and
validated, then routed via the messaging bus to the inference engine. The
inference result is cached and returned to the caller within 50 ms P99.</p>

<p>¶0007 4. Technical Advantages. The design offers three technical advantages
over prior art: (a) a 38% reduction in inference latency through the shared
memory region optimization, (b) linear horizontal scalability up to 1,000
nodes verified empirically, and (c) zero-downtime rolling upgrades.</p>

<p>¶0008 5. Implementation Examples. In a preferred embodiment, the system is
deployed on a Kubernetes cluster with 64 nodes, each equipped with 8 NVIDIA
A100 GPUs. The preferred messaging bus is Apache Kafka with a replication
factor of 3 and 128 partitions.</p>

<p>¶0009 A second embodiment substitutes AMD MI250 accelerators and NATS JetStream
as the messaging bus. Performance characteristics remain within 5% of the
reference configuration.</p>
""".strip()


REALISTIC_SECTIONS = [
    (1, "Header", "<p>¶0001 UNITED STATES PATENT APPLICATION</p>"),
    (2, "Cross-Reference to Related Applications", "<p>¶0001 Not applicable.</p>"),
    (3, "Statement Regarding Federally Sponsored R&D", "<p>¶0001 Not applicable.</p>"),
    (4, "Field of the Invention", "<p>¶0001 The present invention relates to distributed computing systems.</p>"),
    (5, "Background", "<p>¶0001 Existing systems suffer from latency issues.</p><p>¶0002 Prior art does not address horizontal scalability.</p>"),
    (6, "Summary", "<p>¶0001 The invention solves these limitations with a novel microservice architecture.</p>"),
    (7, "Definitions", "<p>¶0001 <b>Microservice</b> means an independently deployable software service.</p>"),
    (8, "Brief Description of the Drawings", "<p>¶0001 FIG. 1 is a system overview.</p><p>¶0002 FIG. 2 is a detailed component diagram.</p>"),
    (9, "Detailed Description of Embodiments", REALISTIC_DETAILED_DESCRIPTION),
    (10, "Claims", "<p>¶0001 What is claimed is:</p><p>¶0002 1. A distributed inference system comprising...</p>"),
    (11, "Abstract", "<p>¶0001 A distributed microservice architecture for low-latency ML inference.</p>"),
    (12, "Appendices", "<p>¶0001 Appendix A: Performance benchmarks.</p>"),
    (13, "Filing Package Checklist", "<p>¶0001 Specification: included.</p>"),
]


def _compile_patent_html(sections):
    """Mirror the compilation logic in download_patent_specification."""
    content = ""
    for number, title, section_content in sections:
        if title.lower() not in ('header', 'encabezado'):
            cleaned = re.sub(
                r'^\s*<h[12][^>]*>.*?</h[12]>\s*',
                '',
                section_content or '',
                count=1,
                flags=re.IGNORECASE | re.DOTALL,
            )
            cleaned = _promote_uspto_heading_in_content(cleaned, title)
            section_content = f'<h2>{title.upper()}</h2>\n{cleaned}'
        content += section_content + '<div style="page-break-after: always;"></div>'
    return content


def _render_pdf(sections, language='en'):
    """Run the production rendering pipeline and return the extracted text."""
    content = _compile_patent_html(sections)
    content = renumber_paragraphs_sequentially(content)
    pdf_bytes = create_pdf(
        title="Patent Specification: Test Invention",
        content=content,
        doc_type="patent_spec",
        language=language,
    )

    # Extract text from the generated PDF via pdftotext
    proc = subprocess.run(
        ['pdftotext', '-', '-'],
        input=pdf_bytes,
        capture_output=True,
        timeout=30,
    )
    assert proc.returncode == 0, f"pdftotext failed: {proc.stderr!r}"
    return proc.stdout.decode('utf-8', errors='ignore')


# ────────────────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────────────────


def test_paragraph_numbers_are_sequential():
    """Every ¶XXXX marker in the PDF must appear in strictly ascending order,
    with no resets and no skipped numbers. The renumbering function is
    responsible for enforcing this across the entire document."""
    text = _render_pdf(REALISTIC_SECTIONS)

    # Match ¶XXXX or ¶ XXXX with optional space
    matches = re.findall(r'[¶&#182;]\s*(\d{4})', text)
    numbers = [int(m) for m in matches]

    assert len(numbers) > 0, "No paragraph numbers found in PDF output"

    # Must be strictly increasing by 1 with no gaps
    expected = list(range(1, len(numbers) + 1))
    assert numbers == expected, (
        f"Paragraph numbers are NOT sequential.\n"
        f"Expected: {expected[:20]}...\n"
        f"Got:      {numbers[:20]}...\n"
        f"First deviation at index {next((i for i,(a,b) in enumerate(zip(numbers, expected)) if a != b), 'none')}"
    )


def test_no_paragraph_number_embedded_mid_sentence():
    """Paragraph numbers must only appear at the START of a paragraph, never
    embedded inside a sentence. This catches the bug where the LLM writes
    ¶0015 in the middle of a line after our renderer fails to split it."""
    text = _render_pdf(REALISTIC_SECTIONS)

    bad_matches = []
    for line in text.split('\n'):
        # Find ¶NNNN markers that have prose text on the SAME line BEFORE them
        # (indicating the marker is embedded inside a paragraph).
        for m in re.finditer(r'[¶&#182;]\s*(\d{4})', line):
            preceding = line[:m.start()].strip()
            # If preceding text is non-empty and contains a full word (≥3 chars),
            # the ¶ marker is embedded mid-sentence — a layout bug.
            if preceding and re.search(r'[A-Za-z]{3,}', preceding):
                bad_matches.append((line.strip()[:160], preceding[-50:]))

    assert not bad_matches, (
        f"Found {len(bad_matches)} paragraph numbers embedded mid-sentence:\n"
        + "\n".join(f"  LINE: {l!r}\n  PRECEDING: {p!r}" for l, p in bad_matches[:5])
    )


def test_subsection_titles_present_and_on_own_lines():
    """The 5 numbered subsections of the Detailed Description section must all
    appear in the PDF AND each must be on its own line (not merged into the
    preceding paragraph). This catches the reported "no salto de línea después
    de Detailed Component Description" bug."""
    text = _render_pdf(REALISTIC_SECTIONS)

    expected_subsections = [
        "Overall System Architecture",
        "Detailed Component Description",
        "Operational Flow",
        "Technical Advantages",
        "Implementation Examples",
    ]

    missing = [s for s in expected_subsections if s not in text]
    assert not missing, f"Missing subsection titles in PDF: {missing}"

    # Each subsection title should appear at the start of its line or
    # preceded only by a paragraph number, never after prose.
    for title in expected_subsections:
        for m in re.finditer(re.escape(title), text):
            # Walk backwards on the same line
            line_start = text.rfind('\n', 0, m.start()) + 1
            line_before_title = text[line_start:m.start()].strip()
            # Remove any paragraph-number marker
            line_before_title = re.sub(r'^[¶&#182;]\s*\d{2,6}\.?\s*', '', line_before_title)
            line_before_title = re.sub(r'^\d+\.\s*', '', line_before_title).strip()
            assert not re.search(r'[a-z]{3,}', line_before_title), (
                f"Subsection '{title}' appears after prose text: "
                f"{line_before_title!r} — missing line break"
            )


def test_all_canonical_section_titles_appear():
    """All 12 main USPTO section titles (excluding 'Header') must appear
    uppercased in the PDF."""
    text = _render_pdf(REALISTIC_SECTIONS)

    missing = []
    for title in PATENT_SECTIONS_EN:
        if title.lower() in ('header', 'encabezado'):
            continue
        if title.upper() not in text.upper():
            missing.append(title)

    assert not missing, f"Missing canonical section titles in PDF: {missing}"


def test_subsection_numbering_within_detailed_description_is_sequential():
    """Within the Detailed Description section, the 5 numbered subsections
    (1., 2., 3., 4., 5.) must appear in strict ascending order and each must
    precede its corresponding title. Catches the reported bug where numbering
    'breaks' after subsection 2."""
    text = _render_pdf(REALISTIC_SECTIONS)

    # Locate the Detailed Description block
    detailed_start = text.upper().find('DETAILED DESCRIPTION OF EMBODIMENTS')
    assert detailed_start >= 0, "Detailed Description section not found"
    claims_start = text.upper().find('CLAIMS', detailed_start + 1)
    if claims_start < 0:
        claims_start = len(text)
    block = text[detailed_start:claims_start]

    # Find every "N. Title" pattern in this block
    # Numbers may appear AFTER a paragraph marker on the same line:
    #   "¶0011 1. Overall System Architecture."
    # so we allow optional ¶XXXX prefix before the "N." marker.
    subsection_numbers = []
    for m in re.finditer(
        r'(?:^|\n)\s*(?:[¶&#182;]\s*\d{2,6}\s+)?(\d+)\.\s+([A-Z][A-Za-z ]{5,50})',
        block,
    ):
        n = int(m.group(1))
        title = m.group(2).strip()
        # Only consider known subsection titles (ignore random enumerations in prose)
        if any(t in title for t in ['System', 'Component', 'Flow', 'Advantage', 'Implementation']):
            subsection_numbers.append((n, title))

    assert len(subsection_numbers) >= 3, (
        f"Expected at least 3 numbered subsections in Detailed Description, "
        f"got: {subsection_numbers}"
    )

    seen = [n for n, _ in subsection_numbers]
    assert seen == sorted(seen), (
        f"Subsection numbering not ascending: {subsection_numbers}"
    )


def test_paragraph_numbering_survives_unicode_subscripts_in_detailed_description():
    """If the Detailed Description contains Unicode subscripts (e.g. CO₂, A₁),
    the paragraph numbering must still be sequential and the subscripts must
    be replaced with ASCII (no black squares in PDF)."""
    sections_with_subs = list(REALISTIC_SECTIONS)
    # Inject subscripts into the detailed description
    sections_with_subs[8] = (
        9,
        "Detailed Description of Embodiments",
        REALISTIC_DETAILED_DESCRIPTION.replace(
            "inference engine",
            "inference engine with emission target CO₂ ≤ 2 ppm and input A₁",
            1,
        ),
    )
    text = _render_pdf(sections_with_subs)

    # No black squares
    assert text.count('\u25A0') == 0, "Black squares (■) found — subscript conversion failed"

    # Subscripts converted to ASCII
    assert 'CO2' in text, "CO₂ not converted to CO2"
    assert 'A1' in text, "A₁ not converted to A1"

    # Paragraph numbers still sequential
    matches = re.findall(r'[¶&#182;]\s*(\d{4})', text)
    numbers = [int(m) for m in matches]
    expected = list(range(1, len(numbers) + 1))
    assert numbers == expected


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
