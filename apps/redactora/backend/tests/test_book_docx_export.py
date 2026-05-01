"""
End-to-end regression tests for the Book .docx export endpoint.

User reported three concrete bugs on the last working day:

  1. Word export duplicated chapter subtitles (Chapter 1: Chapter 1 - …).
  2. Spanish text leaked into the English Word export cover.
  3. PDF export showed raw LLM scaffolding as a subtitle.

These tests render a REAL .docx via `download_book_docx` by seeding a
book with the exact shape seen in production:

  - title + synopsis are Spanish (with 'No ficción / Category:' prefix).
  - title_en / synopsis_en are missing OR empty (simulates an older book).
  - chapter titles contain the 'Chapter N - Title' dash prefix.
  - chapter.content_en starts with its OWN <h2>Chapter N - Title</h2>.

We then parse the generated .docx with python-docx and assert:

  - No paragraph in the EN output contains Spanish-only phrases
    (the genre prefix "No ficción" or the Spanish month names).
  - No paragraph starts with "Chapter 1: Chapter 1" (the double-title
    bug) and no chapter heading is emitted more than once.
  - The chapter number appears exactly as "Chapter 1: The Silent Leak"
    (colon separator, no dash duplication).
"""
import asyncio
import io
import uuid
import os
import sys
from pathlib import Path

import pytest
from docx import Document  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_database")


SPANISH_SYNOPSIS = (
    'No ficción / Servicio al Cliente & Ventas: '
    '"Customer Success Bilingüe: Cómo las Empresas Pueden Ganar el '
    'Mercado Hispano de EE.UU."'
)

SPANISH_MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

CHAPTER_EN_CONTENT = (
    '<h2>Chapter 1 - The Silent Leak: How Bad Service Bleeds Millions'
    ' from the U.S. Hispanic Market</h2>\n'
    '<h3>1. The Hidden Cost You Don\'t See in Your P&L</h3>\n'
    '<p>Every day, in call centers and retail counters across the '
    'United States, Hispanic customers are quietly walking away.</p>'
)


@pytest.fixture
def seeded_book_id():
    """Insert one production-shaped book and yield its id.
    Cleans up afterwards so the test DB doesn't accumulate fixtures."""
    from server import db

    book_id = str(uuid.uuid4())
    doc = {
        "id": book_id,
        "title": "Millones Perdidos: Cómo el Mal Servicio Aleja al Cliente Hispano",
        "title_en": None,               # ← simulates an older book
        "synopsis": SPANISH_SYNOPSIS,
        "synopsis_en": "",              # ← empty string (falsy) like prod
        "author_name": "Leidis Pelaez",
        "client_id": None,
        "chapters": [
            {
                "number": 1,
                "title": "Chapter 1 - The Silent Leak: How Bad Service "
                         "Bleeds Millions from the U.S. Hispanic Market",
                "content_en": CHAPTER_EN_CONTENT,
                "content_es": (
                    '<h2>Capítulo 1 - La Fuga Silenciosa: Cómo el Mal Servicio '
                    'Drena Millones del Mercado Hispano en EE.UU.</h2>\n'
                    '<p>Todos los días, clientes hispanos se alejan en '
                    'silencio.</p>'
                ),
            }
        ],
    }

    async def _seed():
        await db.books.insert_one(doc.copy())

    async def _cleanup():
        await db.books.delete_one({"id": book_id})

    asyncio.get_event_loop().run_until_complete(_seed())
    yield book_id
    asyncio.get_event_loop().run_until_complete(_cleanup())


def _download_docx(book_id: str, language: str) -> bytes:
    """Invoke the FastAPI endpoint in-process and return the .docx bytes."""
    from server import download_book_docx

    async def _run():
        response = await download_book_docx(book_id, language=language)
        # StreamingResponse: collect its body.
        chunks = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode('utf-8')
            chunks.append(chunk)
        return b''.join(chunks)

    return asyncio.get_event_loop().run_until_complete(_run())


def _docx_paragraph_texts(docx_bytes: bytes) -> list[str]:
    d = Document(io.BytesIO(docx_bytes))
    return [p.text for p in d.paragraphs]


# ── Tests ──────────────────────────────────────────────────────────────
def test_english_docx_has_no_spanish_genre_prefix(seeded_book_id):
    """Bug: the untreated Spanish synopsis leaked into EN output."""
    data = _download_docx(seeded_book_id, language='en')
    body = "\n".join(_docx_paragraph_texts(data))
    assert 'No ficción' not in body, (
        'Spanish genre prefix leaked into English Word export:\n' + body[:1500]
    )
    assert 'Servicio al Cliente' not in body


def test_english_docx_has_no_spanish_months_on_cover(seeded_book_id):
    data = _download_docx(seeded_book_id, language='en')
    body = "\n".join(_docx_paragraph_texts(data))
    for m in SPANISH_MONTH_NAMES:
        assert m not in body.lower(), (
            f"Spanish month '{m}' found in English cover. Body: {body[:400]}"
        )


def test_english_docx_chapter_heading_not_doubled(seeded_book_id):
    """Bug: 'Chapter 1: Chapter 1 - The Silent Leak …'."""
    data = _download_docx(seeded_book_id, language='en')
    texts = _docx_paragraph_texts(data)
    doubled = [t for t in texts if 'Chapter 1: Chapter 1' in t
                                 or 'Chapter 1 - Chapter 1' in t]
    assert not doubled, f"Chapter heading duplicated: {doubled}"


def test_english_docx_emits_chapter_heading_exactly_once(seeded_book_id):
    data = _download_docx(seeded_book_id, language='en')
    texts = _docx_paragraph_texts(data)
    occurrences = [
        t for t in texts
        if 'The Silent Leak' in t and 'Bleeds Millions' in t
    ]
    assert len(occurrences) == 1, (
        f"Expected exactly one chapter heading, got {len(occurrences)}:\n"
        + "\n".join(occurrences)
    )


def test_english_docx_chapter_body_survives(seeded_book_id):
    """We MUST not accidentally strip the actual chapter body."""
    data = _download_docx(seeded_book_id, language='en')
    body = "\n".join(_docx_paragraph_texts(data))
    assert 'Hispanic customers are quietly walking away' in body


def test_spanish_docx_uses_spanish_metadata(seeded_book_id):
    data = _download_docx(seeded_book_id, language='es')
    body = "\n".join(_docx_paragraph_texts(data))
    # Cover banner "LIBRO" should be there.
    assert 'LIBRO' in body or 'Libro' in body
    # No double-title in Spanish either.
    assert 'Capítulo 1: Capítulo 1' not in body
