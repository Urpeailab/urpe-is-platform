"""
Pipeline USCIS - Orquestador principal.
Coordina las 6 capas para crear plantillas y llenar PDFs.
NO afecta el I-140 N8N (usa su propio pipeline hardcodeado).
"""
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


async def ejecutar_pipeline_plantilla(
    pdf_formulario: bytes,
    pdf_instrucciones: Optional[bytes],
    codigo_formulario: str,
    categoria_visa: str = None,
    subcategoria_visa: str = None,
    db=None,
    template_id: str = None,
    creado_por: str = None,
) -> Dict:
    """Ejecuta el pipeline completo de creación de plantilla."""

    # Capa 1
    logger.info(f"Pipeline Capa 1: Extrayendo campos de {codigo_formulario}")
    from uscis_pipeline.extractores.extractor_campos_formulario import extraer_campos_formulario
    campos = extraer_campos_formulario(pdf_formulario)
    logger.info(f"Capa 1: {len(campos)} campos")

    # Capa 2
    from uscis_pipeline.esquemas import InstruccionesParseadas
    instrucciones = InstruccionesParseadas()
    if pdf_instrucciones:
        logger.info("Pipeline Capa 2: Parseando instrucciones")
        from uscis_pipeline.extractores.parser_instrucciones import parsear_instrucciones
        instrucciones = parsear_instrucciones(pdf_instrucciones)
        logger.info(f"Capa 2: {len(instrucciones.secciones)} secciones")

    # Capa 3
    logger.info("Pipeline Capa 3: Generando esquema canónico")
    from uscis_pipeline.generadores.generador_esquema_canonico import generar_esquema_canonico
    esquema = generar_esquema_canonico(campos, instrucciones, codigo_formulario, categoria_visa)
    logger.info(f"Capa 3: {len(esquema.esquema)} entradas")

    # Capa 4
    logger.info("Pipeline Capa 4: Generando cuestionario")
    from uscis_pipeline.generadores.generador_cuestionario import generar_cuestionario
    cuestionario = generar_cuestionario(esquema, instrucciones, codigo_formulario, categoria_visa, subcategoria_visa)
    total_q = sum(len(s.preguntas) for s in cuestionario.secciones)
    logger.info(f"Capa 4: {total_q} preguntas")

    # Capa 5
    logger.info("Pipeline Capa 5: Construyendo mapeo")
    from uscis_pipeline.mapeadores.constructor_mapeo import construir_mapeo_campos
    reglas_mapeo = construir_mapeo_campos(esquema)
    logger.info(f"Capa 5: {len(reglas_mapeo)} reglas")

    # Auditoría y Registro
    if db is not None and template_id:
        try:
            from uscis_pipeline.auditoria.trazabilidad_pipeline import guardar_artefactos_pipeline
            await guardar_artefactos_pipeline(db, template_id, codigo_formulario, campos, instrucciones, esquema, cuestionario, reglas_mapeo, creado_por)
        except Exception as e:
            logger.error(f"Error auditoría: {e}")
        try:
            from uscis_pipeline.registro.versionado_plantillas import registrar_plantilla
            await registrar_plantilla(db, template_id, codigo_formulario, pdf_formulario, pdf_instrucciones)
        except Exception as e:
            logger.error(f"Error registro: {e}")

    return {
        'campos_inventario': campos,
        'instrucciones': instrucciones,
        'esquema_canonico': esquema,
        'cuestionario': cuestionario,
        'reglas_mapeo': reglas_mapeo,
    }
