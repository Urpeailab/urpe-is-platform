"""Normalizadores: booleanos (yes/no, checkboxes)."""

def normalizar_si_no(valor: str) -> str:
    if not valor: return ""
    v = valor.strip().lower()
    if v in ('si', 'sí', 'yes', 'y', 'true', '1'): return 'Yes'
    if v in ('no', 'n', 'false', '0'): return 'No'
    return valor

def normalizar_checkbox(valor: str) -> str:
    if not valor: return ""
    v = valor.strip().lower()
    return 'X' if v in ('true', 'yes', 'si', 'sí', '1', 'x', 'on', 'checked') else ''

def normalizar_texto(valor: str) -> str:
    return valor.strip() if valor else ""
