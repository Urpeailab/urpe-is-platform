"""
Regression test for the enhanced `resolve_placeholders_with_firecrawl()`.

User feedback after shipping the placeholder cleanup:
> "esos placeholders no deberían aparecer — ya tienes la API de Firecrawl
>  para investigar, entonces en la redacción como tal no deberían estar"

So we no longer want to just clean placeholders from the PDF — we want to
RESOLVE them into real content during generation, by running Firecrawl
queries against government / academic sources and inlining the result.

This module tests the regex detection layer only (live Firecrawl tests
are run manually because they depend on the external API).

Run with:   pytest backend/tests/test_firecrawl_placeholder_resolver.py -v
"""
import re
import pytest


# Match the exact regexes used in server.py resolve_placeholders_with_firecrawl
CITATION_RE = re.compile(
    r'\[(FUENTE A VERIFICAR|CITACIÓN NECESARIA|CITATION NEEDED|SOURCE TO VERIFY|CITA A VERIFICAR|REFERENCIA NECESARIA):([^\]]{5,500})\]',
    re.IGNORECASE,
)
DATA_RE = re.compile(
    r'\[(pending(?:\s+information|\s+data)?|NEEDED(?::[^\]]{0,300})?|TBD(?::[^\]]{0,100})?|TODO(?::[^\]]{0,100})?|'
    r'to\s+be\s+(?:determined|added|filled|completed|provided)(?:[^\]]{0,100})?|'
    r'placeholder(?::[^\]]{0,100})?|missing(?:\s+data)?(?:[^\]]{0,100})?|'
    r'describe\s+(?:qualitatively|here|below)(?:[^\]]{0,200})?)\]',
    re.IGNORECASE,
)


@pytest.mark.parametrize("text, should_match", [
    # DATA placeholders the user reported → must be detected
    ("[pending information]", True),
    ("[pending data]", True),
    ("[pending]", True),
    ("[NEEDED]", True),
    ("[NEEDED: outcome metrics]", True),
    ("[NEEDED: BLS statistics on labor productivity]", True),
    ("[TBD]", True),
    ("[TBD: fill in after review]", True),
    ("[TODO: add specific number]", True),
    ("[to be determined]", True),
    ("[to be determined based on exhibit review]", True),
    ("[to be added]", True),
    ("[placeholder]", True),
    ("[placeholder: insert chart]", True),
    ("[missing]", True),
    ("[missing data]", True),
    ("[describe qualitatively in the report]", True),
    # Things that MUST NOT match (legitimate content)
    ("[Patel, 2023]", False),           # citation
    ("[Exhibit A-1]", False),           # exhibit ref
    ("[Fig. 3]", False),                # figure ref
    ("[section 4]", False),             # cross-ref
    ("Normal text without brackets", False),
])
def test_data_placeholder_detection(text, should_match):
    match = DATA_RE.search(text)
    if should_match:
        assert match is not None, f"{text!r} SHOULD match as placeholder but did not"
    else:
        assert match is None, f"{text!r} should NOT match but regex found {match.group() if match else None}"


@pytest.mark.parametrize("text, should_match", [
    ("[CITATION NEEDED: CDC small business data 2023]", True),
    ("[FUENTE A VERIFICAR: estadísticas OSHA]", True),
    ("[CITACIÓN NECESARIA: datos del Census Bureau]", True),
    ("[SOURCE TO VERIFY: recent BLS labor statistics]", True),
    ("[REFERENCIA NECESARIA: estudios de la NIH]", True),
    # Not a citation placeholder
    ("[pending information]", False),
    ("[NEEDED: data]", False),
    ("[Citation: Smith 2022]", False),  # missing NEEDED/VERIFY keywords
])
def test_citation_placeholder_detection(text, should_match):
    match = CITATION_RE.search(text)
    if should_match:
        assert match is not None, f"{text!r} SHOULD match as citation placeholder but did not"
    else:
        assert match is None, f"{text!r} should NOT match but regex found {match.group() if match else None}"


def test_resolver_wired_in_finalization():
    """Verify the finalization step invokes resolve_placeholders_with_firecrawl."""
    from pathlib import Path
    src = Path("/app/backend/server.py").read_text()
    # Must call the resolver on each section before insert
    assert "resolve_placeholders_with_firecrawl(_val)" in src, (
        "Finalization loop no longer calls resolve_placeholders_with_firecrawl per field"
    )
    # Must recompile compiled_content so top-level `content` is also clean
    assert "_recompiled = \"\"" in src, (
        "compiled_content is not being recomputed after placeholder resolution"
    )


def test_resolver_supports_whitepaper_variants():
    """The resolver file must now contain the data-placeholder regex."""
    from pathlib import Path
    src = Path("/app/backend/server.py").read_text()
    assert "pending(?:\\s+information|\\s+data)?" in src, (
        "Data-placeholder regex missing from resolve_placeholders_with_firecrawl"
    )
    assert "to\\s+be\\s+(?:determined|added|filled|completed|provided)" in src, (
        "'to be ...' pattern missing from data placeholder regex"
    )
