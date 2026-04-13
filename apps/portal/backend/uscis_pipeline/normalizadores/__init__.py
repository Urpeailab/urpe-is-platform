"""Normalizadores: interfaz pública."""
from uscis_pipeline.normalizadores.fechas import normalizar_fecha
from uscis_pipeline.normalizadores.ubicaciones import normalizar_estado, normalizar_pais, normalizar_zip
from uscis_pipeline.normalizadores.identificadores import normalizar_telefono, normalizar_ssn, normalizar_a_number, normalizar_email
from uscis_pipeline.normalizadores.booleanos import normalizar_si_no, normalizar_checkbox, normalizar_texto

MAPA_NORMALIZADORES = {
    'text': normalizar_texto, 'date': normalizar_fecha, 'date_mmddyyyy': normalizar_fecha,
    'state': normalizar_estado, 'country': normalizar_pais, 'zip': normalizar_zip,
    'yes_no': normalizar_si_no, 'phone': normalizar_telefono, 'phone_digits': normalizar_telefono,
    'checkbox': normalizar_checkbox, 'checkbox_x': normalizar_checkbox,
    'radio': normalizar_texto, 'radio_select': normalizar_texto,
    'a_number': normalizar_a_number, 'ssn': normalizar_ssn, 'ssn_digits': normalizar_ssn,
    'number': normalizar_texto, 'email': normalizar_email, 'textarea': normalizar_texto, 'select': normalizar_texto,
}

def normalizar_valor(valor: str, tipo_campo: str) -> str:
    return MAPA_NORMALIZADORES.get(tipo_campo, normalizar_texto)(valor)

def normalizar_respuestas(respuestas: dict, reglas_mapeo: list) -> dict:
    tipos = {r.clave_canonica: r.transformacion for r in reglas_mapeo}
    return {k: normalizar_valor(str(v), tipos.get(k, 'text')) for k, v in respuestas.items()}
