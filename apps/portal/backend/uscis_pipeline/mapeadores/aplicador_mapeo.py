"""Capa 5: Aplicador de mapeo.
Produce estructura intermedia independiente del motor de PDF.
"""
import logging
from typing import List, Dict
from dataclasses import dataclass, field
from uscis_pipeline.esquemas import ReglaMapeo
from uscis_pipeline.mapeadores.transformador_valores import transformar_valor

logger = logging.getLogger(__name__)


@dataclass
class EdicionPdf:
    """Estructura intermedia de una edición al PDF."""
    nombre_campo: str
    valor: str
    tipo_edicion: str  # "texto", "checkbox", "radio", "dropdown"
    clave_canonica: str = ""


@dataclass
class ResultadoMapeo:
    """Resultado del aplicador: ediciones agrupadas por tipo."""
    campos_texto: List[EdicionPdf] = field(default_factory=list)
    checkboxes: List[EdicionPdf] = field(default_factory=list)
    radios: List[EdicionPdf] = field(default_factory=list)
    dropdowns: List[EdicionPdf] = field(default_factory=list)
    total: int = 0

    def a_lista_plana(self) -> List[Dict]:
        """Convierte a lista plana para el renderizador."""
        ediciones = []
        for e in self.campos_texto + self.checkboxes + self.radios + self.dropdowns:
            ediciones.append({"fieldName": e.nombre_campo, "text": e.valor})
        return ediciones


def aplicar_mapeo(respuestas: dict, reglas: List[ReglaMapeo]) -> ResultadoMapeo:
    """
    Aplica reglas de mapeo a las respuestas normalizadas.
    Retorna estructura intermedia agrupada por tipo.
    """
    resultado = ResultadoMapeo()

    for r in reglas:
        valor = respuestas.get(r.clave_canonica, '')
        if not valor:
            continue

        valor_final = transformar_valor(str(valor), r.transformacion)
        if not valor_final:
            continue

        edicion = EdicionPdf(
            nombre_campo=r.nombre_campo_pdf,
            valor=valor_final,
            tipo_edicion=_clasificar_tipo(r.transformacion),
            clave_canonica=r.clave_canonica,
        )

        if edicion.tipo_edicion == "checkbox":
            resultado.checkboxes.append(edicion)
        elif edicion.tipo_edicion == "radio":
            resultado.radios.append(edicion)
        elif edicion.tipo_edicion == "dropdown":
            resultado.dropdowns.append(edicion)
        else:
            resultado.campos_texto.append(edicion)

    resultado.total = len(resultado.campos_texto) + len(resultado.checkboxes) + len(resultado.radios) + len(resultado.dropdowns)
    logger.info(f"Aplicador: {resultado.total} ediciones ({len(resultado.campos_texto)} texto, {len(resultado.checkboxes)} checkbox, {len(resultado.radios)} radio, {len(resultado.dropdowns)} dropdown)")
    return resultado


def _clasificar_tipo(transformacion: str) -> str:
    if transformacion in ('checkbox_x',):
        return "checkbox"
    if transformacion in ('radio_select',):
        return "radio"
    if transformacion in ('dropdown',):
        return "dropdown"
    return "texto"
