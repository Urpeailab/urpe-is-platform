"""
Patent diagram drawing helpers for USPTO-quality black & white figures.

Designed to be imported by short Python scripts that Claude generates per
patent. Each script does:

    from patent_diagram_helpers import *

    def draw_fig1(c): ...
    def draw_fig2(c): ...
    ...

    c = new_canvas("patent_diagrams.pdf")
    draw_fig1(c); c.showPage()
    draw_fig2(c); c.showPage()
    ...
    c.save()

All coordinates are in PDF points (1pt = 1/72 in). Origin is bottom-left.

The helpers are deliberately small, deterministic, and side-effect-free except
for drawing onto the supplied canvas. They never touch the filesystem, network,
or environment, so they are safe to call from a sandboxed subprocess.
"""

from __future__ import annotations

import math
from typing import Iterable, List, Optional, Sequence, Tuple

from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as _canvas


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

LINE_W = 1.0
LINE_W_THIN = 0.7

PAGE_PORTRAIT = letter                # (612, 792)
PAGE_LANDSCAPE = landscape(letter)    # (792, 612)

# Page margins inside which figures should be drawn
MARGIN_LEFT = 54
MARGIN_RIGHT = 54
MARGIN_TOP = 54
MARGIN_BOTTOM = 72   # leave room for FIG label/caption


# ---------------------------------------------------------------------------
# Layout registry (for post-render validation by the runner)
# ---------------------------------------------------------------------------
# Every component primitive records its bounding box here so the runner can
# detect out-of-margin or overlapping boxes after the figure is drawn and ask
# the LLM to regenerate it. `container=True` marks dashed grouping boxes, which
# are EXPECTED to overlap the solid boxes they enclose (so they are excluded
# from the overlap check, but still checked for page bounds).
_LAYOUT = {"page_w": None, "page_h": None, "elements": []}


def reset_layout() -> None:
    """Clear recorded elements (called automatically by setup_page)."""
    _LAYOUT["elements"] = []


def _record(kind: str, x: float, y: float, w: float, h: float,
            container: bool = False, label: str = "") -> None:
    """Record a drawn component's bounding box for layout validation."""
    try:
        _LAYOUT["elements"].append({
            "kind": kind,
            "container": bool(container),
            "x": float(x), "y": float(y), "w": float(w), "h": float(h),
            "label": (str(label) or "")[:48],
        })
    except Exception:
        pass


def dump_layout(path: str) -> None:
    """Write the recorded layout to `path` as JSON (best-effort)."""
    try:
        import json
        with open(path, "w", encoding="utf-8") as f:
            json.dump(_LAYOUT, f)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Canvas / page setup
# ---------------------------------------------------------------------------

def new_canvas(path: str):
    """Create a US-Letter portrait canvas at `path`."""
    return _canvas.Canvas(path, pagesize=PAGE_PORTRAIT)


def setup_page(c, fig_label: str, fig_caption: str = "",
               page_landscape: bool = False) -> Tuple[float, float]:
    """
    Set page orientation, draw the FIG label centered at the top and the
    caption centered at the bottom. Returns (page_width, page_height).

    Call once at the start of each draw_figN(c) function.
    """
    size = PAGE_LANDSCAPE if page_landscape else PAGE_PORTRAIT
    c.setPageSize(size)
    page_w, page_h = size

    # Reset the layout registry for this figure and record the page size so the
    # runner can validate bounds/overlaps after the figure is fully drawn.
    _LAYOUT["page_w"] = float(page_w)
    _LAYOUT["page_h"] = float(page_h)
    reset_layout()

    # FIG label (top, bold, centered)
    if fig_label:
        c.setFont(FONT_BOLD, 12)
        c.drawCentredString(page_w / 2.0, page_h - 36, fig_label)

    # Caption (bottom, regular, centered, wrapped if too long)
    if fig_caption:
        c.setFont(FONT, 9)
        max_w = page_w - MARGIN_LEFT - MARGIN_RIGHT
        lines = wrap_text(fig_caption, max_w, FONT, 9)
        y = 36 + (len(lines) - 1) * 11
        for line in lines:
            c.drawCentredString(page_w / 2.0, y, line)
            y -= 11

    # Reset stroke defaults so callers don't inherit unexpected state
    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0, 0, 0)
    c.setLineWidth(LINE_W)
    return page_w, page_h


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _string_width(text: str, font_name: str, font_size: float) -> float:
    return pdfmetrics.stringWidth(text, font_name, font_size)


def wrap_text(text: str, max_width: float, font_name: str = FONT,
              font_size: float = 9) -> List[str]:
    """
    Greedy word-wrap that returns a list of lines, each fitting within
    `max_width` points when rendered in (font_name, font_size). Preserves
    explicit "\\n" line breaks in the input.
    """
    if not text:
        return [""]

    out: List[str] = []
    for paragraph in str(text).split("\n"):
        words = paragraph.split()
        if not words:
            out.append("")
            continue
        line = words[0]
        for w in words[1:]:
            candidate = line + " " + w
            if _string_width(candidate, font_name, font_size) <= max_width:
                line = candidate
            else:
                out.append(line)
                line = w
        out.append(line)
    return out


def _draw_centered_lines(c, lines: Sequence[str], cx: float, cy: float,
                         font_name: str, font_size: float,
                         line_gap: float = 1.15) -> None:
    """Draw lines centered horizontally around `cx`, vertically around `cy`."""
    c.setFont(font_name, font_size)
    total_h = (len(lines) - 1) * font_size * line_gap
    y = cy + total_h / 2.0
    for line in lines:
        c.drawCentredString(cx, y - font_size * 0.35, line)
        y -= font_size * line_gap


# ---------------------------------------------------------------------------
# Box / shape primitives
# ---------------------------------------------------------------------------

def draw_box(c, x: float, y: float, w: float, h: float,
             label: str = "", ref_num: Optional[str] = None,
             font_size: float = 8, bold: bool = False,
             ref_pos: str = "above") -> None:
    """
    Draw a rectangle at (x, y) with size (w, h) and write `label` centered
    inside (multi-line wrapped). If `ref_num` is given, render it as the
    USPTO-style reference numeral.

    ref_pos: "above" | "below" | "left" | "right" | "tl" | "tr" | "br" | "bl"
    """
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    c.rect(x, y, w, h, stroke=1, fill=0)
    _record("box", x, y, w, h, label=label)

    font_name = FONT_BOLD if bold else FONT
    if label:
        pad = 4
        lines = wrap_text(label, w - pad * 2, font_name, font_size)
        _draw_centered_lines(c, lines, x + w / 2.0, y + h / 2.0,
                             font_name, font_size)

    if ref_num is not None and str(ref_num) != "":
        _draw_ref_num(c, str(ref_num), x, y, w, h, ref_pos)


def _draw_ref_num(c, ref: str, x: float, y: float, w: float, h: float,
                  pos: str) -> None:
    """Render a reference numeral near a box at the requested anchor."""
    c.setFont(FONT_BOLD, 9)
    gap = 6
    if pos == "above":
        c.drawCentredString(x + w / 2.0, y + h + gap, ref)
    elif pos == "below":
        c.drawCentredString(x + w / 2.0, y - gap - 8, ref)
    elif pos == "left":
        c.drawRightString(x - gap, y + h / 2.0 - 3, ref)
    elif pos == "right":
        c.drawString(x + w + gap, y + h / 2.0 - 3, ref)
    elif pos == "tl":
        c.drawString(x - gap - _string_width(ref, FONT_BOLD, 9), y + h - 9, ref)
    elif pos == "tr":
        c.drawString(x + w + gap, y + h - 9, ref)
    elif pos == "bl":
        c.drawString(x - gap - _string_width(ref, FONT_BOLD, 9), y + 1, ref)
    elif pos == "br":
        c.drawString(x + w + gap, y + 1, ref)
    else:
        c.drawCentredString(x + w / 2.0, y + h + gap, ref)


def draw_dashed_box(c, x: float, y: float, w: float, h: float,
                    label: Optional[str] = None,
                    ref_num: Optional[str] = None,
                    font_size: float = 9,
                    label_at: str = "tl") -> None:
    """
    Draw a dashed-border container (useful for tier/zone boundaries). The
    label is drawn just inside the chosen corner so it doesn't sit on the
    border line.

    label_at: "tl" | "tr" | "bl" | "br" | "tc" (top center) | "bc"
    """
    c.saveState()
    c.setLineWidth(LINE_W_THIN)
    c.setStrokeColorRGB(0, 0, 0)
    c.setDash(4, 3)
    c.rect(x, y, w, h, stroke=1, fill=0)
    _record("dashed_box", x, y, w, h, container=True, label=label or "")
    c.setDash()  # reset
    c.restoreState()

    if label:
        c.setFont(FONT_BOLD, font_size)
        pad = 6
        if label_at == "tl":
            c.drawString(x + pad, y + h - font_size - 2, label)
        elif label_at == "tr":
            c.drawRightString(x + w - pad, y + h - font_size - 2, label)
        elif label_at == "bl":
            c.drawString(x + pad, y + 4, label)
        elif label_at == "br":
            c.drawRightString(x + w - pad, y + 4, label)
        elif label_at == "tc":
            c.drawCentredString(x + w / 2.0, y + h - font_size - 2, label)
        elif label_at == "bc":
            c.drawCentredString(x + w / 2.0, y + 4, label)
        else:
            c.drawString(x + pad, y + h - font_size - 2, label)

    if ref_num is not None and str(ref_num) != "":
        _draw_ref_num(c, str(ref_num), x, y, w, h, "tr")


def draw_oval(c, cx: float, cy: float, w: float, h: float,
              label: str = "", ref_num: Optional[str] = None,
              font_size: float = 10) -> None:
    """Ellipse centered at (cx, cy) with given width and height."""
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    c.ellipse(cx - w / 2.0, cy - h / 2.0, cx + w / 2.0, cy + h / 2.0,
              stroke=1, fill=0)
    _record("oval", cx - w / 2.0, cy - h / 2.0, w, h, label=label)

    if label:
        pad = 6
        lines = wrap_text(label, w - pad * 2, FONT, font_size)
        _draw_centered_lines(c, lines, cx, cy, FONT, font_size)

    if ref_num is not None and str(ref_num) != "":
        c.setFont(FONT_BOLD, 9)
        c.drawCentredString(cx, cy + h / 2.0 + 6, str(ref_num))


def draw_cylinder(c, x: float, y: float, w: float, h: float,
                  label: str = "", ref_num: Optional[str] = None,
                  font_size: float = 8, ref_pos: str = "above") -> None:
    """
    Database-style cylinder: top ellipse + side walls + bottom half-ellipse.
    (x, y) is the bottom-left of the bounding box; (w, h) is the bounding
    box size.
    """
    ellipse_h = min(h * 0.20, 16)
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    _record("cylinder", x, y, w, h, label=label)

    # Top ellipse
    c.ellipse(x, y + h - ellipse_h, x + w, y + h, stroke=1, fill=0)
    # Side walls
    c.line(x, y + h - ellipse_h / 2.0, x, y + ellipse_h / 2.0)
    c.line(x + w, y + h - ellipse_h / 2.0, x + w, y + ellipse_h / 2.0)
    # Bottom half-ellipse (front arc only)
    c.arc(x, y, x + w, y + ellipse_h, startAng=180, extent=180)

    if label:
        pad = 6
        lines = wrap_text(label, w - pad * 2, FONT, font_size)
        # Center vertically inside the cylindrical body (below top ellipse)
        body_top = y + h - ellipse_h
        body_bot = y + ellipse_h / 2.0
        _draw_centered_lines(c, lines, x + w / 2.0, (body_top + body_bot) / 2.0,
                             FONT, font_size)

    if ref_num is not None and str(ref_num) != "":
        _draw_ref_num(c, str(ref_num), x, y, w, h, ref_pos)


# ---------------------------------------------------------------------------
# Arrows
# ---------------------------------------------------------------------------

def _draw_arrow_head(c, x_from: float, y_from: float,
                     x_to: float, y_to: float, head_size: float = 6) -> None:
    """Draw a filled triangular arrow head at (x_to, y_to) pointing along
    the (from -> to) direction."""
    dx = x_to - x_from
    dy = y_to - y_from
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux, uy = dx / length, dy / length        # unit vector
    px, py = -uy, ux                          # perpendicular

    base_x = x_to - ux * head_size
    base_y = y_to - uy * head_size
    left_x = base_x + px * (head_size * 0.55)
    left_y = base_y + py * (head_size * 0.55)
    right_x = base_x - px * (head_size * 0.55)
    right_y = base_y - py * (head_size * 0.55)

    p = c.beginPath()
    p.moveTo(x_to, y_to)
    p.lineTo(left_x, left_y)
    p.lineTo(right_x, right_y)
    p.close()
    c.setFillColorRGB(0, 0, 0)
    c.drawPath(p, stroke=0, fill=1)


def draw_arrow(c, x1: float, y1: float, x2: float, y2: float,
               head_size: float = 6, dashed: bool = False) -> None:
    """Straight arrow from (x1, y1) to (x2, y2)."""
    c.saveState()
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    if dashed:
        c.setDash(4, 3)
    # Shorten the line slightly so the head sits cleanly at the endpoint
    length = math.hypot(x2 - x1, y2 - y1)
    if length > head_size:
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        tip_x = x2 - ux * (head_size * 0.6)
        tip_y = y2 - uy * (head_size * 0.6)
        c.line(x1, y1, tip_x, tip_y)
    else:
        c.line(x1, y1, x2, y2)
    if dashed:
        c.setDash()
    c.restoreState()
    _draw_arrow_head(c, x1, y1, x2, y2, head_size)


def draw_arrow_path(c, points: Sequence[Tuple[float, float]],
                    dashed: bool = False, head_size: float = 6) -> None:
    """
    Polyline arrow through `points` (>=2). The head is placed at the final
    point, pointing along the last segment.
    """
    if len(points) < 2:
        return
    c.saveState()
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    if dashed:
        c.setDash(4, 3)

    # Walk through all but the last segment as plain lines, then shorten
    # the final segment for the arrow head.
    last_x, last_y = points[-1]
    prev_x, prev_y = points[-2]
    length = math.hypot(last_x - prev_x, last_y - prev_y)
    if length > head_size:
        ux, uy = (last_x - prev_x) / length, (last_y - prev_y) / length
        tip_x = last_x - ux * (head_size * 0.6)
        tip_y = last_y - uy * (head_size * 0.6)
    else:
        tip_x, tip_y = last_x, last_y

    p = c.beginPath()
    p.moveTo(*points[0])
    for px, py in points[1:-1]:
        p.lineTo(px, py)
    p.lineTo(tip_x, tip_y)
    c.drawPath(p, stroke=1, fill=0)

    if dashed:
        c.setDash()
    c.restoreState()
    _draw_arrow_head(c, prev_x, prev_y, last_x, last_y, head_size)


# ---------------------------------------------------------------------------
# Hatching / fills (for heatmaps, intensity blocks, etc.)
# ---------------------------------------------------------------------------

def draw_hatched_box(c, x: float, y: float, w: float, h: float,
                     density: str = "medium", angle_deg: float = 45.0) -> None:
    """
    Draw a rectangle filled with diagonal hatch lines. `density` is
    "light" | "medium" | "heavy" — controls line spacing.

    Useful for heatmap cells, sensitivity zones, signal-strength regions.
    """
    spacing = {"light": 6.0, "medium": 3.5, "heavy": 2.0}.get(density, 3.5)
    _record("hatched_box", x, y, w, h)
    c.saveState()
    c.rect(x, y, w, h, stroke=1, fill=0)
    p = c.beginPath()
    # Clip to the rectangle
    c.rect(x, y, w, h, stroke=0, fill=0)
    # Walk diagonals across the bounding box
    angle = math.radians(angle_deg)
    dx = math.cos(angle)
    dy = math.sin(angle)
    # Use parameter t to sweep one corner to the opposite
    diag = math.hypot(w, h)
    n = int(diag / spacing) + 2
    c.setLineWidth(LINE_W_THIN)
    for i in range(-n, n + 1):
        # Line offset along the perpendicular direction
        offset = i * spacing
        # Pick two intersection points with the rectangle's bounding box
        # by using a long line and clipping with simple bounds checks.
        cx = x + w / 2.0 + offset * (-dy)
        cy = y + h / 2.0 + offset * (dx)
        x1 = cx - dx * diag
        y1 = cy - dy * diag
        x2 = cx + dx * diag
        y2 = cy + dy * diag
        # Crude clip to the box
        clipped = _clip_line_to_rect(x1, y1, x2, y2, x, y, x + w, y + h)
        if clipped is not None:
            a, b, e, f = clipped
            c.line(a, b, e, f)
    c.restoreState()


def _clip_line_to_rect(x1, y1, x2, y2, xmin, ymin, xmax, ymax):
    """Liang-Barsky line clipping. Returns clipped segment or None."""
    dx = x2 - x1
    dy = y2 - y1
    p = [-dx, dx, -dy, dy]
    q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1]
    u1, u2 = 0.0, 1.0
    for pi, qi in zip(p, q):
        if pi == 0:
            if qi < 0:
                return None
        else:
            t = qi / pi
            if pi < 0:
                if t > u2:
                    return None
                if t > u1:
                    u1 = t
            else:
                if t < u1:
                    return None
                if t < u2:
                    u2 = t
    return (x1 + u1 * dx, y1 + u1 * dy, x1 + u2 * dx, y1 + u2 * dy)


# ---------------------------------------------------------------------------
# ERD helpers (entity-relationship diagrams)
# ---------------------------------------------------------------------------

def draw_entity(c, x: float, y: float, w: float,
                title: str, fields: Sequence[str],
                ref_num: Optional[str] = None,
                row_h: float = 12, title_h: float = 16) -> float:
    """
    Draw a labeled entity (table) for an ERD. Returns the total height
    of the entity box so callers can lay out arrows.

    `fields` is a sequence of strings. Conventional notation:
      "PK id"  - primary key
      "FK user_id"  - foreign key
      "name"  - regular attribute
    """
    h = title_h + row_h * len(fields)
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    _record("entity", x, y, w, h, label=title)
    # Outer box
    c.rect(x, y, w, h, stroke=1, fill=0)
    # Title bar
    c.line(x, y + h - title_h, x + w, y + h - title_h)
    c.setFont(FONT_BOLD, 9)
    c.drawCentredString(x + w / 2.0, y + h - title_h + 4, title)

    # Field rows
    c.setFont(FONT, 8)
    for i, field in enumerate(fields):
        row_y = y + h - title_h - row_h * (i + 1)
        c.drawString(x + 6, row_y + 3, field)

    if ref_num is not None and str(ref_num) != "":
        _draw_ref_num(c, str(ref_num), x, y, w, h, "above")
    return h


def draw_rel(c, x1: float, y1: float, x2: float, y2: float,
             label: str = "", left_card: str = "",
             right_card: str = "", dashed: bool = False) -> None:
    """
    Draw a relationship line between two entities with optional cardinality
    markers at the ends and an optional centered label.

    Cardinality strings are drawn literally near each endpoint, e.g.
    "1", "N", "1..*", "0..1".
    """
    c.saveState()
    c.setLineWidth(LINE_W_THIN)
    c.setStrokeColorRGB(0, 0, 0)
    if dashed:
        c.setDash(3, 3)
    c.line(x1, y1, x2, y2)
    if dashed:
        c.setDash()
    c.restoreState()

    if left_card:
        c.setFont(FONT, 8)
        c.drawString(x1 + 3, y1 + 3, left_card)
    if right_card:
        c.setFont(FONT, 8)
        c.drawRightString(x2 - 3, y2 + 3, right_card)
    if label:
        c.setFont(FONT, 8)
        c.drawCentredString((x1 + x2) / 2.0, (y1 + y2) / 2.0 + 3, label)


# ---------------------------------------------------------------------------
# Small grid / chart primitives (axes, ticks)
# ---------------------------------------------------------------------------

def draw_axes(c, x: float, y: float, w: float, h: float,
              x_label: str = "", y_label: str = "",
              x_ticks: Iterable[Tuple[float, str]] = (),
              y_ticks: Iterable[Tuple[float, str]] = ()) -> None:
    """
    Draw simple L-shaped axes inside the rectangle (x, y, w, h).
    Tick lists are pairs (fraction_0_to_1, label).
    """
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    c.line(x, y, x + w, y)        # x-axis
    c.line(x, y, x, y + h)        # y-axis

    c.setFont(FONT, 7)
    for frac, label in x_ticks:
        tx = x + w * frac
        c.line(tx, y, tx, y - 3)
        c.drawCentredString(tx, y - 11, str(label))
    for frac, label in y_ticks:
        ty = y + h * frac
        c.line(x, ty, x - 3, ty)
        c.drawRightString(x - 5, ty - 2, str(label))

    if x_label:
        c.setFont(FONT, 8)
        c.drawCentredString(x + w / 2.0, y - 22, x_label)
    if y_label:
        c.saveState()
        c.translate(x - 22, y + h / 2.0)
        c.rotate(90)
        c.setFont(FONT, 8)
        c.drawCentredString(0, 0, y_label)
        c.restoreState()


def draw_polyline(c, points: Sequence[Tuple[float, float]],
                  dashed: bool = False) -> None:
    """Draw a polyline through `points` (no arrow head)."""
    if len(points) < 2:
        return
    c.saveState()
    c.setLineWidth(LINE_W)
    c.setStrokeColorRGB(0, 0, 0)
    if dashed:
        c.setDash(4, 3)
    p = c.beginPath()
    p.moveTo(*points[0])
    for px, py in points[1:]:
        p.lineTo(px, py)
    c.drawPath(p, stroke=1, fill=0)
    if dashed:
        c.setDash()
    c.restoreState()


__all__ = [
    "FONT", "FONT_BOLD", "LINE_W", "LINE_W_THIN",
    "PAGE_PORTRAIT", "PAGE_LANDSCAPE",
    "MARGIN_LEFT", "MARGIN_RIGHT", "MARGIN_TOP", "MARGIN_BOTTOM",
    "new_canvas", "setup_page", "wrap_text",
    "draw_box", "draw_dashed_box", "draw_oval", "draw_cylinder",
    "draw_arrow", "draw_arrow_path",
    "draw_hatched_box",
    "draw_entity", "draw_rel",
    "draw_axes", "draw_polyline",
]
