"""Configuración centralizada del pipeline USCIS.
Todos los módulos DEBEN leer de aquí, no de os.environ directo.
"""
import os

# ===== Gemini =====
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_VISION", os.environ.get("GEMINI_API_KEY", ""))
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_TIMEOUT = 30  # segundos

# ===== Límites de procesamiento =====
MAX_CAMPOS_POR_PROMPT = 150
MAX_SECCIONES_INSTRUCCIONES = 15
MAX_TEXTO_INSTRUCCIONES = 50000
MAX_OPCIONES_POR_CAMPO = 20

# ===== Pipeline =====
PIPELINE_VERSION = "v2"
EXTRACTOR_VERSION = "pypdf+pymupdf"
PROMPT_VERSION_ESQUEMA = "v2.0"
PROMPT_VERSION_CUESTIONARIO = "v2.0"

# ===== Flags por ambiente =====
IS_PRODUCTION = os.environ.get("NODE_ENV") == "production" or "panel.urpeintegralservices.co" in os.environ.get("FRONTEND_URL", "")
GUARDAR_GEMINI_RAW = not IS_PRODUCTION  # Solo en develop guardar respuestas crudas de Gemini
HABILITAR_APLANADO_PDF = False  # Deshabilitado por defecto

# ===== Supabase (para storage de PDFs generados) =====
SUPABASE_STORAGE_URL = os.environ.get("SUPABASE_STORAGE_URL", "")
SUPABASE_STORAGE_KEY = os.environ.get("SUPABASE_STORAGE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
