"""Capa 2: Parser de instrucciones USCIS.
Devuelve estructura rica útil para Gemini.
"""
import re
import logging
from typing import List
from uscis_pipeline.esquemas import InstruccionesParseadas, SeccionInstrucciones
from uscis_pipeline.configuracion import MAX_TEXTO_INSTRUCCIONES

logger = logging.getLogger(__name__)


def parsear_instrucciones(pdf_bytes: bytes) -> InstruccionesParseadas:
    """Extrae y estructura el texto del PDF de instrucciones."""
    import fitz
    texto = ""
    paginas_por_parte = {}
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for i, pagina in enumerate(doc):
            page_text = pagina.get_text("text")
            texto += page_text + "\n"
            # Track which page each Part starts on
            for m in re.finditer(r'Part\s+(\d+)\.', page_text):
                part_num = int(m.group(1))
                if part_num not in paginas_por_parte:
                    paginas_por_parte[part_num] = i
        doc.close()
    except Exception as e:
        logger.error(f"Error extrayendo instrucciones: {e}")

    if not texto or len(texto) < 100:
        return InstruccionesParseadas(texto_crudo=texto, total_caracteres=len(texto))

    secciones = _parsear_secciones(texto, paginas_por_parte)
    return InstruccionesParseadas(
        texto_crudo=texto[:MAX_TEXTO_INSTRUCCIONES],
        secciones=secciones,
        total_caracteres=len(texto),
    )


def _parsear_secciones(texto: str, paginas_map: dict = None) -> List[SeccionInstrucciones]:
    secciones = []
    parte_actual = None
    contenido = []
    reglas = []
    notas = []

    for linea in texto.split('\n'):
        linea = linea.strip()
        if not linea:
            continue

        # Detect Part headers
        match = re.match(r'^Part\s+(\d+)\.\s*(.+)', linea, re.IGNORECASE)
        if match:
            if parte_actual:
                contenido_final = _enriquecer_contenido('\n'.join(contenido), reglas, notas)
                secciones.append(SeccionInstrucciones(
                    parte=parte_actual['num'],
                    titulo=parte_actual['titulo'],
                    contenido=contenido_final,
                ))
            parte_actual = {'num': int(match.group(1)), 'titulo': match.group(2).strip()}
            contenido = []
            reglas = []
            notas = []
            continue

        # Detect Item Numbers
        item_match = re.match(r'^Item\s+Numbers?\s+(\d+[\w.]*)\s*[-–]\s*(\d+[\w.]*)', linea, re.IGNORECASE)
        if item_match:
            contenido.append(f"\n[Items {item_match.group(1)}-{item_match.group(2)}]")

        # Detect rules/requirements
        if re.search(r'(must|required|should|need to|you must|do not)', linea, re.IGNORECASE):
            reglas.append(linea)

        # Detect notes/warnings
        if re.search(r'^(NOTE|WARNING|IMPORTANT|CAUTION)', linea, re.IGNORECASE):
            notas.append(linea)

        if contenido is not None:
            contenido.append(linea)

    if parte_actual:
        contenido_final = _enriquecer_contenido('\n'.join(contenido), reglas, notas)
        secciones.append(SeccionInstrucciones(
            parte=parte_actual['num'],
            titulo=parte_actual['titulo'],
            contenido=contenido_final,
        ))

    logger.info(f"Parser instrucciones: {len(secciones)} secciones")
    return secciones


def _enriquecer_contenido(contenido: str, reglas: list, notas: list) -> str:
    """Agrega metadata de reglas y notas al contenido."""
    partes = [contenido.strip()]
    if reglas:
        partes.append("\n[REGLAS DETECTADAS]")
        for r in reglas[:10]:
            partes.append(f"  - {r[:150]}")
    if notas:
        partes.append("\n[NOTAS]")
        for n in notas[:5]:
            partes.append(f"  - {n[:150]}")
    return '\n'.join(partes)
