"""Capa 5: Transformador de valores para PDF."""
import re

def transformar_valor(valor: str, transformacion: str) -> str:
    if transformacion == 'checkbox_x':
        return 'X' if valor.lower() in ('true','yes','si','sí','1','x') else ''
    if transformacion == 'date_mmddyyyy':
        m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', valor)
        if m and int(m.group(1)) > 12:
            return f"{m.group(2)}/{m.group(1)}/{m.group(3)}"
        return valor
    if transformacion in ('phone_digits', 'ssn_digits'):
        return re.sub(r'[^\d]', '', valor)
    return valor
