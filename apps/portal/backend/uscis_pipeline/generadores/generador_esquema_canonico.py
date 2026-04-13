"""Capa 3: Generador de esquema canónico con Gemini."""
import re
import json
import logging
from typing import List
from uscis_pipeline.esquemas import CampoPdf, InstruccionesParseadas, EsquemaCanonico, EntradaEsquema, TipoCampo
from uscis_pipeline.configuracion import GEMINI_API_KEY, GEMINI_MODEL, MAX_CAMPOS_POR_PROMPT
from uscis_pipeline.prompts.esquema_canonico import construir_prompt_esquema

logger = logging.getLogger(__name__)


def generar_esquema_canonico(campos: List[CampoPdf], instrucciones: InstruccionesParseadas, codigo_formulario: str, categoria_visa: str = None) -> EsquemaCanonico:
    if not GEMINI_API_KEY:
        return _esquema_fallback(campos)

    campos_texto = _formatear_campos(campos[:MAX_CAMPOS_POR_PROMPT])
    instr_texto = _formatear_instrucciones(instrucciones)
    visa_hint = f"Visa: {categoria_visa}" if categoria_visa else ""

    prompt = construir_prompt_esquema(codigo_formulario, campos_texto, instr_texto, visa_hint)

    try:
        respuesta = _llamar_gemini(prompt)
        datos = _extraer_json(respuesta)
        if datos and datos.get('schema'):
            entradas = [EntradaEsquema(
                clave=e.get('key', ''), campo_pdf=e.get('pdf_field', ''),
                etiqueta_es=e.get('label_es', ''), etiqueta_en=e.get('label_en', ''),
                tipo=TipoCampo(e['type']) if e.get('type') in [t.value for t in TipoCampo] else TipoCampo.TEXT,
                parte=e.get('part', 1), requerido=e.get('required', False), opciones=e.get('options', []),
            ) for e in datos['schema']]
            logger.info(f"Esquema canónico: {len(entradas)} entradas")
            return EsquemaCanonico(esquema=entradas, partes=datos.get('parts', []))
    except Exception as e:
        logger.error(f"Error generando esquema: {e}")

    return _esquema_fallback(campos)


def _esquema_fallback(campos: List[CampoPdf]) -> EsquemaCanonico:
    return EsquemaCanonico(esquema=[
        EntradaEsquema(clave=c.nombre_campo_pdf, campo_pdf=c.nombre_campo_pdf,
            etiqueta_es=c.etiqueta_espanol or c.nombre_legible, etiqueta_en=c.nombre_legible,
            tipo=c.tipo_campo, parte=c.pagina + 1, opciones=c.opciones)
        for c in campos
    ])


def _formatear_campos(campos: List[CampoPdf]) -> str:
    lineas = []
    for c in campos:
        etiqueta = c.etiqueta_espanol or c.nombre_legible
        linea = f"- {c.nombre_campo_pdf} ({c.tipo_campo.value}) = {etiqueta}"
        if c.texto_contexto and 'subform' not in c.texto_contexto[:20]:
            linea += f" [context: {c.texto_contexto[:80]}]"
        lineas.append(linea)
    return '\n'.join(lineas)


def _formatear_instrucciones(instrucciones: InstruccionesParseadas) -> str:
    texto = ""
    for s in instrucciones.secciones[:15]:
        texto += f"\nPart {s.parte}: {s.titulo}\n{s.contenido[:300]}"
    return texto


def _llamar_gemini(prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=GEMINI_API_KEY)
    return client.models.generate_content(model=GEMINI_MODEL, contents=prompt).text.strip()


def _extraer_json(texto: str) -> dict:
    try:
        return json.loads(texto)
    except:
        pass
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', texto)
    if match:
        try: return json.loads(match.group(1))
        except: pass
    for p in [r'(\{[\s\S]*\})', r'(\[[\s\S]*\])']:
        m = re.search(p, texto)
        if m:
            try: return json.loads(m.group(1))
            except: pass
    return {}
