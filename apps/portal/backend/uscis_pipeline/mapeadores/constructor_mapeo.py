"""Capa 5: Constructor de mapeo."""
import logging
from typing import List
from uscis_pipeline.esquemas import EsquemaCanonico, ReglaMapeo

logger = logging.getLogger(__name__)

def construir_mapeo_campos(esquema: EsquemaCanonico) -> List[ReglaMapeo]:
    mapeo = []
    for e in esquema.esquema:
        transformacion = {'checkbox': 'checkbox_x', 'radio': 'radio_select', 'date': 'date_mmddyyyy', 'phone': 'phone_digits', 'ssn': 'ssn_digits'}.get(e.tipo.value, 'text')
        mapeo.append(ReglaMapeo(clave_canonica=e.clave, nombre_campo_pdf=e.campo_pdf, transformacion=transformacion, tipo_campo=e.tipo, etiqueta_es=e.etiqueta_es))
    logger.info(f"Mapeo: {len(mapeo)} reglas construidas")
    return mapeo
