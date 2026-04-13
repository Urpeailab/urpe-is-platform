"""Normalizadores: identificadores (A-Number, SSN, teléfono, email)."""
import re

def normalizar_telefono(valor: str) -> str:
    return re.sub(r'[^\d]', '', valor.strip()) if valor else ""

def normalizar_ssn(valor: str) -> str:
    return re.sub(r'[^\d]', '', valor.strip()) if valor else ""

def normalizar_a_number(valor: str) -> str:
    return re.sub(r'[^\d]', '', valor.strip()) if valor else ""

def normalizar_email(valor: str) -> str:
    return valor.strip().lower() if valor else ""
