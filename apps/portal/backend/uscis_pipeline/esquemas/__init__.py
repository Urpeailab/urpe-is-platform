"""
Esquemas de datos del pipeline USCIS.
Estructuras estables para intercambio entre capas.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class TipoCampo(str, Enum):
    TEXT = "text"
    DATE = "date"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    SELECT = "select"
    PHONE = "phone"
    EMAIL = "email"
    SSN = "ssn"
    NUMBER = "number"
    TEXTAREA = "textarea"
    BUTTON = "button"


class CampoPdf(BaseModel):
    nombre_campo_pdf: str
    tipo_campo: TipoCampo = TipoCampo.TEXT
    pagina: int = 0
    valor_por_defecto: str = ""
    opciones: List[str] = []
    nombre_legible: str = ""
    etiqueta_espanol: Optional[str] = None
    texto_contexto: str = ""


class SeccionInstrucciones(BaseModel):
    parte: int
    titulo: str
    contenido: str


class InstruccionesParseadas(BaseModel):
    texto_crudo: str = ""
    secciones: List[SeccionInstrucciones] = []
    total_caracteres: int = 0


class EntradaEsquema(BaseModel):
    clave: str
    campo_pdf: str
    etiqueta_es: str = ""
    etiqueta_en: str = ""
    tipo: TipoCampo = TipoCampo.TEXT
    parte: int = 1
    requerido: bool = False
    opciones: List[str] = []


class EsquemaCanonico(BaseModel):
    esquema: List[EntradaEsquema] = []
    partes: List[Dict[str, Any]] = []


class PreguntaCuestionario(BaseModel):
    id: str
    pregunta: str
    tipo: TipoCampo = TipoCampo.TEXT
    requerido: bool = False
    ayuda: str = ""
    claves_campos: List[str] = []


class SeccionCuestionario(BaseModel):
    id: str
    nombre: str
    descripcion: str = ""
    preguntas: List[PreguntaCuestionario] = []


class Cuestionario(BaseModel):
    secciones: List[SeccionCuestionario] = []


class ReglaMapeo(BaseModel):
    clave_canonica: str
    nombre_campo_pdf: str
    transformacion: str = "text"
    tipo_campo: TipoCampo = TipoCampo.TEXT
    etiqueta_es: str = ""


class ResultadoRenderizado(BaseModel):
    total_campos: int = 0
    campos_llenados: int = 0
    campos_no_encontrados: int = 0
    campos_fallidos: int = 0
    cobertura_pct: float = 0.0
    detalles_errores: List[Dict] = []


class ResultadoPipeline(BaseModel):
    campos_inventario: List[CampoPdf] = []
    instrucciones: InstruccionesParseadas = InstruccionesParseadas()
    esquema_canonico: EsquemaCanonico = EsquemaCanonico()
    cuestionario: Cuestionario = Cuestionario()
    reglas_mapeo: List[ReglaMapeo] = []
