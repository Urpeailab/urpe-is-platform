"""
Regression test for the whitepaper bilingual-cover bug.

User report (with screenshot of `Whitepaper_Evelyn_Katherine_Loor_Lucio_en.pdf`):
the English version of the whitepaper had the cover page filled with
SPANISH text that the user originally typed when creating the document:
- Title: "EB-2 NIW Project Proposal: Modelo" ("Modelo" is Spanish)
- author_credentials: "Odontologa, Maestría de Gerencia en Servicios para
  la salud, Curso multidisciplinario de Endodoncia y Rehabilitación
  oral..." (entirely Spanish)
- "Technical Domain: Odontología, atención integral del paciente,
  promoción de la salud bucal" (Spanish)

Root cause: the metadata-translation block in `download_whitepaper_pdf`
assumed cover-page fields were ALWAYS stored in English and only ran the
LLM translation when language == 'es'. For users who fill the form in
Spanish (the dominant cohort), the English PDF therefore showed raw
Spanish.

Fix: the translation flow is now SYMMETRIC. We detect the source language
(via a heuristic looking for Spanish-specific markers) and translate
toward the requested PDF language, caching results in the DB under
*_es and *_en keys so we only call the LLM once per (document, target
language) pair.

These tests exercise the source-level invariants and the heuristic.
"""
import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


SERVER_PATH = Path(__file__).resolve().parent.parent / "server.py"


def _read_server_chunk(start_marker: str, length: int = 8000) -> str:
    src = SERVER_PATH.read_text(encoding="utf-8")
    idx = src.find(start_marker)
    assert idx >= 0, f"Marker not found in server.py: {start_marker!r}"
    return src[idx: idx + length]


def test_metadata_translation_block_is_bilingual():
    """The translation flow must handle BOTH source-Spanish→EN and
    source-English→ES, not only EN→ES like before."""
    block = _read_server_chunk("BILINGUAL METADATA TRANSLATION")
    # The block must mention both directions.
    assert "language == 'es'" in block
    # The else branch must trigger an EN translation when source looks Spanish.
    assert "_looks_like_spanish" in block, (
        "Heuristic to detect Spanish source content not present."
    )
    assert "project_title_en" in block, (
        "EN-cached fields not stored — the LLM call would repeat on every "
        "download."
    )


def test_old_one_way_translation_block_is_gone():
    """The old comment that asserted 'Cover-page fields are stored in
    English; translate them for the Spanish PDF.' must be gone — that
    assumption was the root cause."""
    src = SERVER_PATH.read_text(encoding="utf-8")
    bad_phrase = "Cover-page fields are stored in English; translate them for the Spanish PDF"
    assert bad_phrase not in src, (
        "The legacy one-way translation comment is still present, which "
        "suggests the fix was reverted."
    )


def test_looks_like_spanish_heuristic_works():
    """The heuristic must catch CV text written in Spanish."""
    # Grab the function from a fresh import of server (avoid heavy startup).
    import inspect
    src = SERVER_PATH.read_text(encoding="utf-8")
    fn_start = src.index("def _looks_like_spanish")
    # Capture the function definition only.
    fn_end = src.index("\n    async def _translate_metadata_fields", fn_start)
    fn_src = src[fn_start: fn_end]
    # Compile it in an isolated namespace so we don't import all of server.
    namespace = {}
    # Strip leading indentation so it parses as a module-level def.
    import textwrap
    fn_src_dedented = textwrap.dedent(fn_src)
    exec(compile(fn_src_dedented, "<looks_like_spanish>", "exec"), namespace)
    fn = namespace["_looks_like_spanish"]

    # Spanish CV samples must be flagged.
    spanish_samples = [
        "Odontologa, Maestría de Gerencia en Servicios para la salud",
        "Curso multidisciplinario de Endodoncia y Rehabilitación oral",
        "Odontología, atención integral del paciente, promoción de la salud bucal",
        "Diplomado en Estética y rehabilitación protesica",
    ]
    for s in spanish_samples:
        assert fn(s), f"False negative: heuristic missed Spanish text: {s!r}"

    # English CV samples must NOT be flagged.
    english_samples = [
        "Dentist with Master's Degree in Health Services Management",
        "Multidisciplinary course in endodontics and oral rehabilitation",
        "Dentistry, comprehensive patient care, oral health promotion",
        "",
        None,
    ]
    for s in english_samples:
        assert not fn(s), f"False positive: heuristic flagged English/empty as Spanish: {s!r}"
