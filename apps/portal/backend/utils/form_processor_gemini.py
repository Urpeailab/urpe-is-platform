"""
Form Processor V2 - Corregido para Formularios Grandes + Compatibilidad Pydantic

CORRECCIONES:
1. Pydantic compatible con google.generativeai (sin default_factory en Dict)
2. Procesamiento en CHUNKS para formularios grandes (>100 campos)
3. Prompts optimizados para reducir tokens
4. Fallback robusto si falla la generación

Requisitos:
    pip install pymupdf google-generativeai pydantic

"""

import google.generativeai as genai
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import re
import os
from config import logger

# ============================================================================
# MODELOS PYDANTIC CORREGIDOS (sin default_factory, sin Dict vacío)
# ============================================================================

class LabelItem(BaseModel):
    """Una etiqueta individual - CORREGIDO para Gemini"""
    index: str = Field(description="Índice del campo como string")
    label: str = Field(description="Etiqueta amigable 2-6 palabras")

class FieldLabelsResponse(BaseModel):
    """Respuesta de etiquetas - CORREGIDO: Lista en lugar de Dict"""
    labels: List[LabelItem] = Field(description="Lista de etiquetas")

class Question(BaseModel):
    """Una pregunta del cuestionario - CORREGIDO"""
    id: str = Field(description="ID único")
    question: str = Field(description="Texto en español")
    type: str = Field(description="text|date|select|yes_no|textarea|email|phone|ssn|number")
    required: bool = Field(description="Si es obligatorio")
    placeholder: Optional[str] = Field(description="Ejemplo")
    hint: Optional[str] = Field(description="Ayuda")
    options: Optional[List[str]] = Field(description="Opciones para select")
    field_ids: Optional[List[str]] = Field(description="IDs de campos PDF")

class Section(BaseModel):
    """Sección del cuestionario - CORREGIDO"""
    id: str = Field(description="ID de sección")
    name: str = Field(description="Nombre")
    description: Optional[str] = Field(description="Descripción")
    questions: List[Question] = Field(description="Preguntas")

class QuestionnaireChunk(BaseModel):
    """Chunk de cuestionario - Para procesamiento parcial"""
    questions: List[Question] = Field(description="Preguntas generadas")

class FieldEdit(BaseModel):
    """Edición de campo"""
    field_id: str = Field(description="ID exacto del campo")
    value: str = Field(description="Valor a llenar")

class FormMapping(BaseModel):
    """Mapeo de respuestas - CORREGIDO"""
    edits: List[FieldEdit] = Field(description="Lista de ediciones")

# ============================================================================
# CONSTANTES
# ============================================================================

CHUNK_SIZE = 80  # Campos por chunk (reducido para evitar truncamiento)
MAX_CONTEXT_LENGTH = 150  # Caracteres máx de contexto por campo
MAX_OUTPUT_TOKENS = 4096  # Reducido para evitar truncamiento

# ============================================================================
# CLASE PRINCIPAL
# ============================================================================

class FormProcessorGemini:
    """
    Procesador de formularios con soporte para formularios grandes.
    Procesa en chunks para evitar límites de tokens.
    """

    def __init__(self, google_api_key: str = None):
        self.api_key = google_api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Se requiere GEMINI_API_KEY")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        logger.info("✅ FormProcessorGemini V2 inicializado")

    # ========================================================================
    # PASO 1: FRIENDLY LABELS (Gemini) - CORREGIDO
    # ========================================================================

    def generate_friendly_labels(self, fields: List[dict]) -> List[dict]:
        """Genera etiquetas amigables - CORREGIDO para Gemini."""
        if not fields:
            return fields

        # Procesar en chunks si hay muchos campos
        if len(fields) > CHUNK_SIZE:
            return self._generate_labels_chunked(fields)

        try:
            summaries = [
                {
                    "i": str(i),
                    "n": f.get('native_field_name', '')[:50],
                    "c": f.get('label_context', '')[:100]
                }
                for i, f in enumerate(fields)
            ]

            prompt = f"""Genera etiquetas cortas (2-6 palabras) para estos {len(fields)} campos de formulario.

CAMPOS:
{json.dumps(summaries, ensure_ascii=False)}

Responde con lista de objetos: [{{"index": "0", "label": "Full Name"}}, ...]"""

            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=FieldLabelsResponse,
                    temperature=0.1,
                    max_output_tokens=2048
                )
            )

            result = FieldLabelsResponse.model_validate_json(response.text)

            # Convertir lista a dict para búsqueda rápida
            labels_map = {item.index: item.label for item in result.labels}

            for i, field in enumerate(fields):
                field['friendly_label'] = labels_map.get(str(i), field.get('native_field_name', ''))

            logger.info(f"[Gemini] {len(labels_map)} etiquetas generadas")
            return fields

        except Exception as e:
            logger.error(f"[Gemini] Error en labels: {e}")
            # Fallback: usar nombres nativos
            for f in fields:
                f['friendly_label'] = f.get('native_field_name', f['field_id'])
            return fields

    def _generate_labels_chunked(self, fields: List[dict]) -> List[dict]:
        """Genera labels en chunks para formularios grandes."""
        logger.info(f"[Gemini] Procesando {len(fields)} campos en chunks de {CHUNK_SIZE}")

        for i in range(0, len(fields), CHUNK_SIZE):
            chunk = fields[i:i + CHUNK_SIZE]
            chunk_result = self.generate_friendly_labels(chunk)

            # Copiar labels de vuelta
            for j, f in enumerate(chunk_result):
                fields[i + j]['friendly_label'] = f.get('friendly_label', '')

        return fields

    # ========================================================================
    # PASO 2: GENERACIÓN DE CUESTIONARIO (EN CHUNKS)
    # ========================================================================

    def _detect_sections(self, fields: List[dict]) -> dict:
        """Detecta secciones dinámicamente."""
        sections = {}

        patterns = [
            (r'Part\s*(\d+)', lambda m: f'part{m.group(1)}'),
            (r'Pt\s*(\d+)', lambda m: f'part{m.group(1)}'),
            (r'Section\s*(\d+)', lambda m: f'section{m.group(1)}'),
            (r'page(\d+)_', lambda m: f'page{m.group(1)}'),
        ]

        for field in fields:
            combined = field.get('field_id', '') + ' ' + field.get('native_field_name', '')
            section_key = 'general'

            for pattern, key_func in patterns:
                match = re.search(pattern, combined, re.IGNORECASE)
                if match:
                    section_key = key_func(match)
                    break

            if section_key not in sections:
                sections[section_key] = []
            sections[section_key].append(field)

        return sections

    def generate_questionnaire(
        self,
        fields: List[dict],
        form_code: str,
        instructions_text: str = None,
        visa_category: str = None,
        visa_subcategory: str = None
    ) -> dict:
        """
        Genera cuestionario completo.
        Para formularios grandes (>80 campos), procesa en chunks.
        """
        total_fields = len(fields)

        # Si es pequeño, procesar todo de una vez
        if total_fields <= CHUNK_SIZE:
            return self._generate_questionnaire_single(
                fields, form_code, instructions_text, visa_category, visa_subcategory
            )

        # Si es grande, procesar en chunks y combinar
        logger.info(f"[Gemini] Formulario grande ({total_fields} campos). Procesando en chunks...")
        return self._generate_questionnaire_chunked(
            fields, form_code, instructions_text, visa_category, visa_subcategory
        )

    def _generate_questionnaire_single(
        self,
        fields: List[dict],
        form_code: str,
        instructions_text: str = None,
        visa_category: str = None,
        visa_subcategory: str = None
    ) -> dict:
        """Genera cuestionario para formulario pequeño/mediano."""

        # Formato compacto de campos con context
        fields_compact = []
        for f in fields:
            label = f.get('friendly_label', '') or ''
            context = f.get('label_context', '')[:150] or ''
            native = f.get('native_field_name', '')
            
            # Extract human-readable hints from native field name
            # e.g. "Pt1Line1_FamilyName[0]" -> "Part 1 Line 1 Family Name"
            readable = re.sub(r'\[\d+\]', '', native)
            readable = re.sub(r'form\d+\[\d+\]\.#subform\[\d+\]\.', '', readable)
            readable = re.sub(r'([a-z])([A-Z])', r'\1 \2', readable)
            readable = re.sub(r'[_.]', ' ', readable)
            readable = re.sub(r'Pt(\d+)', r'Part \1', readable)
            readable = re.sub(r'Line(\d+)', r'Item \1', readable)
            readable = readable.strip()
            
            best_label = label if label and 'subform' not in label else readable
            
            line = f"{f['field_id']}|{f['field_type']}|{best_label}"
            if context and 'subform' not in context[:30]:
                line += f"|context:{context[:100]}"
            if f.get('options'):
                line += f"|opts:{','.join(f['options'][:5])}"
            fields_compact.append(line)

        fields_text = "\n".join(fields_compact)

        # Contexto de visa (si aplica)
        visa_hint = ""
        if visa_subcategory in ['NIW', 'EB-1A']:
            visa_hint = "AUTO-PETICIÓN: No preguntar sobre empleador."

        # Instrucciones resumidas
        instr_summary = ""
        if instructions_text:
            instr_summary = f"\nINSTRUCCIONES (resumen):\n{instructions_text[:3000]}"

        prompt = f"""You are an expert immigration attorney assistant. Generate a questionnaire in SPANISH for USCIS form {form_code}.

CRITICAL RULES:
- Questions MUST be in natural Spanish, easy to understand by a non-expert client
- NEVER use technical PDF field names (like "form1[0].#subform[0]...") in the question text
- Each question should be clear: "¿Cuál es su apellido?" NOT "¿Cuál es su Pt1Line1_FamilyName?"
- Use the "context" and field label hints to understand what each field asks
- Group related fields into single questions when logical (e.g., full name = first + middle + last)
- For addresses: ask street, city, state, ZIP, country separately
- For dates: specify format (DD/MM/YYYY)
- Common field patterns: FamilyName=Apellido, GivenName=Nombre, MiddleName=Segundo nombre, DOB=Fecha de nacimiento, COB=País de nacimiento, SSN=Número de Seguro Social, AlienNumber=A-Number

{visa_hint}

FORM FIELDS ({len(fields)} total):
{fields_text}
{instr_summary}

QUESTION TYPES: text, date, select, yes_no, phone, email, ssn, number, textarea
Each question must include field_ids array for mapping back to PDF fields.

Generate a comprehensive questionnaire covering ALL fields. Respond as JSON with list of questions."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=QuestionnaireChunk,
                    temperature=0.2,
                    max_output_tokens=MAX_OUTPUT_TOKENS
                )
            )

            result = QuestionnaireChunk.model_validate_json(response.text)
            questions = [q.model_dump() for q in result.questions]

            # Agrupar en secciones
            sections_dict = self._detect_sections(fields)
            sections = self._organize_questions_into_sections(questions, sections_dict)

            questionnaire = {
                'form_code': form_code,
                'sections': sections,
                'total_questions': len(questions),
                'visa_notes': visa_hint
            }

            logger.info(f"[Gemini] ✅ {len(questions)} preguntas generadas")
            return questionnaire

        except Exception as e:
            logger.error(f"[Gemini] Error: {e}")
            # Fallback: generar cuestionario básico
            return self._generate_fallback_questionnaire(fields, form_code)

    def _generate_questionnaire_chunked(
        self,
        fields: List[dict],
        form_code: str,
        instructions_text: str = None,
        visa_category: str = None,
        visa_subcategory: str = None
    ) -> dict:
        """Genera cuestionario en chunks para formularios grandes."""

        all_questions = []
        sections_dict = self._detect_sections(fields)

        # Procesar por secciones para mantener coherencia
        for section_key, section_fields in sections_dict.items():
            logger.info(f"[Gemini] Procesando sección {section_key} ({len(section_fields)} campos)...")

            # Si la sección es muy grande, subdividir
            for i in range(0, len(section_fields), CHUNK_SIZE):
                chunk = section_fields[i:i + CHUNK_SIZE]

                chunk_result = self._generate_questions_for_chunk(
                    chunk, form_code, section_key, visa_category, visa_subcategory
                )
                all_questions.extend(chunk_result)

        # Organizar en secciones
        sections = self._organize_questions_into_sections(all_questions, sections_dict)

        questionnaire = {
            'form_code': form_code,
            'sections': sections,
            'total_questions': len(all_questions),
            'visa_notes': f"Procesado en chunks. Secciones: {len(sections_dict)}"
        }

        logger.info(f"[Gemini] ✅ Total: {len(all_questions)} preguntas en {len(sections)} secciones")
        return questionnaire

    def _generate_questions_for_chunk(
        self,
        fields: List[dict],
        form_code: str,
        section_name: str,
        visa_category: str = None,
        visa_subcategory: str = None
    ) -> List[dict]:
        """Genera preguntas para un chunk de campos."""

        fields_compact = []
        for f in fields:
            native = f.get('native_field_name', '')
            readable = re.sub(r'\[\d+\]', '', native)
            readable = re.sub(r'form\d+\[\d+\]\.#subform\[\d+\]\.', '', readable)
            readable = re.sub(r'([a-z])([A-Z])', r'\1 \2', readable)
            readable = re.sub(r'[_.]', ' ', readable).strip()
            readable = re.sub(r'Pt(\d+)', r'Part \1', readable)
            
            label = f.get('friendly_label', '') or readable
            context = f.get('label_context', '')[:100] or ''
            
            line = f"{f['field_id']}|{f['field_type']}|{label}"
            if context and 'subform' not in context[:30]:
                line += f"|context:{context[:80]}"
            if f.get('options'):
                line += f"|{','.join(f['options'][:3])}"
            fields_compact.append(line)

        prompt = f"""Generate questions in SPANISH for USCIS form {form_code}, section {section_name}.
NEVER use technical PDF field names in questions. Use natural language.
Common: FamilyName=Apellido, GivenName=Nombre, DOB=Fecha nacimiento, COB=País nacimiento.

FIELDS:
{chr(10).join(fields_compact)}

Types: text/date/select/yes_no/phone/email/ssn/number. Include field_ids for mapping."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=QuestionnaireChunk,
                    temperature=0.2,
                    max_output_tokens=2048
                )
            )

            result = QuestionnaireChunk.model_validate_json(response.text)
            return [q.model_dump() for q in result.questions]

        except Exception as e:
            logger.error(f"[Gemini] Error en chunk {section_name}: {e}")
            return self._generate_basic_questions(fields)

    def _organize_questions_into_sections(
        self,
        questions: List[dict],
        sections_dict: dict
    ) -> List[dict]:
        """Organiza preguntas en secciones."""

        # Mapear field_id a sección
        field_to_section = {}
        for section_key, fields in sections_dict.items():
            for f in fields:
                field_to_section[f['field_id']] = section_key

        # Agrupar preguntas por sección
        section_questions = {}
        for q in questions:
            # Determinar sección por field_ids
            section_key = 'general'
            if q.get('field_ids'):
                for fid in q['field_ids']:
                    if fid in field_to_section:
                        section_key = field_to_section[fid]
                        break

            if section_key not in section_questions:
                section_questions[section_key] = []
            section_questions[section_key].append(q)

        # Convertir a lista de secciones
        sections = []
        for key in sorted(section_questions.keys(), key=self._section_sort_key):
            sections.append({
                'id': key,
                'name': self._get_section_name(key),
                'description': '',
                'questions': section_questions[key]
            })

        return sections

    def _section_sort_key(self, key: str):
        match = re.search(r'(\d+)', key)
        num = int(match.group(1)) if match else 999
        if key.startswith('part'):
            return (0, num)
        elif key.startswith('section'):
            return (1, num)
        elif key.startswith('page'):
            return (2, num)
        return (3, num)

    def _get_section_name(self, key: str) -> str:
        names = {
            'part1': 'Información del Peticionario',
            'part2': 'Tipo de Petición',
            'part3': 'Información del Beneficiario',
            'part4': 'Procesamiento',
            'part5': 'Información Adicional',
            'part6': 'Empleo Propuesto',
            'part7': 'Dependientes',
            'part8': 'Firma y Certificación',
        }
        return names.get(key, key.replace('_', ' ').title())

    def _generate_fallback_questionnaire(self, fields: List[dict], form_code: str) -> dict:
        """Genera cuestionario básico como fallback."""
        questions = self._generate_basic_questions(fields)

        return {
            'form_code': form_code,
            'sections': [{
                'id': 'general',
                'name': 'Información General',
                'description': 'Generado automáticamente',
                'questions': questions
            }],
            'total_questions': len(questions),
            'visa_notes': 'Fallback: cuestionario básico'
        }

    def _generate_basic_questions(self, fields: List[dict]) -> List[dict]:
        """Genera preguntas básicas sin IA usando friendly_label."""
        questions = []

        for i, f in enumerate(fields):
            q_type = 'text'
            if f['field_type'] == 'checkbox':
                q_type = 'yes_no'
            elif f['field_type'] == 'dropdown':
                q_type = 'select'
            elif 'date' in f.get('native_field_name', '').lower():
                q_type = 'date'
            elif 'phone' in f.get('native_field_name', '').lower():
                q_type = 'phone'
            elif 'email' in f.get('native_field_name', '').lower():
                q_type = 'email'
            elif 'ssn' in f.get('native_field_name', '').lower():
                q_type = 'ssn'

            # USAR FRIENDLY_LABEL en lugar de field_id, con cleanup
            label = f.get('friendly_label') or f.get('native_field_name') or 'este campo'
            # Clean technical names from label
            if 'subform' in label or 'form1' in label or '#' in label:
                label = re.sub(r'\[\d+\]', '', label)
                label = re.sub(r'form\d+\[\d+\]\.#subform\[\d+\]\.', '', label)
                label = re.sub(r'([a-z])([A-Z])', r'\1 \2', label)
                label = re.sub(r'[_.]', ' ', label)
                label = re.sub(r'Pt(\d+)', r'Part \1', label)
                label = re.sub(r'Line(\d+)', r'Item \1', label)
                label = label.strip()
            
            # Map common English field patterns to Spanish
            label_map = {
                'Family Name': 'Apellido', 'Given Name': 'Nombre', 'Middle Name': 'Segundo Nombre',
                'Date Of Birth': 'Fecha de Nacimiento', 'Country Of Birth': 'País de Nacimiento',
                'City Of Birth': 'Ciudad de Nacimiento', 'State Of Birth': 'Estado/Provincia de Nacimiento',
                'Street Number': 'Dirección (Calle y Número)', 'City Or Town': 'Ciudad',
                'Zip Code': 'Código Postal', 'Province': 'Provincia/Estado',
                'Daytime Phone': 'Teléfono', 'Mobile Phone': 'Teléfono Móvil',
                'Email Address': 'Correo Electrónico', 'Alien Number': 'A-Number',
            }
            for eng, esp in label_map.items():
                if eng.lower() in label.lower():
                    label = esp
                    break

            questions.append({
                'id': f"q_{i}",
                'question': f"¿Cuál es su {label}?",
                'type': q_type,
                'required': True,
                'placeholder': None,
                'hint': None,
                'options': f.get('options'),
                'field_ids': [f['field_id']]
            })

        return questions

    # ========================================================================
    # PASO 3: MAPEO DE RESPUESTAS (Gemini)
    # ========================================================================

    def map_answers_to_fields(
        self,
        answers: List[dict],
        fields: List[dict],
        instructions_text: str = None
    ) -> dict:
        """Mapea respuestas a campos del formulario."""
        if not fields or not answers:
            return {}

        # Formato compacto de respuestas
        answers_text = "\n".join([
            f"Q: {a['question'][:80]}\nA: {a['answer']}"
            for a in answers[:50]  # Limitar para tokens
        ])

        # Formato compacto de campos
        fields_text = "\n".join([
            f"{f['field_id']}|{f['field_type']}|{f.get('friendly_label', '')[:40]}"
            for f in fields[:150]  # Limitar
        ])

        prompt = f"""Mapea respuestas a campos PDF.

RESPUESTAS:
{answers_text}

CAMPOS:
{fields_text}

REGLAS:
- SSN: 9 dígitos sin guiones
- Teléfono: 10 dígitos
- Fechas: MM/DD/YYYY
- Traducir español→inglés
- Solo incluir campos con respuesta

Devuelve lista de ediciones."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=FormMapping,
                    temperature=0.1,
                    max_output_tokens=2048
                )
            )

            result = FormMapping.model_validate_json(response.text)

            mappings = {edit.field_id: edit.value for edit in result.edits}

            logger.info(f"[Gemini] {len(mappings)} campos mapeados")
            return mappings

        except Exception as e:
            logger.error(f"[Gemini] Error en mapeo: {e}")
            return {}

    # ========================================================================
    # VALIDACIÓN
    # ========================================================================

    def validate_questionnaire_coverage(self, questionnaire: dict, fields: List[dict]) -> dict:
        """Valida cobertura del cuestionario."""
        mapped_ids = set()
        for section in questionnaire.get('sections', []):
            for q in section.get('questions', []):
                if q.get('field_ids'):
                    mapped_ids.update(q['field_ids'])

        all_ids = {f['field_id'] for f in fields}
        covered = len(mapped_ids.intersection(all_ids))
        coverage = (covered / len(all_ids)) * 100 if all_ids else 0

        return {
            'total_fields': len(all_ids),
            'mapped_fields': covered,
            'coverage_pct': round(coverage, 1),
            'total_questions': questionnaire.get('total_questions', 0),
            'status': 'OK' if coverage >= 50 else 'NEEDS_IMPROVEMENT'
        }


# ============================================================================
# FUNCIONES HELPER PARA USO DIRECTO
# ============================================================================

def get_gemini_processor() -> FormProcessorGemini:
    """
    Factory function para crear un procesador Gemini.
    
    Returns:
        FormProcessorGemini instancia configurada
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY no configurada")
    
    return FormProcessorGemini(google_api_key=api_key)
