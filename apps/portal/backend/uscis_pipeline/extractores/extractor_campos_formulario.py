"""Capa 1: Extractor de campos del PDF del formulario."""
import re
import logging
from typing import List
from uscis_pipeline.esquemas import CampoPdf, TipoCampo

logger = logging.getLogger(__name__)

ETIQUETAS_COMUNES = {
    'family name': 'Apellido', 'given name': 'Nombre', 'middle name': 'Segundo Nombre',
    'date of birth': 'Fecha de Nacimiento', 'dob': 'Fecha de Nacimiento',
    'country of birth': 'País de Nacimiento', 'city of birth': 'Ciudad de Nacimiento',
    'state of birth': 'Estado/Provincia de Nacimiento', 'city or town': 'Ciudad',
    'street number': 'Dirección', 'zip code': 'Código Postal', 'postal code': 'Código Postal',
    'province': 'Provincia/Estado', 'daytime phone': 'Teléfono', 'mobile phone': 'Teléfono Móvil',
    'email address': 'Correo Electrónico', 'email': 'Correo Electrónico',
    'alien number': 'A-Number', 'a number': 'A-Number',
    'ssn': 'Número de Seguro Social', 'social security': 'Número de Seguro Social',
    'uscis account': 'Cuenta USCIS Online', 'passport number': 'Número de Pasaporte',
    'occupation': 'Ocupación', 'employer': 'Empleador',
    'signature': 'Firma', 'interpreter': 'Intérprete', 'preparer': 'Preparador',
}


def _limpiar_nombre_campo(raw: str) -> str:
    clean = re.sub(r'\[\d+\]', '', raw)
    clean = re.sub(r'form\d+\.#subform\.', '', clean)
    clean = re.sub(r'([a-z])([A-Z])', r'\1 \2', clean)
    clean = re.sub(r'[_.]', ' ', clean)
    clean = re.sub(r'Pt(\d+)', r'Part \1 ', clean)
    clean = re.sub(r'Line(\d+[a-z]?)', r'Item \1', clean)
    return re.sub(r'\s+', ' ', clean).strip()


def _obtener_etiqueta_espanol(nombre_legible: str) -> str:
    lower = nombre_legible.lower()
    for patron, etiqueta in ETIQUETAS_COMUNES.items():
        if patron in lower:
            return etiqueta
    return ""


def extraer_campos_formulario(pdf_bytes: bytes) -> List[CampoPdf]:
    """Extrae campos del PDF usando pypdf + PyMuPDF."""
    campos_pypdf = _extraer_con_pypdf(pdf_bytes)
    campos_pymupdf = _extraer_con_pymupdf(pdf_bytes)

    contexto_map = {f['nombre']: f for f in campos_pymupdf}
    vistos = set()
    resultado = []

    for c in campos_pypdf:
        if c['nombre'] in vistos:
            continue
        vistos.add(c['nombre'])
        ctx = contexto_map.get(c['nombre'], {})
        legible = _limpiar_nombre_campo(c['nombre'])
        espanol = _obtener_etiqueta_espanol(legible)

        resultado.append(CampoPdf(
            nombre_campo_pdf=c['nombre'],
            tipo_campo=TipoCampo(c.get('tipo', 'text')),
            pagina=ctx.get('pagina', 0),
            valor_por_defecto=c.get('valor', ''),
            opciones=c.get('opciones', []),
            nombre_legible=legible,
            etiqueta_espanol=espanol or None,
            texto_contexto=ctx.get('contexto', ''),
        ))

    for c in campos_pymupdf:
        if c['nombre'] in vistos:
            continue
        vistos.add(c['nombre'])
        legible = _limpiar_nombre_campo(c['nombre'])
        resultado.append(CampoPdf(
            nombre_campo_pdf=c['nombre'],
            tipo_campo=TipoCampo(c.get('tipo', 'text')),
            pagina=c.get('pagina', 0),
            nombre_legible=legible,
            etiqueta_espanol=_obtener_etiqueta_espanol(legible) or None,
            texto_contexto=c.get('contexto', ''),
        ))

    logger.info(f"Extractor: {len(resultado)} campos ({len(campos_pypdf)} pypdf, {len(campos_pymupdf)} pymupdf)")
    return resultado


def _extraer_con_pypdf(pdf_bytes: bytes) -> list:
    from pypdf import PdfReader
    import io
    campos = []
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for nombre, campo in (reader.get_fields() or {}).items():
            tipo_raw = str(campo.get('/FT', ''))
            tipo = {'/Tx': 'text', '/Btn': 'checkbox', '/Ch': 'select'}.get(tipo_raw, 'text')
            if tipo == 'checkbox':
                flags = campo.get('/Ff', 0)
                if isinstance(flags, int) and (flags & (1 << 15)):
                    tipo = 'radio'
            opciones = []
            if '/Opt' in campo and isinstance(campo['/Opt'], list):
                opciones = [str(o) for o in campo['/Opt'][:20]]
            campos.append({'nombre': nombre, 'tipo': tipo, 'valor': str(campo.get('/V', '') or ''), 'opciones': opciones})
    except Exception as e:
        logger.error(f"pypdf error: {e}")
    return campos


def _extraer_con_pymupdf(pdf_bytes: bytes) -> list:
    import fitz
    campos = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for num_pag in range(len(doc)):
            pagina = doc[num_pag]
            for widget in (pagina.widgets() or []):
                nombre = widget.field_name or ''
                if not nombre:
                    continue
                tipo = {0: 'text', 2: 'checkbox', 3: 'select', 4: 'select', 5: 'radio', 6: 'button'}.get(widget.field_type, 'text')
                rect = widget.rect
                expandido = fitz.Rect(rect.x0 - 200, rect.y0 - 15, rect.x1 + 50, rect.y1 + 15)
                contexto = re.sub(r'\s+', ' ', pagina.get_text("text", clip=expandido).strip())[:200]
                campos.append({'nombre': nombre, 'tipo': tipo, 'pagina': num_pag, 'contexto': contexto})
        doc.close()
    except Exception as e:
        logger.error(f"PyMuPDF error: {e}")
    return campos
