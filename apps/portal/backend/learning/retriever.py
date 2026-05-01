"""Semantic retrieval over learning_chunks via pgvector RPC."""

import logging
from typing import List, Optional

from db.supabase_client import rpc

from .config import RETRIEVAL_TOP_K, RETRIEVAL_MIN_SIMILARITY
from .embeddings import embed_text

logger = logging.getLogger(__name__)


def retrieve(query: str, module_id: Optional[str] = None, top_k: int = RETRIEVAL_TOP_K) -> List[dict]:
    """Embed query and return top_k chunks. Filters by module_id when provided."""
    if not query or not query.strip():
        return []

    embedding = embed_text(query)
    results = rpc(
        "match_learning_chunks",
        {
            "query_embedding": embedding,
            "match_count": top_k,
            "filter_module_id": module_id,
        },
    )
    if not results:
        return []
    return [r for r in results if (r.get("similarity") or 0) >= RETRIEVAL_MIN_SIMILARITY]


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
