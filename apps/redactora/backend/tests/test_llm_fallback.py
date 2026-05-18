"""
Regression tests for `llm_fallback.call_llm_with_fallback`.

User production issue: recommendation letters, expert letters, and intent
letters were failing with "Empty letter from LLM..." because the primary
Gemini call returned empty / rate-limited and there was no transparent
fallback. Users then manually retried, creating 4-5 duplicate failed
letter records in the list.

Fix: a centralised `call_llm_with_fallback` helper now wraps the primary
Gemini call with a 3-level OpenRouter fallback (Sonnet 4.6 → Opus 4.6 →
Sonnet 4.5). Only after all four providers fail does it raise
`ValueError("Empty letter from LLM")`.

These tests monkey-patch `httpx.AsyncClient.post` to avoid hitting the
real OpenRouter API.
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from llm_fallback import call_llm_with_fallback  # noqa: E402


class _MockResp:
    def __init__(self, status_code: int, payload: dict | str):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)
    def json(self):
        return self._payload if isinstance(self._payload, dict) else {}


def _mk_openrouter_response(text: str):
    return _MockResp(200, {"choices": [{"message": {"content": text}}]})


@pytest.mark.asyncio
async def test_primary_gemini_succeeds_returns_immediately():
    """When Gemini returns a long response, fallback is NOT hit."""
    good = "x" * 800
    mock_gemini = AsyncMock(return_value=good)

    with patch("httpx.AsyncClient") as mock_client:
        result = await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test1",
        )

    assert result == good
    mock_gemini.assert_awaited_once()
    # httpx.AsyncClient must NOT be instantiated — no fallback was needed.
    mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_gemini_empty_triggers_openrouter_sonnet_success(monkeypatch):
    """Empty Gemini → first OpenRouter attempt (Sonnet 4.6) succeeds."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_gemini = AsyncMock(return_value="")  # empty

    good = "y" * 1000
    async def fake_post(*args, **kwargs):
        return _mk_openrouter_response(good)

    mock_cli = MagicMock()
    mock_cli.__aenter__ = AsyncMock(return_value=mock_cli)
    mock_cli.__aexit__ = AsyncMock(return_value=None)
    mock_cli.post = fake_post

    with patch("httpx.AsyncClient", return_value=mock_cli):
        result = await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test2",
        )
    assert result == good


@pytest.mark.asyncio
async def test_gemini_too_short_triggers_openrouter(monkeypatch):
    """Gemini returns 100 chars (below min_chars=500) → fallback kicks in."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    short = "too short"
    mock_gemini = AsyncMock(return_value=short)
    good = "z" * 1200

    async def fake_post(*args, **kwargs):
        return _mk_openrouter_response(good)

    mock_cli = MagicMock()
    mock_cli.__aenter__ = AsyncMock(return_value=mock_cli)
    mock_cli.__aexit__ = AsyncMock(return_value=None)
    mock_cli.post = fake_post

    with patch("httpx.AsyncClient", return_value=mock_cli):
        result = await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test3",
        )
    assert result == good


@pytest.mark.asyncio
async def test_gemini_raises_exception_triggers_fallback(monkeypatch):
    """Gemini raises → fallback saves the day."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_gemini = AsyncMock(side_effect=RuntimeError("Gemini 429 rate-limited"))
    good = "k" * 800

    async def fake_post(*args, **kwargs):
        return _mk_openrouter_response(good)

    mock_cli = MagicMock()
    mock_cli.__aenter__ = AsyncMock(return_value=mock_cli)
    mock_cli.__aexit__ = AsyncMock(return_value=None)
    mock_cli.post = fake_post

    with patch("httpx.AsyncClient", return_value=mock_cli):
        result = await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test4",
        )
    assert result == good


@pytest.mark.asyncio
async def test_all_providers_fail_raises_legacy_error(monkeypatch):
    """Legacy error message preserved for back-compat."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_gemini = AsyncMock(return_value="")

    async def always_500(*args, **kwargs):
        return _MockResp(500, "Server error")

    mock_cli = MagicMock()
    mock_cli.__aenter__ = AsyncMock(return_value=mock_cli)
    mock_cli.__aexit__ = AsyncMock(return_value=None)
    mock_cli.post = always_500

    with patch("httpx.AsyncClient", return_value=mock_cli):
        with pytest.raises(ValueError, match="Empty letter from LLM"):
            await call_llm_with_fallback(
                system_prompt="sys",
                user_prompt="user",
                primary_gemini_fn=mock_gemini,
                min_chars=500,
                label="test5",
            )


@pytest.mark.asyncio
async def test_no_openrouter_key_raises_immediately(monkeypatch):
    """Without OPENROUTER_API_KEY we can't fall back → raise the legacy error."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    mock_gemini = AsyncMock(return_value="")
    with pytest.raises(ValueError, match="Empty letter from LLM"):
        await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test6",
        )


@pytest.mark.asyncio
async def test_tries_each_fallback_model_in_order(monkeypatch):
    """Sonnet 4.6 500 → Opus 4.6 500 → Sonnet 4.5 succeeds."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_gemini = AsyncMock(return_value="")
    good = "q" * 900

    posted = []
    async def fake_post(url, **kwargs):
        model = kwargs.get("json", {}).get("model", "")
        posted.append(model)
        if model == "anthropic/claude-sonnet-4.6":
            return _MockResp(500, "err")
        if model == "anthropic/claude-opus-4-6":
            return _MockResp(500, "err")
        return _mk_openrouter_response(good)

    mock_cli = MagicMock()
    mock_cli.__aenter__ = AsyncMock(return_value=mock_cli)
    mock_cli.__aexit__ = AsyncMock(return_value=None)
    mock_cli.post = fake_post

    with patch("httpx.AsyncClient", return_value=mock_cli):
        result = await call_llm_with_fallback(
            system_prompt="sys",
            user_prompt="user",
            primary_gemini_fn=mock_gemini,
            min_chars=500,
            label="test7",
        )
    assert result == good
    assert posted == [
        "anthropic/claude-sonnet-4.6",
        "anthropic/claude-opus-4-6",
        "anthropic/claude-sonnet-4-5",
    ]
