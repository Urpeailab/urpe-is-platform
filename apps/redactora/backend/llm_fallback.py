"""
llm_fallback.py — Unified LLM call with automatic OpenRouter fallback.

Every letter-generation endpoint used to call Gemini Flash Lite directly
and — when Gemini returned empty or rate-limited — raise ValueError with
"Empty letter from LLM". Users then clicked "Generate" again, creating
duplicate failed records. The production screenshot showed 4 out of 5
recommendation letters in error state for this exact reason.

This helper wraps the primary Gemini call and, on empty/short/error
output, transparently falls back through OpenRouter.

**2026-05-28 cascada actualizada.** OpenRouter retiró silenciosamente
`claude-sonnet-4.5` y `claude-sonnet-4.6` del catálogo público (el endpoint
/api/v1/models ya no los lista). La cascada vieja tenía 2 de 3 modelos
muertos → cualquier 404 + fallo transitorio del tercero (opus-4.7) tiraba
"Empty letter from LLM" en TODAS las cartas. Ahora usamos IDs vigentes,
y `~claude-sonnet-latest` como red de seguridad porque el `~` prefix de
OpenRouter es un alias que siempre apunta al modelo válido más reciente
de la familia (resiliente a renames silenciosos como este).

Cascada efectiva:
   1. anthropic/claude-opus-4.8       (más nuevo, mejor)
   2. anthropic/claude-opus-4.7       (sólido, billing/rate-limit aparte)
   3. ~anthropic/claude-sonnet-latest (alias resiliente a deprecaciones)

Only after all four providers have failed do we raise ValueError.
"""
from __future__ import annotations

import logging
import os
from typing import Awaitable, Callable, Optional

logger = logging.getLogger(__name__)


async def call_llm_with_fallback(
    *,
    system_prompt: str,
    user_prompt: str,
    primary_gemini_fn: Callable[..., Awaitable[str]],
    openai_gpt4o_fn: Optional[Callable[..., Awaitable[str]]] = None,
    temperature: float = 0.35,
    max_tokens: int = 8000,
    min_chars: int = 500,
    label: str = "document",
    timeout_secs: float = 180.0,
) -> str:
    """
    Try the primary Gemini call first. If it returns empty / too-short /
    raises, fall back through OpenRouter (Opus 4.8 → Opus 4.7 →
    sonnet-latest). Si todo OpenRouter falla y `openai_gpt4o_fn` está
    provisto, último escalón: GPT-4o vía OpenAI directo (sin OpenRouter).

    El fallback a OpenAI-directo existe porque las cuentas de OpenRouter
    pueden morir silenciosamente (key revocada, billing lapso, "User not
    found") y necesitamos que las cartas sigan funcionando mientras el
    operador arregla eso. Otros módulos (diagramas de patente,
    evaluadores) ya hacen esto; esto trae las cartas a paridad.

    Returns the first response that is >= `min_chars` long. Raises
    `ValueError("Empty letter from LLM. Fallback fallos: …")` solo después
    de que TODOS los providers fallen. El prefijo legacy "Empty letter
    from LLM" se preserva para que matchers existentes sigan funcionando.
    """
    import asyncio
    import httpx

    content: Optional[str] = None

    # ── Step 1: primary (Gemini) ────────────────────────────────────────
    try:
        content = await asyncio.wait_for(
            primary_gemini_fn(system_prompt, user_prompt,
                              temperature=temperature, max_tokens=max_tokens),
            timeout=timeout_secs,
        )
    except Exception as e:
        logger.warning(f"[{label}] Gemini primary call raised: {e}")
        content = None

    if content and len(content.strip()) >= min_chars:
        return content

    logger.warning(
        f"[{label}] Gemini produced {len(content or '') } chars (<{min_chars}); "
        "falling back to OpenRouter."
    )

    # Helper local para intentar GPT-4o vía OpenAI directo como red de seguridad
    # final cuando OpenRouter está caído o sin saldo. Devuelve el contenido si
    # cumple `min_chars`, o None (con un mensaje guardado en `failures`).
    async def _try_openai_direct(failures_acc: list) -> Optional[str]:
        if openai_gpt4o_fn is None:
            return None
        try:
            cand = await asyncio.wait_for(
                openai_gpt4o_fn(system_prompt, user_prompt,
                                temperature=temperature, max_tokens=max_tokens),
                timeout=timeout_secs,
            )
        except Exception as e:
            failures_acc.append(f"openai-direct/gpt-4o → {type(e).__name__}: {str(e)[:120]}")
            logger.warning(f"[{label}] OpenAI direct gpt-4o raised: {e}")
            return None
        if cand and len(cand.strip()) >= min_chars:
            logger.info(f"[{label}] ✅ OpenAI direct gpt-4o produced {len(cand)} chars")
            return cand
        failures_acc.append(f"openai-direct/gpt-4o → too short ({len(cand or '')} chars)")
        return None

    # ── Step 2: OpenRouter cascade ──────────────────────────────────────
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_key:
        # Sin OpenRouter intentamos directo OpenAI antes de rendirnos.
        fails: list = ["OPENROUTER_API_KEY no configurada"]
        oa = await _try_openai_direct(fails)
        if oa is not None:
            return oa
        logger.error(f"[{label}] No OPENROUTER_API_KEY y OpenAI direct también falló")
        raise ValueError(
            f"Empty letter from LLM. Fallback fallos: {'; '.join(fails)}"
        )

    OR_HEADERS = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://redaccion.urpeintegralservices.co",
        "X-Title": f"SmartDocs Fallback ({label})",
    }
    or_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]

    # IDs verificados contra https://openrouter.ai/api/v1/models el 2026-05-28.
    # Si OpenRouter vuelve a renombrar/retirar modelos, el alias
    # `~anthropic/claude-sonnet-latest` debería seguir resolviendo (los `~`
    # prefijos son router-aliases que apuntan al modelo más reciente vigente).
    fallback_models = [
        "anthropic/claude-opus-4.8",
        "anthropic/claude-opus-4.7",
        "~anthropic/claude-sonnet-latest",
    ]

    # Acumulamos motivos de fallo por modelo para que el ValueError final lleve
    # diagnóstico útil al frontend (antes solo decía "Empty letter from LLM"
    # y el operador no tenía forma de saber si era key inválida, 404 de modelo,
    # rate-limit o respuesta demasiado corta).
    failures: list[str] = []

    for model_id in fallback_models:
        try:
            async with httpx.AsyncClient(timeout=timeout_secs) as cli:
                r = await cli.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=OR_HEADERS,
                    json={
                        "model": model_id,
                        "messages": or_messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
            if r.status_code != 200:
                msg = f"HTTP {r.status_code}: {r.text[:150]}"
                logger.warning(f"[{label}] {model_id} {msg}")
                failures.append(f"{model_id} → {msg}")
                continue
            data = r.json()
            choices = data.get("choices") or []
            candidate = (
                choices[0].get("message", {}).get("content")
                if choices else None
            )
            if candidate and len(candidate.strip()) >= min_chars:
                logger.info(
                    f"[{label}] ✅ {model_id} fallback produced "
                    f"{len(candidate)} chars"
                )
                return candidate
            short_len = len(candidate or "")
            logger.warning(
                f"[{label}] {model_id} too short: {short_len} chars "
                f"(min={min_chars})"
            )
            failures.append(f"{model_id} → too short ({short_len} chars)")
        except Exception as e:
            logger.warning(f"[{label}] {model_id} fallback failed: {e}")
            failures.append(f"{model_id} → {type(e).__name__}: {str(e)[:100]}")
            continue

    # ── Step 3: último escalón — OpenAI directo (sin OpenRouter) ────────
    # Solo se intenta si la cascada OpenRouter agotó todos los modelos. Esto
    # es lo que mantiene cartas vivas cuando la cuenta de OpenRouter está
    # caída (caso "User not found" 2026-05-28). Es opt-in vía openai_gpt4o_fn
    # para no acoplar este módulo al cliente OpenAI global de server.py.
    oa_result = await _try_openai_direct(failures)
    if oa_result is not None:
        return oa_result

    detail = "; ".join(failures) if failures else "all providers silent"
    logger.error(f"[{label}] All fallback providers failed — {detail}")
    raise ValueError(f"Empty letter from LLM. Fallback fallos: {detail}")


__all__ = ["call_llm_with_fallback"]
