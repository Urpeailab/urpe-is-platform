"""
llm_fallback.py — Unified LLM call with automatic OpenRouter fallback.

Every letter-generation endpoint used to call Gemini Flash Lite directly
and — when Gemini returned empty or rate-limited — raise ValueError with
"Empty letter from LLM". Users then clicked "Generate" again, creating
duplicate failed records. The production screenshot showed 4 out of 5
recommendation letters in error state for this exact reason.

This helper wraps the primary Gemini call and, on empty/short/error
output, transparently falls back through OpenRouter in this order:

   1. anthropic/claude-sonnet-4.6   (latest Sonnet, best instruction-following)
   2. anthropic/claude-opus-4-6     (most powerful fallback)
   3. anthropic/claude-sonnet-4-5   (last resort)

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
    temperature: float = 0.35,
    max_tokens: int = 8000,
    min_chars: int = 500,
    label: str = "document",
    timeout_secs: float = 180.0,
) -> str:
    """
    Try the primary Gemini call first. If it returns empty / too-short /
    raises, fall back to OpenRouter with a Sonnet 4.6 → Opus 4.6 → Sonnet 4.5
    cascade. Returns the first response that is >= `min_chars` long.

    Raises `ValueError("Empty letter from LLM")` only after all providers
    fail, matching the legacy error message so callers need no changes.
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

    # ── Step 2: OpenRouter cascade ──────────────────────────────────────
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_key:
        logger.error(f"[{label}] No OPENROUTER_API_KEY → cannot fall back")
        raise ValueError("Empty letter from LLM")

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

    for model_id in [
        "anthropic/claude-sonnet-4.6",
        "anthropic/claude-opus-4-6",
        "anthropic/claude-sonnet-4-5",
    ]:
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
                logger.warning(
                    f"[{label}] {model_id} HTTP {r.status_code}: {r.text[:150]}"
                )
                continue
            candidate = r.json()["choices"][0]["message"]["content"]
            if candidate and len(candidate.strip()) >= min_chars:
                logger.info(
                    f"[{label}] ✅ {model_id} fallback produced "
                    f"{len(candidate)} chars"
                )
                return candidate
            logger.warning(
                f"[{label}] {model_id} too short: "
                f"{len(candidate or '')} chars"
            )
        except Exception as e:
            logger.warning(f"[{label}] {model_id} fallback failed: {e}")
            continue

    logger.error(f"[{label}] All fallback providers failed — raising ValueError")
    raise ValueError("Empty letter from LLM")


__all__ = ["call_llm_with_fallback"]
