"""
USCIS Forms Module - Backend Routes
AI-powered USCIS PDF form filling application
Access restricted to admin and super_admin roles only
"""

import os
import json
import uuid
import base64
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any, Annotated

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends, status, Header
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import fitz  # PyMuPDF
from openai import OpenAI

from config import db, JWT_SECRET, JWT_ALGORITHM, logger
from utils.auth_helpers import verify_staff_token_impl
from bson import ObjectId

# Import N8N mapping module
import sys, os as _os
sys.path.append(_os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'data'))
from i140_n8n_pdf_mapping import fill_i140_form_n8n

# Import Gemini
import google.generativeai as genai

# Import nuevo procesador Gemini
import sys
sys.path.append('/app/backend')
from utils.form_processor_gemini import FormProcessorGemini, get_gemini_processor

load_dotenv()

# Configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("✅ Gemini API configured")

# OpenAI client (initialized on first use)
_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None and OPENAI_API_KEY:
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


# ============================================================================
# TRANSLATION FUNCTION - Spanish to English for USCIS Forms
# ============================================================================

# Cache for translations to avoid repeated API calls
_translation_cache = {}

def translate_spanish_to_english(text: str, field_context: str = "") -> str:
    """
    Translate Spanish text to English using OpenAI.
    Uses caching to avoid repeated translations of the same text.
    
    Args:
        text: The Spanish text to translate
        field_context: Optional context about what type of field this is (for better translation)
    
    Returns:
        English translation of the text
    """
    if not text or not text.strip():
        return text
    
    # Check if it's already in English or doesn't need translation
    text = text.strip()
    
    # Common translations (hardcoded for speed and consistency) - CHECK FIRST
    common_translations = {
        # Relationships
        "cónyuge": "Spouse",
        "esposo": "Spouse",
        "esposa": "Spouse",
        "hijo": "Child",
        "hija": "Child",
        "hijo/a": "Child",
        "madre": "Mother",
        "padre": "Father",
        
        # Yes/No - Important: check these first before skip patterns
        "sí": "Yes",
        "si": "Yes",
        "no": "No",
        
        # Countries (common ones)
        "colombia": "REPUBLIC OF COLOMBIA",
        "venezuela": "VENEZUELA",
        "perú": "PERU",
        "peru": "PERU",
        "méxico": "MEXICO",
        "mexico": "MEXICO",
        "argentina": "ARGENTINA",
        "chile": "CHILE",
        "ecuador": "ECUADOR",
        "bolivia": "BOLIVIA",
        "brasil": "BRAZIL",
        "cuba": "CUBA",
        "república dominicana": "DOMINICAN REPUBLIC",
        "costa rica": "COSTA RICA",
        "panamá": "PANAMA",
        "guatemala": "GUATEMALA",
        "honduras": "HONDURAS",
        "el salvador": "EL SALVADOR",
        "nicaragua": "NICARAGUA",
        "puerto rico": "PUERTO RICO",
        "uruguay": "URUGUAY",
        "paraguay": "PARAGUAY",
        "estados unidos": "UNITED STATES OF AMERICA",
        "españa": "SPAIN",
        
        # Common words
        "calle": "Street",
        "avenida": "Avenue",
        "apartamento": "Apartment",
        "piso": "Floor",
        "edificio": "Building",
        "casa": "House",
        "ciudad": "City",
        "provincia": "Province",
        "estado": "State",
        "país": "Country",
        
        # Employment related
        "tiempo completo": "Full-time",
        "medio tiempo": "Part-time",
        "permanente": "Permanent",
        "temporal": "Temporary",
        "gerente": "Manager",
        "director": "Director",
        "ingeniero": "Engineer",
        "abogado": "Attorney",
        "médico": "Physician",
        "profesor": "Professor",
        "investigador": "Researcher",
        "científico": "Scientist",
        "consultor": "Consultant",
        "analista": "Analyst",
        "desarrollador": "Developer",
        "programador": "Programmer",
        "contador": "Accountant",
        "administrador": "Administrator",
    }
    
    # Check for exact match in common translations (case insensitive) - BEFORE skip patterns
    text_lower = text.lower().strip()
    if text_lower in common_translations:
        result = common_translations[text_lower]
        _translation_cache[f"{text}|{field_context}"] = result
        return result
    
    # Skip translation for certain patterns
    skip_patterns = [
        # Numbers only
        text.replace("-", "").replace(" ", "").isdigit(),
        # Email addresses
        "@" in text and "." in text,
        # URLs
        text.startswith("http"),
        # Already uppercase English (likely already translated)
        text.isupper() and not any(c in text for c in "ÁÉÍÓÚÑÜ"),
        # Short codes or identifiers (but not common words like Sí, No)
        len(text) <= 2 and text.isalnum() and text_lower not in common_translations,
    ]
    
    if any(skip_patterns):
        return text.upper() if len(text) > 3 else text
    
    # Check cache
    cache_key = f"{text}|{field_context}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]
    
    # For longer texts, use OpenAI directly
    try:
        system_prompt = """You are a professional translator for USCIS immigration forms.
Translate the following Spanish text to English.
Rules:
- Use formal, official language appropriate for government forms
- Keep proper nouns (names, cities, addresses) as-is but in UPPERCASE
- Translate common words to their English equivalents
- For countries, use the official English name (e.g., "Republic of Colombia")
- For relationships: Cónyuge=Spouse, Hijo/a=Child, Padre=Father, Madre=Mother
- Keep numbers and dates in their original format
- Return ONLY the translated text, nothing else
- If text is already in English, return it in UPPERCASE"""

        context_hint = f"\nField context: {field_context}" if field_context else ""

        client = _get_openai_client()
        if not client:
            logger.warning("OpenAI client not available for translation")
            return text.upper()

        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Translate to English:{context_hint}\n\n{text}"}
            ],
            temperature=0.3,
            max_tokens=500
        )

        translated = response.choices[0].message.content.strip()

        # Cache the result
        _translation_cache[cache_key] = translated

        logger.info(f"Translated: '{text}' -> '{translated}'")
        return translated

    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text.upper()


def translate_form_answers(answers_dict: dict) -> dict:
    """
    Translate all answers in a form dictionary from Spanish to English.
    
    Args:
        answers_dict: Dictionary of {question: answer} pairs
        
    Returns:
        Dictionary with translated answers
    """
    translated = {}
    
    # Fields that should NOT be translated, only converted to uppercase
    # These are proper nouns like names that should remain as-is
    name_field_patterns = [
        "apellido",
        "nombre", 
        "family name",
        "given name",
        "middle name",
        "segundo nombre",
        "firma",
        "signature",
    ]
    
    # Field context mapping for better translations
    field_contexts = {
        "relación": "family relationship",
        "relationship": "family relationship",
        "país": "country name",
        "country": "country name",
        "ciudad": "city name",
        "city": "city name",
        "calle": "street address",
        "street": "street address",
        "trabajo": "job/employment",
        "job": "job/employment",
        "descripción": "description",
        "description": "description",
    }
    
    for question, answer in answers_dict.items():
        if not answer or not isinstance(answer, str):
            translated[question] = answer
            continue
        
        question_lower = question.lower()
        
        # Check if this is a name field - just uppercase, don't translate
        is_name_field = any(pattern in question_lower for pattern in name_field_patterns)
        if is_name_field:
            # Names should just be uppercased, not translated
            # Remove accents for USCIS compatibility
            import unicodedata
            normalized = unicodedata.normalize('NFD', answer)
            without_accents = ''.join(c for c in normalized if not unicodedata.combining(c))
            translated[question] = without_accents.upper()
            continue
        
        # Determine field context from question
        context = ""
        for key, ctx in field_contexts.items():
            if key in question_lower:
                context = ctx
                break
        
        # Translate the answer
        translated[question] = translate_spanish_to_english(answer, context)
    
    return translated

def is_expired(expires_at) -> bool:
    """Safely compare expiration dates handling both naive and aware datetimes."""
    if not expires_at:
        return False
    now = datetime.now(timezone.utc)
    # If expires_at is naive (no timezone), assume it's UTC and make it aware
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < now

# Router
router = APIRouter(prefix="/uscis-forms", tags=["USCIS Forms"])

# ============================================================================
# TRANSLATION ON-DEMAND ENDPOINT
# ============================================================================

class TranslateRequest(BaseModel):
    """Request model for on-demand translation"""
    form_id: str
    answers: dict  # Dictionary of question -> answer pairs

@router.post("/translate-answers")
async def translate_answers_on_demand(
    request: TranslateRequest,
    authorization: Annotated[str | None, Header()] = None
):
    """
    Translate form answers from Spanish to English on-demand.
    This is called when the coordinator clicks "Translate to English" button.
    Returns the translated answers for preview before PDF download.
    """
    try:
        # Verify staff token (pass full authorization header)
        user_data = verify_staff_token_impl(authorization)
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        logger.info(f"Translating answers on-demand for form {request.form_id}")
        
        # Translate the answers
        translated_answers = translate_form_answers(request.answers)
        
        logger.info(f"Translation completed. Translated {len(translated_answers)} fields.")
        
        return {
            "success": True,
            "original_answers": request.answers,
            "translated_answers": translated_answers,
            "translation_count": len(translated_answers)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

# ============================================================================
# UTILITY FUNCTIONS - MEJORAS IMPLEMENTADAS
# ============================================================================

def normalize_field_id(page_num: int, field_name: str) -> str:
    """
    Normaliza el field_id para evitar problemas con caracteres especiales.
    
    Ejemplos:
    - "form1[0].#subform[0].Field[0]" → "page0_form1_0_subform_0_Field_0"
    - "Line6b_StreetNumberName[0]" → "page0_Line6b_StreetNumberName_0"
    """
    clean_name = re.sub(r'[^\w\-]', '_', field_name)
    clean_name = re.sub(r'_+', '_', clean_name)
    clean_name = clean_name.strip('_')
    return f"page{page_num}_{clean_name}"


def extract_dropdown_options(widget) -> list:
    """
    Extrae opciones de dropdown de forma robusta.
    Maneja diferentes formatos que PyMuPDF puede devolver.
    """
    try:
        raw_options = widget.choice_values or []
        options = []
        
        for opt in raw_options:
            try:
                if isinstance(opt, tuple):
                    options.append(str(opt[0]) if opt else "")
                elif isinstance(opt, list):
                    options.append(str(opt[0]) if opt else "")
                elif isinstance(opt, str):
                    options.append(opt)
                else:
                    options.append(str(opt))
            except Exception as e:
                logger.warning(f"Error parsing dropdown option {opt}: {e}")
                continue
        
        return [o for o in options if o]
    
    except Exception as e:
        logger.error(f"Error extracting dropdown options: {e}")
        return []


def extract_key_instructions(instructions_text: str, max_length: int = 50000) -> str:
    """
    Extrae las secciones más relevantes de las instrucciones cuando son muy largas.
    """
    if len(instructions_text) <= max_length:
        return instructions_text
    
    # Secciones clave a priorizar
    key_sections = [
        "Who Should File",
        "Required Evidence",
        "Completing This Form",
        "Specific Instructions",
        "Evidence",
        "Supporting Documents"
    ]
    
    instructions_parts = []
    for section in key_sections:
        idx = instructions_text.lower().find(section.lower())
        if idx != -1:
            section_text = instructions_text[idx:idx+5000]
            instructions_parts.append(section_text)
    
    if instructions_parts:
        result = "\n\n".join(instructions_parts)
        if len(result) > max_length:
            return result[:max_length]
        return result
    else:
        return instructions_text[:max_length]


async def validate_ai_mapping(
    fields: list,
    field_mappings: dict,
    answers: list
) -> dict:
    """
    Valida que el mapeo de IA sea completo y coherente.
    Devuelve warnings pero NO bloquea la generación.
    """
    validation_report = {
        "warnings": [],
        "stats": {
            "total_fields": len(fields),
            "mapped_fields": len(field_mappings),
            "unmapped_fields": 0,
            "total_answers": len(answers),
            "mapped_answers": 0
        }
    }
    
    # 1. Verificar campos importantes no mapeados
    important_keywords = [
        "name", "apellido", "nombre", "date", "fecha", 
        "country", "país", "address", "dirección"
    ]
    
    unmapped_important = []
    for field in fields:
        field_id = field.get('field_id')
        if field_id not in field_mappings:
            label = field.get('label_context', '').lower()
            if any(keyword in label for keyword in important_keywords):
                unmapped_important.append({
                    "field_id": field_id,
                    "label": field.get('label_context', '')[:100]
                })
    
    if unmapped_important:
        validation_report["warnings"].append({
            "type": "unmapped_important_fields",
            "count": len(unmapped_important),
            "fields": unmapped_important[:5]
        })
    
    # 2. Verificar respuestas no usadas
    used_answers = set()
    for field_id, value in field_mappings.items():
        if value and str(value).strip():
            used_answers.add(str(value)[:50])
    
    unused_answers = []
    for answer in answers:
        answer_text = str(answer.answer)[:50]
        if answer_text and answer_text not in used_answers and answer_text.strip():
            unused_answers.append({
                "question": answer.question[:100],
                "answer": answer_text
            })
    
    if len(unused_answers) > len(answers) * 0.3:
        validation_report["warnings"].append({
            "type": "many_unused_answers",
            "count": len(unused_answers),
            "percentage": round(len(unused_answers) / len(answers) * 100, 1)
        })
    
    # 3. Stats
    validation_report["stats"]["unmapped_fields"] = len(fields) - len(field_mappings)
    validation_report["stats"]["mapped_answers"] = len(answers) - len(unused_answers)
    
    # Log warnings
    if validation_report["warnings"]:
        logger.warning(f"AI Mapping validation warnings: {len(validation_report['warnings'])}")
        for warning in validation_report["warnings"]:
            logger.warning(f"  - {warning['type']}: {warning.get('count', 0)}")
    
    return validation_report

# ============================================================================
# Helper Functions
# ============================================================================

async def find_template_by_id(template_id: str, projection: dict = None):
    """Find a template by ID, handling both string and ObjectId formats."""
    # Try string ID first
    query = {"_id": template_id}
    template = await db.uscis_templates.find_one(query, projection)
    
    if not template:
        # Try ObjectId
        try:
            template = await db.uscis_templates.find_one({"_id": ObjectId(template_id)}, projection)
        except:
            pass
    
    return template

async def delete_template_by_id(template_id: str):
    """Delete a template by ID, handling both string and ObjectId formats."""
    result = await db.uscis_templates.delete_one({"_id": template_id})
    
    if result.deleted_count == 0:
        try:
            result = await db.uscis_templates.delete_one({"_id": ObjectId(template_id)})
        except:
            pass
    
    return result

async def update_template_by_id(template_id: str, update: dict):
    """Update a template by ID, handling both string and ObjectId formats."""
    result = await db.uscis_templates.update_one({"_id": template_id}, update)
    
    if result.matched_count == 0:
        try:
            result = await db.uscis_templates.update_one({"_id": ObjectId(template_id)}, update)
        except:
            pass
    
    return result

# ============================================================================
# Auth Helper - Verify Admin or Super Admin
# ============================================================================

def verify_admin_or_super_admin(authorization: str):
    """Verify that the user is an admin or super_admin."""
    try:
        payload = verify_staff_token_impl(authorization)
        role = payload.get('role', '')
        
        if role not in ['admin', 'super_admin', 'coordinator', 'advisor']:
            raise HTTPException(
                status_code=403, 
                detail="Acceso denegado. Solo administradores pueden acceder a este módulo."
            )
        
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error in USCIS forms: {e}")
        raise HTTPException(status_code=401, detail="Token inválido")

# ============================================================================
# Models
# ============================================================================

class QuestionAnswer(BaseModel):
    question: str
    answer: str

class SharedFormLink(BaseModel):
    template_id: str
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    expires_in_days: Optional[int] = 30
    form_type: Optional[str] = "complete"  # "complete" or "pre_validation"
    visa_case_id: Optional[str] = None  # Linked visa case

class ClientSubmission(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    answers: List[QuestionAnswer]
    submission_status: Optional[str] = "por_revisar"  # "por_revisar", "revisado", "completado"

class ChatMessage(BaseModel):
    template_id: str
    message: str
    conversation_history: Optional[List[dict]] = []

# ============================================================================
# Visa Categories Configuration
# ============================================================================

VISA_CATEGORIES = {
    "EB-1": {
        "name": "EB-1 (Primera Preferencia)",
        "description": "Para personas con habilidades extraordinarias, profesores/investigadores destacados, o ejecutivos multinacionales",
        "subcategories": {
            "EB-1A": {
                "name": "Habilidades Extraordinarias (Artes, Ciencias, Negocios, Educación, Deportes)",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": True,
                "special_notes": "El solicitante debe demostrar habilidades extraordinarias con evidencia sustancial. No requiere oferta de empleo."
            },
            "EB-1B": {
                "name": "Profesores e Investigadores Destacados",
                "requires_employer": True,
                "requires_labor_cert": False,
                "self_petition": False,
                "special_notes": "Requiere oferta de empleo permanente de una universidad o institución de investigación."
            },
            "EB-1C": {
                "name": "Ejecutivos y Gerentes Multinacionales",
                "requires_employer": True,
                "requires_labor_cert": False,
                "self_petition": False,
                "special_notes": "Requiere que el empleador sea una empresa multinacional y el beneficiario haya trabajado en el extranjero."
            }
        }
    },
    "EB-2": {
        "name": "EB-2 (Segunda Preferencia)",
        "description": "Para profesionales con títulos avanzados o habilidades excepcionales",
        "subcategories": {
            "EB-2A": {
                "name": "Profesionales con Título Avanzado",
                "requires_employer": True,
                "requires_labor_cert": True,
                "self_petition": False,
                "special_notes": "Requiere título de maestría o superior, o licenciatura + 5 años de experiencia progresiva."
            },
            "EB-2B": {
                "name": "Habilidades Excepcionales",
                "requires_employer": True,
                "requires_labor_cert": True,
                "self_petition": False,
                "special_notes": "Requiere demostrar habilidades excepcionales en ciencias, artes o negocios."
            },
            "NIW": {
                "name": "National Interest Waiver (Exención por Interés Nacional)",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": True,
                "special_notes": "NO requiere empleador ni certificación laboral. El solicitante debe demostrar que su trabajo beneficia el interés nacional de EE.UU."
            }
        }
    },
    "EB-3": {
        "name": "EB-3 (Tercera Preferencia)",
        "description": "Para trabajadores calificados, profesionales y otros trabajadores",
        "subcategories": {
            "EB-3A": {
                "name": "Trabajadores Calificados",
                "requires_employer": True,
                "requires_labor_cert": True,
                "self_petition": False,
                "special_notes": "Requiere mínimo 2 años de experiencia o entrenamiento."
            },
            "EB-3B": {
                "name": "Profesionales",
                "requires_employer": True,
                "requires_labor_cert": True,
                "self_petition": False,
                "special_notes": "Requiere título universitario (licenciatura) para el puesto."
            },
            "EB-3C": {
                "name": "Otros Trabajadores",
                "requires_employer": True,
                "requires_labor_cert": True,
                "self_petition": False,
                "special_notes": "Para trabajos que requieren menos de 2 años de experiencia."
            }
        }
    },
    "Family": {
        "name": "Visas Familiares",
        "description": "Peticiones basadas en relaciones familiares",
        "subcategories": {
            "IR": {
                "name": "Familiares Inmediatos de Ciudadanos",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": False,
                "petitioner_type": "family",
                "special_notes": "Cónyuges, hijos solteros menores de 21 años, y padres de ciudadanos mayores de 21 años."
            },
            "F1": {
                "name": "Hijos Solteros de Ciudadanos",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": False,
                "petitioner_type": "family",
                "special_notes": "Hijos solteros mayores de 21 años de ciudadanos estadounidenses."
            },
            "F2A": {
                "name": "Cónyuges e Hijos de Residentes",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": False,
                "petitioner_type": "family",
                "special_notes": "Cónyuges e hijos solteros menores de 21 años de residentes permanentes."
            }
        }
    },
    "B-1/B-2": {
        "name": "Visa de Turismo y Negocios",
        "description": "Visas de no-inmigrante para visitantes temporales por turismo o negocios",
        "subcategories": {
            "B-1": {
                "name": "Negocios",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": True,
                "petitioner_type": "individual",
                "special_notes": "Para visitas temporales de negocios: reuniones, conferencias, consultas, negociaciones. NO permite empleo en EE.UU."
            },
            "B-2": {
                "name": "Turismo",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": True,
                "petitioner_type": "individual",
                "special_notes": "Para turismo, vacaciones, visitas a familiares/amigos, tratamiento médico. Estancia típica de hasta 6 meses."
            },
            "B-1/B-2": {
                "name": "Turismo y Negocios Combinados",
                "requires_employer": False,
                "requires_labor_cert": False,
                "self_petition": True,
                "petitioner_type": "individual",
                "special_notes": "Visa combinada para actividades de turismo y negocios. La más común para visitantes temporales. NO permite trabajar en EE.UU."
            }
        }
    }
}

# ============================================================================
# PDF Processing Helpers
# ============================================================================

def detect_form_fields(pdf_bytes: bytes) -> List[dict]:
    """Detect all fillable AcroForm fields in the PDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    fields = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        widgets = list(page.widgets())
        
        for widget in widgets:
            if not widget.field_name:
                continue
            
            field_type = "text"
            if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                field_type = "checkbox"
            elif widget.field_type in (fitz.PDF_WIDGET_TYPE_COMBOBOX, fitz.PDF_WIDGET_TYPE_LISTBOX):
                field_type = "dropdown"
            elif widget.field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
                field_type = "radio"
            
            options = None
            if widget.field_type in (fitz.PDF_WIDGET_TYPE_COMBOBOX, fitz.PDF_WIDGET_TYPE_LISTBOX):
                options = extract_dropdown_options(widget)
            
            current_value = widget.field_value
            if isinstance(current_value, bool):
                current_value = str(current_value).lower()
            
            # Extract nearby text for context (MEJORADO: área más grande)
            rect = widget.rect
            search_rect = fitz.Rect(rect)
            search_rect.x0 -= 200  # Aumentado de 100 a 200
            search_rect.y0 -= 100  # Aumentado de 50 a 100
            search_rect.x1 += 200  # Aumentado de 100 a 200
            search_rect.y1 += 100  # Aumentado de 50 a 100
            search_rect.intersect(page.rect)
            nearby_text = page.get_text("text", clip=search_rect).strip()
            
            fields.append({
                "field_id": normalize_field_id(page_num, widget.field_name),  # MEJORADO: normalizado
                "field_type": field_type,
                "page": page_num,
                "label_context": nearby_text[:1000] if nearby_text else widget.field_name,  # MEJORADO: 1000 chars
                "native_field_name": widget.field_name,  # Mantener nombre original
                "current_value": current_value,
                "options": options,
                "bbox": list(widget.rect),
            })
    
    doc.close()
    return fields

def fill_pdf_fields(pdf_bytes: bytes, edits: dict, use_direct_mapping: bool = False) -> tuple:
    """Apply edits to PDF form fields.
    
    Args:
        pdf_bytes: The PDF file as bytes
        edits: Either AI-mapped page{num}_{field_name} format OR direct N8N field mappings
        use_direct_mapping: If True, edits contains direct PDF field names from N8N
        
    Returns:
        tuple: (filled_pdf_bytes, error_report)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    error_report = {
        "total_fields": len(edits),
        "successful": 0,
        "failed": 0,
        "errors": []
    }
    
    if use_direct_mapping:
        # N8N Direct Mapping (sin cambios)
        for edit in edits:
            field_name = edit.get("fieldName")
            field_value = edit.get("text", "")
            
            if not field_name:
                continue
            
            found = False
            for page_num in range(len(doc)):
                page = doc[page_num]
                for widget in page.widgets():
                    if widget.field_name == field_name:
                        try:
                            if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                                widget.field_value = field_value.upper() in ('X', 'TRUE', 'YES', '1', 'CHECKED')
                            else:
                                widget.field_value = str(field_value)
                            widget.update()
                            error_report["successful"] += 1
                            found = True
                        except Exception as e:
                            error_report["failed"] += 1
                            error_report["errors"].append({
                                "field": field_name,
                                "value": str(field_value)[:50],
                                "error": str(e)
                            })
                            logger.error(f"Error filling field {field_name}: {e}")
                        break
                if found:
                    break
            
            if not found:
                logger.warning(f"Field not found in PDF: {field_name}")
    else:
        # AI Mapping (MEJORADO: mejor manejo de errores)
        for page_num in range(len(doc)):
            page = doc[page_num]
            for widget in page.widgets():
                if not widget.field_name:
                    continue
                
                # Buscar por field_id normalizado
                normalized_id = normalize_field_id(page_num, widget.field_name)
                
                # Intentar ambos formatos para compatibilidad
                field_id_options = [
                    normalized_id,
                    f"page{page_num}_{widget.field_name}"  # Formato antiguo
                ]
                
                matched_value = None
                for field_id in field_id_options:
                    if field_id in edits:
                        matched_value = edits[field_id]
                        break
                
                if matched_value is not None:
                    try:
                        if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                            if isinstance(matched_value, str):
                                matched_value = matched_value.lower() in ('true', 'yes', '1', 'checked', 'x')
                            widget.field_value = bool(matched_value)
                        else:
                            widget.field_value = str(matched_value)
                        widget.update()
                        error_report["successful"] += 1
                    except Exception as e:
                        error_report["failed"] += 1
                        error_report["errors"].append({
                            "field_id": normalized_id,
                            "native_name": widget.field_name,
                            "value": str(matched_value)[:50],
                            "error": str(e)
                        })
                        logger.error(f"Error filling field {normalized_id} ({widget.field_name}): {e}")
    
    result = doc.tobytes()
    doc.close()
    
    # Log summary
    if error_report["failed"] > 0:
        logger.warning(f"PDF filling: {error_report['successful']} successful, {error_report['failed']} failed")
    else:
        logger.info(f"PDF filling: All {error_report['successful']} fields filled successfully")
    
    return result, error_report

# ============================================================================
# HTML Generation for Forms without PDF
# ============================================================================

def generate_html_form(template, answers):
    """Generate HTML document with all answers and copy buttons."""
    sections_data = template.get("questions", {}).get("sections", [])
    answers_dict = {a.question: a.answer for a in answers}
    
    html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{template['form_code']} - {template['name']}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        .header h1 {{ font-size: 32px; margin-bottom: 10px; font-weight: 600; }}
        .header p {{ font-size: 18px; opacity: 0.9; }}
        .content {{ padding: 40px; }}
        .section {{
            margin-bottom: 40px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 30px;
        }}
        .section:last-child {{ border-bottom: none; }}
        .section-title {{
            font-size: 24px;
            color: #d4af37;
            margin-bottom: 20px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .section-icon {{
            width: 32px;
            height: 32px;
            background: #d4af37;
            color: #0a1628;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }}
        .question-block {{
            margin-bottom: 24px;
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            position: relative;
            transition: all 0.3s ease;
        }}
        .question-block:hover {{
            background: #e9ecef;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        .question {{ font-weight: 600; color: #333; margin-bottom: 12px; font-size: 16px; }}
        .answer {{
            color: #495057;
            font-size: 15px;
            line-height: 1.6;
            padding: 12px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #d4af37;
            word-wrap: break-word;
        }}
        .copy-btn {{
            position: absolute;
            top: 16px;
            right: 16px;
            background: #d4af37;
            color: #0a1628;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.3s ease;
        }}
        .copy-btn:hover {{ background: #c9a227; transform: scale(1.05); }}
        .copy-btn.copied {{ background: #10b981; color: white; }}
        .footer {{
            text-align: center;
            padding: 30px;
            background: #f8f9fa;
            color: #6c757d;
            font-size: 14px;
        }}
        @media print {{
            body {{ background: white; padding: 0; }}
            .copy-btn {{ display: none; }}
            .container {{ box-shadow: none; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{template['form_code']}</h1>
            <p>{template['name']}</p>
        </div>
        <div class="content">
"""
    
    section_num = 1
    for section in sections_data:
        section_answers = []
        for q in section.get("questions", []):
            if q["question"] in answers_dict and answers_dict[q["question"]].strip():
                section_answers.append((q["question"], answers_dict[q["question"]]))
        
        if section_answers:
            # Handle both 'name' and 'title' keys for section names
            section_name = section.get('name') or section.get('title', f'Sección {section_num}')
            html += f"""
            <div class="section">
                <div class="section-title">
                    <div class="section-icon">{section_num}</div>
                    {section_name}
                </div>
"""
            for question, answer in section_answers:
                question_id = question.replace(' ', '_').replace('?', '').replace('¿', '')[:50]
                html += f"""
                <div class="question-block">
                    <button class="copy-btn" onclick="copyAnswer('{question_id}', this)">📋 Copiar</button>
                    <div class="question">{question}</div>
                    <div class="answer" id="{question_id}">{answer}</div>
                </div>
"""
            html += """
            </div>
"""
            section_num += 1
    
    html += f"""
        </div>
        <div class="footer">
            <p><strong>URPE Integral Services</strong> - Sistema de Formularios USCIS</p>
            <p>Generado el {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC</p>
        </div>
    </div>
    <script>
        function copyAnswer(id, button) {{
            const element = document.getElementById(id);
            const text = element.innerText;
            navigator.clipboard.writeText(text).then(() => {{
                button.innerHTML = '✓ Copiado';
                button.classList.add('copied');
                setTimeout(() => {{
                    button.innerHTML = '📋 Copiar';
                    button.classList.remove('copied');
                }}, 2000);
            }});
        }}
    </script>
</body>
</html>
"""
    
    return html

# ============================================================================
# AI Processing
# ============================================================================

TRANSLATION_SYSTEM_PROMPT = """You are an expert assistant for filling USCIS immigration forms. Your job is to:

1. Analyze the user's answers (which may be in Spanish or English)
2. Translate any Spanish content to proper English for official forms
3. Map the answers to the correct form fields
4. Apply proper formatting for USCIS forms:
   - Country names in full English (e.g., "Estados Unidos" → "United States of America", "México" → "Mexico")
   - Dates in MM/DD/YYYY format
   - Names in UPPERCASE when required
   - Phone numbers: REMOVE all dashes, spaces, parentheses. Example: "(555) 123-4567" → "5551234567"
   - SSN: REMOVE all dashes. Example: "567-98-0000" → "567980000"
   - A-Number: REMOVE dashes. Example: "A-123-456-789" → "123456789"
   - ZIP codes: Keep only numbers
   - Addresses formatted correctly

You MUST respond with a valid JSON object containing field mappings."""

async def map_answers_to_fields(answers, fields, instructions_text=None, visa_category=None, visa_subcategory=None):
    """
    MEJORADO v2: Usa FormProcessorGemini con Structured Outputs (Pydantic).
    Incluye todas las mejoras de precisión + validación automática.
    """
    try:
        # Obtener procesador Gemini
        processor = get_gemini_processor()
        logger.info(f"[AI] Mapeando {len(answers)} respuestas a {len(fields)} campos con Gemini")
        
        # Preparar respuestas en formato correcto
        answers_list = [
            {"question": a.question, "answer": a.answer}
            for a in answers if a.answer and str(a.answer).strip()
        ]
        
        # Usar el procesador Gemini con structured outputs
        field_mappings = processor.map_answers_to_fields(
            answers=answers_list,
            fields=fields,
            instructions_text=instructions_text
        )
        
        logger.info(f"[AI] ✅ Mapeados {len(field_mappings)} campos exitosamente")
        
        return field_mappings
        
    except Exception as e:
        logger.error(f"[AI] Error mapeando respuestas con Gemini: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al mapear campos con Gemini: {str(e)}"
        )

async def generate_questions_for_form(
    fields: List[dict],
    instructions_text: Optional[str] = None,
    visa_category: Optional[str] = None,
    visa_subcategory: Optional[str] = None
) -> tuple:
    """
    Generate user-friendly questions for form fields using Gemini AI.
    
    Esta función REEMPLAZA la anterior implementación con OpenAI.
    Ahora usa Google Gemini 2.0 Flash con structured outputs para mejor calidad.
    
    Returns:
        tuple: (questionnaire_dict, fields_with_labels)
    """
    try:
        # Obtener procesador Gemini
        processor = get_gemini_processor()
        logger.info(f"[AI] Generando cuestionario con Gemini para {len(fields)} campos")
        
        # 1. Generar etiquetas amigables primero
        fields_with_labels = processor.generate_friendly_labels(fields)
        logger.info(f"[AI] Etiquetas amigables generadas")
        
        # 2. Generar cuestionario completo
        form_code = "USCIS"  # Default, será sobrescrito en create_template si aplica
        questionnaire = processor.generate_questionnaire(
            fields=fields_with_labels,
            form_code=form_code,
            instructions_text=instructions_text,
            visa_category=visa_category,
            visa_subcategory=visa_subcategory
        )
        
        # 3. Validar cobertura
        coverage = processor.validate_questionnaire_coverage(questionnaire, fields_with_labels)
        logger.info(f"[AI] Cobertura del cuestionario: {coverage['coverage_pct']}% ({coverage['mapped_fields']}/{coverage['total_fields']} campos)")
        
        # 4. Agregar información de visa si aplica
        visa_info = None
        requires_employer = True
        is_self_petition = False
        special_notes = ""
        
        if visa_category and visa_subcategory:
            category_data = VISA_CATEGORIES.get(visa_category, {})
            subcategory_data = category_data.get("subcategories", {}).get(visa_subcategory, {})
            if isinstance(subcategory_data, dict):
                visa_info = subcategory_data
                requires_employer = subcategory_data.get("requires_employer", True)
                is_self_petition = subcategory_data.get("self_petition", False)
                special_notes = subcategory_data.get("special_notes", "")
                
                questionnaire["visa_requirements"] = {
                    "requires_employer": requires_employer,
                    "is_self_petition": is_self_petition,
                    "special_notes": special_notes
                }
        
        # 5. Agregar metadata de cobertura
        questionnaire["_coverage_report"] = coverage
        
        logger.info(f"[AI] ✅ Cuestionario generado: {questionnaire['total_questions']} preguntas en {len(questionnaire['sections'])} secciones")
        
        # Devolver cuestionario Y campos con etiquetas
        return questionnaire, fields_with_labels
        
    except Exception as e:
        logger.error(f"[AI] Error generando cuestionario con Gemini: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando cuestionario: {str(e)}")

# ============================================================================
# Routes
# ============================================================================

@router.get("/visa-categories")
async def get_visa_categories(authorization: Annotated[str, Header()]):
    """Get all visa categories and subcategories."""
    verify_admin_or_super_admin(authorization)
    return VISA_CATEGORIES

@router.post("/templates")
async def create_template(
    authorization: Annotated[str, Header()],
    name: str = Form(...),
    form_code: str = Form(...),
    description: str = Form(None),
    visa_category: str = Form(...),
    visa_subcategory: str = Form(...),
    form_pdf: UploadFile = File(None),
    instructions_pdf: UploadFile = File(None),
):
    """Create a new form template by uploading PDF and instructions."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    if not visa_category:
        raise HTTPException(status_code=400, detail="Debe seleccionar una categoría de visa")
    
    if not visa_subcategory:
        raise HTTPException(status_code=400, detail="Debe seleccionar un tipo de visa específico")
    
    # Check if this is a B-1/B-2 visa (DS-160 online form)
    is_tourist_visa = visa_category == "B-1/B-2"
    
    if is_tourist_visa:
        form_bytes = None
        fields = []
        canonical_schema = None
        field_mapping = None
        template_id = None
        
        # Load DS-160 questions from JSON file
        ds160_path = os.path.join(os.path.dirname(__file__), '..', 'ds160_questions.json')
        try:
            with open(ds160_path, 'r', encoding='utf-8') as f:
                ds160_data = json.load(f)
                questions = ds160_data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading DS-160 questions: {str(e)}")
        
        instructions_text = "DS-160 es un formulario en línea. Las preguntas están basadas en el formulario oficial de solicitud de visa de no inmigrante de EE.UU."
    else:
        if not form_pdf:
            raise HTTPException(status_code=400, detail="El PDF del formulario USCIS es obligatorio")
        
        if not instructions_pdf:
            raise HTTPException(status_code=400, detail="El PDF de las instrucciones oficiales de USCIS es obligatorio")
        
        form_bytes = await form_pdf.read()
        instructions_bytes = await instructions_pdf.read()
        
        logger.info(f"[USCIS Forms] Running new pipeline for: {form_code} | Visa: {visa_category}/{visa_subcategory}")
        
        # Generate template ID early (needed by pipeline for audit/registry)
        template_id = str(uuid.uuid4())
        
        # Run the 5-layer pipeline
        from uscis_pipeline import ejecutar_pipeline_plantilla
        pipeline_result = await ejecutar_pipeline_plantilla(
            pdf_formulario=form_bytes,
            pdf_instrucciones=instructions_bytes,
            codigo_formulario=form_code,
            categoria_visa=visa_category,
            subcategoria_visa=visa_subcategory,
            db=db,
            template_id=template_id,
            creado_por=staff_id,
        )
        
        campos_inv = pipeline_result['campos_inventario']
        instrucciones_obj = pipeline_result['instrucciones']
        esquema_can = pipeline_result['esquema_canonico']
        cuest = pipeline_result['cuestionario']
        mapeo = pipeline_result['reglas_mapeo']
        
        instructions_text = instrucciones_obj.texto_crudo
        
        if not campos_inv:
            raise HTTPException(status_code=400, detail="No se detectaron campos rellenables en el PDF")
        
        # Convert to formats expected by the rest of the system
        fields = [{'field_id': f'page{c.pagina}_{c.nombre_campo_pdf}', 'native_field_name': c.nombre_campo_pdf, 'field_type': c.tipo_campo.value, 'page_number': c.pagina, 'friendly_label': c.etiqueta_espanol or c.nombre_legible, 'label_context': c.texto_contexto, 'options': c.opciones} for c in campos_inv]
        
        # Convert questionnaire to frontend format
        questions = {'sections': [{'id': s.id, 'name': s.nombre, 'description': s.descripcion, 'questions': [{'id': q.id, 'question': q.pregunta, 'type': q.tipo.value, 'required': q.requerido, 'hint': q.ayuda, 'field_keys': q.claves_campos} for q in s.preguntas]} for s in cuest.secciones], 'form_code': form_code}
        
        canonical_schema = {'schema': [e.model_dump() for e in esquema_can.esquema], 'parts': esquema_can.partes}
        field_mapping = [r.model_dump() for r in mapeo]
        
        logger.info(f"[USCIS Forms] Pipeline v2: {len(fields)} campos, {sum(len(s.preguntas) for s in cuest.secciones)} preguntas")
    
    # Create template
    if not template_id:
        template_id = str(uuid.uuid4())
    template = {
        "_id": template_id,
        "name": name,
        "form_code": form_code,
        "description": description,
        "visa_category": visa_category,
        "visa_subcategory": visa_subcategory,
        "fields": fields,
        "questions": questions,
        "field_count": len(fields),
        "form_pdf_bytes": form_bytes,
        "instructions_text": instructions_text,
        "canonical_schema": canonical_schema if not is_tourist_visa else None,
        "field_mapping": field_mapping if not is_tourist_visa else None,
        "pipeline_version": "v2" if not is_tourist_visa else "ds160",
        "created_by": staff_id,
        "created_at": datetime.utcnow(),
    }
    
    await db.uscis_templates.insert_one(template)
    
    return {
        "id": template_id,
        "name": name,
        "form_code": form_code,
        "description": description,
        "field_count": len(fields),
        "questions": questions,
    }

@router.get("/templates")
async def list_templates(authorization: Annotated[str, Header()]):
    """List all form templates."""
    verify_admin_or_super_admin(authorization)
    
    templates = await db.uscis_templates.find(
        {},
        {"form_pdf_bytes": 0, "fields": 0}
    ).to_list(100)
    
    return [
        {
            "id": str(t["_id"]) if t.get("_id") else None,
            "name": t["name"],
            "form_code": t["form_code"],
            "description": t.get("description"),
            "visa_category": t.get("visa_category"),
            "visa_subcategory": t.get("visa_subcategory"),
            "field_count": t.get("field_count", 0),
            "created_at": t.get("created_at"),
        }
        for t in templates
    ]

@router.get("/templates/{template_id}")
async def get_template(template_id: str, authorization: Annotated[str, Header()]):
    """Get a specific template with questions."""
    verify_admin_or_super_admin(authorization)
    
    template = await find_template_by_id(template_id, {"form_pdf_bytes": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {
        "id": str(template["_id"]),
        "name": template["name"],
        "form_code": template["form_code"],
        "description": template.get("description"),
        "visa_category": template.get("visa_category"),
        "visa_subcategory": template.get("visa_subcategory"),
        "field_count": template.get("field_count", 0),
        "questions": template.get("questions", []),
        "fields": template.get("fields", []),
    }

@router.get("/templates/{template_id}/pdf")
async def get_template_pdf(template_id: str, authorization: Annotated[str, Header()]):
    """Download the blank template PDF."""
    verify_admin_or_super_admin(authorization)
    
    template = await find_template_by_id(template_id)
    
    if not template or not template.get("form_pdf_bytes"):
        raise HTTPException(status_code=404, detail="Template not found or no PDF available")
    
    return Response(
        content=template["form_pdf_bytes"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{template["form_code"]}_blank.pdf"'}
    )

@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, authorization: Annotated[str, Header()]):
    """Delete a form template."""
    verify_admin_or_super_admin(authorization)
    
    result = await delete_template_by_id(template_id)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

@router.post("/templates/{template_id}/regenerate-questions")
async def regenerate_template_questions(template_id: str, authorization: Annotated[str, Header()]):
    """Regenerate questions for an existing template using AI."""
    verify_admin_or_super_admin(authorization)
    
    template = await find_template_by_id(template_id)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    form_code = template.get("form_code", "").upper().replace(" ", "").replace("-", "")
    
    # Check for predefined questions files
    predefined_files = {
        "I140": "i140_questions.json",
        "DS160": "ds160_questions.json",
    }
    
    matched_predefined = None
    for code_pattern, filename in predefined_files.items():
        if code_pattern in form_code:
            matched_predefined = filename
            break
    
    if matched_predefined:
        try:
            predefined_path = os.path.join(os.path.dirname(__file__), '..', matched_predefined)
            with open(predefined_path, 'r', encoding='utf-8') as f:
                questions = json.load(f)
            logger.info(f"[USCIS Forms] Using predefined questions from {matched_predefined}")
        except Exception as e:
            logger.error(f"[USCIS Forms] Error loading predefined questions: {e}")
            matched_predefined = None
    
    if not matched_predefined:
        fields = template.get("fields", [])
        if not fields:
            raise HTTPException(status_code=400, detail="Template has no fields to generate questions from")
        
        instructions_text = template.get("instructions_text")
        visa_category = template.get("visa_category")
        visa_subcategory = template.get("visa_subcategory")
        
        # Generate questions (returns tuple)
        questions, fields_with_labels = await generate_questions_for_form(fields, instructions_text, visa_category, visa_subcategory)
        
        # Update template with fields that now have friendly_label
        await update_template_by_id(template_id, {"$set": {"questions": questions, "fields": fields_with_labels}})
    
    return {
        "message": "Questions regenerated successfully",
        "total_sections": len(questions.get("sections", [])),
        "total_questions": questions.get("total_questions", sum(len(s.get("questions", [])) for s in questions.get("sections", []))),
        "source": "predefined" if matched_predefined else "ai_generated"
    }


class DeleteQuestionRequest(BaseModel):
    section_index: int
    question_id: str


@router.delete("/templates/{template_id}/questions")
async def delete_template_question(
    template_id: str,
    request: DeleteQuestionRequest,
    authorization: Annotated[str, Header()]
):
    """Delete a question from a template's questionnaire."""
    verify_admin_or_super_admin(authorization)
    
    template = await find_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    questions = template.get("questions", {})
    sections = questions.get("sections", [])
    
    if request.section_index < 0 or request.section_index >= len(sections):
        raise HTTPException(status_code=400, detail="Invalid section index")
    
    section = sections[request.section_index]
    section_questions = section.get("questions", [])
    
    # Find and remove the question
    original_count = len(section_questions)
    section_questions = [q for q in section_questions if q.get("id") != request.question_id]
    
    if len(section_questions) == original_count:
        raise HTTPException(status_code=404, detail="Question not found in section")
    
    # Update the section with filtered questions
    sections[request.section_index]["questions"] = section_questions
    questions["sections"] = sections
    
    # Update total_questions count if it exists
    if "total_questions" in questions:
        questions["total_questions"] = sum(len(s.get("questions", [])) for s in sections)
    
    # Save to database
    await update_template_by_id(template_id, {"$set": {"questions": questions}})
    
    logger.info(f"[USCIS Forms] Deleted question '{request.question_id}' from template {template_id}")
    
    return {
        "message": "Question deleted successfully",
        "deleted_question_id": request.question_id,
        "remaining_questions_in_section": len(section_questions)
    }


@router.post("/fill")
async def fill_form(
    authorization: Annotated[str, Header()],
    template_id: str = Form(...),
    answers_json: str = Form(...),
    client_name: str = Form(None),
):
    """Fill a form with user answers and return the filled PDF or HTML."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    template = await find_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        answers_data = json.loads(answers_json)
        answers = [QuestionAnswer(**a) for a in answers_data]
    except (json.JSONDecodeError, ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid answers format")
    
    has_pdf = template.get("form_pdf_bytes") is not None
    
    if has_pdf:
        # Check if this template uses N8N direct mapping
        use_n8n_mapping = template.get("pdf_field_mapping") is not None
        
        if use_n8n_mapping:
            # N8N Direct Mapping
            # Convert answers from frontend format (question) to N8N format (fieldLabel)
            # Frontend uses {question: answer} but N8N mapping expects {fieldLabel: answer}
            answers_dict = {}
            for a in answers:
                # The question text in frontend is the same as fieldLabel in N8N
                answers_dict[a.question] = a.answer
            
            # NOTE: Translation is now done on-demand when coordinator clicks "Translate to English"
            # The client's answers are passed as-is to preserve original data
            # Translation happens before PDF download, not during form submission
            logger.info("Form answers saved without translation (translation is on-demand)")
            
            # Use N8N mapping function
            try:
                n8n_result = fill_i140_form_n8n(answers_dict)
                field_mappings = n8n_result["fields"]
            except Exception as mapping_err:
                logger.error(f"N8N mapping error: {mapping_err}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error en mapeo N8N: {str(mapping_err)}")
            
            # Fill PDF with direct field names
            try:
                filled_pdf, error_report = fill_pdf_fields(template["form_pdf_bytes"], field_mappings, use_direct_mapping=True)
            except Exception as pdf_err:
                logger.error(f"PDF fill error: {pdf_err}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error al llenar PDF: {str(pdf_err)}")
        else:
            # AI Mapping (legacy) - MEJORADO con Gemini y validación
            field_mappings = await map_answers_to_fields(
                answers,
                template.get("fields", []),
                template.get("instructions_text"),
                template.get("visa_category"),
                template.get("visa_subcategory")
            )
            
            # NUEVO: Validar mapeo
            validation_report = await validate_ai_mapping(
                template.get('fields', []),
                field_mappings,
                answers
            )
            
            # Log validation warnings
            if validation_report["warnings"]:
                logger.warning(f"AI Mapping validation: {validation_report['stats']}")
            
            filled_pdf, error_report = fill_pdf_fields(template["form_pdf_bytes"], field_mappings, use_direct_mapping=False)
        
        # Log PDF filling results
        if error_report["failed"] > 0:
            logger.warning(f"PDF generation completed with {error_report['failed']} field errors")
        
        content = filled_pdf
        media_type = "application/pdf"
        filename = f"{template['form_code']}_filled.pdf"
    else:
        html_content = generate_html_form(template, answers)
        content = html_content.encode('utf-8')
        media_type = "text/html"
        filename = f"{template['form_code']}_filled.html"
        field_mappings = {}
    
    # Save to history
    history_id = str(uuid.uuid4())
    history_entry = {
        "_id": history_id,
        "staff_id": staff_id,
        "client_name": client_name,
        "template_id": template_id,
        "template_name": template["name"],
        "form_code": template["form_code"],
        "answers": [a.dict() for a in answers],
        "field_mappings": field_mappings if has_pdf else {},
        "filled_pdf_bytes": content if has_pdf else None,
        "filled_html": content.decode('utf-8') if not has_pdf else None,
        "created_at": datetime.now(timezone.utc),
        "file_type": "pdf" if has_pdf else "html"
    }
    await db.uscis_form_history.insert_one(history_entry)
    
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-History-Id": history_id,
            "X-File-Type": "pdf" if has_pdf else "html",
        }
    )

@router.get("/history")
async def get_history(authorization: Annotated[str, Header()]):
    """Get form filling history."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    history = await db.uscis_form_history.find(
        {"staff_id": staff_id},
        {"filled_pdf_bytes": 0, "answers": 0, "field_mappings": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [
        {
            "id": str(h["_id"]) if h.get("_id") else h.get("id"),
            "template_name": h.get("template_name"),
            "form_code": h.get("form_code"),
            "client_name": h.get("client_name"),
            "created_at": h.get("created_at"),
            "file_type": h.get("file_type", "pdf"),
        }
        for h in history
    ]

@router.get("/history/{history_id}")
async def get_history_entry(history_id: str, authorization: Annotated[str, Header()]):
    """Get a specific history entry."""
    verify_admin_or_super_admin(authorization)
    
    entry = await db.uscis_form_history.find_one(
        {"_id": history_id},
        {"filled_pdf_bytes": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    
    return {
        "id": entry["_id"],
        "template_name": entry.get("template_name"),
        "form_code": entry.get("form_code"),
        "client_name": entry.get("client_name"),
        "answers": entry.get("answers", []),
        "created_at": entry.get("created_at"),
        "file_type": entry.get("file_type", "pdf"),
    }

@router.get("/history/{history_id}/download")
async def download_history_pdf(history_id: str, authorization: Annotated[str, Header()]):
    """Download the filled PDF/HTML from history."""
    verify_admin_or_super_admin(authorization)
    
    entry = await db.uscis_form_history.find_one({"_id": history_id})
    
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    
    file_type = entry.get("file_type", "pdf")
    
    if file_type == "html":
        content = entry.get("filled_html", "").encode('utf-8')
        media_type = "text/html"
        filename = f"{entry.get('form_code', 'form')}_filled.html"
    else:
        content = entry.get("filled_pdf_bytes")
        if not content:
            raise HTTPException(status_code=404, detail="PDF not found")
        media_type = "application/pdf"
        filename = f"{entry.get('form_code', 'form')}_filled.pdf"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.delete("/history/{history_id}")
async def delete_history_entry(history_id: str, authorization: Annotated[str, Header()]):
    """Delete a history entry."""
    verify_admin_or_super_admin(authorization)
    
    result = await db.uscis_form_history.delete_one({"_id": history_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"message": "History entry deleted"}

# ============================================================================
# Shared Form Links (for clients)
# ============================================================================

@router.post("/shared-forms")
async def create_shared_form(data: SharedFormLink, authorization: Annotated[str, Header()]):
    """Create a shareable link for a client to fill a form."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    template = await find_template_by_id(data.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days or 30)
    
    # Store template_id as string for consistency
    template_id_str = str(template["_id"])
    
    shared_form = {
        "_id": token,
        "template_id": template_id_str,
        "template_name": template["name"],
        "form_code": template["form_code"],
        "client_name": data.client_name,
        "client_email": data.client_email,
        "created_by": staff_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "status": "pending",
        "form_type": data.form_type or "complete",  # Store form type
        "visa_case_id": data.visa_case_id,  # Linked visa case
    }
    
    await db.uscis_shared_forms.insert_one(shared_form)
    
    return {
        "token": token,
        "expires_at": expires_at,
        "template_name": template["name"],
    }

@router.get("/shared-forms")
async def list_shared_forms(authorization: Annotated[str, Header()]):
    """List all shared form links created by the staff member."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    forms = await db.uscis_shared_forms.find(
        {"created_by": staff_id}
    ).sort("created_at", -1).to_list(100)
    
    return [
        {
            "token": str(f["_id"]) if f.get("_id") else None,
            "template_name": f.get("template_name"),
            "form_code": f.get("form_code"),
            "client_name": f.get("client_name"),
            "client_email": f.get("client_email"),
            "created_at": f.get("created_at"),
            "expires_at": f.get("expires_at"),
            "status": f.get("status", "pending"),
            "visa_case_id": f.get("visa_case_id"),
        }
        for f in forms
    ]

@router.delete("/shared-forms/{token}")
async def delete_shared_form(token: str, authorization: Annotated[str, Header()]):
    """Delete a shared form link."""
    verify_admin_or_super_admin(authorization)
    
    result = await db.uscis_shared_forms.delete_one({"_id": token})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shared form not found")
    return {"message": "Shared form deleted"}

# Public endpoint for clients to access shared forms (NO AUTH REQUIRED)
@router.get("/public/form/{token}")
async def get_public_form(token: str):
    """Get public form data by token (no auth required)."""
    shared_form = await db.uscis_shared_forms.find_one({"_id": token})
    
    if not shared_form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if is_expired(shared_form.get("expires_at")):
        raise HTTPException(status_code=410, detail="This link has expired")
    
    if shared_form.get("status") == "completed":
        raise HTTPException(status_code=410, detail="This form has already been submitted")
    
    template = await find_template_by_id(shared_form["template_id"], {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    form_type = shared_form.get("form_type", "complete")
    
    # Return simplified response for pre-validation forms
    if form_type == "pre_validation":
        return {
            "form_code": template["form_code"],
            "name": template["name"],
            "client_name": shared_form.get("client_name"),
            "form_type": "pre_validation",
            "token": token
        }
    
    # Return full form for complete forms
    return {
        "form_code": template["form_code"],
        "name": template["name"],
        "questions": template.get("questions", {}),
        "client_name": shared_form.get("client_name"),
        "form_type": "complete",
        "token": token
    }

@router.post("/public/form/{token}/submit")
async def submit_public_form(token: str, data: ClientSubmission):
    """Submit a filled form from a public link (no auth required)."""
    shared_form = await db.uscis_shared_forms.find_one({"_id": token})
    
    if not shared_form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if is_expired(shared_form.get("expires_at")):
        raise HTTPException(status_code=410, detail="This link has expired")
    
    if shared_form.get("status") == "completed":
        raise HTTPException(status_code=410, detail="This form has already been submitted")
    
    template = await find_template_by_id(shared_form["template_id"])
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Determine form_type and status
    form_type = shared_form.get("form_type", "complete")
    submission_status = "por_revisar" if form_type == "pre_validation" else "completado"
    
    # Save answers as-is (Spanish). Translation is done on-demand by the admin.
    logger.info(f"Saving {form_type} form answers (no auto-translation, admin will translate on-demand)")
    
    # For pre-validation forms, we just save the answers without generating PDF
    # The admin will complete the form later with the pre-filled data
    content = None
    file_type = None
    
    if form_type != "pre_validation":
        # Only generate PDF/HTML for complete forms
        has_pdf = template.get("form_pdf_bytes") is not None
        
        if has_pdf:
            field_mappings = await map_answers_to_fields(
                data.answers,  # Use original answers
                template.get("fields", []),
                template.get("instructions_text"),
                template.get("visa_category"),
                template.get("visa_subcategory")
            )
            filled_pdf, error_report = fill_pdf_fields(template["form_pdf_bytes"], field_mappings, use_direct_mapping=False)
            content = filled_pdf
            file_type = "pdf"
        else:
            html_content = generate_html_form(template, data.answers)
            content = html_content.encode('utf-8')
            file_type = "html"
    
    submission_id = str(uuid.uuid4())
    submission = {
        "_id": submission_id,
        "shared_form_token": token,
        "template_id": shared_form["template_id"],
        "template_name": template["name"],
        "form_code": template["form_code"],
        "client_name": data.client_name or shared_form.get("client_name"),
        "client_email": data.client_email or shared_form.get("client_email"),
        "answers": [a.dict() for a in data.answers],  # Save original Spanish answers
        "original_answers": [a.dict() for a in data.answers],  # Keep copy for reference
        "filled_pdf_bytes": content if file_type == "pdf" else None,
        "filled_html": content.decode('utf-8') if file_type == "html" else None,
        "file_type": file_type,
        "created_by_staff": shared_form.get("created_by"),
        "submitted_at": datetime.now(timezone.utc),
        "submission_status": submission_status,
        "form_type": form_type,
        "visa_case_id": shared_form.get("visa_case_id"),  # Store visa case link
    }
    await db.uscis_submissions.insert_one(submission)
    
    # Update shared form status
    await db.uscis_shared_forms.update_one(
        {"_id": token},
        {"$set": {"status": "completed", "submission_id": submission_id}}
    )
    
    # If this is an I-140 form linked to a visa case, add PDF as deliverable
    form_code = template.get("form_code", "").lower()
    visa_case_id = shared_form.get("visa_case_id")
    
    if visa_case_id and ("i-140" in form_code or "i140" in form_code) and content and file_type == "pdf":
        try:
            import base64
            
            # Get the visa case to find user info
            visa_case = await db.visa_cases.find_one({"_id": visa_case_id})
            
            if visa_case:
                user_id = visa_case.get("userId")
                
                # Create filename
                client_name = data.client_name or shared_form.get("client_name") or "Cliente"
                safe_name = "".join(c for c in client_name if c.isalnum() or c in " _-").strip().replace(" ", "_")
                file_name = f"I-140_Completado_{safe_name}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
                
                # Find or create the I-140 deliverable for stage 3 (typically where forms are)
                deliverable = await db.deliverables.find_one({
                    "caseId": visa_case_id,
                    "$or": [
                        {"name.es": {"$regex": "I-140", "$options": "i"}},
                        {"name.en": {"$regex": "I-140", "$options": "i"}},
                        {"deliverableName": {"$regex": "I-140", "$options": "i"}}
                    ]
                })
                
                if deliverable:
                    # Update existing deliverable with the PDF
                    file_entry = {
                        "id": str(uuid.uuid4()),
                        "fileName": file_name,
                        "fileData": base64.b64encode(content).decode('utf-8'),
                        "fileType": "application/pdf",
                        "uploadedAt": datetime.now(timezone.utc).isoformat(),
                        "source": "uscis_form_submission"
                    }
                    
                    # Add to files array or create it
                    existing_files = deliverable.get("files", [])
                    existing_files.append(file_entry)
                    
                    await db.deliverables.update_one(
                        {"_id": deliverable["_id"]},
                        {"$set": {
                            "files": existing_files,
                            "status": "completed",
                            "updatedAt": datetime.now(timezone.utc)
                        }}
                    )
                    logger.info(f"✅ Added I-140 PDF to existing deliverable for case {visa_case_id}")
                else:
                    # Create new deliverable for I-140
                    new_deliverable = {
                        "_id": str(uuid.uuid4()),
                        "caseId": visa_case_id,
                        "userId": user_id,
                        "stageNumber": 3,  # Stage 3 typically for forms
                        "deliverableName": "Formulario I-140 Completado",
                        "name": {"es": "Formulario I-140 Completado", "en": "Completed I-140 Form"},
                        "description": {"es": "Formulario I-140 completado por el cliente", "en": "I-140 Form completed by client"},
                        "status": "completed",
                        "files": [{
                            "id": str(uuid.uuid4()),
                            "fileName": file_name,
                            "fileData": base64.b64encode(content).decode('utf-8'),
                            "fileType": "application/pdf",
                            "uploadedAt": datetime.now(timezone.utc).isoformat(),
                            "source": "uscis_form_submission"
                        }],
                        "createdAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc)
                    }
                    
                    await db.deliverables.insert_one(new_deliverable)
                    logger.info(f"✅ Created new I-140 deliverable for case {visa_case_id}")
                    
        except Exception as e:
            # Don't fail the submission if deliverable creation fails
            logger.error(f"Error adding I-140 PDF to deliverable: {e}")
    
    return {
        "message": "Form submitted successfully",
        "submission_id": submission_id,
    }

@router.get("/client-submissions")
async def get_client_submissions(authorization: Annotated[str, Header()]):
    """Get all submissions from clients."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    submissions = await db.uscis_submissions.find(
        {"created_by_staff": staff_id},
        {"filled_pdf_bytes": 0, "answers": 0}
    ).sort("submitted_at", -1).to_list(100)
    
    def to_iso_utc(dt):
        """Convert datetime to ISO string with UTC timezone indicator."""
        if dt is None:
            return None
        if hasattr(dt, 'isoformat'):
            iso = dt.isoformat()
            # Add Z suffix if no timezone info
            if '+' not in iso and 'Z' not in iso:
                iso += 'Z'
            return iso
        return dt
    
    return [
        {
            "id": str(s["_id"]) if s.get("_id") else None,
            "template_id": s.get("template_id"),
            "template_name": s.get("template_name"),
            "form_code": s.get("form_code"),
            "client_name": s.get("client_name"),
            "client_email": s.get("client_email"),
            "submitted_at": to_iso_utc(s.get("submitted_at")),
            "last_modified": to_iso_utc(s.get("last_modified")),
            "file_type": s.get("file_type", "pdf"),
            "submission_status": s.get("submission_status", "completado"),
            "form_type": s.get("form_type", "complete"),
        }
        for s in submissions
    ]


class SaveAnswersRequest(BaseModel):
    answers: List[QuestionAnswer]


class UpdateStatusRequest(BaseModel):
    status: str  # por_revisar, en_revision, completado


@router.patch("/client-submissions/{submission_id}/status")
async def update_submission_status(
    submission_id: str, 
    data: UpdateStatusRequest,
    authorization: Annotated[str, Header()]
):
    """Update the status of a submission. Only admin/super_admin can do this."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    # Validate status
    valid_statuses = ['por_revisar', 'en_revision', 'completado']
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    submission = await db.uscis_submissions.find_one({"_id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Update status and last_modified
    now = datetime.now(timezone.utc)
    await db.uscis_submissions.update_one(
        {"_id": submission_id},
        {
            "$set": {
                "submission_status": data.status,
                "last_modified": now,
                "last_modified_by": staff_id,
                "status_changed_at": now,
                "status_changed_by": staff_id
            }
        }
    )
    
    logger.info(f"[USCIS Forms] Updated status of submission {submission_id} to {data.status}")
    
    return {
        "message": "Estado actualizado correctamente",
        "submission_id": submission_id,
        "new_status": data.status,
        "updated_at": now.isoformat()
    }


@router.patch("/client-submissions/{submission_id}/save")
async def save_submission_answers(
    submission_id: str, 
    data: SaveAnswersRequest,
    authorization: Annotated[str, Header()]
):
    """Save partial answers to a submission without generating PDF."""
    payload = verify_admin_or_super_admin(authorization)
    staff_id = payload.get('id')
    
    submission = await db.uscis_submissions.find_one({"_id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Verify the staff owns this submission
    if submission.get("created_by_staff") != staff_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this submission")
    
    # Update answers and last_modified
    now = datetime.now(timezone.utc)
    await db.uscis_submissions.update_one(
        {"_id": submission_id},
        {
            "$set": {
                "answers": [a.dict() for a in data.answers],
                "last_modified": now,
                "last_modified_by": staff_id
            }
        }
    )
    
    logger.info(f"[USCIS Forms] Saved answers for submission {submission_id}")
    
    return {
        "message": "Cambios guardados correctamente",
        "last_modified": now.isoformat()
    }


@router.get("/client-submissions/{submission_id}")
async def get_client_submission_details(submission_id: str, authorization: Annotated[str, Header()]):
    """Get details of a specific submission including answers."""
    verify_admin_or_super_admin(authorization)
    
    submission = await db.uscis_submissions.find_one(
        {"_id": submission_id},
        {"filled_pdf_bytes": 0, "filled_html": 0}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return {
        "id": str(submission["_id"]) if submission.get("_id") else None,
        "template_id": submission.get("template_id"),
        "template_name": submission.get("template_name"),
        "form_code": submission.get("form_code"),
        "client_name": submission.get("client_name"),
        "client_email": submission.get("client_email"),
        "answers": submission.get("answers", []),
        "submitted_at": submission.get("submitted_at"),
        "file_type": submission.get("file_type", "pdf"),
        "submission_status": submission.get("submission_status", "completado"),
        "form_type": submission.get("form_type", "complete"),
    }

@router.get("/client-submissions/{submission_id}/download")
async def download_client_submission(submission_id: str, authorization: Annotated[str, Header()]):
    """Download a client's submitted form."""
    verify_admin_or_super_admin(authorization)
    
    submission = await db.uscis_submissions.find_one({"_id": submission_id})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    file_type = submission.get("file_type", "pdf")
    
    if file_type == "html":
        content = submission.get("filled_html", "").encode('utf-8')
        media_type = "text/html"
        filename = f"{submission.get('form_code', 'form')}_{submission.get('client_name', 'client')}.html"
    else:
        content = submission.get("filled_pdf_bytes")
        if not content:
            raise HTTPException(status_code=404, detail="PDF not found")
        media_type = "application/pdf"
        filename = f"{submission.get('form_code', 'form')}_{submission.get('client_name', 'client')}.pdf"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/client-submissions/{submission_id}/html-summary")
async def get_submission_html_summary(submission_id: str, authorization: Annotated[str, Header()]):
    """Generate an HTML summary of a submission with all answers organized by section.
    This is especially useful for DS-160 forms where users need to copy answers to the official website.
    """
    verify_admin_or_super_admin(authorization)
    
    submission = await db.uscis_submissions.find_one({"_id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get the template to organize answers by section
    template_id = submission.get("template_id")
    template = await find_template_by_id(template_id)
    
    answers_dict = {a.get("question"): a.get("answer") for a in submission.get("answers", [])}
    
    sections_data = []
    
    if template:
        sections = template.get("questions", {}).get("sections", [])
        for section in sections:
            section_data = {
                "name": section.get("name", "Sin nombre"),
                "questions": []
            }
            for q in section.get("questions", []):
                question_text = q.get("question", "")
                answer = answers_dict.get(question_text, "")
                if answer:  # Only include answered questions
                    section_data["questions"].append({
                        "id": q.get("id", ""),
                        "question": question_text,
                        "answer": answer,
                        "type": q.get("type", "text")
                    })
            if section_data["questions"]:  # Only include sections with answers
                sections_data.append(section_data)
    else:
        # Fallback: just list all answers without sections
        section_data = {
            "name": "Respuestas",
            "questions": [
                {"question": a.get("question"), "answer": a.get("answer"), "type": "text"}
                for a in submission.get("answers", [])
            ]
        }
        sections_data.append(section_data)
    
    return {
        "submission_id": submission_id,
        "form_code": submission.get("form_code"),
        "template_name": submission.get("template_name"),
        "client_name": submission.get("client_name"),
        "client_email": submission.get("client_email"),
        "submitted_at": submission.get("submitted_at"),
        "sections": sections_data,
        "total_answers": sum(len(s["questions"]) for s in sections_data)
    }


# ============================================================================
# CHAT ASSISTANT ENDPOINTS
# ============================================================================

# Chat System Prompts
CHAT_SYSTEM_PROMPT = """Eres Mónica, una asistente virtual especializada en formularios de inmigración de USCIS. Tu trabajo es ayudar a los usuarios a llenar sus formularios de manera precisa y profesional.

REGLAS IMPORTANTES:
1. Siempre responde en español de manera amable y profesional
2. Haz UNA pregunta a la vez para recopilar información
3. Cuando el usuario proporcione información, confírmala brevemente y pasa a la siguiente pregunta
4. Si el usuario proporciona MÚLTIPLES datos en una respuesta, confirma TODOS y pasa a la siguiente pregunta
5. NO muestres JSON ni código técnico al usuario - solo conversación natural
6. Sé empático - muchos usuarios están nerviosos con su proceso migratorio
7. Mantén las respuestas concisas y directas
8. IMPORTANTE: Cuando el usuario suba una foto de un documento (pasaporte, ID, cédula, licencia), DEBES analizarla y extraer toda la información visible

ANÁLISIS DE DOCUMENTOS:
- SIEMPRE analiza las imágenes de documentos que te envíen
- Extrae TODOS los datos visibles: nombre, fecha de nacimiento, nacionalidad, número de documento, dirección, etc.
- Confirma al usuario qué datos extrajiste
- Pregunta si la información es correcta antes de continuar

FLUJO DE CONVERSACIÓN:
1. Nombre completo
2. Fecha de nacimiento  
3. País de nacimiento
4. Dirección actual (calle, ciudad, estado, código postal)
5. Teléfono
6. Email
7. SSN (si tiene)
8. A-Number (si tiene)
9. Estatus migratorio actual
10. Información específica según el tipo de visa

FORMATO DE TUS RESPUESTAS:
Cuando el usuario proporcione información, responde en DOS PARTES:

PARTE 1 (lo que ve el usuario - sin etiquetas):
Perfecto, he registrado tu información:
• Nombre: JUAN CARLOS GARCIA LOPEZ
• Fecha de nacimiento: 03/15/1990
• País de nacimiento: Mexico

¿Cuál es tu dirección actual en Estados Unidos?

PARTE 2 (datos estructurados - CON etiquetas):
[DATOS_EXTRAIDOS]
nombre_completo: JUAN CARLOS GARCIA LOPEZ
fecha_nacimiento: 03/15/1990
pais_nacimiento: Mexico
[/DATOS_EXTRAIDOS]

IMPORTANTE:
- NO incluyas la palabra [CONVERSACIÓN] ni etiquetas similares en la Parte 1
- La Parte 1 debe ser conversación natural pura
- Solo la Parte 2 debe tener las etiquetas [DATOS_EXTRAIDOS]
- SIEMPRE incluye ambas partes cuando extraigas datos
- Mantén conversación natural y fluida

NOMBRES DE CAMPOS VÁLIDOS:
- nombre_completo, apellidos, nombres
- fecha_nacimiento, pais_nacimiento, nacionalidad
- direccion, ciudad, estado, codigo_postal
- telefono, email
- ssn, a_number
- genero (Male/Female)
- estatus_migratorio, fecha_entrada
- numero_pasaporte, numero_documento, fecha_expedicion, fecha_expiracion, pais_emision

FORMATO DE DATOS:
- SSN: 9 dígitos sin guiones (123456789)
- Teléfono: 10 dígitos sin guiones (5551234567)
- Fechas: MM/DD/YYYY
- Nombres: MAYÚSCULAS
- Países: en inglés (Mexico, United States of America, Venezuela, Colombia, etc.)"""

DOCUMENT_ANALYSIS_PROMPT = """Analiza esta imagen de documento y extrae la siguiente información en formato JSON:

Para PASAPORTE:
- nombre_completo (en MAYÚSCULAS)
- apellidos (en MAYÚSCULAS)
- nombres (en MAYÚSCULAS)
- fecha_nacimiento (formato MM/DD/YYYY)
- fecha_expedicion (formato MM/DD/YYYY)
- fecha_expiracion (formato MM/DD/YYYY)
- numero_pasaporte
- pais_emision
- nacionalidad
- genero (Male/Female)

Para ID/LICENCIA:
- nombre_completo (en MAYÚSCULAS)
- apellidos (en MAYÚSCULAS)
- nombres (en MAYÚSCULAS)
- fecha_nacimiento (formato MM/DD/YYYY)
- direccion (calle, ciudad, estado, ZIP)
- numero_documento
- estado (2 letras)

Responde SOLO con un JSON válido con los campos que puedas extraer. Si no puedes leer algún campo, no lo incluyas.
Ejemplo: {{"nombre_completo": "JUAN GARCIA", "fecha_nacimiento": "03/15/1990"}}"""

def extract_json_from_response(assistant_message: str) -> dict:
    """Extraer datos de la respuesta del asistente usando el formato [DATOS_EXTRAIDOS]."""
    extracted_data = {}
    
    try:
        # Buscar sección [DATOS_EXTRAIDOS]
        if '[DATOS_EXTRAIDOS]' in assistant_message and '[/DATOS_EXTRAIDOS]' in assistant_message:
            start_idx = assistant_message.find('[DATOS_EXTRAIDOS]') + len('[DATOS_EXTRAIDOS]')
            end_idx = assistant_message.find('[/DATOS_EXTRAIDOS]')
            data_section = assistant_message[start_idx:end_idx].strip()
            
            # Parsear cada línea como campo: valor
            for line in data_section.split('\n'):
                line = line.strip()
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    if key and value:
                        extracted_data[key] = value
            
            logger.info(f"[Data Extraction] Extracted {len(extracted_data)} fields: {list(extracted_data.keys())}")
        
        # Fallback: Buscar bloque ```json (por si el modelo usa el formato antiguo)
        elif '```json' in assistant_message:
            json_block = assistant_message.split('```json')[1].split('```')[0]
            data = json.loads(json_block.strip())
            if 'extracted_data' in data:
                extracted_data = data['extracted_data']
            elif isinstance(data, dict):
                extracted_data = data
        
        # Fallback 2: Buscar {"extracted_data": ...}
        elif '{"extracted_data"' in assistant_message or '{ "extracted_data"' in assistant_message:
            start_idx = assistant_message.find('{')
            if start_idx != -1:
                # Contar llaves para encontrar el JSON completo
                brace_count = 0
                end_idx = start_idx
                for i, char in enumerate(assistant_message[start_idx:]):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = start_idx + i + 1
                            break
                json_str = assistant_message[start_idx:end_idx]
                data = json.loads(json_str)
                if 'extracted_data' in data:
                    extracted_data = data['extracted_data']
                else:
                    extracted_data = data
    
    except Exception as e:
        logger.error(f"[JSON Extraction Error] {e}")
    
    return extracted_data


class ChatStartRequest(BaseModel):
    template_id: str

class ChatMessageRequest(BaseModel):
    template_id: str
    message: str
    conversation_history: Optional[List[dict]] = []
    current_answers: Optional[dict] = {}
    image_base64: Optional[str] = None

class AnalyzeDocumentRequest(BaseModel):
    image_base64: str
    document_type: Optional[str] = "id"  # "passport", "id", "license"


@router.post("/chat/start")
async def start_chat(
    request: ChatStartRequest,
    authorization: str = Header(None)
):
    """Iniciar conversación con el asistente Mónica."""
    verify_admin_or_super_admin(authorization)
    
    template = await find_template_by_id(request.template_id, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    form_code = template.get('form_code', '')
    form_name = template.get('name', '')
    
    greeting = f"""¡Hola! 👋 Soy Mónica, tu asistente virtual para llenar el formulario {form_code} - {form_name}.

Voy a ayudarte paso a paso a completar toda la información necesaria. Puedes:
- Escribirme las respuestas directamente
- Subir fotos de tus documentos (pasaporte, ID, licencia) y yo extraeré la información automáticamente

Nunca te guiaré paso a paso. Puedes responderme escribiendo o subiendo fotos de tus documentos para ahorrar tiempo.

¿Empezamos? ¿Cuál es tu nombre completo tal como aparece en tu pasaporte?"""
    
    return {
        "success": True,
        "greeting": greeting,
        "template_info": {
            "form_code": form_code,
            "name": form_name
        }
    }


@router.post("/chat/message")
async def chat_message(
    request: ChatMessageRequest,
    authorization: str = Header(None)
):
    """Enviar mensaje al asistente y recibir respuesta."""
    verify_admin_or_super_admin(authorization)
    
    openai_client = get_openai_client()
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI client not configured")
    
    template = await find_template_by_id(request.template_id, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Construir contexto del formulario
    form_code = template.get('form_code', '')
    form_name = template.get('name', '')
    visa_category = template.get('visa_category', '')
    visa_subcategory = template.get('visa_subcategory', '')
    
    # Extraer preguntas para contexto
    questions_summary = []
    sections = template.get('questions', {}).get('sections', [])
    for section in sections[:5]:  # Primeras 5 secciones para no exceder límite
        questions_summary.append(f"\n{section.get('name', '')}:")
        for q in section.get('questions', [])[:10]:  # Primeras 10 preguntas por sección
            questions_summary.append(f"  - {q.get('question', '')}")
    
    questions_text = "\n".join(questions_summary)
    
    system_message = f"""{CHAT_SYSTEM_PROMPT}

CONTEXTO DEL FORMULARIO:
- Formulario: {form_code} - {form_name}
- Tipo de visa: {visa_category} - {visa_subcategory}

PREGUNTAS DEL FORMULARIO (muestra):
{questions_text}

RESPUESTAS YA PROPORCIONADAS:
{json.dumps(request.current_answers or {}, indent=2)}
"""
    
    # Construir mensajes para OpenAI
    messages = [{"role": "system", "content": system_message}]
    
    # Agregar historial de conversación
    for msg in request.conversation_history:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Agregar mensaje actual
    if request.image_base64:
        # Mensaje con imagen (GPT-4 Vision)
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": request.message},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{request.image_base64}"}}
            ]
        })
    else:
        messages.append({"role": "user", "content": request.message})
    
    try:
        # Llamar a OpenAI
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        assistant_message = response.choices[0].message.content
        
        # Extraer datos de la sección [DATOS_EXTRAIDOS]
        extracted_data = extract_json_from_response(assistant_message)
        
        # Limpiar el mensaje para el usuario (remover sección técnica)
        clean_message = assistant_message
        if '[DATOS_EXTRAIDOS]' in assistant_message:
            # Remover toda la sección [DATOS_EXTRAIDOS]...[/DATOS_EXTRAIDOS]
            import re
            clean_message = re.sub(r'\[DATOS_EXTRAIDOS\].*?\[/DATOS_EXTRAIDOS\]', '', assistant_message, flags=re.DOTALL)
            clean_message = clean_message.strip()
        
        return {
            "success": True,
            "message": clean_message,
            "extracted_data": extracted_data
        }
    
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el mensaje: {str(e)}")


@router.post("/chat/analyze-document")
async def analyze_document(
    request: AnalyzeDocumentRequest,
    authorization: str = Header(None)
):
    """Analizar imagen de documento y extraer información."""
    verify_admin_or_super_admin(authorization)
    
    openai_client = get_openai_client()
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI client not configured")
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": DOCUMENT_ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{request.image_base64}"}}
                ]
            }],
            max_tokens=500,
            temperature=0.3
        )
        
        # Parsear JSON de la respuesta
        response_text = response.choices[0].message.content
        
        # Limpiar respuesta para obtener solo el JSON
        if '```json' in response_text:
            json_text = response_text.split('```json')[1].split('```')[0].strip()
        elif '```' in response_text:
            json_text = response_text.split('```')[1].split('```')[0].strip()
        else:
            json_text = response_text.strip()
        
        extracted_data = json.loads(json_text)
        
        return {
            "success": True,
            "extracted_data": extracted_data
        }
    
    except Exception as e:
        logger.error(f"Error analyzing document: {e}")
        raise HTTPException(status_code=500, detail=f"Error al analizar el documento: {str(e)}")


# ============================================================================
# N8N Template Creation Endpoint
# ============================================================================

@router.post("/templates/create-i140-n8n")
async def create_i140_n8n_template(authorization: Annotated[str, Header()]):
    """Create I-140 N8N template from configuration files."""
    verify_admin_or_super_admin(authorization)
    
    try:
        # Load questions from JSON
        with open('/app/backend/data/i140_n8n_questions.json', 'r', encoding='utf-8') as f:
            questions_data = json.load(f)
        
        # Try to load existing I-140 PDF from another template (optional)
        existing_template = await db.uscis_templates.find_one({
            "$or": [
                {"form_code": {"$regex": "^i-?140$", "$options": "i"}},
                {"form_code": {"$regex": "^i140$", "$options": "i"}}
            ]
        })
        
        # PDF is optional - template can be created without it
        form_pdf_bytes = None
        if existing_template and existing_template.get("form_pdf_bytes"):
            form_pdf_bytes = existing_template["form_pdf_bytes"]
        else:
            print("⚠️ No existing I-140 PDF found - creating template without PDF")
        
        # Check if N8N template already exists
        n8n_template_exists = await db.uscis_templates.find_one({"name": "I-140 Formulario N8N"})
        if n8n_template_exists:
            raise HTTPException(
                status_code=400,
                detail="La plantilla I-140 N8N ya existe"
            )
        
        # Transform N8N questions format to match frontend expectations
        transformed_questions = []
        
        # First, add hardcoded company mailing address fields
        company_address_fields = [
            {
                "id": str(uuid.uuid4()),
                "question": "DIRECCIÓN DE CORREO DE LA EMPRESA (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Sección informativa - datos de la empresa",
                "options": [],
                "answer": "📍 Esta sección se llenará automáticamente"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.a. In Care Of Name (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Dejar en blanco",
                "options": [],
                "answer": ""
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.b. Street Number and Name (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado con dirección de empresa",
                "options": [],
                "answer": "3235 NORTH POINT PKWY"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.c. Suite/Apt/Floor Number (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado",
                "options": [],
                "answer": "STE 101"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.d. City or Town (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado",
                "options": [],
                "answer": "ALPHARETTA"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.e. State (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado",
                "options": [],
                "answer": "GA"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.f. ZIP Code (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado",
                "options": [],
                "answer": "30005"
            },
            {
                "id": str(uuid.uuid4()),
                "question": "5.g. Country (Peticionario)",
                "type": "text",
                "required": False,
                "placeholder": "Pre-llenado",
                "options": [],
                "answer": "THE UNITED STATES OF AMERICA"
            }
        ]
        
        transformed_questions.extend(company_address_fields)
        
        # Then process the rest of the N8N questions
        for idx, q in enumerate(questions_data):
            # Skip informational fields (that have no input)
            field_label = q.get("fieldLabel", "")
            if not field_label or "INFORMACIÓN DE" in field_label or "PERSONA" in field_label and "COMPLETE SOLO SI APLICA" in q.get("placeholder", "").upper():
                continue
            
            transformed_q = {
                "id": str(uuid.uuid4()),
                "question": field_label,  # Use fieldLabel as question text
                "type": q.get("fieldType", "text"),
                "required": q.get("requiredField", False),
                "placeholder": q.get("placeholder", ""),
                "options": []
            }
            
            # Handle dropdown options
            if q.get("fieldType") == "dropdown" and q.get("fieldOptions"):
                options_list = q.get("fieldOptions", {}).get("values", [])
                transformed_q["options"] = [opt.get("option", "") for opt in options_list if opt.get("option")]
            
            transformed_questions.append(transformed_q)
        
        # Create new template with N8N configuration
        template_id = str(uuid.uuid4())
        template = {
            "_id": template_id,
            "name": "I-140 Formulario N8N",
            "form_code": "I-140",
            "category": "employment",
            "description": "Plantilla I-140 basada en configuración N8N con mapeo preciso",
            "form_pdf_bytes": form_pdf_bytes,  # Use PDF from existing template or None
            "pdf_field_mapping": True,  # Flag to indicate N8N mapping is used
            "questions": {
                "mode": "manual",
                "sections": [
                    {
                        "title": "Formulario I-140 N8N",
                        "description": "Formulario completo basado en workflow N8N",
                        "questions": transformed_questions  # Use transformed format
                    }
                ]
            },
            "fields": [],  # Not needed for N8N mapping
            "instructions_text": "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "visa_category": "EB",
            "visa_subcategory": "EB-2 NIW"
        }
        
        await db.uscis_templates.insert_one(template)
        
        return {
            "success": True,
            "message": "Plantilla I-140 N8N creada exitosamente",
            "template_id": template_id,
            "template_name": template["name"],
            "total_questions": len(transformed_questions)
        }
    
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Archivos de configuración N8N no encontrados"
        )
    except Exception as e:
        logger.error(f"Error creating I-140 N8N template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear plantilla N8N: {str(e)}"
        )