"""Auditoría: trazabilidad completa del pipeline.
Guarda artefactos serializables en cada etapa.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def _contar_por_campo(items, campo: str) -> dict:
    c = {}
    for i in items:
        v = str(getattr(i, campo, None) if hasattr(i, campo) else i.get(campo, 'unknown') if isinstance(i, dict) else 'unknown')
        c[v] = c.get(v, 0) + 1
    return c


async def guardar_artefactos_pipeline(
    db,
    template_id: str,
    codigo_formulario: str,
    campos,
    instrucciones,
    esquema,
    cuestionario,
    reglas_mapeo,
    creado_por: str = None,
    gemini_raw_schema: str = None,
    gemini_raw_questionnaire: str = None,
):
    """
    Guarda TODOS los artefactos intermedios del pipeline.
    """
    entrada = {
        "template_id": template_id,
        "form_code": codigo_formulario,
        "created_by": creado_por,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "pipeline_version": "v2",
        "artefactos": {
            "capa_1_extraccion": {
                "total_campos": len(campos),
                "tipos": _contar_por_campo(campos, 'tipo_campo'),
                "con_etiqueta_espanol": sum(1 for c in campos if c.etiqueta_espanol),
                "con_contexto": sum(1 for c in campos if c.texto_contexto),
                "paginas": sorted(set(c.pagina for c in campos)),
                "muestra_campos": [{"pdf": c.nombre_campo_pdf, "legible": c.nombre_legible, "espanol": c.etiqueta_espanol, "tipo": c.tipo_campo.value} for c in campos[:20]],
            },
            "capa_2_instrucciones": {
                "total_caracteres": instrucciones.total_caracteres,
                "total_secciones": len(instrucciones.secciones),
                "secciones": [{"parte": s.parte, "titulo": s.titulo, "largo_contenido": len(s.contenido)} for s in instrucciones.secciones],
            },
            "capa_3_esquema": {
                "total_entradas": len(esquema.esquema),
                "partes": esquema.partes,
                "tipos": _contar_por_campo(esquema.esquema, 'tipo'),
                "muestra": [{"clave": e.clave, "pdf": e.campo_pdf, "es": e.etiqueta_es, "tipo": e.tipo.value} for e in esquema.esquema[:20]],
                "gemini_raw": gemini_raw_schema[:2000] if gemini_raw_schema else None,
            },
            "capa_4_cuestionario": {
                "total_secciones": len(cuestionario.secciones),
                "total_preguntas": sum(len(s.preguntas) for s in cuestionario.secciones),
                "secciones": [{"id": s.id, "nombre": s.nombre, "preguntas": len(s.preguntas)} for s in cuestionario.secciones],
                "muestra_preguntas": [{"id": q.id, "pregunta": q.pregunta[:80], "tipo": q.tipo.value} for s in cuestionario.secciones for q in s.preguntas[:3]],
                "gemini_raw": gemini_raw_questionnaire[:2000] if gemini_raw_questionnaire else None,
            },
            "capa_5_mapeo": {
                "total_reglas": len(reglas_mapeo),
                "transformaciones": _contar_por_campo(reglas_mapeo, 'transformacion'),
                "muestra": [{"clave": r.clave_canonica, "pdf": r.nombre_campo_pdf, "trans": r.transformacion} for r in reglas_mapeo[:20]],
            },
        },
    }

    await db.uscis_pipeline_audit.insert_one(entrada)
    logger.info(f"Auditoría: artefactos completos guardados para {codigo_formulario} ({template_id})")
    return entrada


async def guardar_auditoria_llenado(
    db,
    template_id: str,
    codigo_formulario: str,
    respuestas_originales: dict,
    respuestas_normalizadas: dict,
    ediciones_aplicadas: list,
    resultado_render,
    llenado_por: str = None,
    nombre_cliente: str = None,
    errores_validacion: list = None,
):
    """
    Guarda auditoría completa de un llenado de PDF.
    """
    sin_mapear = [d['field'] for d in resultado_render.detalles_errores if d.get('error') == 'not_found']

    entrada = {
        "template_id": template_id,
        "form_code": codigo_formulario,
        "operation": "fill_pdf",
        "filled_by": llenado_por,
        "client_name": nombre_cliente,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "respuestas_count": len(respuestas_originales),
        "respuestas_normalizadas_count": len(respuestas_normalizadas),
        "ediciones_count": len(ediciones_aplicadas),
        "campos_llenados": resultado_render.campos_llenados,
        "campos_no_encontrados": resultado_render.campos_no_encontrados,
        "campos_fallidos": resultado_render.campos_fallidos,
        "cobertura_pct": resultado_render.cobertura_pct,
        "campos_sin_mapear": sin_mapear[:30],
        "errores_validacion": errores_validacion[:10] if errores_validacion else [],
        "muestra_ediciones": ediciones_aplicadas[:15],
    }

    await db.uscis_pipeline_audit.insert_one(entrada)
    logger.info(f"Auditoría llenado: {codigo_formulario} - {resultado_render.cobertura_pct}% cobertura, {len(sin_mapear)} sin mapear")
    return entrada


async def obtener_auditoria_plantilla(db, template_id: str) -> Optional[Dict]:
    return await db.uscis_pipeline_audit.find_one(
        {"template_id": template_id, "operation": {"$exists": False}}, {"_id": 0}
    )


async def obtener_auditorias_llenado(db, template_id: str, limite: int = 20) -> List[Dict]:
    cursor = db.uscis_pipeline_audit.find(
        {"template_id": template_id, "operation": "fill_pdf"}, {"_id": 0}
    ).sort("created_at", -1).limit(limite)
    return await cursor.to_list(length=limite)
