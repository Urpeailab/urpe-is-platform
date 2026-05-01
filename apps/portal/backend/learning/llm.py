"""OpenRouter chat client for generating avatar responses."""

import json
import logging
from typing import List, Optional
from openai import OpenAI

from .config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL_DEFAULT

logger = logging.getLogger(__name__)

_client: OpenAI = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTE_API_KEY no está configurada")
        _client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL)
    return _client


def chat(messages: List[dict], model: Optional[str] = None, temperature: float = 0.4) -> dict:
    """Run a chat completion. Returns {text, tokens_input, tokens_output}."""
    client = _get_client()
    model = model or OPENROUTER_MODEL_DEFAULT
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    choice = resp.choices[0].message
    usage = getattr(resp, "usage", None)
    return {
        "text": choice.content or "",
        "tokens_input": getattr(usage, "prompt_tokens", None) if usage else None,
        "tokens_output": getattr(usage, "completion_tokens", None) if usage else None,
        "model": model,
    }


def chat_json(messages: List[dict], model: Optional[str] = None, temperature: float = 0.2) -> dict:
    """Force the model to reply with valid JSON (used for evaluations)."""
    client = _get_client()
    model = model or OPENROUTER_MODEL_DEFAULT
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(f"[learning.llm] invalid JSON response: {raw[:200]}")
        return {}


def build_module_system_prompt(module: dict) -> str:
    """Compose the system prompt for a module session."""
    base = (module.get("system_prompt") or "").strip()
    mode = module.get("mode") or "free"
    objectives = module.get("objectives") or []

    rules = (
        "Eres un tutor virtual del equipo URPE. Vas a HABLAR como avatar, tu respuesta se "
        "convierte a voz por TTS. Responde siempre en español.\n\n"
        "FORMATO DE RESPUESTA (obligatorio):\n"
        "- Prosa natural, conversacional, en 2 a 4 frases. Pensá que lo estás explicando "
        "en voz alta, no escribiendo un documento.\n"
        "- PROHIBIDO usar markdown: nada de ### encabezados, ** negritas, listas con guiones "
        "o números, viñetas, emojis ni saltos de línea decorativos. El TTS los lee como ruido.\n"
        "- Si hay varios pasos o criterios, enlazalos con conectores (\"primero\", \"además\", "
        "\"y finalmente\") dentro de la misma oración o párrafo, no como lista.\n"
        "- Si el tema da para más, cerrá con una frase ofreciendo profundizar "
        "(ej: \"¿querés que entre en detalle en alguno?\").\n\n"
        "REGLA CRÍTICA DE GROUNDING:\n"
        "Tu ÚNICA fuente de verdad es el bloque CONTEXTO RECUPERADO que viene en el mensaje "
        "del colaborador. Cuando respondas:\n"
        "1) Usá los términos, clasificaciones, criterios, pasos, roles y reglas exactas que aparecen "
        "en el contexto. No los parafrasees a conceptos genéricos (ej: si el contexto dice "
        "'clasificación Tipo A retentivo', NO digas 'naturaleza del reclamo').\n"
        "2) Si la pregunta no se puede responder con lo que está en el contexto, decí "
        "literalmente: \"No tengo esa información en el material indexado de este módulo. "
        "Te recomiendo consultarlo con tu líder.\" — y NADA más. NO inventes con conocimiento "
        "general del tema.\n"
        "3) Está prohibido dar respuestas genéricas tipo 'considera la política de la empresa', "
        "'evalúa la naturaleza del reclamo', 'documenta el proceso'. Si vas a decir algo así, "
        "es señal de que no encontraste la info en el contexto y debés aplicar la regla 2."
    )

    if mode == "guided" and objectives:
        objs = "\n".join([f"- {o.get('text', '')}" for o in objectives if o.get("text")])
        guided = (
            "\n\nMODO GUIADO. Tu meta es asegurar que el colaborador comprenda los siguientes objetivos. "
            "Empieza saludando y planteando la primera pregunta para evaluar conocimiento previo. "
            "Avanza un objetivo a la vez. Pregúntale activamente para confirmar comprensión.\n"
            f"Objetivos:\n{objs}"
        )
    else:
        guided = (
            "\n\nMODO LIBRE. Responde a las preguntas del colaborador. Si detectas vacíos importantes, "
            "puedes hacer una pregunta de regreso para ayudarle a aprender mejor."
        )

    parts = [rules]
    if base:
        parts.append(f"\n\nINSTRUCCIONES DEL MÓDULO:\n{base}")
    parts.append(guided)
    return "".join(parts)


def build_rag_user_message(user_text: str, context: str) -> str:
    """Compose a user-role message that injects retrieved context."""
    if not context:
        return user_text
    return (
        f"Contexto recuperado de los materiales del módulo:\n\n{context}\n\n"
        f"---\n\nPregunta del colaborador: {user_text}"
    )
