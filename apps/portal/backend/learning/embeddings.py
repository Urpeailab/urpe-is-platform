"""OpenAI embeddings client (text-embedding-3-small, 1536 dims)."""

from typing import List
import logging
from openai import OpenAI

from .config import OPENAI_API_KEY, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

_client: OpenAI = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY no está configurada")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts. Returns list of float vectors."""
    if not texts:
        return []
    client = _get_client()
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in resp.data]


def embed_text(text: str) -> List[float]:
    """Embed a single text. Returns one vector."""
    return embed_texts([text])[0]
