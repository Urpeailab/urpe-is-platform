"""LiveAvatar Lite Mode — ElevenLabs Agent Connector.

ElevenLabs maneja STT + LLM + TTS y LiveAvatar renderiza el video.
Nosotros sólo:
  1) Registramos nuestro API key de ElevenLabs como secreto en LiveAvatar (una vez)
  2) Creamos sesiones LITE con el connector apuntando a nuestro Agent

Doc: https://docs.liveavatar.com/docs/lite-mode/connectors/elevenlabs-agent
"""

import logging
from typing import Optional

import requests

from .config import (
    ELEVENLABS_AGENT_ID,
    ELEVENLABS_API_KEY,
    LIVEAVATAR_API_KEY,
    LIVEAVATAR_AVATAR_ID,
    LIVEAVATAR_BASE_URL,
    LIVEAVATAR_ELEVENLABS_SECRET_ID,
    LIVEAVATAR_SANDBOX,
)

logger = logging.getLogger(__name__)


def _post(path: str, *, headers: dict, json_body: Optional[dict] = None) -> dict:
    """POST a LiveAvatar y devolver el bloque `data`. Reusa el contrato de _post
    de liveavatar.py pero local a este módulo para no acoplar imports."""
    url = f"{LIVEAVATAR_BASE_URL.rstrip('/')}{path}"
    try:
        resp = requests.post(
            url,
            headers={"Content-Type": "application/json", "Accept": "application/json", **headers},
            json=json_body or {},
            timeout=20,
        )
    except Exception as e:
        logger.exception(f"[liveavatar.connector] network error on {path}")
        raise RuntimeError(f"No se pudo conectar a LiveAvatar ({path}): {e}")

    body = resp.text[:500]
    logger.info(f"[liveavatar.connector] POST {path} → HTTP {resp.status_code} body={body}")

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


def register_elevenlabs_secret() -> str:
    """Registra ELEVENLABS_API_KEY como secreto en LiveAvatar y devuelve el secret_id.

    LiveAvatar requiere que la API key del provider (ElevenLabs) viva en sus
    sistemas antes de que el connector la pueda usar; por eso el flujo es:
    POST /v1/secrets → obtenés `secret_id` → lo pasás en cada session start.

    Esta función NO se llama on-the-fly por sesión (sería un waste y exhausto
    de rate limits): se llama UNA vez para sembrar `LIVEAVATAR_ELEVENLABS_SECRET_ID`
    en el .env. La exponemos también como helper por si la key rota.
    """
    if not LIVEAVATAR_API_KEY:
        raise RuntimeError("LIVEAVATAR_API_KEY no está configurada")
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY no está configurada")

    # LiveAvatar renombró los campos: `value` → `secret_value` y agregaron
    # `secret_name`. La doc oficial todavía muestra el shape viejo pero la API
    # rechaza ese formato. Mandamos los tres por compatibilidad: si en el futuro
    # quitan `secret_type`, el server lo ignora.
    payload = {
        "secret_name": "urpe-elevenlabs-prod",
        "secret_value": ELEVENLABS_API_KEY,
        "secret_type": "ELEVENLABS_API_KEY",
    }
    data = _post(
        "/v1/secrets",
        headers={"X-API-KEY": LIVEAVATAR_API_KEY},
        json_body=payload,
    )
    secret_id = data.get("secret_id") or data.get("id")
    if not secret_id:
        raise RuntimeError(f"LiveAvatar /v1/secrets sin secret_id: {data}")
    logger.info(
        f"[liveavatar.connector] secret registered. GUARDAR EN ENV: "
        f"LIVEAVATAR_ELEVENLABS_SECRET_ID={secret_id}"
    )
    return secret_id


def create_connector_session(
    module: Optional[dict] = None,
    dynamic_variables: Optional[dict] = None,
) -> dict:
    """Crear una sesión LITE con el ElevenLabs Agent Connector.

    Returns dict con livekit_url + livekit_token para que el frontend se
    conecte al room. El agent de ElevenLabs se une automáticamente como
    tercer participant (LiveAvatar arma todo el bridge).

    `dynamic_variables` se pasan al agent al inicio de la conversación y se
    pueden referenciar en su system prompt y first message vía sintaxis
    {{variable_name}}. Útil para inyectar module_title, module_objectives,
    user_name, etc. por sesión sin tener un agent por módulo.
    """
    if not LIVEAVATAR_API_KEY:
        raise RuntimeError("LIVEAVATAR_API_KEY no está configurada")
    if not LIVEAVATAR_AVATAR_ID:
        raise RuntimeError("LIVEAVATAR_AVATAR_ID no está configurada")
    if not LIVEAVATAR_ELEVENLABS_SECRET_ID:
        raise RuntimeError(
            "LIVEAVATAR_ELEVENLABS_SECRET_ID no está configurada. "
            "Corré register_elevenlabs_secret() una vez y guardá el ID en .env."
        )
    if not ELEVENLABS_AGENT_ID:
        raise RuntimeError("ELEVENLABS_AGENT_ID no está configurada")

    avatar_id = LIVEAVATAR_AVATAR_ID
    if module:
        avatar_id = module.get("avatar_id") or avatar_id

    connector_config: dict = {
        "secret_id": LIVEAVATAR_ELEVENLABS_SECRET_ID,
        "agent_id": ELEVENLABS_AGENT_ID,
    }
    if dynamic_variables:
        # ElevenLabs acepta dynamic_variables como parte de conversation_initiation;
        # el wrapper de LiveAvatar las propaga si se incluyen acá.
        connector_config["dynamic_variables"] = dynamic_variables

    body = {
        "mode": "LITE",
        "avatar_id": avatar_id,
        "is_sandbox": LIVEAVATAR_SANDBOX,
        "elevenlabs_agent_config": connector_config,
    }

    data = _post(
        "/v1/sessions",
        headers={"X-API-KEY": LIVEAVATAR_API_KEY},
        json_body=body,
    )

    livekit_url = data.get("livekit_url")
    client_token = data.get("livekit_client_token") or data.get("livekit_token")
    if not livekit_url or not client_token:
        raise RuntimeError(f"LiveAvatar /v1/sessions sin credenciales LiveKit: {data}")

    return {
        "session_id": data.get("session_id"),
        "livekit_url": livekit_url,
        "livekit_token": client_token,
        "max_duration_sec": data.get("max_session_duration"),
        "provider": "elevenlabs_connector",
    }


def build_dynamic_variables(module: Optional[dict], staff_payload: Optional[dict]) -> dict:
    """Empaquetar variables que el agent puede referenciar como {{var}} en su
    system prompt y first message. Mantenemos los nombres en snake_case para
    que coincidan con la convención de ElevenLabs."""
    objectives = (module or {}).get("objectives") or []
    objectives_text = "\n".join(
        f"- {o.get('text', '')}" for o in objectives if isinstance(o, dict) and o.get("text")
    )
    return {
        "module_id": (module or {}).get("id") or "",
        "module_title": (module or {}).get("title") or "",
        "module_mode": (module or {}).get("mode") or "free",
        "module_objectives": objectives_text,
        "user_name": (staff_payload or {}).get("name") or (staff_payload or {}).get("email") or "",
    }
