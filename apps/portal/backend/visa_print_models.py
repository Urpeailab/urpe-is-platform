"""Modelos y plantilla base para el módulo de Impresión (archivo maestro de visa).

El layout de impresión organiza los entregables de un caso en secciones y
subsecciones para generar un PDF maestro paginado (portada + índice + separadoras
+ documentos). La fuente de verdad del orden es el árbol `sections` (JSONB en
Supabase, ver migración 019_visa_print_layouts.sql).
"""

import uuid
from typing import List, Optional, Dict, Any, Union

from pydantic import BaseModel, Field, ConfigDict


# ============= REQUEST MODELS (validación del PUT) =============

# Los títulos pueden ser string o dict bilingüe {"es": ..., "en": ...}, igual que
# `name`/`description` en visa_deliverables.
BilingualText = Union[str, Dict[str, str]]


class PrintItem(BaseModel):
    """Un entregable (o un archivo puntual de un entregable) dentro de una sección."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deliverableId: str
    # fileId opcional: si se especifica, solo ese archivo del entregable entra al
    # maestro; si es None, entran todos los archivos publicados del entregable.
    fileId: Optional[str] = None
    title: Optional[BilingualText] = None
    order: int = 0


class PrintSubsection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: Optional[BilingualText] = None
    order: int = 0
    items: List[PrintItem] = []


class PrintSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: Optional[BilingualText] = None
    order: int = 0
    # Si True, la página separadora de esta sección lleva la imagen de marca.
    includeBranding: bool = False
    items: List[PrintItem] = []
    subsections: List[PrintSubsection] = []


class PrintLayoutUpdate(BaseModel):
    """Body del PUT /print-layout — guarda el árbol completo tras drag&drop."""
    model_config = ConfigDict(extra="ignore")

    sections: List[PrintSection] = []
    brandingClientName: Optional[str] = None
    brandingAddress: Optional[str] = None


# ============= PLANTILLA BASE =============

def _section(es: str, en: str, *, branding: bool = False,
             subsections: Optional[List[dict]] = None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": {"es": es, "en": en},
        "order": 0,
        "includeBranding": branding,
        "items": [],
        "subsections": subsections or [],
    }


def _subsection(es: str, en: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": {"es": es, "en": en},
        "order": 0,
        "items": [],
    }


def default_print_template() -> List[dict]:
    """Plantilla base editable, basada en la estructura típica de un paquete NIW.

    El admin arranca de acá y arrastra los entregables del caso a cada sección /
    subsección. Las secciones de portada llevan branding por default.
    """
    sections = [
        _section("Certificación de Fotocopias", "Photocopy Certification"),
        _section("Formularios y Tarifa", "Forms and Fee"),
        _section("Documentos Migratorios Históricos", "Historical Immigration Documents"),
        _section("Petición de Exención por Interés Nacional",
                 "Petition for National Interest Waiver", branding=True),
        _section(
            "Lista de Exhibits", "List of Exhibits", branding=True,
            subsections=[
                _subsection("Exhibit 1: Proyecto", "Exhibit 1: Project"),
                _subsection("Exhibit 2: Estudios de Soporte", "Exhibit 2: Supporting Studies"),
                _subsection("Exhibit 3: Currículum Vitae (CV)", "Exhibit 3: Curriculum Vitae (CV)"),
                _subsection("Exhibit 4: Certificados de Estudio", "Exhibit 4: Certificates of Study"),
                _subsection("Exhibit 5: Cartas de Intención de Inversión",
                            "Exhibit 5: Letters of Intent to Invest"),
                _subsection("Exhibit 6: Carta de Evaluación de Experto",
                            "Exhibit 6: Expert Evaluation Letter"),
                _subsection("Exhibit 7: Recomendaciones de Expertos",
                            "Exhibit 7: Recommendation from Experts"),
                _subsection("Exhibit 8: Cartas de Certificación Laboral",
                            "Exhibit 8: Employment Certificate Letters"),
                _subsection("Exhibit 9: Documentos de mi Familia",
                            "Exhibit 9: Documents of my Family"),
            ],
        ),
    ]
    # Normalizar el campo `order` según la posición en la lista.
    for i, sec in enumerate(sections):
        sec["order"] = i
        for j, sub in enumerate(sec["subsections"]):
            sub["order"] = j
    return sections
