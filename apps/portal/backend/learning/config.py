"""Centralized config for learning module."""

import os

# OpenAI (embeddings only)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536

# OpenRouter (chat / generation)
# Modelo por default: claude-haiku-4.5 — más rápido que gpt-4o-mini en TTFT
# (~400ms vs ~700ms) y con calidad muy similar para conversación tutorial.
# Alternativas más rápidas si necesitás más velocidad (a costa de calidad):
#   - "google/gemini-2.0-flash-001"  (~300ms, multimodal)
#   - "groq/llama-3.3-70b-versatile" (~200ms, infra Groq)
#   - "openai/gpt-4.1-nano"          (~400ms)
# Si la calidad es lo principal: "openai/gpt-4o" o "anthropic/claude-sonnet-4.5".
# Sobreescribir vía env OPENROUTER_MODEL_DEFAULT si querés probar otro.
OPENROUTER_API_KEY = os.environ.get("OPENROUTE_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL_DEFAULT = os.environ.get("OPENROUTER_MODEL_DEFAULT", "anthropic/claude-haiku-4.5")

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

# ===== ElevenLabs Conversational AI (Connector path) =====
# Si LEARNING_USE_ELEVENLABS=true, las sesiones de aprendizaje se crean usando
# el Connector de LiveAvatar: ElevenLabs maneja STT+LLM+TTS, LiveAvatar
# renderiza el video del avatar, y nuestro RAG queda expuesto como un tool HTTP
# que el agent llama cuando necesita info del módulo.
#
# Si está en false (default), seguimos usando el flujo legacy FULL/LITE donde
# nosotros orquestamos STT (Whisper) + LLM (OpenRouter) + buffering manual.
LEARNING_USE_ELEVENLABS = os.environ.get("LEARNING_USE_ELEVENLABS", "false").lower() in ("1", "true", "yes")

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
ELEVENLABS_AGENT_ID = os.environ.get("ELEVENLABS_AGENT_ID")
# secret_id que devuelve LiveAvatar después de registrar la API key de ElevenLabs
# vía POST /v1/secrets. Lo guardamos en env para no re-registrar la key cada vez
# que el backend arranca (los secrets en LiveAvatar son inmutables por ID).
# Si no está seteado y LEARNING_USE_ELEVENLABS=true, el helper register_elevenlabs_secret()
# lo crea on-demand y loguea el ID para que lo guardes en .env.
LIVEAVATAR_ELEVENLABS_SECRET_ID = os.environ.get("LIVEAVATAR_ELEVENLABS_SECRET_ID")

# Bearer secret que el Agent de ElevenLabs incluye en el header
# `Authorization: Bearer <RAG_LOOKUP_SECRET>` al llamar a nuestro endpoint
# /api/learning/agent/rag_lookup. Es la única defensa del endpoint público.
# Generalo con: python -c "import secrets; print(secrets.token_urlsafe(32))"
RAG_LOOKUP_SECRET = os.environ.get("RAG_LOOKUP_SECRET")

# Supabase storage bucket for documents
LEARNING_BUCKET = "learning-documents"

# Chunking
CHUNK_SIZE_TOKENS = 800
CHUNK_OVERLAP_TOKENS = 150

# RAG
# 3 chunks suelen ser suficiente y ahorran ~150ms vs 5 chunks (menos contexto
# para el LLM = first-token más rápido).
RETRIEVAL_TOP_K = 3
# 0.15 es permisivo para text-embedding-3-small, que produce similitudes más
# bajas que modelos más grandes. Subir si empieza a devolver chunks irrelevantes.
RETRIEVAL_MIN_SIMILARITY = 0.15

# Upload limits
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
