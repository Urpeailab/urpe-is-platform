"""
Shared utilities for letter PDF rendering.

- `prepare_pdf_settings(profile)`: takes a profile from letter_format_profiles
  and returns a dict ready for the renderer that contains `font_body`,
  `font_bold`, `font_italic` resolved from the profile's `font_intent`.

- `inject_signature_spacer(content, height=70)`: walks the list of ReportLab
  flowables and ensures there is ~1 inch of vertical whitespace immediately
  after the first sign-off paragraph (Sincerely, Respectfully, ...), so the
  signer has physical room for a handwritten signature. Idempotent: skips if
  there's already a tall Spacer after the sign-off.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from reportlab.platypus import Paragraph, Spacer


# Pattern matching the standard sign-off lines our profiles emit. Kept
# permissive so it catches variants like "With sincere regards," and
# "Most respectfully,".
SIGN_OFF_RX = re.compile(
    r'^\s*(?:'
    r'Sincerely|Respectfully(?:\s+submitted)?|Cordially|Warmly|'
    r'Faithfully(?:\s+yours)?|Yours(?:\s+truly|\s+faithfully)?|'
    r'With\s+(?:sincere|warm|great|collegial)(?:\s+\w+)?|'
    r'Best\s+regards|Kind\s+regards|Regards|Most\s+respectfully'
    r')[,\.]?\s*$',
    re.IGNORECASE,
)


def prepare_pdf_settings(profile: dict) -> dict:
    """
    Take a profile and return a shallow copy of its `pdf` settings with
    `font_body` / `font_bold` / `font_italic` filled in from the registry.

    The renderer code can keep reading those keys exactly like before; this
    function just plugs the new font_intent-based resolution in transparently.
    """
    from letter_format_profiles import resolve_fonts

    pdf = dict(profile.get("pdf", {}))
    fonts = resolve_fonts(profile)
    pdf["font_body"] = fonts["regular"]
    pdf["font_bold"] = fonts["bold"]
    pdf["font_italic"] = fonts["italic"]
    return pdf


def _paragraph_text(flow: Paragraph) -> str:
    """Best-effort plain-text extraction from a ReportLab Paragraph."""
    raw = getattr(flow, "text", "") or ""
    return re.sub(r"<[^>]+>", "", raw).strip()


def inject_signature_spacer(content: List[Any], height: float = 70) -> List[Any]:
    """
    Mutate `content` in place: locate the first Paragraph whose plain text
    matches a sign-off and ensure the next flowable is a Spacer of at least
    `height` pt. Returns the same list for convenience.

    Default height of 70pt ≈ 1 inch — enough room for a handwritten signature.

    Idempotent: if a tall Spacer already follows the sign-off, no change.
    """
    for idx, flow in enumerate(content):
        if not isinstance(flow, Paragraph):
            continue
        text = _paragraph_text(flow)
        if not SIGN_OFF_RX.match(text):
            continue
        # Is the next flowable already a tall Spacer?
        nxt = content[idx + 1] if idx + 1 < len(content) else None
        if isinstance(nxt, Spacer) and getattr(nxt, "height", 0) >= height - 5:
            return content
        content.insert(idx + 1, Spacer(1, height))
        return content
    return content


__all__ = [
    "SIGN_OFF_RX",
    "prepare_pdf_settings",
    "inject_signature_spacer",
]
