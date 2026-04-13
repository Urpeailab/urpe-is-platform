"""Normalizadores: fechas."""
import re

def normalizar_fecha(valor: str) -> str:
    if not valor: return ""
    v = valor.strip()
    iso = re.match(r'^(\d{4})-(\d{2})-(\d{2})', v)
    if iso: return f"{iso.group(2)}/{iso.group(3)}/{iso.group(1)}"
    slash = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', v)
    if slash:
        p1, p2, y = int(slash.group(1)), int(slash.group(2)), slash.group(3)
        return f"{p2:02d}/{p1:02d}/{y}" if p1 > 12 else f"{p1:02d}/{p2:02d}/{y}"
    return v
