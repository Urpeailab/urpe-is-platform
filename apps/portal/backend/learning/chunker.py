"""Token-aware text chunking using tiktoken."""

from typing import List
import tiktoken

from .config import CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS

_ENCODER = tiktoken.get_encoding("cl100k_base")


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE_TOKENS,
    overlap: int = CHUNK_OVERLAP_TOKENS,
) -> List[str]:
    """Split text into overlapping token windows. Tries to break at paragraphs first."""
    if not text or not text.strip():
        return []

    tokens = _ENCODER.encode(text)
    if len(tokens) <= chunk_size:
        return [text.strip()]

    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        window = tokens[start:end]
        chunk_str = _ENCODER.decode(window).strip()
        if chunk_str:
            chunks.append(chunk_str)
        if end == len(tokens):
            break
        start = end - overlap
    return chunks
