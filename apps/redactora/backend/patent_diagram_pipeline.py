"""
Parallel per-figure patent diagram generation.

Instead of asking the LLM for a single Python script that draws all 6 figures
(slow, and one bad figure breaks the whole script), this module generates each
figure independently and in parallel:

  - One focused LLM prompt per figure (better quality — the model concentrates
    on a single diagram with its own strict requirements).
  - 6 calls fired concurrently with asyncio.gather.
  - Each figure is an isolated Python script → validated → executed in a
    subprocess → rasterized to a single PNG.
  - If one figure fails, the other 5 still come out. Failures are reported per
    figure so the caller can retry just the broken one.

Public API:
  generate_figures_parallel(patent_text, title, openai_client, only=None)
      -> (combined_html, n_ok, n_total, per_figure_status)
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Dict, List, Optional, Tuple

from patent_diagram_runner import (
    DiagramScriptError,
    analyze_layout,
    render_python_diagram_script,
    render_python_diagram_script_with_layout,
    validate_script,
)

logger = logging.getLogger(__name__)

# How many times to regenerate a figure whose rendered layout has overlapping
# boxes or boxes that spill past the page margins. Each retry feeds the concrete
# problems back to the LLM. Figures are generated in parallel, so this only adds
# latency for the figures that actually need fixing.
MAX_LAYOUT_RETRIES = 2


# ---------------------------------------------------------------------------
# Shared prompt header — helper API + global USPTO rules. Injected into every
# per-figure prompt so the model knows exactly which primitives it may call.
# ---------------------------------------------------------------------------

_PROMPT_HEADER = r'''# USPTO PATENT DIAGRAM — SINGLE FIGURE (PYTHON / REPORTLAB)

Eres un experto en diagramas técnicos para patentes USPTO. Generas UN script Python que dibuja **UNA sola figura** de calidad USPTO (blanco y negro, líneas limpias, numerales de referencia). El script se ejecuta en un sandbox y se rasteriza a PNG.

## OUTPUT — CRITICAL
Devuelve UN solo bloque ```python ...``` sin texto antes ni después:

```python
from patent_diagram_helpers import *

def draw_fig(c):
    setup_page(c, "FIG. {N}", "{CAPTION}")
    # ... drawing calls ...

c = new_canvas("patent_diagrams.pdf")
draw_fig(c)
c.save()
```

## IMPORTS PERMITIDOS (whitelist absoluta)
- `from patent_diagram_helpers import *` (REQUERIDO, primera línea)
- `import math` (opcional)
- `import random` (opcional; si lo usas, fija una semilla)
NUNCA: os, sys, subprocess, socket, requests, urllib, open(), eval(), exec(),
compile(), __import__(), getattr(), setattr(), globals(), locals(), input(),
ni cadenas con `"__...__"`.

## API DE HELPERS — ÚSALOS, NO INVENTES OTROS
Coordenadas en puntos PDF (origen abajo-izquierda). US-Letter portrait = 612×792.
Área útil portrait ≈ (54,72)–(558,738). Landscape ≈ (54,72)–(738,558).

Canvas / página:
- `new_canvas(path)` → canvas portrait US-Letter.
- `setup_page(c, fig_label, fig_caption="", page_landscape=False)` → título arriba, caption abajo. Llámalo PRIMERO.

Texto:
- `wrap_text(text, max_width, font_name=FONT, font_size=9)` → lista de líneas.

Cajas/formas:
- `draw_box(c, x, y, w, h, label="", ref_num=None, font_size=8, bold=False, ref_pos="above")` — ref_pos: above|below|left|right|tl|tr|bl|br
- `draw_dashed_box(c, x, y, w, h, label=None, ref_num=None, font_size=9, label_at="tl")` — label_at: tl|tr|bl|br|tc|bc
- `draw_oval(c, cx, cy, w, h, label="", ref_num=None, font_size=10)` — (cx,cy)=CENTRO
- `draw_cylinder(c, x, y, w, h, label="", ref_num=None, font_size=8, ref_pos="above")`
- `draw_hatched_box(c, x, y, w, h, density="medium", angle_deg=45)` — density: light|medium|heavy

Flechas/líneas:
- `draw_arrow(c, x1, y1, x2, y2, head_size=6, dashed=False)`
- `draw_arrow_path(c, points, dashed=False, head_size=6)` — points=[(x,y),...] head en el último
- `draw_polyline(c, points, dashed=False)` — sin head

ERD:
- `draw_entity(c, x, y, w, title, fields, ref_num=None)` → devuelve altura. fields=["PK id","FK user_id","name"]
- `draw_rel(c, x1, y1, x2, y2, label="", left_card="", right_card="", dashed=False)`

Ejes/charts:
- `draw_axes(c, x, y, w, h, x_label="", y_label="", x_ticks=[(frac,"lbl")], y_ticks=[(frac,"lbl")])`

Constantes: `FONT`, `FONT_BOLD`, `LINE_W`, `LINE_W_THIN`, `MARGIN_LEFT/RIGHT/TOP/BOTTOM`.

## REGLAS DE DISEÑO USPTO (OBLIGATORIAS)
1. Solo blanco y negro. Stroke negro, sin fills coloreados (hatching OK).
2. **Numerales de referencia en TODOS los componentes** que la patente menciona. Lee el texto, encuentra los identificadores numéricos (101, 102, 103...) y dibújalos con su `ref_num` exacto.
3. **CERO solapamiento entre cajas.** Define PRIMERO las coordenadas de todas las cajas; deja ≥18pt horizontal entre cajas de una fila y ≥18pt vertical entre filas. Dos cajas NUNCA pueden compartir área. (Las cajas dashed contenedoras SÍ envuelven a sus cajas internas, con ≥20pt de margen interno.)
4. **Texto que CABE.** Sube `h` o baja `font_size` (mínimo 7) si la etiqueta es larga.
5. **Flechas que CONECTAN.** Calcula bordes: caja A (100,400,120,40) y B (300,400,120,40) → `draw_arrow(c, 220, 420, 300, 420)`. ❌ NINGUNA flecha puede terminar en coordenadas sin caja. Las etiquetas de flecha van en el HUECO entre cajas, nunca encima de una caja.
6. **ÁREA DIBUJABLE OBLIGATORIA.** TODAS las cajas deben caber con x∈[54, page_w−54] y y∈[72, page_h−54] (portrait: page_w=612, page_h=792; landscape: 792×612). Si no caben, reduce tamaños o usa menos columnas/filas. Una caja que se pasa de estos límites se RECORTA en el PDF.
7. Layout coherente: decide un grid mental y respétalo.

'''

_PROMPT_FOOTER = r'''
## CHECKLIST ANTES DE DEVOLVER
- [ ] Primera línea `from patent_diagram_helpers import *`.
- [ ] Solo UNA función `draw_fig(c)`, que empieza con `setup_page(...)`.
- [ ] Al final: `c = new_canvas("patent_diagrams.pdf")`, `draw_fig(c)`, `c.save()`.
- [ ] Cumple el MÍNIMO de componentes indicado arriba para esta figura.
- [ ] Ninguna flecha apunta al vacío.
- [ ] Coordenadas dentro del área útil.
- [ ] Sin imports/llamadas prohibidas.

Devuelve SOLO el bloque ```python ...```. Nada más.
'''


# ---------------------------------------------------------------------------
# Per-figure specifications. Each one becomes a focused prompt.
# ---------------------------------------------------------------------------

FIGURE_SPECS: List[dict] = [
    {
        "n": 1,
        "title": "System Architecture Overview",
        "caption": "High-level architecture of the system and its main components.",
        "landscape": False,
        "requirements": """
## ESTA FIGURA — FIG. 1: Arquitectura de alto nivel
- **MÍNIMO 10 cajas, MÁXIMO 14**, una por cada módulo/componente del sistema.
- **TODOS los componentes numerados de la patente (101, 102, 103, ...) DEBEN aparecer** como caja con su `ref_num` exacto. Si la patente menciona 101–106, dibuja las 6, no solo 4.
- **MÍNIMO 2 `draw_dashed_box`** para agrupar capas/tiers (p. ej. "Server-side", "Client-side", "External Systems").
- **🚨 EL CONTENEDOR DASHED NUNCA DEBE CRUZAR UNA CAJA.** Procedimiento OBLIGATORIO: primero decide las coordenadas de TODAS las cajas internas de un grupo, calcula min_x, min_y, max_x2 (=x+w mayor), max_y2 (=y+h mayor), y SOLO ENTONCES dibuja el contenedor con `draw_dashed_box(c, min_x-20, min_y-20, (max_x2-min_x)+40, (max_y2-min_y)+40, ...)`. Es decir, ≥20pt de margen por dentro en los 4 lados. El borde del dashed jamás debe pasar por encima del texto de una caja.
- Deja ≥30pt de separación vertical entre un contenedor dashed y el siguiente, para que sus bordes no se toquen.
- **MÍNIMO 6 flechas** conectando componentes, cada una de borde a borde de dos cajas, sin cruzar por encima de otra caja.
""",
    },
    {
        "n": 2,
        "title": "Operational Process Flow",
        "caption": "Process flow of the main operation.",
        "landscape": False,
        "requirements": """
## ESTA FIGURA — FIG. 2: Flujo de operación
- **MÍNIMO 12 pasos, MÁXIMO 16.**
- **MÍNIMO 2 óvalos** (Start y End) con `draw_oval`.
- **MÍNIMO 1 bucle de feedback** explícito: usa `draw_arrow_path` con puntos intermedios para que una flecha regrese hacia arriba a un paso anterior.
- **MÍNIMO 1 punto de decisión** (una caja con dos flechas saliendo, etiquetadas "Yes"/"No" usando draw_box pequeñas o etiquetas de texto cercanas).
- Numera los pasos con ref_num secuencial (201, 202, ...). Ninguna flecha colgando.
""",
    },
    {
        "n": 3,
        "title": "Data Model / Internal Structure",
        "caption": "Detailed data model or internal component structure.",
        "landscape": False,
        "requirements": """
## ESTA FIGURA — FIG. 3: Modelo de datos (ERD) o estructura interna
- Si el invento maneja datos persistentes (BD, registros, tablas):
  - **MÍNIMO 6 entidades** con `draw_entity`, cada una con ≥4 campos (PK + 2-3 atributos + FK donde aplique).
  - **MÍNIMO 5 relaciones** con `draw_rel`, con cardinalidades visibles ("1", "N", "1..*").
- Si NO maneja datos persistentes: descomposición interna de un componente clave con **MÍNIMO 8 sub-cajas** en jerarquía + flechas etiquetadas mostrando el flujo interno.
""",
    },
    {
        "n": 4,
        "title": "User / Dashboard Interface",
        "caption": "Exemplary user or administrator interface.",
        "landscape": False,
        "requirements": """
## ESTA FIGURA — FIG. 4: UI / dashboard / ejemplo concreto
- **MÍNIMO 5 secciones visuales** (paneles, tarjetas, áreas) con `draw_box`/`draw_dashed_box`.
- **MÍNIMO 1 `draw_hatched_box`** para una zona de intensidad/heatmap. Esta zona va en su PROPIA sección (p. ej. un panel "heatmap"), SEPARADA del mini-gráfico.
- **MÍNIMO 1 mini-gráfico**: `draw_axes` (≥4 ticks en X, ≥3 en Y, con etiquetas) + `draw_polyline` con ≥4 puntos.
- **🚨 EL MINI-GRÁFICO DEBE ESTAR EN UN ÁREA LIMPIA, SIN NINGÚN `draw_hatched_box` DEBAJO.** El hatching hace ilegibles los ejes, los ticks y la polilínea. NUNCA dibujes draw_axes/draw_polyline encima de un draw_hatched_box.
- Los labels de los ejes (x_label, y_label) van FUERA del rectángulo de trazado, con espacio suficiente: deja ≥24pt a la izquierda del eje Y para su etiqueta rotada y ≥20pt debajo del eje X. El área de trazado (x,y,w,h que pasas a draw_axes) debe dejar ese margen libre.
- **MÍNIMO 5 etiquetas de texto** que parezcan datos reales (nombres, métricas, valores), cada una en su panel, nunca encima de hatching ni de líneas del gráfico.
""",
    },
    {
        "n": 5,
        "title": "Data Flow / Pipeline",
        "caption": "Data flow between components and external systems.",
        "landscape": True,
        "requirements": """
## ESTA FIGURA — FIG. 5: Flujo de datos / pipeline (LANDSCAPE)
- Esta figura es LANDSCAPE: `setup_page(c, "FIG. 5", "...", page_landscape=True)`.
- **MÍNIMO 10 componentes** en 3 columnas: Origen (3-4) → Procesamiento (3-4) → Destino (3-4).
- **MÍNIMO 2 `draw_cylinder`** para storages/bases de datos.
- **MÍNIMO 8 flechas** entre columnas, cada una con etiqueta semántica específica ("sends events", "queries", "writes log" — NO solo "data" o "flow").
""",
    },
    {
        "n": 6,
        "title": "Deployment Topology",
        "caption": "Deployment topology across tiers.",
        "landscape": False,
        "requirements": """
## ESTA FIGURA — FIG. 6: Topología / despliegue
- **MÍNIMO 2 `draw_dashed_box`** como zones (p. ej. "Cloud Tier" y "On-Premise Tier"), cada una conteniendo **≥3 sub-cajas**.
- **🚨 SEPARA LAS DOS ZONAS HORIZONTALMENTE con ≥60pt de espacio vacío entre ellas** (el borde derecho de la zona izquierda y el borde izquierdo de la zona derecha). Ese carril vacío es por donde pasan las flechas inter-zona.
- Dentro de cada zona, apila las sub-cajas en columna con ≥18pt de separación vertical, y aplica la misma regla del contenedor que en FIG.1: dibuja el dashed con ≥20pt de margen alrededor de sus sub-cajas (calcula coords de las cajas primero).
- **MÍNIMO 8 cajas total** distribuidas entre las zones.
- **MÍNIMO 2 `draw_cylinder`** para storages.
- **🚨 LAS FLECHAS NUNCA CRUZAN POR ENCIMA DE UNA CAJA NI DE UN CILINDRO.** Conecta una caja de la zona izquierda con una de la derecha trazando la flecha por el carril vacío central, a una altura Y donde no haya cajas en medio. Sale del borde DERECHO de la caja origen y entra al borde IZQUIERDO de la caja destino.
- **MÍNIMO 5 flechas** inter-zone, cada una etiquetada con el tipo de tráfico ("HTTPS", "LTI 1.3", "sync", etc.). **La etiqueta va en el punto medio de la flecha, dentro del carril vacío central — NUNCA encima de una caja.** Pon la etiqueta ~8pt por encima de la línea de la flecha.
- Ninguna flecha sale al borde de la página sin destino.
""",
    },
]

NUM_FIGURES = len(FIGURE_SPECS)


def build_figure_prompt(spec: dict) -> str:
    """Compose the full system prompt for one figure."""
    return (
        _PROMPT_HEADER
        + spec["requirements"].replace("{N}", str(spec["n"])).replace("{CAPTION}", spec["caption"])
        + _PROMPT_FOOTER
    )


# ---------------------------------------------------------------------------
# LLM call (Claude Opus 4.7 → GPT-4o fallback) for a single figure
# ---------------------------------------------------------------------------

_OR_URL = "https://openrouter.ai/api/v1/chat/completions"


async def _call_llm(system_prompt: str, user_message: str, openai_client) -> Optional[str]:
    """Claude Opus 4.7 (OpenRouter) → GPT-4o (OpenAI) → GPT-4o (OpenRouter)."""
    import httpx

    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    # 1) Claude Opus 4.7 via OpenRouter
    if openrouter_key:
        try:
            async with httpx.AsyncClient(timeout=180.0) as cli:
                r = await cli.post(
                    _OR_URL,
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://redaccion.urpeintegralservices.co",
                        "X-Title": "SmartDocs - Patent Figure",
                    },
                    json={
                        "model": "anthropic/claude-opus-4.7",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.25,
                        "max_tokens": 8000,
                    },
                )
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
            logger.warning("Claude figure call HTTP %s: %s", r.status_code, r.text[:150])
        except Exception as e:
            logger.warning("Claude figure call raised %s: %s", type(e).__name__, e)

    # 2) GPT-4o direct
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.25,
            max_tokens=8000,
        )
        return resp.choices[0].message.content
    except Exception as e:
        logger.warning("GPT-4o figure call raised %s: %s", type(e).__name__, e)

    # 3) GPT-4o via OpenRouter
    if openrouter_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=180.0) as cli:
                r = await cli.post(
                    _OR_URL,
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "openai/gpt-4o",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.25,
                        "max_tokens": 8000,
                    },
                )
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("OpenRouter GPT-4o figure call raised %s: %s", type(e).__name__, e)

    return None


def _extract_python(text: str) -> str:
    import re
    s = text or ""
    m = re.search(r"```python\s*\n(.*?)```", s, re.DOTALL)
    if not m:
        m = re.search(r"```\s*\n(.*?)```", s, re.DOTALL)
    code = (m.group(1) if m else s).strip()
    if "from patent_diagram_helpers" not in code:
        raise DiagramScriptError("response lacks a patent_diagram_helpers script")
    return code


# ---------------------------------------------------------------------------
# Generate ONE figure: LLM → validate → execute → PNG
# ---------------------------------------------------------------------------

async def _get_valid_script(
    system_prompt: str, user_message: str, openai_client
) -> Tuple[Optional[str], str]:
    """Call the LLM and return (script, ""), retrying once if the AST validator
    rejects it. Returns (None, error_msg) on failure."""
    raw = await _call_llm(system_prompt, user_message, openai_client)
    if not raw:
        return (None, "LLM no devolvió contenido")
    try:
        script = _extract_python(raw)
        validate_script(script)
        return (script, "")
    except DiagramScriptError as e:
        retry_msg = (
            f"{user_message}\n\n🚨 Tu script fue rechazado por el validador: {e}\n"
            "Reescríbelo respetando las restricciones. SOLO el bloque ```python```."
        )
        raw2 = await _call_llm(system_prompt, retry_msg, openai_client)
        if not raw2:
            return (None, f"validación falló y retry vacío: {e}")
        try:
            script = _extract_python(raw2)
            validate_script(script)
            return (script, "")
        except DiagramScriptError as e2:
            return (None, f"validación falló tras retry: {e2}")


def _layout_feedback(issues: List[str]) -> str:
    """Build a corrective message listing concrete layout problems."""
    bullet = "\n".join(f"  - {it}" for it in issues)
    return (
        "\n\n🚨 La figura anterior tiene PROBLEMAS DE DISPOSICIÓN (cajas que se "
        "solapan o que se salen del área dibujable). Corrígelos y vuelve a "
        "generar el script COMPLETO:\n"
        f"{bullet}\n\n"
        "REGLAS para evitarlo:\n"
        "  - Calcula primero las coordenadas de TODAS las cajas en una grilla "
        "mental; deja ≥18pt de separación entre cajas y ≥20pt entre una caja y "
        "el borde de su contenedor dashed.\n"
        "  - Mantén TODO dentro del área dibujable (x entre 54 y page_w-54; "
        "y entre 72 y page_h-54). Reduce el ancho/alto de las cajas o usa menos "
        "columnas si no caben.\n"
        "  - NINGUNA caja debe solaparse con otra. Las flechas/etiquetas van en "
        "los espacios LIBRES entre cajas, no encima de ellas.\n"
        "Devuelve SOLO el bloque ```python```."
    )


async def generate_one_figure(
    spec: dict,
    patent_text: str,
    title: str,
    openai_client,
    timeout_s: int = 120,
) -> Tuple[int, Optional[bytes], str]:
    """
    Returns (fig_number, png_bytes_or_None, status_msg). Never raises — a
    failure for one figure must not abort the others.

    After each render the recorded layout is checked for overlapping boxes and
    out-of-margin boxes; if any are found the figure is regenerated (up to
    MAX_LAYOUT_RETRIES times) feeding the concrete problems back to the LLM. If
    every attempt still has minor issues, the cleanest render is returned rather
    than failing the figure outright.
    """
    n = spec["n"]
    system_prompt = build_figure_prompt(spec)
    base_message = (
        f"Genera el script Python para la FIG. {n} ({spec['title']}) de esta patente.\n\n"
        f"TÍTULO: {title}\n\n{patent_text}"
    )

    best_png: Optional[bytes] = None
    best_issue_count = 10 ** 9
    feedback = ""
    last_status = "sin intentos"

    for attempt in range(MAX_LAYOUT_RETRIES + 1):
        script, err = await _get_valid_script(
            system_prompt, base_message + feedback, openai_client
        )
        if not script:
            last_status = err
            break  # validation failures won't fix themselves with layout feedback

        try:
            pngs, layout = await asyncio.to_thread(
                render_python_diagram_script_with_layout, script, 150, timeout_s
            )
        except DiagramScriptError as e:
            last_status = f"ejecución falló: {str(e)[:280]}"
            break
        except Exception as e:
            last_status = f"error inesperado: {type(e).__name__}: {str(e)[:180]}"
            break

        if not pngs:
            last_status = "script no produjo PNG"
            break

        issues = analyze_layout(layout)
        if not issues:
            return (n, pngs[0], "ok" if attempt == 0 else f"ok tras {attempt} reintento(s) de layout")

        # Keep the cleanest attempt seen so far as a fallback.
        if len(issues) < best_issue_count:
            best_issue_count = len(issues)
            best_png = pngs[0]

        logger.info("FIG. %d intento %d: %d problema(s) de layout", n, attempt + 1, len(issues))
        feedback = _layout_feedback(issues)
        last_status = f"layout con {len(issues)} aviso(s)"

    if best_png is not None:
        # Return the best-looking render even if it still has minor issues — a
        # slightly imperfect figure beats a missing one.
        return (n, best_png, f"ok con avisos de layout ({best_issue_count})")

    return (n, None, last_status)


# ---------------------------------------------------------------------------
# Orchestrate all 6 (or a subset) in parallel
# ---------------------------------------------------------------------------

def _wrap_png(n: int, png: bytes) -> str:
    b64 = base64.b64encode(png).decode("ascii")
    return (
        '<div class="diagram-container" style="text-align: center; margin: 20px auto;">'
        f'<img src="data:image/png;base64,{b64}" alt="FIG. {n}" style="max-width: 100%;"/>'
        "</div>"
    )


async def generate_figures_parallel(
    patent_text: str,
    title: str,
    openai_client,
    only: Optional[List[int]] = None,
) -> Tuple[str, int, int, Dict[int, str]]:
    """
    Generate figures concurrently. `only` optionally restricts to a subset of
    figure numbers (e.g. [3] to retry just FIG. 3).

    Returns:
      combined_html : the ---DIAGRAM_SEPARATOR---joined <div> blocks (ordered)
      n_ok          : how many figures rendered successfully
      n_total       : how many were attempted
      per_figure    : {fig_number: status_msg}
    """
    specs = [s for s in FIGURE_SPECS if (only is None or s["n"] in only)]
    results = await asyncio.gather(
        *[generate_one_figure(s, patent_text, title, openai_client) for s in specs]
    )

    # results is a list of (n, png|None, status); keep order by figure number
    results.sort(key=lambda t: t[0])
    blocks: List[str] = []
    per_figure: Dict[int, str] = {}
    n_ok = 0
    for n, png, status in results:
        per_figure[n] = status
        if png is not None:
            blocks.append(_wrap_png(n, png))
            n_ok += 1
        else:
            logger.warning("FIG. %d failed: %s", n, status)

    combined = "\n---DIAGRAM_SEPARATOR---\n".join(blocks)
    logger.info(
        "Parallel diagram generation: %d/%d figures OK", n_ok, len(specs)
    )
    return combined, n_ok, len(specs), per_figure


__all__ = [
    "FIGURE_SPECS",
    "NUM_FIGURES",
    "build_figure_prompt",
    "generate_one_figure",
    "generate_figures_parallel",
]
