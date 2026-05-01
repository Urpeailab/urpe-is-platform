"""LiveAvatar client — two-step flow for browser interactive avatar sessions.

Flow:
  1. POST {base}/v1/sessions/token  (auth: X-API-KEY) → returns { session_id, session_token }
  2. POST {base}/v1/sessions/start  (auth: Bearer session_token) → returns LiveKit creds

The frontend uses livekit_url + livekit_client_token to join the LiveKit room.
"""

import logging
import requests

from .config import (
    LIVEAVATAR_API_KEY,
    LIVEAVATAR_AVATAR_ID,
    LIVEAVATAR_VOICE_ID,
    LIVEAVATAR_LANGUAGE,
    LIVEAVATAR_BASE_URL,
    LIVEAVATAR_MODE,
    LIVEAVATAR_SANDBOX,
)

logger = logging.getLogger(__name__)


def _post(path: str, *, headers: dict, json_body: dict | None = None) -> dict:
    """Helper: POST to LiveAvatar and return the parsed JSON `data` block.
    Raises RuntimeError with the response body on failure."""
    url = f"{LIVEAVATAR_BASE_URL.rstrip('/')}{path}"
    try:
        resp = requests.post(
            url,
            headers={"Content-Type": "application/json", "Accept": "application/json", **headers},
            json=json_body or {},
            timeout=20,
        )
    except Exception as e:
        logger.exception(f"[liveavatar] network error on {path}")
        raise RuntimeError(f"No se pudo conectar a LiveAvatar ({path}): {e}")

    body = resp.text[:400]
    logger.info(f"[liveavatar] POST {path} → HTTP {resp.status_code} body={body}")

    if resp.status_code not in (200, 201):
        raise RuntimeError(f"LiveAvatar {path} respondió HTTP {resp.status_code}: {body}")

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"LiveAvatar {path} respuesta no-JSON: {body}")

    payload = data.get("data") or {}
    if not payload:
        raise RuntimeError(f"LiveAvatar {path} respuesta sin 'data': {data}")
    return payload


def _build_token_body(module: dict | None) -> dict:
    """Build the body for /v1/sessions/token. Module overrides allowed."""
    avatar_id = LIVEAVATAR_AVATAR_ID
    voice_id = LIVEAVATAR_VOICE_ID
    language = LIVEAVATAR_LANGUAGE

    if module:
        avatar_id = module.get("avatar_id") or avatar_id
        voice_id = module.get("voice_id") or voice_id

    if not avatar_id:
        raise RuntimeError(
            "LIVEAVATAR_AVATAR_ID no configurado. Pega el UUID del avatar de tu cuenta LiveAvatar en .env."
        )

    body: dict = {
        "mode": LIVEAVATAR_MODE,
        "avatar_id": avatar_id,
        "is_sandbox": LIVEAVATAR_SANDBOX,
    }

    if LIVEAVATAR_MODE.upper() == "FULL":
        persona: dict = {"language": language}
        if voice_id:
            persona["voice_id"] = voice_id
        body["avatar_persona"] = persona
        body["interactivity_type"] = "CONVERSATIONAL"

    return body


def create_avatar_session(module: dict | None = None) -> dict:
    """Run the full 2-step flow. Returns LiveKit credentials for the browser."""
    if not LIVEAVATAR_API_KEY:
        raise RuntimeError("LIVEAVATAR_API_KEY (o HEYGEN_API_KEY) no está configurada")

    token_body = _build_token_body(module)
    token_data = _post(
        "/v1/sessions/token",
        headers={"X-API-KEY": LIVEAVATAR_API_KEY},
        json_body=token_body,
    )
    session_id = token_data.get("session_id")
    session_token = token_data.get("session_token")
    if not session_id or not session_token:
        raise RuntimeError(f"LiveAvatar /token incompleto: {token_data}")

    start_data = _post(
        "/v1/sessions/start",
        headers={"Authorization": f"Bearer {session_token}"},
    )

    livekit_url = start_data.get("livekit_url")
    client_token = start_data.get("livekit_client_token")
    if not livekit_url or not client_token:
        raise RuntimeError(f"LiveAvatar /start sin credenciales LiveKit: {start_data}")

    return {
        "session_id": start_data.get("session_id") or session_id,
        "livekit_url": livekit_url,
        "livekit_token": client_token,
        "max_duration_sec": start_data.get("max_session_duration"),
        "ws_url": start_data.get("ws_url"),
    }


def get_avatar_config() -> dict:
    """Defaults shown to the frontend."""
    return {
        "avatar_id": LIVEAVATAR_AVATAR_ID,
        "voice_id": LIVEAVATAR_VOICE_ID,
        "language": LIVEAVATAR_LANGUAGE,
        "mode": LIVEAVATAR_MODE,
    }
