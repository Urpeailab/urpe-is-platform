"""
Font registry for letter generation.

Registers optional TTF fonts from `static/fonts/` into ReportLab on import.
If a font family's files aren't present, the registry transparently falls
back to ReportLab's built-in Times-Roman / Helvetica / Courier families
(which are always available), so the system never breaks when fonts are
missing — it just uses fewer visual variants.

Add new fonts by dropping `.ttf` files into apps/redactora/backend/static/fonts/
with these exact filenames:

    EBGaramond-Regular.ttf  EBGaramond-Bold.ttf  EBGaramond-Italic.ttf
    Lato-Regular.ttf        Lato-Bold.ttf        Lato-Italic.ttf
    OpenSans-Regular.ttf    OpenSans-Bold.ttf    OpenSans-Italic.ttf
    CrimsonPro-Regular.ttf  CrimsonPro-Bold.ttf  CrimsonPro-Italic.ttf

Download URLs (raw TTFs from the official Google Fonts repo):

    EB Garamond  → https://github.com/google/fonts/raw/main/ofl/ebgaramond/static/EBGaramond-Regular.ttf
                   (and -Bold.ttf, -Italic.ttf)
    Lato         → https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf
                   (and -Bold.ttf, -Italic.ttf)
    Open Sans    → https://github.com/google/fonts/raw/main/ofl/opensans/static/OpenSans-Regular.ttf
                   (and -Bold.ttf, -Italic.ttf)
    Crimson Pro  → https://github.com/google/fonts/raw/main/ofl/crimsonpro/static/CrimsonPro-Regular.ttf
                   (and -Bold.ttf, -Italic.ttf)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# Each "intent" maps to a font family of three weights (regular / bold / italic).
# When a custom TTF triplet is found in static/fonts/, the intent resolves to
# the custom family; otherwise it falls back to a built-in family.
_FONT_DIR = Path(__file__).resolve().parent / "static" / "fonts"

# (intent, regular_filename, bold_filename, italic_filename, fallback_family_tuple)
_FONT_INTENTS: List[tuple] = [
    (
        "elegant_serif",
        "EBGaramond-Regular.ttf",
        "EBGaramond-Bold.ttf",
        "EBGaramond-Italic.ttf",
        ("Times-Roman", "Times-Bold", "Times-Italic"),
    ),
    (
        "humanist_serif",
        "CrimsonPro-Regular.ttf",
        "CrimsonPro-Bold.ttf",
        "CrimsonPro-Italic.ttf",
        ("Times-Roman", "Times-Bold", "Times-Italic"),
    ),
    (
        "classic_serif",
        None,  # always use built-in Times
        None,
        None,
        ("Times-Roman", "Times-Bold", "Times-Italic"),
    ),
    (
        "modern_sans",
        "OpenSans-Regular.ttf",
        "OpenSans-Bold.ttf",
        "OpenSans-Italic.ttf",
        ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique"),
    ),
    (
        "humanist_sans",
        "Lato-Regular.ttf",
        "Lato-Bold.ttf",
        "Lato-Italic.ttf",
        ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique"),
    ),
    (
        "classic_sans",
        None,  # always use built-in Helvetica
        None,
        None,
        ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique"),
    ),
    (
        "typewriter",
        None,
        None,
        None,
        ("Courier", "Courier-Bold", "Courier-Oblique"),
    ),
]


# Resolved registry: intent -> {regular, bold, italic} (font names usable by ReportLab)
_RESOLVED: Dict[str, Dict[str, str]] = {}
_REGISTERED_CUSTOM: List[str] = []


def _register_one(name: str, path: Path) -> bool:
    """Register a single TTF with ReportLab. Returns True on success."""
    try:
        pdfmetrics.registerFont(TTFont(name, str(path)))
        _REGISTERED_CUSTOM.append(name)
        return True
    except Exception as e:
        logging.warning(f"⚠️ Could not register font {name} from {path}: {e}")
        return False


def _init_registry() -> None:
    for intent, reg_fn, bold_fn, ital_fn, fallback in _FONT_INTENTS:
        # If no filenames given, use built-in fallback directly.
        if reg_fn is None:
            _RESOLVED[intent] = {
                "regular": fallback[0],
                "bold": fallback[1],
                "italic": fallback[2],
            }
            continue

        reg_path = _FONT_DIR / reg_fn
        bold_path = _FONT_DIR / bold_fn
        ital_path = _FONT_DIR / ital_fn

        # All three must exist; otherwise we fall back to the built-in family
        # rather than mixing custom regular with built-in bold (which would
        # look inconsistent).
        if reg_path.exists() and bold_path.exists() and ital_path.exists():
            # ReportLab font names must be unique; we use the filename stem.
            reg_name = reg_path.stem
            bold_name = bold_path.stem
            ital_name = ital_path.stem
            ok = (
                _register_one(reg_name, reg_path)
                and _register_one(bold_name, bold_path)
                and _register_one(ital_name, ital_path)
            )
            if ok:
                _RESOLVED[intent] = {
                    "regular": reg_name,
                    "bold": bold_name,
                    "italic": ital_name,
                }
                continue

        # Fallback
        _RESOLVED[intent] = {
            "regular": fallback[0],
            "bold": fallback[1],
            "italic": fallback[2],
        }


_init_registry()


def get_font_family(intent: str) -> Dict[str, str]:
    """
    Return a dict with keys 'regular', 'bold', 'italic' for the given intent.

    `intent` is one of: elegant_serif, humanist_serif, classic_serif,
    modern_sans, humanist_sans, classic_sans, typewriter.

    Unknown intents fall back to classic_serif.
    """
    return _RESOLVED.get(intent, _RESOLVED["classic_serif"])


def list_available_intents() -> List[str]:
    """Return all registered intents (always the full list — fallbacks ensure
    every intent resolves to *something*)."""
    return list(_RESOLVED.keys())


def custom_fonts_registered() -> List[str]:
    """Return the names of custom TTFs successfully registered. Useful for
    logging at startup so operators see which fonts are actually active."""
    return list(_REGISTERED_CUSTOM)


# Convenience: log what's active at import time so it shows up in the
# container startup log.
if _REGISTERED_CUSTOM:
    logging.info(
        f"✅ Letter font registry: {len(_REGISTERED_CUSTOM)} custom TTF(s) "
        f"loaded from {_FONT_DIR}: {', '.join(_REGISTERED_CUSTOM)}"
    )
else:
    logging.info(
        f"ℹ️ Letter font registry: no custom TTFs found in {_FONT_DIR} — "
        f"using built-in Times/Helvetica/Courier fallbacks for all profiles"
    )


__all__ = [
    "get_font_family",
    "list_available_intents",
    "custom_fonts_registered",
]
