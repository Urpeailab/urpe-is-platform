"""Validadores: interfaz pública."""
from typing import Tuple, List, Dict
from uscis_pipeline.validadores.requeridos import validar_requeridos
from uscis_pipeline.validadores.condicionales import validar_condicionales
from uscis_pipeline.validadores.reglas_uscis import validar_reglas_uscis

def validar_todo(respuestas: dict, reglas_mapeo: list, esquema_canonico=None) -> Tuple[bool, List[Dict]]:
    errores = validar_requeridos(respuestas, reglas_mapeo) + validar_condicionales(respuestas) + validar_reglas_uscis(respuestas)
    tiene_errores = any(e.get('severidad') == 'error' for e in errores)
    return (not tiene_errores, errores)
