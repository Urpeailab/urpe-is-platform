"""
Internal LLM client that replaces `emergentintegrations.llm.chat`.

Provides drop-in replacements for `LlmChat` and `UserMessage` so existing
call sites do not need to change beyond the import line.

Routing strategy:
  - If OPENROUTER_API_KEY is set, all openai/anthropic calls go through OpenRouter
    (OpenAI-compatible API at https://openrouter.ai/api/v1). Model names are
    auto-prefixed (`gpt-4o` → `openai/gpt-4o`, `claude-sonnet-4-5` → `anthropic/claude-sonnet-4-5`).
  - Gemini always uses google.generativeai directly (OpenRouter Gemini support is patchy).
  - If no OPENROUTER_API_KEY, falls back to native SDKs and provider-specific keys
    (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY).
"""

import os
import asyncio
import logging
from dataclasses import dataclass
from typing import List, Optional, Union

logger = logging.getLogger(__name__)


@dataclass
class UserMessage:
    """Message wrapper. Accepts `text=` (legacy) or `content=` interchangeably."""
    text: str = ""
    content: str = ""

    def __post_init__(self):
        if self.content and not self.text:
            self.text = self.content
        elif self.text and not self.content:
            self.content = self.text


def _openrouter_key() -> Optional[str]:
    return os.getenv("OPENROUTER_API_KEY")


def _resolve_api_key(provider: str, explicit_key: Optional[str]) -> Optional[str]:
    if explicit_key:
        return explicit_key
    env_map = {
        "openai": "OPENAI_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "google": "GEMINI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "claude": "ANTHROPIC_API_KEY",
    }
    var = env_map.get(provider.lower())
    if var:
        key = os.getenv(var)
        if key:
            return key
    return os.getenv("EMERGENT_LLM_KEY")


import re as _re


def _normalize_claude_id(model_id: str) -> str:
    """
    OpenRouter expects Claude version numbers with a DOT (claude-sonnet-4.5),
    but the Anthropic-native SDK uses HYPHENS (claude-sonnet-4-5) and sometimes
    a trailing date (claude-sonnet-4-5-20250929). Convert the native form to
    the OpenRouter form so callers can keep passing native IDs to .with_model().

    Examples:
        anthropic/claude-sonnet-4-5            -> anthropic/claude-sonnet-4.5
        anthropic/claude-opus-4-7              -> anthropic/claude-opus-4.7
        anthropic/claude-sonnet-4-5-20250929   -> anthropic/claude-sonnet-4.5
    """
    return _re.sub(
        r'(claude-(?:opus|sonnet|haiku))-(\d+)-(\d+)(?:-\d+)?',
        r'\1-\2.\3',
        model_id,
    )


def _to_openrouter_model(provider: str, model: str) -> str:
    """Map (provider, model) to an OpenRouter model id (`vendor/model`)."""
    if "/" in model:
        return _normalize_claude_id(model)
    p = provider.lower()
    if p == "openai":
        return f"openai/{model}"
    if p in ("anthropic", "claude"):
        return _normalize_claude_id(f"anthropic/{model}")
    if p in ("gemini", "google"):
        return f"google/{model}"
    return model


class LlmChat:
    """
    Drop-in replacement for emergentintegrations.llm.chat.LlmChat.

    Two construction styles are supported:

      A) chat = LlmChat(api_key=..., session_id=..., system_message=...).with_model("openai", "gpt-4o")
         response = await chat.send_message(UserMessage(text="..."))

      B) chat = LlmChat(provider="openai", model="gpt-4o-mini", api_key=None)
         response = await chat.generate_response(
             system_message="...",
             user_messages=[UserMessage(content="...")],
             temperature=0.1, max_tokens=1000, json_mode=True,
         )
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        system_message: str = "",
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self._explicit_api_key = api_key
        self.session_id = session_id
        self.system_message = system_message or ""
        self.provider = provider
        self.model = model

    def with_model(self, provider: str, model: str) -> "LlmChat":
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, message: UserMessage) -> str:
        """Send a single user message and return the assistant text response."""
        return await self._call(
            system_message=self.system_message,
            user_text=message.text,
        )

    async def generate_response(
        self,
        system_message: str = "",
        user_messages: Optional[List[UserMessage]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        json_mode: bool = False,
    ) -> str:
        """Pattern-B entrypoint used by intelligent_extractor."""
        user_messages = user_messages or []
        joined = "\n\n".join(m.text for m in user_messages)
        return await self._call(
            system_message=system_message or self.system_message,
            user_text=joined,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )

    async def _call(
        self,
        system_message: str,
        user_text: str,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        json_mode: bool = False,
    ) -> str:
        if not self.provider or not self.model:
            raise RuntimeError("LlmChat requires provider and model (use .with_model() or pass provider/model in constructor)")

        provider = self.provider.lower()

        # Prefer OpenRouter for openai/anthropic when available (single key, OpenAI-compatible API).
        or_key = _openrouter_key()
        if or_key and provider in ("openai", "anthropic", "claude"):
            return await self._call_openai_compatible(
                api_key=or_key,
                base_url="https://openrouter.ai/api/v1",
                model=_to_openrouter_model(provider, self.model),
                system_message=system_message,
                user_text=user_text,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
            )

        api_key = _resolve_api_key(provider, self._explicit_api_key)
        if not api_key:
            raise RuntimeError(f"No API key for provider '{provider}'. Set OPENROUTER_API_KEY or the provider-specific env var.")

        if provider == "openai":
            return await self._call_openai_compatible(
                api_key=api_key, base_url=None, model=self.model,
                system_message=system_message, user_text=user_text,
                temperature=temperature, max_tokens=max_tokens, json_mode=json_mode,
            )
        if provider in ("gemini", "google"):
            return await self._call_gemini(api_key, system_message, user_text, temperature, max_tokens, json_mode)
        if provider in ("anthropic", "claude"):
            return await self._call_anthropic(api_key, system_message, user_text, temperature, max_tokens)

        raise RuntimeError(f"Unsupported provider: {provider}")

    async def _call_openai_compatible(self, api_key, base_url, model, system_message, user_text, temperature, max_tokens, json_mode):
        """Works for native OpenAI and any OpenAI-compatible endpoint (OpenRouter)."""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key, base_url=base_url) if base_url else AsyncOpenAI(api_key=api_key)
        kwargs = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_text},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    async def _call_gemini(self, api_key, system_message, user_text, temperature, max_tokens, json_mode):
        import google.generativeai as genai

        def _sync():
            genai.configure(api_key=api_key)
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            if json_mode:
                generation_config["response_mime_type"] = "application/json"
            model = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=system_message or None,
                generation_config=generation_config,
            )
            result = model.generate_content(user_text)
            return result.text or ""

        return await asyncio.to_thread(_sync)

    async def _call_anthropic(self, api_key, system_message, user_text, temperature, max_tokens):
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=api_key)
        resp = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message or "",
            messages=[{"role": "user", "content": user_text}],
        )
        parts = []
        for block in resp.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts)


class EmergentIntegrations:
    """
    Replacement for `emergentintegrations.EmergentIntegrations`.

    Provides a synchronous `chat_completion()` method whose return shape mirrors
    the OpenAI Chat Completions response (dict with `choices[*].message.content`).
    Uses the OpenAI SDK directly under the hood.
    """

    def __init__(self, api_key: Optional[str] = None):
        # Prefer OpenRouter if available (gives access to Claude/GPT/Gemini with one key)
        or_key = _openrouter_key()
        if or_key:
            self.api_key = or_key
            self.base_url = "https://openrouter.ai/api/v1"
        else:
            self.api_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("EMERGENT_LLM_KEY")
            self.base_url = None

    def chat_completion(self, model: str, messages: list, temperature: float = 0.7, max_tokens: int = 4000, **kwargs) -> dict:
        from openai import OpenAI
        # Auto-prefix model with vendor when going through OpenRouter and no slash present
        target_model = model
        if self.base_url and "/" not in model:
            # Default to openai vendor for plain model names like "gpt-4o"
            target_model = f"openai/{model}" if not model.startswith("claude") else f"anthropic/{model}"
        client = OpenAI(api_key=self.api_key, base_url=self.base_url) if self.base_url else OpenAI(api_key=self.api_key)
        resp = client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {
            "choices": [
                {
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content or "",
                    }
                }
                for choice in resp.choices
            ]
        }
