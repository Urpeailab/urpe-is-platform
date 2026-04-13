"""Validadores: reglas condicionales."""
import re
from typing import List, Dict

def validar_condicionales(respuestas: dict) -> List[Dict]:
    errores = []
    for k, v in respuestas.items():
        if not v: continue
        lower = k.lower()
        if ('a_number' in lower or 'alien' in lower) and len(re.sub(r'[^\d]', '', v)) < 7 and len(re.sub(r'[^\d]', '', v)) > 0:
            errores.append({"campo": k, "valor": v, "error": "A-Number debe tener al menos 7 dígitos", "severidad": "warning"})
        if 'ssn' in lower and len(re.sub(r'[^\d]', '', v)) != 9 and len(re.sub(r'[^\d]', '', v)) > 0:
            errores.append({"campo": k, "valor": v, "error": "SSN debe tener 9 dígitos", "severidad": "warning"})
        if 'phone' in lower and len(re.sub(r'[^\d]', '', v)) < 10 and len(re.sub(r'[^\d]', '', v)) > 0:
            errores.append({"campo": k, "valor": v, "error": "Teléfono debe tener al menos 10 dígitos", "severidad": "warning"})
    return errores
