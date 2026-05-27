"""Generación del PDF maestro de la visa (módulo de Impresión).

Toma el layout (árbol de secciones) de un caso y arma un único PDF paginado:

    portada → índice con rangos de página → [separadora de sección →
    (items) → separadora de subsección → (items)] ... → numeración de página.

Conversión de formatos:
  - PDF        → tal cual
  - DOCX/DOC   → LibreOffice headless (`soffice --convert-to pdf`)
  - imágenes   → embebidas como página (PyMuPDF)
  - otros      → página placeholder "formato no soportado"

Datastore: Supabase (layout + deliverables). El maestro se sube a Supabase y se
registra en `visa_print_layouts.master`.
"""

import io
import os
import math
import uuid
import zipfile
import logging
import subprocess
import tempfile
from datetime import datetime, timezone

import requests
import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader

from db.supabase_client import select, update
from storage_service import upload_file as supabase_upload

logger = logging.getLogger(__name__)

PAGE_W, PAGE_H = letter
MARGIN = 72  # 1 pulgada
GOLD = (0.83, 0.69, 0.22)
DARK = (0.1, 0.1, 0.1)
DEFAULT_ADDRESS = "3235 North Point Pkwy, Suite 101, Alpharetta, GA. 30005"
# Opacidad del fondo de marca (0 = invisible, 1 = sólido). Tipo marca de agua.
BG_OPACITY = 0.2

# Paginación determinística del índice (debe coincidir simulación vs render).
TOC_ROWS_FIRST = 24
TOC_ROWS_REST = 32


# ============= helpers de texto =============

def _text(val, lang="en"):
    """Resuelve un título que puede ser str o dict bilingüe {es,en}.
    El documento maestro es en inglés, así que priorizamos 'en'."""
    if isinstance(val, dict):
        return val.get(lang) or val.get("en") or val.get("es") or ""
    return str(val or "")


def _wrap(text, font, size, max_w):
    """Parte un texto en líneas que entran en max_w (puntos)."""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if stringWidth(test, font, size) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


# ============= conversión de archivos a PDF =============

def _count_pages(pdf_bytes):
    try:
        return len(PdfReader(io.BytesIO(pdf_bytes)).pages)
    except Exception as e:
        logger.warning(f"[print_master] no se pudo contar páginas: {e}")
        return 1


def _docx_to_pdf(content, ext="docx"):
    """Convierte DOCX/DOC a PDF usando LibreOffice headless."""
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, f"in.{ext}")
        with open(src, "wb") as fh:
            fh.write(content)
        # UserInstallation aislado por conversión → evita choques de perfil concurrentes.
        profile = f"-env:UserInstallation=file://{tmp}/lo_profile"
        subprocess.run(
            ["soffice", "--headless", profile, "--convert-to", "pdf",
             "--outdir", tmp, src],
            check=True, timeout=180,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        out = os.path.join(tmp, "in.pdf")
        with open(out, "rb") as fh:
            return fh.read()


def _image_to_pdf(content, ext="png"):
    """Embebe una imagen como una página PDF tamaño carta (PyMuPDF)."""
    img_doc = fitz.open(stream=content, filetype=ext)
    pdf_bytes = img_doc.convert_to_pdf()
    img_doc.close()
    return pdf_bytes


def _placeholder_pdf(title):
    """Página que indica que un archivo no se pudo incluir."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setFont("Helvetica-Oblique", 12)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2, f"[Could not include: {title}]")
    c.showPage()
    c.save()
    return buf.getvalue()


def _zip_to_pdf(content):
    """Descomprime un .zip y concatena en un solo PDF cada archivo convertible
    (imágenes, PDFs, DOCX) en orden alfabético por nombre. Ignora lo que no se
    puede convertir. Soporta carpetas anidadas."""
    writer = PdfWriter()
    added = 0
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        names = sorted(n for n in zf.namelist() if not n.endswith("/"))
        for name in names:
            base = name.rsplit("/", 1)[-1]
            if base.startswith(".") or base.startswith("__MACOSX"):
                continue  # archivos ocultos / metadata de macOS
            try:
                data = zf.read(name)
                if not data:
                    continue
                pdf = _file_to_pdf(data, base)
                for page in PdfReader(io.BytesIO(pdf)).pages:
                    writer.add_page(page)
                added += 1
            except Exception as e:
                logger.warning(f"[print_master] entrada '{name}' del zip omitida: {e}")
    if added == 0:
        raise ValueError("zip sin archivos convertibles")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _file_to_pdf(content, filename, mime=None):
    """Despacha la conversión según extensión / mime."""
    ext = ""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
    if not ext and mime:
        if "pdf" in mime:
            ext = "pdf"
        elif "word" in mime or "officedocument" in mime:
            ext = "docx"
        elif "image" in mime:
            ext = mime.split("/")[-1]
        elif "zip" in mime:
            ext = "zip"

    if ext == "pdf":
        return content
    if ext in ("docx", "doc"):
        return _docx_to_pdf(content, ext)
    if ext in ("png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff"):
        return _image_to_pdf(content, "jpeg" if ext == "jpg" else ext)
    if ext == "zip":
        return _zip_to_pdf(content)
    raise ValueError(f"formato no soportado: {ext or mime}")


# ============= páginas generadas (reportlab) =============

def _draw_page_bg(c, img_bytes, alpha=BG_OPACITY):
    """Dibuja la imagen de marca como fondo a página completa (full-bleed) con
    opacidad reducida (marca de agua). El texto se dibuja DESPUÉS, por encima,
    a opacidad sólida (el save/restore aísla el alpha)."""
    if not img_bytes:
        return
    try:
        c.saveState()
        c.setFillAlpha(alpha)
        c.drawImage(ImageReader(io.BytesIO(img_bytes)), 0, 0, PAGE_W, PAGE_H,
                    preserveAspectRatio=False, mask="auto")
        c.restoreState()
    except Exception as e:
        logger.warning(f"[print_master] no se pudo dibujar fondo: {e}")


def _build_cover(title, client_name, address, branding_bytes):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    _draw_page_bg(c, branding_bytes)
    c.setFillColorRGB(*DARK)
    c.setFont("Helvetica-Bold", 26)
    for i, line in enumerate(_wrap(title, "Helvetica-Bold", 26, PAGE_W - 2 * MARGIN)):
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 40 - i * 32, line)
    if client_name:
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 40, client_name)
    if address:
        c.setFont("Helvetica", 11)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        for i, line in enumerate(_wrap(address, "Helvetica", 11, PAGE_W - 2 * MARGIN)):
            c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 64 - i * 16, line)
    c.showPage()
    c.save()
    return buf.getvalue()


def _build_separator(section_title, sub_title, branding_bytes):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    _draw_page_bg(c, branding_bytes)
    c.setFillColorRGB(*DARK)
    c.setFont("Helvetica-Bold", 24)
    y = PAGE_H / 2 + 30
    for line in _wrap(section_title, "Helvetica-Bold", 24, PAGE_W - 2 * MARGIN):
        c.drawCentredString(PAGE_W / 2, y, line)
        y -= 30
    if sub_title:
        c.setFont("Helvetica-Bold", 16)
        c.setFillColorRGB(*GOLD)
        y -= 10
        for line in _wrap(sub_title, "Helvetica-Bold", 16, PAGE_W - 2 * MARGIN):
            c.drawCentredString(PAGE_W / 2, y, line)
            y -= 22
    c.showPage()
    c.save()
    return buf.getvalue()


def _toc_page_count(n_entries):
    if n_entries <= TOC_ROWS_FIRST:
        return 1
    return 1 + math.ceil((n_entries - TOC_ROWS_FIRST) / TOC_ROWS_REST)


def _build_toc(entries, branding_bytes):
    """entries: list de {level, title, start, end}. Numeración ya absoluta."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    rows_on_page = 0
    rows_limit = TOC_ROWS_FIRST
    y = PAGE_H - MARGIN

    def new_page(first=False):
        nonlocal y, rows_on_page, rows_limit
        if not first:
            c.showPage()
        _draw_page_bg(c, branding_bytes)
        y = PAGE_H - MARGIN
        rows_on_page = 0
        rows_limit = TOC_ROWS_REST
        c.setFillColorRGB(*DARK)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(MARGIN, y, "Table of Contents" if first else "Table of Contents (cont.)")
        y -= 34

    new_page(first=True)
    rows_limit = TOC_ROWS_FIRST

    for e in entries:
        if rows_on_page >= rows_limit:
            new_page()
        indent = MARGIN + e["level"] * 18
        bold = e["level"] == 0
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 11 if bold else 10)
        c.setFillColorRGB(*(DARK if bold else (0.25, 0.25, 0.25)))
        title = _text(e["title"])
        # rango de páginas a la derecha
        if e.get("end") and e["end"] != e["start"]:
            pages_label = f"{e['start']}–{e['end']}"
        else:
            pages_label = f"{e['start']}"
        max_title_w = (PAGE_W - MARGIN) - indent - 60
        line = _wrap(title, "Helvetica", 11, max_title_w)[0]
        c.drawString(indent, y, line)
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawRightString(PAGE_W - MARGIN, y, pages_label)
        y -= 18
        rows_on_page += 1

    c.showPage()
    c.save()
    return buf.getvalue()


# ============= numeración de páginas =============

def _stamp_page_numbers(merged_bytes):
    reader = PdfReader(io.BytesIO(merged_bytes))
    writer = PdfWriter()
    total = len(reader.pages)
    for i, page in enumerate(reader.pages):
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(w, h))
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.drawCentredString(w / 2, 24, f"{i + 1} / {total}")
        c.showPage()
        c.save()
        overlay = PdfReader(io.BytesIO(buf.getvalue())).pages[0]
        page.merge_page(overlay)
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ============= resolución de archivos =============

def _resolve_files(item, deliverables_by_id, documents_by_id):
    src = item.get("source", "deliverable")
    table = documents_by_id if src == "document" else deliverables_by_id
    d = table.get(item.get("deliverableId"))
    if not d:
        return []
    files = d.get("files") or []
    if not files and d.get("fileUrl"):
        files = [{"id": "legacy", "fileName": d.get("fileName"), "fileUrl": d.get("fileUrl")}]
    if item.get("fileId"):
        files = [f for f in files if f.get("id") == item.get("fileId")]
    else:
        files = [f for f in files if f.get("published", True)]
    return files


def _download(url):
    if not url:
        raise ValueError("sin URL de archivo")
    resp = requests.get(url, timeout=90)
    resp.raise_for_status()
    if not resp.content:
        raise ValueError("archivo vacío (0 bytes)")
    return resp.content


# ============= orquestador =============

def generate_master_pdf(case_id: str) -> dict:
    """Genera el PDF maestro del caso, lo sube a Supabase y actualiza el layout."""
    layout = select("visa_print_layouts", filters={"case_id": case_id}, single=True)
    if not layout:
        raise ValueError("El caso no tiene layout de impresión")

    sections = layout.get("sections") or []
    branding_url = layout.get("brandingImageUrl")
    branding_bytes = None
    if branding_url:
        try:
            branding_bytes = _download(branding_url)
        except Exception as e:
            logger.warning(f"[print_master] no se pudo bajar branding: {e}")

    deliverables = select("visa_deliverables", filters={"case_id": case_id}, limit=500)
    deliverables_by_id = {d.get("id"): d for d in deliverables}
    documents = select("visa_documents", filters={"case_id": case_id}, limit=500)
    documents_by_id = {d.get("id"): d for d in documents}

    # --- Paso 1: armar el cuerpo (separadoras + contenido) y registrar entradas ---
    body_chunks = []
    body_pages = 0
    entries = []  # {level, title, start, end} en páginas relativas al cuerpo

    def add_chunk(pdf_bytes):
        nonlocal body_pages
        # Blindaje: el chunk DEBE ser un PDF legible y no vacío, porque el merge
        # final lo lee con PdfReader (que tira EmptyFileError si está vacío).
        try:
            if not pdf_bytes:
                raise ValueError("vacío")
            n = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
            if n == 0:
                raise ValueError("sin páginas")
        except Exception as e:
            logger.warning(f"[print_master] chunk inválido ({e}); reemplazo por placeholder")
            pdf_bytes = _placeholder_pdf("unreadable file")
            n = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
        start = body_pages + 1
        body_chunks.append(pdf_bytes)
        body_pages += n
        return start, body_pages

    def add_items(items, level):
        for item in sorted(items, key=lambda x: x.get("order", 0)):
            files = _resolve_files(item, deliverables_by_id, documents_by_id)
            if not files:
                continue
            item_start = item_end = None
            for f in files:
                title = f.get("fileName") or "archivo"
                try:
                    raw = _download(f.get("fileUrl"))
                    pdf = _file_to_pdf(raw, f.get("fileName"), f.get("mimeType"))
                except Exception as e:
                    logger.warning(f"[print_master] item {title} falló: {e}")
                    pdf = _placeholder_pdf(title)
                cs, ce = add_chunk(pdf)
                if item_start is None:
                    item_start = cs
                item_end = ce
            table = documents_by_id if item.get("source") == "document" else deliverables_by_id
            d = table.get(item.get("deliverableId"), {})
            item_title = item.get("title") or d.get("name") or d.get("documentName") or "Document"
            entries.append({"level": level, "title": item_title,
                            "start": item_start, "end": item_end})

    for section in sorted(sections, key=lambda x: x.get("order", 0)):
        sec_title = section.get("title")
        sec_branding = branding_bytes if section.get("includeBranding") else None
        sep_start, _ = add_chunk(_build_separator(_text(sec_title), None, sec_branding))
        entries.append({"level": 0, "title": sec_title, "start": sep_start, "end": None})
        add_items(section.get("items") or [], level=1)
        for sub in sorted(section.get("subsections") or [], key=lambda x: x.get("order", 0)):
            sub_title = sub.get("title")
            sub_sep, _ = add_chunk(_build_separator(_text(sec_title), _text(sub_title), sec_branding))
            entries.append({"level": 1, "title": sub_title, "start": sub_sep, "end": None})
            add_items(sub.get("items") or [], level=2)

    if not body_chunks:
        raise ValueError("No hay entregables asignados a ninguna sección")

    # --- Paso 2: calcular offset (portada + índice) y volver absolutas las páginas ---
    toc_pages = _toc_page_count(len(entries))
    offset = 1 + toc_pages  # 1 = portada
    for e in entries:
        e["start"] = e["start"] + offset
        if e.get("end"):
            e["end"] = e["end"] + offset

    # --- Paso 3: portada + índice ---
    case = select("visa_cases", filters={"id": case_id}, single=True) or {}
    # Fallback: si no se guardó el nombre del cliente, lo tomamos del caso; la
    # dirección por default es la de URPE.
    client_name = layout.get("brandingClientName")
    if not client_name:
        cid = case.get("clientId") or case.get("userId") or case.get("client_id")
        if cid:
            u = select("users", filters={"id": cid}, single=True)
            client_name = (u or {}).get("name")
    address = layout.get("brandingAddress") or DEFAULT_ADDRESS
    cover = _build_cover(
        client_name or "Visa Master Document",
        client_name,
        address,
        branding_bytes,
    )
    toc = _build_toc(entries, branding_bytes)

    # --- Paso 4: merge + numeración ---
    writer = PdfWriter()
    for chunk in [cover, toc] + body_chunks:
        for page in PdfReader(io.BytesIO(chunk)).pages:
            writer.add_page(page)
    merged = io.BytesIO()
    writer.write(merged)
    final_bytes = _stamp_page_numbers(merged.getvalue())
    total_pages = _count_pages(final_bytes)

    # --- Paso 5: subir a Supabase + registrar en el layout ---
    file_name = f"visa-maestro-{case.get('caseId') or case_id}.pdf"
    result = supabase_upload(
        file_content=final_bytes,
        filename=file_name,
        folder="print-masters",
    )
    if not result.get("success"):
        raise RuntimeError(f"Error subiendo el maestro: {result.get('error')}")

    master = {
        "fileUrl": result["fileUrl"],
        "filePath": result["filePath"],
        "fileName": file_name,
        "pageCount": total_pages,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    update("visa_print_layouts", filters={"case_id": case_id},
           data={"master": master, "updated_at": master["generatedAt"]})
    return master
