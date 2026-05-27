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
    # Origen del archivo: "deliverable" (visa_deliverables) o "document"
    # (visa_documents, documentos requeridos del cliente).
    source: str = "deliverable"
    deliverableId: str
    # fileId opcional: si se especifica, solo ese archivo entra al maestro;
    # si es None, entran todos los archivos publicados.
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

def _section(title: str, *, branding: bool = False,
             subsections: Optional[List[dict]] = None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "order": 0,
        "includeBranding": branding,
        "items": [],
        "subsections": subsections or [],
    }


def _subsection(title: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "order": 0,
        "items": [],
    }


def default_print_template() -> List[dict]:
    """Plantilla base editable, basada en la estructura típica de un paquete NIW.

    El documento maestro es en inglés (es lo que recibe USCIS), así que los
    títulos de secciones/subsecciones van en inglés. El admin arranca de acá y
    arrastra los entregables a cada sección. Las portadas llevan branding.
    """
    sections = [
        _section("Photocopy Certification"),
        _section("Forms and Fee"),
        _section("Historical Immigration Documents"),
        _section("Petition for National Interest Waiver", branding=True),
        _section(
            "List of Exhibits", branding=True,
            subsections=[
                _subsection("Exhibit 1: Project"),
                _subsection("Exhibit 2: Supporting Studies"),
                _subsection("Exhibit 3: Curriculum Vitae (CV)"),
                _subsection("Exhibit 4: Certificates of Study"),
                _subsection("Exhibit 5: Letters of Intent to Invest"),
                _subsection("Exhibit 6: Expert Evaluation Letter"),
                _subsection("Exhibit 7: Recommendation from Experts"),
                _subsection("Exhibit 8: Employment Certificate Letters"),
                _subsection("Exhibit 9: Documents of my Family"),
            ],
        ),
    ]
    # Normalizar el campo `order` según la posición en la lista.
    for i, sec in enumerate(sections):
        sec["order"] = i
        for j, sub in enumerate(sec["subsections"]):
            sub["order"] = j
    return sections
