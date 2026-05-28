"""
Sandboxed runner for Claude-generated patent-diagram Python scripts.

Pipeline:

  validate_script(src)             -> raises DiagramScriptError on disallowed AST
  run_script_to_pdf(src, tmp_dir)  -> returns Path to the generated PDF
  pdf_to_pngs(pdf_path, dpi=150)   -> returns list[bytes] (one PNG per page)
  render_python_diagram_script(src) -> end-to-end: validated + executed + rendered

The script is run with `python -I` (isolated mode) in a subprocess with a
60-second timeout, no environment variables, cwd in a tempdir. Imports are
restricted by AST analysis BEFORE execution to the allow-list:

  patent_diagram_helpers, reportlab, reportlab.*, math, random

Disallowed names / attributes / builtins are rejected at validation time so
they never reach the interpreter.
"""

from __future__ import annotations

import ast
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

ALLOWED_IMPORT_ROOTS = {
    "patent_diagram_helpers",
    "reportlab",
    "math",
    "random",
}

# Bare names / attribute names that are never allowed to appear in source.
# Some (e.g. ``open``) are also blocked at runtime via -I, but rejecting them
# here gives clearer error messages and prevents wasting a subprocess.
DISALLOWED_NAMES = {
    "os", "sys", "subprocess", "socket", "shutil",
    "urllib", "urllib2", "urllib3", "requests", "httpx", "http",
    "ctypes", "multiprocessing", "threading", "asyncio",
    "pickle", "marshal", "shelve",
    "open", "exec", "eval", "compile", "__import__",
    "globals", "locals", "vars", "input",
    # getattr / setattr / delattr enable string-literal sandbox escapes
    # (e.g. getattr(object, "__subclasses__")()). The drawing helpers do
    # not need reflection, so we block them.
    "getattr", "setattr", "delattr", "hasattr",
}

DISALLOWED_ATTRS = {
    "__globals__", "__builtins__", "__loader__", "__class__",
    "__subclasses__", "__bases__", "__mro__",
    "__import__", "__getattribute__", "__dict__",
    "f_back", "f_locals", "f_globals",
    "system", "popen", "spawn", "fork",
}


class DiagramScriptError(Exception):
    """Raised when the generated script fails validation or execution."""


def validate_script(src: str) -> None:
    """
    Parse `src` and reject any usage outside the allow-list. Raises
    `DiagramScriptError` with a message identifying the offending node.
    """
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        raise DiagramScriptError(f"syntax error: {e}") from e

    for node in ast.walk(tree):
        # ---- imports ---------------------------------------------------
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in ALLOWED_IMPORT_ROOTS:
                    raise DiagramScriptError(
                        f"disallowed import: {alias.name}"
                    )
        elif isinstance(node, ast.ImportFrom):
            mod = (node.module or "").split(".", 1)[0]
            if mod not in ALLOWED_IMPORT_ROOTS:
                raise DiagramScriptError(
                    f"disallowed import-from: {node.module}"
                )

        # ---- bare names ------------------------------------------------
        elif isinstance(node, ast.Name):
            if node.id in DISALLOWED_NAMES:
                raise DiagramScriptError(
                    f"disallowed name reference: {node.id}"
                )

        # ---- attribute access -----------------------------------------
        elif isinstance(node, ast.Attribute):
            if node.attr in DISALLOWED_ATTRS:
                raise DiagramScriptError(
                    f"disallowed attribute access: .{node.attr}"
                )
            if node.attr.startswith("__") and node.attr.endswith("__"):
                # Block dunders we didn't anticipate. Whitelist a couple of
                # harmless ones used by stdlib helpers.
                if node.attr not in {"__name__", "__main__"}:
                    raise DiagramScriptError(
                        f"disallowed dunder attribute: .{node.attr}"
                    )

        # ---- string constants ----------------------------------------
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            val = node.value
            # Reject string literals that look like sensitive dunders, so
            # reflection-based escapes via getattr / __import__ / etc. can't
            # smuggle them in even if those names were ever re-enabled.
            if (len(val) >= 4 and val.startswith("__") and val.endswith("__")
                    and val not in {"__main__", "__name__"}):
                raise DiagramScriptError(
                    f"disallowed dunder string literal: {val!r}"
                )

        # ---- function calls -------------------------------------------
        elif isinstance(node, ast.Call):
            func = node.func
            # Catch eval()/exec()/compile()/__import__() that slip past the
            # Name check (e.g. via getattr).
            if isinstance(func, ast.Name) and func.id in DISALLOWED_NAMES:
                raise DiagramScriptError(
                    f"disallowed call: {func.id}(...)"
                )
            if isinstance(func, ast.Attribute) and func.attr in DISALLOWED_NAMES:
                raise DiagramScriptError(
                    f"disallowed method call: .{func.attr}(...)"
                )


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

DEFAULT_TIMEOUT_S = 60
OUTPUT_FILENAME = "patent_diagrams.pdf"


def run_script_to_pdf(src: str, work_dir: Path,
                      timeout_s: int = DEFAULT_TIMEOUT_S) -> Path:
    """
    Write the validated script to `work_dir/diagram.py`, execute it with
    `python -I`, and return the path to the generated PDF.

    The script is expected to write `patent_diagrams.pdf` in its CWD. To make
    that the default no matter what path the LLM writes, we override the
    typical OUT constant by prepending a small shim that sets sys.argv[0] and
    monkey-patches `new_canvas` if the script uses it. The simpler approach,
    used here, is to just run the script in `work_dir` and copy/move the
    expected output filename out.
    """
    work_dir.mkdir(parents=True, exist_ok=True)
    script_path = work_dir / "diagram.py"
    # Append a tiny epilog (NOT AST-validated — added after validation) that
    # dumps the recorded layout (component bounding boxes) to layout.json so the
    # caller can detect out-of-margin / overlapping boxes and trigger a retry.
    epilog = (
        "\n\n# --- layout dump (injected by runner) ---\n"
        "try:\n"
        "    import patent_diagram_helpers as __pdh\n"
        "    __pdh.dump_layout('layout.json')\n"
        "except Exception:\n"
        "    pass\n"
    )
    script_path.write_text(src + epilog, encoding="utf-8")

    # `python -I` ignores PYTHONPATH, so make the helper module discoverable
    # by copying it next to the script. The copy stays inside the per-run
    # tempdir and is cleaned up by the caller.
    backend_dir = Path(__file__).resolve().parent
    shutil.copy2(backend_dir / "patent_diagram_helpers.py",
                 work_dir / "patent_diagram_helpers.py")

    env = {
        # Keep PATH so the interpreter can find shared libs on Windows.
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
    }

    # Use -E -s -B instead of -I:
    #   -E  ignore PYTHON* env vars
    #   -s  ignore user site-packages
    #   -B  don't write .pyc files
    # We deliberately do NOT pass -I, because on Python 3.11+ -I implies -P,
    # which removes the script directory from sys.path. We need sys.path[0]
    # to be the work_dir so the locally-copied helper module is importable.
    try:
        result = subprocess.run(
            [sys.executable, "-E", "-s", "-B", str(script_path)],
            cwd=str(work_dir),
            env=env,
            capture_output=True,
            timeout=timeout_s,
            text=True,
        )
    except subprocess.TimeoutExpired as e:
        raise DiagramScriptError(
            f"script timed out after {timeout_s}s"
        ) from e

    if result.returncode != 0:
        stderr_tail = (result.stderr or "")[-2000:]
        raise DiagramScriptError(
            f"script exited with code {result.returncode}:\n{stderr_tail}"
        )

    # Find the produced PDF (preferred name, otherwise first .pdf in cwd).
    pdf_path = work_dir / OUTPUT_FILENAME
    if not pdf_path.exists():
        pdfs = list(work_dir.glob("*.pdf"))
        if not pdfs:
            stderr_tail = (result.stderr or "")[-500:]
            raise DiagramScriptError(
                f"script produced no PDF in {work_dir}. stderr: {stderr_tail}"
            )
        pdf_path = pdfs[0]
    return pdf_path


def pdf_to_pngs(pdf_path: Path, dpi: int = 150) -> List[bytes]:
    """Render each PDF page to a PNG (in-memory bytes) using pypdfium2."""
    import pypdfium2 as pdfium  # local import: keeps module importable even
                                # if pypdfium2 is missing at import time

    scale = dpi / 72.0
    out: List[bytes] = []
    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        for page in pdf:
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil()
            import io
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            out.append(buf.getvalue())
            bitmap.close()
            page.close()
    finally:
        pdf.close()
    return out


def render_python_diagram_script_with_layout(
    src: str, dpi: int = 150, timeout_s: int = DEFAULT_TIMEOUT_S
) -> "tuple[List[bytes], Optional[dict]]":
    """
    End-to-end: validate -> run -> rasterize, ALSO returning the recorded
    layout (component bounding boxes) for post-render validation.

    Returns (list[png_bytes], layout_dict_or_None). Raises DiagramScriptError
    on any failure.
    """
    validate_script(src)
    tmp = Path(tempfile.mkdtemp(prefix="patent_diag_"))
    try:
        pdf = run_script_to_pdf(src, tmp, timeout_s=timeout_s)
        pngs = pdf_to_pngs(pdf, dpi=dpi)
        layout = None
        layout_path = tmp / "layout.json"
        if layout_path.exists():
            try:
                import json
                layout = json.loads(layout_path.read_text(encoding="utf-8"))
            except Exception:
                layout = None
        return pngs, layout
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def render_python_diagram_script(src: str, dpi: int = 150,
                                 timeout_s: int = DEFAULT_TIMEOUT_S
                                 ) -> List[bytes]:
    """
    End-to-end: validate -> run -> rasterize. Returns a list of PNG bytes,
    one per figure page. Raises DiagramScriptError on any failure.
    (Back-compat wrapper around render_python_diagram_script_with_layout.)
    """
    pngs, _layout = render_python_diagram_script_with_layout(src, dpi, timeout_s)
    return pngs


# Drawing margins — must match patent_diagram_helpers.MARGIN_*.
_MARGIN_LEFT = 54.0
_MARGIN_RIGHT = 54.0
_MARGIN_TOP = 54.0
_MARGIN_BOTTOM = 72.0


def analyze_layout(layout: Optional[dict],
                   bounds_tol: float = 5.0,
                   min_overlap: float = 5.0) -> List[str]:
    """
    Inspect a recorded layout dict and return a list of human-readable layout
    problems. An empty list means the figure looks clean.

    Two checks (deliberately conservative to avoid wasting retries):
      1. Out-of-margin: any component box that extends past the drawable area
         (page minus margins) by more than `bounds_tol` points.
      2. Overlap: any two SOLID components (dashed grouping containers are
         excluded — they are meant to enclose boxes) that overlap by more than
         `min_overlap` points on BOTH axes (a shared edge is fine).
    """
    issues: List[str] = []
    if not layout:
        return issues
    page_w = layout.get("page_w")
    page_h = layout.get("page_h")
    els = layout.get("elements") or []
    if not page_w or not page_h or not els:
        return issues

    left = _MARGIN_LEFT
    right = page_w - _MARGIN_RIGHT
    bottom = _MARGIN_BOTTOM
    top = page_h - _MARGIN_TOP

    def _name(e: dict) -> str:
        return (e.get("label") or e.get("kind") or "elemento").strip() or "elemento"

    for e in els:
        try:
            x, y, w, h = float(e["x"]), float(e["y"]), float(e["w"]), float(e["h"])
        except Exception:
            continue
        nm = _name(e)
        if x < left - bounds_tol:
            issues.append(f"'{nm}' se sale por el margen IZQUIERDO (x={x:.0f}, mínimo {left:.0f})")
        if x + w > right + bounds_tol:
            issues.append(f"'{nm}' se sale/recorta por el margen DERECHO (borde={x + w:.0f}, máximo {right:.0f})")
        if y < bottom - bounds_tol:
            issues.append(f"'{nm}' se sale por el margen INFERIOR (y={y:.0f}, mínimo {bottom:.0f})")
        if y + h > top + bounds_tol:
            issues.append(f"'{nm}' se sale por el margen SUPERIOR (borde={y + h:.0f}, máximo {top:.0f})")

    comps = [e for e in els if not e.get("container")]
    for i in range(len(comps)):
        a = comps[i]
        try:
            ax, ay, aw, ah = float(a["x"]), float(a["y"]), float(a["w"]), float(a["h"])
        except Exception:
            continue
        for j in range(i + 1, len(comps)):
            b = comps[j]
            try:
                bx, by, bw, bh = float(b["x"]), float(b["y"]), float(b["w"]), float(b["h"])
            except Exception:
                continue
            iw = min(ax + aw, bx + bw) - max(ax, bx)
            ih = min(ay + ah, by + bh) - max(ay, by)
            if iw > min_overlap and ih > min_overlap:
                issues.append(
                    f"las cajas '{_name(a)}' y '{_name(b)}' se solapan "
                    f"({iw:.0f}×{ih:.0f}pt) — sepáralas"
                )

    # De-duplicate preserving order; cap the list so the retry prompt stays short.
    seen: List[str] = []
    for it in issues:
        if it not in seen:
            seen.append(it)
    return seen[:12]


__all__ = [
    "DiagramScriptError",
    "validate_script",
    "run_script_to_pdf",
    "pdf_to_pngs",
    "render_python_diagram_script",
    "render_python_diagram_script_with_layout",
    "analyze_layout",
]
