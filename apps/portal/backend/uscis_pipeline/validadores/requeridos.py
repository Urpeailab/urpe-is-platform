"""Validadores: campos requeridos."""
from typing import List, Dict

def validar_requeridos(respuestas: dict, reglas_mapeo: list) -> List[Dict]:
    return [{"campo": r.clave_canonica, "etiqueta": r.etiqueta_es, "error": "Campo requerido", "severidad": "error"} for r in reglas_mapeo if getattr(r, 'requerido', False) and not respuestas.get(r.clave_canonica)]
