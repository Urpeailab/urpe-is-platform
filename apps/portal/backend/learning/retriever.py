"""Semantic retrieval over learning_chunks via pgvector RPC."""

import logging
from typing import List, Optional

from db.supabase_client import rpc, select, get_supabase

from .config import RETRIEVAL_TOP_K, RETRIEVAL_MIN_SIMILARITY
from .embeddings import embed_text

logger = logging.getLogger(__name__)


def _direct_vector_search(embedding: List[float], top_k: int) -> List[dict]:
    """Fallback que hace la búsqueda vectorial directamente vía postgrest-rpc
    construyendo el SELECT a mano. Lo usamos cuando match_learning_chunks
    devuelve vacío para confirmar si el problema es la RPC o si realmente no
    hay chunks. Devuelve [] si el helper directo tampoco funciona."""
    try:
        sb = get_supabase()
        # Pedimos todos los chunks con embedding y calculamos similaridad en Python.
        # No es eficiente pero sirve como fallback de diagnóstico/recovery.
        rows = (
            sb.table("learning_chunks")
            .select("id, document_id, module_id, content, metadata, embedding")
            .not_.is_("embedding", "null")
            .limit(500)
            .execute()
            .data
        ) or []
        if not rows:
            return []

        def _cosine(a, b):
            import math
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a))
            nb = math.sqrt(sum(y * y for y in b))
            return dot / (na * nb) if na and nb else 0.0

        scored = []
        for r in rows:
            emb = r.get("embedding")
            if isinstance(emb, str):
                # Postgres devuelve el vector como string "[0.1,0.2,...]"
                try:
                    emb = [float(x) for x in emb.strip("[]").split(",") if x]
                except Exception:
                    continue
            if not emb or len(emb) != len(embedding):
                continue
            sim = _cosine(embedding, emb)
            scored.append({
                "id": r["id"],
                "document_id": r.get("document_id"),
                "module_id": r.get("module_id"),
                "content": r.get("content"),
                "metadata": r.get("metadata"),
                "similarity": sim,
            })
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]
    except Exception:
        logger.exception("[learning.retrieve] direct fallback failed")
        return []


def retrieve(query: str, module_id: Optional[str] = None, top_k: int = RETRIEVAL_TOP_K) -> List[dict]:
    """Embed query and return top_k chunks. Filters by module_id when provided."""
    if not query or not query.strip():
        return []

    embedding = embed_text(query)
    # Omitimos filter_module_id cuando es None — PostgREST puede rechazar el
    # cast a UUID si recibe `null` explícito en el JSON. Sin la key, el SQL
    # usa el DEFAULT NULL de la función, que devuelve chunks de todos los módulos.
    params = {"query_embedding": embedding, "match_count": top_k}
    if module_id:
        params["filter_module_id"] = module_id

    logger.info(
        f"[learning.retrieve] calling RPC match_learning_chunks "
        f"keys={list(params.keys())} module_id={module_id!r}"
    )

    try:
        results = rpc("match_learning_chunks", params)
    except Exception as e:
        logger.exception(f"[learning.retrieve] RPC raised: {e}")
        results = None

    if not results:
        # La RPC devolvió vacío. Si module_id es None, casi seguro es el bug
        # de PostgREST con UUID nullables. Caemos al fallback directo en Python.
        try:
            total = len(select("learning_chunks", columns="id", limit=1) or [])
        except Exception:
            total = -1
        logger.warning(
            f"[learning.retrieve] RPC returned 0 chunks (module_id={module_id!r}). "
            f"learning_chunks tiene >={total} filas. Activando fallback directo."
        )
        results = _direct_vector_search(embedding, top_k)
        if module_id:
            results = [r for r in results if r.get("module_id") in (module_id, None)]

    if not results:
        logger.info(
            f"[learning.retrieve] no chunks at all for query={query[:60]!r} "
            f"module_id={module_id!r} (incluso fallback directo vacío)"
        )
        return []

    sims_raw = [round(r.get("similarity") or 0, 3) for r in results]
    filtered = [r for r in results if (r.get("similarity") or 0) >= RETRIEVAL_MIN_SIMILARITY]
    logger.info(
        f"[learning.retrieve] query={query[:60]!r} module_id={module_id!r} "
        f"rpc_or_fallback_returned={len(results)} sims={sims_raw} "
        f"kept={len(filtered)} threshold={RETRIEVAL_MIN_SIMILARITY}"
    )
    return filtered


def format_context(chunks: List[dict]) -> str:
    """Format retrieved chunks into a single context block for the LLM prompt."""
    if not chunks:
        return ""
    parts = []
    for i, c in enumerate(chunks, start=1):
        meta = c.get("metadata") or {}
        source = meta.get("source_filename") or "documento"
        parts.append(f"[Fuente {i} — {source}]\n{c.get('content', '')}")
    return "\n\n".join(parts)
