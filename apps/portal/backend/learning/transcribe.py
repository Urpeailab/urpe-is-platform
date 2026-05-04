"""Audio transcription via OpenAI Whisper (whisper-1)."""

import logging
from openai import OpenAI

from .config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

_client: OpenAI = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY no está configurada")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm", mime: str = "audio/webm", language: str = "es") -> str:
    """Send raw audio bytes to Whisper and return the transcribed text.
    Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB)."""
    if not audio_bytes:
        return ""
    client = _get_client()
    resp = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes, mime),
        language=language,
    )
    text = (resp.text or "").strip()
    logger.info(f"[learning.transcribe] bytes={len(audio_bytes)} text_len={len(text)}")
    return text
