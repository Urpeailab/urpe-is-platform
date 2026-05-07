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
    """Send raw audio bytes to OpenAI STT and return the transcribed text.
    Usamos gpt-4o-mini-transcribe (modelo nuevo) que es ~3x más rápido que
    whisper-1 con calidad equivalente para español. Si OpenAI lo deprecara,
    fallback automático a whisper-1.
    Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB)."""
    if not audio_bytes:
        return ""
    client = _get_client()
    import time
    t0 = time.time()
    try:
        resp = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=(filename, audio_bytes, mime),
            language=language,
        )
    except Exception as e:
        logger.warning(f"[learning.transcribe] gpt-4o-mini-transcribe failed ({e}); fallback to whisper-1")
        resp = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, mime),
            language=language,
        )
    text = (resp.text or "").strip()
    logger.info(
        f"[learning.transcribe] bytes={len(audio_bytes)} text_len={len(text)} "
        f"elapsed={time.time()-t0:.2f}s"
    )
    return text
