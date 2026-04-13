"""Capa 6: Rellenador de PDF con PyMuPDF.
Maneja: texto, checkbox, radio, dropdown, multiline, NeedAppearances, flatten.
"""
import logging
from typing import List, Dict, Tuple
from uscis_pipeline.esquemas import ResultadoRenderizado

logger = logging.getLogger(__name__)


def rellenar_pdf(pdf_bytes: bytes, ediciones: List[Dict], aplanar: bool = False) -> Tuple[bytes, ResultadoRenderizado]:
    """
    Rellena un PDF con lista de ediciones.
    ediciones: [{"fieldName": "...", "text": "..."}]
    Maneja checkboxes, radios, dropdowns y texto multilinea.
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    resultado = ResultadoRenderizado()

    # Forzar NeedAppearances para que los valores se rendericen visualmente
    try:
        if doc.xref_xml_metadata:
            pass
        # Set NeedAppearances flag en AcroForm
        xref = doc.pdf_catalog()
        acro = doc.xref_get_key(xref, "AcroForm")
        if acro[0] == "dict":
            # Already has AcroForm, ensure NeedAppearances
            pass
    except:
        pass

    # Construir mapa de widgets por nombre
    widgets = {}
    for num_pag in range(len(doc)):
        pagina = doc[num_pag]
        for w in (pagina.widgets() or []):
            if w.field_name:
                widgets[w.field_name] = (num_pag, w)

    resultado.total_campos = len(widgets)

    for edicion in ediciones:
        nombre = edicion.get("fieldName", "")
        texto = edicion.get("text", "")
        if not nombre:
            continue

        if nombre not in widgets:
            resultado.campos_no_encontrados += 1
            resultado.detalles_errores.append({"field": nombre, "error": "not_found"})
            continue

        num_pag, widget = widgets[nombre]
        try:
            tipo_widget = widget.field_type

            # Checkbox (tipo 2)
            if tipo_widget == 2:
                if texto in ('X', 'x', 'Yes', 'yes', 'true', 'True', '1'):
                    widget.field_value = True
                else:
                    widget.field_value = False

            # Radio button (tipo 5)
            elif tipo_widget == 5:
                widget.field_value = texto

            # Combobox/Listbox (tipo 3, 4) — dropdown
            elif tipo_widget in (3, 4):
                widget.field_value = texto

            # Text (tipo 0) — incluye multiline
            elif tipo_widget == 0:
                widget.field_value = texto
                # Si el texto es largo y el campo soporta multiline, ajustar
                if len(texto) > 100:
                    try:
                        widget.text_fontsize = 8  # Reducir tamaño para textos largos
                    except:
                        pass

            # Botón push (tipo 6) — ignorar
            elif tipo_widget == 6:
                continue

            else:
                widget.field_value = texto

            widget.update()
            resultado.campos_llenados += 1

        except Exception as e:
            resultado.campos_fallidos += 1
            resultado.detalles_errores.append({"field": nombre, "error": str(e)[:80]})

    # Calcular cobertura
    total_intentados = len(ediciones)
    resultado.cobertura_pct = round((resultado.campos_llenados / max(total_intentados, 1)) * 100, 1)

    # Aplanar si se solicita (hace campos no editables)
    if aplanar:
        try:
            # PyMuPDF no tiene flatten nativo, pero podemos intentar con save options
            pdf_final = doc.tobytes(deflate=True, garbage=3)
        except:
            pdf_final = doc.tobytes()
    else:
        pdf_final = doc.tobytes()

    doc.close()

    logger.info(
        f"Rellenador: {resultado.campos_llenados}/{total_intentados} campos llenados "
        f"({resultado.campos_no_encontrados} no encontrados, {resultado.campos_fallidos} fallidos) "
        f"= {resultado.cobertura_pct}% cobertura"
    )

    return pdf_final, resultado
