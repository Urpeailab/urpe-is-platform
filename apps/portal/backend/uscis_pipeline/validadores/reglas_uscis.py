"""Validadores: reglas de negocio USCIS."""
import re
from datetime import datetime
from typing import List, Dict

def validar_reglas_uscis(respuestas: dict) -> List[Dict]:
    errores = []
    for k, v in respuestas.items():
        if not v: continue
        lower = k.lower()
        if any(d in lower for d in ['birth', 'nacimiento', 'dob']):
            if re.match(r'\d{2}/\d{2}/\d{4}', v):
                try:
                    p = v.split('/'); dt = datetime(int(p[2]), int(p[0]), int(p[1]))
                    if dt > datetime.now(): errores.append({"campo": k, "error": "Fecha de nacimiento en el futuro", "severidad": "error"})
                except: pass
        if any(z in lower for z in ['zip', 'postal']):
            d = re.sub(r'[^\d]', '', v)
            if d and len(d) not in (5, 9): errores.append({"campo": k, "error": "ZIP debe tener 5 o 9 dígitos", "severidad": "warning"})
        if 'email' in lower and not re.match(r'^[^@]+@[^@]+\.[^@]+$', v):
            errores.append({"campo": k, "error": "Email inválido", "severidad": "error"})
    return errores
