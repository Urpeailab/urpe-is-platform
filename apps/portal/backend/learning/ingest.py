"""Document ingestion pipeline: download from Storage → extract → chunk → embed → store."""

import logging
from datetime import datetime, timezone
from typing import Optional

from db.supabase_client import get_supabase, select, update as sb_update, insert, delete

from .config import LEARNING_BUCKET
from .extract import extract_text
from .chunker import chunk_text
from .embeddings import embed_texts

logger = logging.getLogger(__name__)

# Embed in batches to keep request size reasonable.
EMBED_BATCH_SIZE = 64


def ingest_document(document_id: str) -> dict:
    """Run full ingest pipeline for a document. Updates its status in DB."""
    docs = select("learning_documents", filters={"id": document_id}, single=True)
    if not docs:
        raise ValueError(f"Document {document_id} not found")
    doc = docs

    sb_update(
        "learning_documents",
        {"id": document_id},
        {"status": "processing", "error_message": None},
    )

    try:
        sb = get_supabase()
        file_bytes = sb.storage.from_(LEARNING_BUCKET).download(doc["storage_path"])
        if not file_bytes:
            raise RuntimeError("Storage devolvió bytes vacíos")

        text = extract_text(file_bytes, doc.get("mime_type"), doc.get("filename") or "")
        if not text.strip():
            raise RuntimeError("No se pudo extraer texto del documento")

        chunks = chunk_text(text)
        if not chunks:
            raise RuntimeError("El documento no produjo chunks")

        # Limpiar chunks anteriores si hay reindex
        delete("learning_chunks", filters={"document_id": document_id})

        total = 0
        for batch_start in range(0, len(chunks), EMBED_BATCH_SIZE):
            batch = chunks[batch_start : batch_start + EMBED_BATCH_SIZE]
            vectors = embed_texts(batch)
            rows = []
            for offset, (content, vec) in enumerate(zip(batch, vectors)):
                rows.append(
                    {
                        "document_id": document_id,
                        "module_id": doc.get("module_id"),
                        "chunk_index": batch_start + offset,
                        "content": content,
                        "embedding": vec,
                        "metadata": {"source_filename": doc.get("filename")},
                    }
                )
            sb.table("learning_chunks").insert(rows).execute()
            total += len(rows)

        sb_update(
            "learning_documents",
            {"id": document_id},
            {
                "status": "indexed",
                "chunk_count": total,
                "error_message": None,
            },
        )
        logger.info(f"[learning.ingest] document={document_id} indexed chunks={total}")
        return {"document_id": document_id, "chunks": total}

    except Exception as e:
        logger.exception(f"[learning.ingest] failed document={document_id}")
        sb_update(
            "learning_documents",
            {"id": document_id},
            {"status": "failed", "error_message": str(e)[:500]},
        )
        raise
