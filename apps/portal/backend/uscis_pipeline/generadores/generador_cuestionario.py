"""Capa 4: Generador de cuestionario con Gemini."""
import re
import json
import logging
from uscis_pipeline.esquemas import EsquemaCanonico, InstruccionesParseadas, Cuestionario, SeccionCuestionario, PreguntaCuestionario, TipoCampo
from uscis_pipeline.configuracion import GEMINI_API_KEY, GEMINI_MODEL
from uscis_pipeline.prompts.cuestionario import construir_prompt_cuestionario

logger = logging.getLogger(__name__)


def generar_cuestionario(esquema: EsquemaCanonico, instrucciones: InstruccionesParseadas, codigo_formulario: str, categoria_visa: str = None, subcategoria_visa: str = None) -> Cuestionario:
    if not GEMINI_API_KEY:
        return _cuestionario_fallback(esquema)

    esquema_texto = '\n'.join([f"- key:{e.clave} | label:{e.etiqueta_es} | type:{e.tipo.value} | part:{e.parte}" + (f" | options:{','.join(e.opciones[:5])}" if e.opciones else '') for e in esquema.esquema[:200]])
    partes_texto = "FORM PARTS:\n" + '\n'.join([f"Part {p.get('number','?')}: {p.get('title_es', p.get('title_en',''))}" for p in esquema.partes]) if esquema.partes else ""
    instr_texto = '\n'.join([f"Part {s.parte}: {s.contenido[:200]}" for s in instrucciones.secciones[:10]])
    visa_hint = f"Visa: {categoria_visa}" + (f" ({subcategoria_visa})" if subcategoria_visa else "") if categoria_visa else ""

    prompt = construir_prompt_cuestionario(codigo_formulario, esquema_texto, partes_texto, instr_texto, visa_hint)

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        respuesta = client.models.generate_content(model=GEMINI_MODEL, contents=prompt).text.strip()
        datos = _extraer_json(respuesta)

        if datos and datos.get('sections'):
            secciones = []
            for s in datos['sections']:
                preguntas = [PreguntaCuestionario(
                    id=q.get('id', ''), pregunta=q.get('question', ''),
                    tipo=TipoCampo(q['type']) if q.get('type') in [t.value for t in TipoCampo] else TipoCampo.TEXT,
                    requerido=q.get('required', False), ayuda=q.get('hint', ''), claves_campos=q.get('field_keys', []),
                ) for q in s.get('questions', [])]
                secciones.append(SeccionCuestionario(id=s.get('id', ''), nombre=s.get('name', ''), descripcion=s.get('description', ''), preguntas=preguntas))
            total = sum(len(s.preguntas) for s in secciones)
            logger.info(f"Cuestionario: {len(secciones)} secciones, {total} preguntas")
            return Cuestionario(secciones=secciones)
    except Exception as e:
        logger.error(f"Error generando cuestionario: {e}")

    return _cuestionario_fallback(esquema)


def _cuestionario_fallback(esquema: EsquemaCanonico) -> Cuestionario:
    por_parte = {}
    for e in esquema.esquema:
        por_parte.setdefault(e.parte, []).append(e)
    secciones = []
    for num in sorted(por_parte.keys()):
        preguntas = [PreguntaCuestionario(id=f"q_{num}_{i}", pregunta=f"¿Cuál es su {e.etiqueta_es or e.etiqueta_en}?", tipo=e.tipo, requerido=e.requerido, claves_campos=[e.clave]) for i, e in enumerate(por_parte[num])]
        secciones.append(SeccionCuestionario(id=f"part_{num}", nombre=f"Part {num}", preguntas=preguntas))
    return Cuestionario(secciones=secciones)


def _extraer_json(texto):
    try: return json.loads(texto)
    except: pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', texto)
    if m:
        try: return json.loads(m.group(1))
        except: pass
    for p in [r'(\{[\s\S]*\})', r'(\[[\s\S]*\])']:
        m = re.search(p, texto)
        if m:
            try: return json.loads(m.group(1))
            except: pass
    return {}
