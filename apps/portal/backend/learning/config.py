"""Centralized config for learning module."""

import os

# OpenAI (embeddings only)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536

# OpenRouter (chat / generation)
OPENROUTER_API_KEY = os.environ.get("OPENROUTE_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL_DEFAULT = os.environ.get("OPENROUTER_MODEL_DEFAULT", "openai/gpt-4o-mini")

# LiveAvatar (sucesor de HeyGen Streaming Avatar — sunset 31-mar-2026)
# Cuenta separada de HeyGen, registrarse en https://app.liveavatar.com.
# Acepta también HEYGEN_* como fallback si el cliente reuso esos nombres.
LIVEAVATAR_API_KEY = os.environ.get("LIVEAVATAR_API_KEY") or os.environ.get("HEYGEN_API_KEY")
LIVEAVATAR_AVATAR_ID = (
    os.environ.get("LIVEAVATAR_AVATAR_ID") or os.environ.get("HEYGEN_AVATAR_ID") or ""
)
LIVEAVATAR_VOICE_ID = (
    os.environ.get("LIVEAVATAR_VOICE_ID") or os.environ.get("HEYGEN_VOICE_ID") or ""
)
LIVEAVATAR_LANGUAGE = os.environ.get("LIVEAVATAR_LANGUAGE", "es")
LIVEAVATAR_BASE_URL = os.environ.get(
    "LIVEAVATAR_BASE_URL", "https://api.liveavatar.com"
)
LIVEAVATAR_MODE = os.environ.get("LIVEAVATAR_MODE", "FULL")  # FULL o LITE
LIVEAVATAR_SANDBOX = os.environ.get("LIVEAVATAR_SANDBOX", "false").lower() in ("1", "true", "yes")

# Supabase storage bucket for documents
LEARNING_BUCKET = "learning-documents"

# Chunking
CHUNK_SIZE_TOKENS = 800
CHUNK_OVERLAP_TOKENS = 150

# RAG
RETRIEVAL_TOP_K = 5
RETRIEVAL_MIN_SIMILARITY = 0.3

# Upload limits
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
