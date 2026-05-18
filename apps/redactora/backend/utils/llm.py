"""
LLM integration utilities
"""
import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

# OpenRouter API configuration
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


async def call_claude_opus_niw(
    system_message: str, 
    user_message: str, 
    temperature: float = 0.5, 
    max_tokens: int = 32000
) -> str:
    """
    Helper function to call Claude Opus 4.5 via OpenRouter for NIW business plan generation.
    Uses the strict financial structure requirements.
    """
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://monica-docs.com",
                    "X-Title": "Monica Document Generator"
                },
                json={
                    "model": "anthropic/claude-opus-4-6",
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Error calling Claude Opus 4.5: {str(e)}")
        raise


async def call_openrouter_llm(
    system_message: str,
    user_message: str,
    model: str = "anthropic/claude-3.5-sonnet",
    temperature: float = 0.7,
    max_tokens: int = 8000
) -> str:
    """
    Generic function to call any model via OpenRouter.
    """
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://monica-docs.com",
                    "X-Title": "Monica Document Generator"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Error calling {model}: {str(e)}")
        raise


async def translate_text(
    text: str,
    target_language: str = "es",
    model: str = "anthropic/claude-3.5-sonnet"
) -> str:
    """
    Translate text to the specified language.
    """
    system_message = f"""You are a professional translator. Translate the following text to {target_language}.
Maintain the original HTML formatting if present.
Do not add any explanations, just provide the translation."""
    
    return await call_openrouter_llm(
        system_message=system_message,
        user_message=text,
        model=model,
        temperature=0.3,
        max_tokens=len(text) * 2
    )
