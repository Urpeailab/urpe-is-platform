"""
SISTEMA DE EXTRACCIÓN Y GENERACIÓN DE CARTAS V2 - VERSIÓN MEJORADA

Este módulo reemplaza el sistema anterior con un enfoque más robusto:
1. Extracción PROFUNDA del texto completo de cada documento
2. Análisis en 2 fases: Clasificación inicial + Extracción detallada
3. Síntesis inteligente que identifica correctamente el perfil profesional
4. Generación de carta usando TODA la información extraída

Diseñado para funcionar aunque tome 20 minutos - la calidad es la prioridad
"""

import asyncio
import logging
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any


async def extract_all_document_contents(session_id: str, db, files: list, classifications: list) -> Dict[str, Any]:
    """
    FASE 1: Extraer el contenido COMPLETO de todos los documentos.
    Esto es crítico - necesitamos todo el texto para generar una carta precisa.
    """
    from patent_extractor.file_handler import extract_text_from_file
    
    document_contents = {}
    
    for i, file_data in enumerate(files):
        file_id = file_data['file_id']
        filename = file_data['filename']
        file_path = file_data.get('file_path')
        
        logging.info(f"📄 Extrayendo contenido de: {filename} ({i+1}/{len(files)})")
        
        # Update progress
        progress = 35 + int((i / len(files)) * 15)
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "progress": progress,
                "progress_message": f"Extrayendo texto: {filename} ({i+1}/{len(files)})"
            }}
        )
        
        text_content = ""
        if file_path and Path(file_path).exists():
            try:
                with open(file_path, 'rb') as f:
                    content_bytes = f.read()
                text_content = extract_text_from_file(content_bytes, filename)
            except Exception as e:
                logging.error(f"Error extracting {filename}: {e}")
                text_content = f"[Error extrayendo texto de {filename}]"
        
        # Find classification for this file
        classification = next((c for c in classifications if c.get('file_id') == file_id), {})
        
        document_contents[file_id] = {
            "filename": filename,
            "file_id": file_id,
            "exhibit_number": classification.get('exhibit_number', i + 1),
            "document_type": classification.get('document_type', 'other'),
            "classification_summary": classification.get('summary', ''),
            "full_text": text_content,
            "text_length": len(text_content)
        }
        
        # Small delay to not overwhelm the system
        await asyncio.sleep(0.1)
    
    return document_contents


async def deep_analyze_document(openai_client, doc_content: dict, applicant_name: str) -> dict:
    """
    FASE 2: Análisis PROFUNDO de un documento individual.
    Extrae toda la información relevante para la petición NIW.
    """
    filename = doc_content['filename']
    full_text = doc_content['full_text']
    doc_type = doc_content['document_type']
    exhibit_num = doc_content['exhibit_number']
    
    # Usar hasta 80000 caracteres (≈20-25 páginas) para que cartas largas/estudios no pierdan contenido
    text_sample = full_text[:80000] if full_text else f"[Archivo: {filename}]"
    
    if len(text_sample.strip()) < 100:
        return {
            "filename": filename,
            "exhibit_number": exhibit_num,
            "document_type": doc_type,
            "analysis": "Documento sin contenido extraíble",
            "key_information": [],
            "quotes": [],
            "relevance_to_petition": "No se pudo analizar"
        }
    
    analysis_prompt = f"""Analiza este documento en PROFUNDIDAD para una petición EB-2 NIW del solicitante {applicant_name}.

ARCHIVO: {filename} (Exhibit {exhibit_num})
TIPO DETECTADO: {doc_type}

CONTENIDO COMPLETO DEL DOCUMENTO:
{text_sample}

INSTRUCCIONES CRÍTICAS:
1. Lee TODO el contenido cuidadosamente
2. Identifica EXACTAMENTE qué tipo de documento es y su propósito
3. Extrae TODA la información relevante para la petición NIW
4. Si es una carta de recomendación, identifica QUIÉN la escribe y SOBRE QUIÉN
5. Si menciona proyectos, metodologías o logros, extráelos textualmente
6. Distingue entre documentos CREADOS POR el solicitante vs documentos SOBRE el solicitante

Responde en JSON con este formato EXACTO:
{{
    "document_purpose": "Descripción clara del propósito de este documento",
    "is_about_applicant": true/false,
    "is_created_by_applicant": true/false,
    "author_info": {{
        "name": "Nombre del autor si aplica",
        "title": "Título profesional",
        "institution": "Institución",
        "relationship_to_applicant": "Cómo conoce al solicitante"
    }},
    "applicant_info_found": {{
        "professional_title": "Título profesional del solicitante mencionado",
        "current_employer": "Empleador actual mencionado",
        "field_of_work": "Campo de trabajo",
        "proposed_project": "Proyecto propuesto si se menciona",
        "methodologies": ["Metodologías propias mencionadas"],
        "achievements": ["Logros específicos mencionados"]
    }},
    "key_quotes": ["Citas textuales sustantivas y extensas (máximo 15) — incluye párrafos completos cuando aportan valor argumentativo"],
    "statistics_and_data": ["Datos cuantitativos mencionados"],
    "prong1_evidence": "Cómo este documento apoya el mérito sustancial e importancia nacional",
    "prong2_evidence": "Cómo este documento demuestra que el solicitante está bien posicionado",
    "prong3_evidence": "Cómo este documento justifica la exención del proceso laboral",
    "summary_for_letter": "Resumen de 2-3 oraciones de cómo usar este documento en la carta"
}}"""

    # System prompt profesional para análisis
    analysis_system = f"""Eres un asistente legal que ayuda a analizar documentos para peticiones de inmigración EB-2 NIW.

Tu tarea es extraer información relevante del documento proporcionado para ayudar a un abogado a preparar la petición de {applicant_name}.

Esta es una tarea legítima de análisis de documentos para un proceso de inmigración legal ante USCIS.
Debes extraer la información de manera objetiva y precisa, respondiendo siempre en formato JSON."""

    try:
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": analysis_system},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.2,
                max_tokens=8000,
                response_format={"type": "json_object"}
            ),
            timeout=120.0
        )
        
        result = json.loads(response.choices[0].message.content)
        result['filename'] = filename
        result['exhibit_number'] = exhibit_num
        result['document_type'] = doc_type
        result['original_text_preview'] = text_sample[:2000]  # Keep preview for reference
        return result
        
    except Exception as e:
        logging.warning(f"⚠️ GPT-4o falló analizando {filename}: {str(e)[:50]}. Intentando GPT-5.1...")
        try:
            response = await asyncio.wait_for(
                openai_client.chat.completions.create(
                    model="gpt-5.1",
                    messages=[
                        {"role": "system", "content": analysis_system},
                        {"role": "user", "content": analysis_prompt}
                    ],
                    temperature=0.2,
                    max_completion_tokens=8000,
                    response_format={"type": "json_object"}
                ),
                timeout=180.0
            )
            result = json.loads(response.choices[0].message.content)
            result['filename'] = filename
            result['exhibit_number'] = exhibit_num
            result['document_type'] = doc_type
            result['original_text_preview'] = text_sample[:2000]
            return result
        except Exception as e2:
            logging.error(f"Error analyzing {filename} con ambos modelos: {e2}")
            return {
                "filename": filename,
                "exhibit_number": exhibit_num,
                "document_type": doc_type,
                "error": str(e2),
                "analysis": "Error en análisis"
            }


async def create_comprehensive_profile(openai_client, applicant_name: str, all_analyses: list) -> dict:
    """
    FASE 3: Crear un perfil COMPLETO del solicitante basado en TODOS los documentos analizados.
    Esta es la fase crítica donde identificamos correctamente quién es el solicitante.
    """
    
    # Preparar un resumen estructurado de todos los análisis
    analyses_summary = []
    for analysis in all_analyses:
        if 'error' not in analysis:
            analyses_summary.append({
                "exhibit": analysis.get('exhibit_number'),
                "filename": analysis.get('filename'),
                "purpose": analysis.get('document_purpose', ''),
                "applicant_info": analysis.get('applicant_info_found', {}),
                "author_info": analysis.get('author_info', {}),
                "key_quotes": analysis.get('key_quotes', [])[:10],
                "statistics_and_data": analysis.get('statistics_and_data', []),
                "summary_for_letter": analysis.get('summary_for_letter', ''),
                "prong1": analysis.get('prong1_evidence', ''),
                "prong2": analysis.get('prong2_evidence', ''),
                "prong3": analysis.get('prong3_evidence', '')
            })
    
    profile_prompt = f"""Basándote en el análisis de TODOS los documentos, crea un perfil PRECISO, COMPLETO y EXTREMADAMENTE DETALLADO de {applicant_name} para su petición EB-2 NIW.

ANÁLISIS DE TODOS LOS DOCUMENTOS:
{json.dumps(analyses_summary, indent=2, default=str)}

INSTRUCCIONES CRÍTICAS:
1. Identifica EXACTAMENTE la profesión principal del solicitante (NO inventes, usa solo lo que dicen los documentos)
2. Identifica el proyecto propuesto ESPECÍFICO con TODOS sus componentes
3. Lista TODAS las metodologías/frameworks PROPIOS del solicitante con sus acrónimos (ej: RISE, GCBT, GON, DGC, CABT)
4. Para CADA metodología, incluye una descripción detallada de qué es y cómo funciona
5. Identifica el empleador ACTUAL con cargo específico
6. Extrae datos cuantitativos ESPECÍFICOS del problema nacional (millones afectados, pérdidas económicas, etc.)
7. NO confundas la profesión - si es educador, es educador, NO econometrista
8. Identifica TODOS los componentes del proyecto (ej: componente lingüístico, cívico, digital)
9. Extrae información de estudios econométricos si los hay (impacto económico proyectado, empleos a crear, ROI social)
10. Identifica alineación con políticas federales mencionadas (WIOA, Digital Equity Act, etc.)

Responde en JSON:
{{
    "applicant_name": "{applicant_name}",
    
    "professional_identity": {{
        "primary_profession": "Profesión principal EXACTA según los documentos",
        "specialization": "Especialización específica",
        "field": "Campo de trabajo",
        "years_experience": "Años de experiencia",
        "international_experience": ["Países donde ha trabajado"]
    }},
    
    "current_employment": {{
        "employer": "Nombre exacto del empleador actual",
        "position": "Puesto actual",
        "location": "Ciudad, Estado",
        "start_date": "Fecha de inicio si se menciona",
        "responsibilities": ["Responsabilidades principales detalladas"],
        "pilot_phase_connection": "Cómo el empleo actual conecta con el proyecto propuesto"
    }},
    
    "proposed_endeavor": {{
        "project_name": "Nombre COMPLETO del proyecto propuesto",
        "project_type": "Tipo (ej: Plataforma Digital Nacional, Programa Educativo, etc.)",
        "description": "Descripción detallada del proyecto (mínimo 100 palabras)",
        "target_population": "Población objetivo con números específicos",
        "components": [
            {{
                "name": "Nombre del componente (ej: Componente Lingüístico)",
                "description": "Descripción detallada de qué incluye",
                "methodology_used": "Metodología específica usada para este componente"
            }}
        ],
        "innovation": "Qué hace único/innovador a este proyecto vs soluciones existentes",
        "scalability": "Plan de escalabilidad (usuarios año 1, año 3, año 5)",
        "expected_impact": "Impacto esperado detallado"
    }},
    
    "academic_credentials": [
        {{
            "degree": "Tipo de título (ej: Master's, Bachelor's)",
            "full_name": "Nombre completo del título",
            "field": "Campo de estudio",
            "institution": "Institución que lo otorgó",
            "country": "País",
            "year": "Año de graduación",
            "us_equivalency": "Equivalencia a título estadounidense si se evaluó",
            "evaluator": "Organización que hizo la evaluación (ej: CED, WES)",
            "gpa": "GPA si se menciona"
        }}
    ],
    
    "own_methodologies": [
        {{
            "acronym": "Acrónimo de la metodología (ej: RISE, GCBT, GON)",
            "full_name": "Nombre completo expandido",
            "description": "Descripción detallada de la metodología (qué es, cómo funciona)",
            "phases_or_steps": ["Fases o pasos de la metodología si los tiene"],
            "evidence_of_effectiveness": "Evidencia de efectividad si se menciona",
            "documented_in": "Dónde está documentada (ej: manuscrito, publicación)"
        }}
    ],
    
    "professional_experience": [
        {{
            "position": "Cargo",
            "employer": "Empleador",
            "location": "Ubicación",
            "dates": "Período",
            "key_responsibilities": ["Responsabilidades clave"],
            "achievements": ["Logros en este cargo"]
        }}
    ],
    
    "key_achievements": ["Logros principales con números específicos si los hay"],
    
    "expert_endorsements": [
        {{
            "expert_name": "Nombre completo del experto",
            "expert_title": "Título/Cargo del experto",
            "expert_credentials": "Credenciales académicas del experto",
            "organization": "Organización del experto",
            "key_endorsement": "Cita textual de lo que dice sobre el solicitante",
            "exhibit_number": "Número de exhibit"
        }}
    ],
    
    "quantitative_data": {{
        "national_problem_statistics": {{
            "affected_population": "Número de personas afectadas por el problema",
            "economic_losses": "Pérdidas económicas del problema (en dólares)",
            "other_statistics": ["Otras estadísticas relevantes del problema"]
        }},
        "econometric_study": {{
            "study_name": "Nombre del estudio si existe",
            "economic_value_generation": "Valor económico proyectado",
            "job_creation": "Empleos a crear",
            "roi_or_benefit_ratio": "Ratio beneficio/costo o ROI social",
            "public_cost_savings": "Ahorros proyectados en costos públicos",
            "other_projections": ["Otras proyecciones del estudio"]
        }},
        "social_impact_projections": {{
            "proficiency_improvement": "Mejora proyectada en competencias",
            "labor_participation": "Cambio proyectado en participación laboral",
            "civic_participation": "Cambio proyectado en participación cívica"
        }}
    }},
    
    "federal_policy_alignment": [
        {{
            "policy_name": "Nombre de la política/ley federal",
            "how_aligned": "Cómo el proyecto se alinea con esta política"
        }}
    ],
    
    "why_current_solutions_inadequate": "Explicación de por qué las soluciones actuales son insuficientes",
    
    "prong1_summary": "Resumen DETALLADO de cómo el proyecto tiene mérito sustancial e importancia nacional (mínimo 150 palabras)",
    "prong2_summary": "Resumen DETALLADO de cómo el solicitante está bien posicionado para avanzar el proyecto (mínimo 150 palabras)",
    "prong3_summary": "Resumen DETALLADO de por qué se justifica la exención del proceso laboral - incluir naturaleza emprendedora, creación de empleos, urgencia (mínimo 150 palabras)",
    
    "strongest_evidence": ["Los 10 puntos de evidencia más fuertes para esta petición"]
}}"""

    try:
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Eres un abogado de inmigración experto creando el perfil más preciso y COMPLETO posible del solicitante basándote ÚNICAMENTE en los documentos proporcionados. Debes extraer TODAS las metodologías propias con sus acrónimos, TODOS los datos cuantitativos, y TODA la información de expertos. NO inventes información pero SÍ extrae todo lo que encuentres."},
                    {"role": "user", "content": profile_prompt}
                ],
                temperature=0.2,
                max_tokens=12000,
                response_format={"type": "json_object"}
            ),
            timeout=180.0
        )
        
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        logging.warning(f"⚠️ GPT-4o falló creando perfil: {str(e)[:50]}. Intentando GPT-5.1...")
        try:
            response = await asyncio.wait_for(
                openai_client.chat.completions.create(
                    model="gpt-5.1",
                    messages=[
                        {"role": "system", "content": "Eres un abogado de inmigración experto creando el perfil más preciso y COMPLETO posible del solicitante basándote ÚNICAMENTE en los documentos proporcionados. Debes extraer TODAS las metodologías propias con sus acrónimos, TODOS los datos cuantitativos, y TODA la información de expertos. NO inventes información pero SÍ extrae todo lo que encuentres."},
                        {"role": "user", "content": profile_prompt}
                    ],
                    temperature=0.2,
                    max_completion_tokens=12000,
                    response_format={"type": "json_object"}
                ),
                timeout=240.0
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e2:
            logging.error(f"Error creating profile con ambos modelos: {e2}")
            return {"applicant_name": applicant_name, "error": str(e2)}


async def _call_ai_with_fallback(openrouter_key, openai_client, system_prompt, user_prompt, section_name=""):
    """
    Helper: llama a la IA con cadena de fallback:
    Claude Opus 4.5 → Gemini 3 Pro → GPT-4o → GPT-5.1
    """
    import httpx
    REFUSAL_MARKERS = ["I'm sorry", "I cannot", "I can't assist", "I apologize, but I"]
    OR_HEADERS = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://redaccion.urpeintegralservices.co",
        "X-Title": "SmartDocs Creator",
    }

    async def _try_openrouter(model_id):
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=OR_HEADERS,
                json={"model": model_id,
                      "messages": [{"role": "system", "content": system_prompt},
                                   {"role": "user", "content": user_prompt}],
                      "temperature": 0.5, "max_tokens": 32000}
            )
        if resp.status_code != 200:
            raise Exception(f"{model_id} HTTP {resp.status_code}: {resp.text[:200]}")
        content = resp.json()['choices'][0]['message']['content']
        if any(m in content for m in REFUSAL_MARKERS) or len(content.strip()) < 500:
            raise Exception(f"{model_id} refused or too short ({len(content)} chars)")
        return content

    # 1. Claude Opus 4.5
    if openrouter_key:
        try:
            logging.warning(f"📝 [{section_name}] Trying Claude Opus 4.5...")
            c = await _try_openrouter("anthropic/claude-opus-4.7")
            logging.warning(f"✅ [{section_name}] Claude OK ({len(c)} chars)")
            return c
        except Exception as e:
            logging.warning(f"⚠️ [{section_name}] Claude failed: {str(e)[:120]}. Trying Gemini 3 Pro...")

    # 2. Gemini 3 Pro
    if openrouter_key:
        try:
            logging.warning(f"📝 [{section_name}] Trying Gemini 3 Pro...")
            c = await _try_openrouter("google/gemini-3-pro-preview")
            logging.warning(f"✅ [{section_name}] Gemini 3 Pro OK ({len(c)} chars)")
            return c
        except Exception as e:
            logging.warning(f"⚠️ [{section_name}] Gemini failed: {str(e)[:120]}. Trying GPT-4o...")

    # 3. GPT-4o (hard cap: GPT-4o supports at most 16,384 output tokens)
    try:
        logging.warning(f"📝 [{section_name}] Trying GPT-4o...")
        resp = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_prompt}],
                temperature=0.5, max_tokens=16000
            ),
            timeout=180.0
        )
        c = resp.choices[0].message.content
        if any(m in c for m in REFUSAL_MARKERS):
            raise Exception("GPT-4o refused content")
        logging.warning(f"✅ [{section_name}] GPT-4o OK ({len(c)} chars)")
        return c
    except Exception as e:
        logging.warning(f"⚠️ [{section_name}] GPT-4o failed: {str(e)[:120]}. Trying GPT-5.1...")

    # 4. GPT-5.1 (last resort) — newer models reject `max_tokens` and require
    # `max_completion_tokens` instead. They also don't accept a non-default
    # `temperature` value.
    resp = await asyncio.wait_for(
        openai_client.chat.completions.create(
            model="gpt-5.1",
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            max_completion_tokens=32000
        ),
        timeout=300.0
    )
    c = resp.choices[0].message.content
    logging.warning(f"✅ [{section_name}] GPT-5.1 OK ({len(c)} chars)")
    return c


async def generate_precise_letter(openai_client, applicant_name: str, profile: dict, all_analyses: list, exhibit_list: str) -> str:
    """
    FASE 4: Generar la carta en 3 llamadas separadas para alcanzar 30+ páginas.
    Call 1: Section I (Introduction) + Section II (Prong 1)
    Call 2: Section III (Prong 2)
    Call 3: Section IV (Prong 3) + Section V (Conclusion) + Exhibits
    """
    import os
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')

    # ── Shared context ─────────────────────────────────────────────────────────
    all_quotes = []
    for analysis in all_analyses:
        for quote in analysis.get('key_quotes', [])[:10]:
            all_quotes.append(f"Exhibit {analysis.get('exhibit_number')}: \"{quote}\"")

    # Rich per-document context (the drafter previously only saw the synthesized
    # profile JSON; passing the raw analyses lets it cite documents directly).
    document_deep_context = json.dumps([
        {
            "exhibit": a.get('exhibit_number'),
            "filename": a.get('filename'),
            "document_type": a.get('document_type'),
            "purpose": a.get('document_purpose'),
            "summary_for_letter": a.get('summary_for_letter'),
            "applicant_info_found": a.get('applicant_info_found'),
            "author_info": a.get('author_info'),
            "statistics_and_data": a.get('statistics_and_data'),
            "prong1_evidence": a.get('prong1_evidence'),
            "prong2_evidence": a.get('prong2_evidence'),
            "prong3_evidence": a.get('prong3_evidence'),
            "key_quotes": a.get('key_quotes', [])[:10],
        }
        for a in all_analyses if 'error' not in a
    ], indent=2, default=str)

    expert_section = "\n".join([
        f"- {e.get('expert_name')} ({e.get('expert_credentials')}, {e.get('organization')}): \"{e.get('key_endorsement')}\" (Exhibit {e.get('exhibit_number')})"
        for e in profile.get('expert_endorsements', [])
    ])

    today = datetime.now(timezone.utc).strftime('%B %d, %Y')

    profile_ctx = f"""=== PETITIONER: {applicant_name} | DATE: {today} ===
=== PROFESSIONAL IDENTITY ===
{json.dumps(profile.get('professional_identity', {}), indent=2, default=str)}
=== CURRENT EMPLOYMENT ===
{json.dumps(profile.get('current_employment', {}), indent=2, default=str)}
=== PROPOSED ENDEAVOR (all components) ===
{json.dumps(profile.get('proposed_endeavor', {}), indent=2, default=str)}
=== ACADEMIC CREDENTIALS ===
{json.dumps(profile.get('academic_credentials', []), indent=2, default=str)}
=== OWN METHODOLOGIES (with all phases) ===
{json.dumps(profile.get('own_methodologies', []), indent=2, default=str)}
=== PROFESSIONAL EXPERIENCE ===
{json.dumps(profile.get('professional_experience', []), indent=2, default=str)}
=== KEY ACHIEVEMENTS ===
{json.dumps(profile.get('key_achievements', []), indent=2, default=str)}
=== EXPERT ENDORSEMENTS ===
{expert_section}
=== NATIONAL PROBLEM STATISTICS ===
{json.dumps(profile.get('quantitative_data', {}).get('national_problem_statistics', {}), indent=2, default=str)}
=== ECONOMETRIC STUDY ===
{json.dumps(profile.get('quantitative_data', {}).get('econometric_study', {}), indent=2, default=str)}
=== SOCIAL IMPACT PROJECTIONS ===
{json.dumps(profile.get('quantitative_data', {}).get('social_impact_projections', {}), indent=2, default=str)}
=== FEDERAL POLICY ALIGNMENT ===
{json.dumps(profile.get('federal_policy_alignment', []), indent=2, default=str)}
=== WHY CURRENT SOLUTIONS ARE INSUFFICIENT ===
{profile.get('why_current_solutions_inadequate', '')}
=== KEY DOCUMENT QUOTES ===
{chr(10).join(all_quotes[:80])}
=== EXHIBITS ===
{exhibit_list}
=== PRONG SUMMARIES ===
PRONG 1: {profile.get('prong1_summary', '')}
PRONG 2: {profile.get('prong2_summary', '')}
PRONG 3: {profile.get('prong3_summary', '')}
=== STRONGEST EVIDENCE ===
{json.dumps(profile.get('strongest_evidence', []), indent=2, default=str)}
=== DOCUMENT-BY-DOCUMENT DEEP CONTEXT (raw analyses — use this when the synthesized profile above is sparse; cite each exhibit by number) ===
{document_deep_context}"""

    RULES = f"""
CRITICAL RULES (NON-NEGOTIABLE):

VOICE & TONE:
- Write in FIRST PERSON SINGULAR ("I submit...", "My work...", "I respectfully request...")
- Narrative legal voice — confident yet respectful before the adjudicating officer
- This is a LEGAL ALLEGATION, not an expanded CV — argue, do not list
- Specific about numbers, dates, names, institutions — no vague qualifiers
- Self-praise comes EXCLUSIVELY from VERBATIM QUOTES of independent signatories — never adjectives applied to oneself

CITATION RULES:
- CITE each exhibit by number (Exhibit 1, Exhibit 2, etc.) whenever you mention it
- For EACH recommendation/expert letter you reference, INCLUDE A VERBATIM QUOTE in quotation marks with full attribution:
  Pattern: "As Dr. [Full Name] has independently observed in [his/her] expert opinion: '[exact quote]'."
- For EACH signatory mentioned: name + academic/professional title + institution + years of experience + nature of relationship with petitioner + EXPLICIT statement of financial independence
- DO NOT invent information — use ONLY what is in the provided data
- If a data point is missing or ambiguous, use generic language or a visible placeholder like "[VERIFY]" — NEVER fabricate

MANDATORY DHANASAR PHRASES (use at least once each, naturally embedded):
- "within the meaning of Matter of Dhanasar"
- "substantial merit and national importance"
- "well-positioned to advance the proposed endeavor"
- "on balance, it would be beneficial to the United States to waive..."
- "structurally rare in the labor market" OR "skill set exists in too few professionals to populate one"
- Reference "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)" at least once in any section that mentions Dhanasar

PROHIBITED PHRASES (do NOT use):
- "Unique combination" without demonstrating it through specific competencies
- "Highly qualified" (generic)
- "World-class" (empty)
- "Game-changer" / "Game changing"
- "Cutting-edge" without technical substance
- Adjectives without a measurable noun attached

UNIQUE-ANGLE ARGUMENT:
- Identify WHAT MAKES THIS PETITIONER UNIQUE — typically an unusual convergence of competencies
  (e.g. "national-IT-infrastructure + construction entrepreneurship", "maritime-medicine + rural-telehealth")
- Articulate that convergence as the central thread — DO NOT repeat the word "unique"; DEMONSTRATE it
  through the specific combination of credentials, years of experience, and observed problems

NATIONAL FIGURES:
- Cite official sources whenever possible (BLS, Census Bureau, EPA, CDC, HRSA, FDA, DEA, ONDCP, Pew Research, etc.)
- Always with SPECIFIC YEAR
- If the documents already cite them, repeat the figures exactly

PERSONAL ↔ NATIONAL BRIDGE:
- Show the petitioner has been a direct, on-the-ground witness to the problem the project solves
- Use phrases like "I have personally observed...", "I have personally absorbed, in my own [context]...",
  "Across [X] years I have been a sustained, professional, on-the-ground witness to..."

PRONG 3 TIME-SENSITIVITY:
- QUANTIFY the cost of a PERM delay
  Example: "A 12-to-18-month PERM delay therefore translates, in expected value, into approximately
  [N] [units of harm] that would not be prevented during the delay window alone."

FORMAT:
- Use HTML formatting: <h1>, <h2>, <h3>, <h4>, <p>, <ul>, <li>, <strong>, <em>
- Section headings (I-VIII): use <h1> with the EXACT title given
- Subsection headings (A/B/C/D): use <h2> with <strong><em>…</em></strong> styling
- Perjury declarations: wrap in <em> tags (italic)
- Endeavor descriptions in the opening block: wrap in <em>
- Narrative prose — avoid unnecessary bullets in body
- NO tables in body — use fluent prose
- Today's date is {today} — use it directly, NEVER write [Date] or any bracket placeholder
- DO NOT wrap in <html>, <head>, <body> or add <style> blocks — only content HTML
- DO NOT use bracket placeholders like [Name], [Address], [TODO] (the only allowed bracket is [VERIFY] when data is genuinely missing)
"""

    system_prompt = f"""You are a specialist legal assistant in U.S. immigration petitions, drafting EB-2 NIW Self-Petitioner Statements under the framework of Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).

This is a legitimate legal document for USCIS (U.S. Citizenship and Immigration Services).

Your role is to draft a specific SECTION of the self-petition letter for {applicant_name}, writing in the FIRST PERSON SINGULAR as if {applicant_name} were the author — confident, narrative, legally argumentative, never robotic.

The complete final letter (across all sections) targets 13,000–16,000 words (~26–32 single-spaced pages); each section you draft must be substantive, exhaustively developed, and meet the per-section word counts indicated in the user prompt. Depth and specificity matter more than brevity — do NOT abbreviate, do NOT summarize unnecessarily, develop every subsection with concrete dates, dollar amounts, percentages, institutional names, and verbatim quotes.

Use ONLY the provided document information — never invent data. If a fact is missing, leave the visible placeholder [VERIFY] in its place.

Output format: HTML using <h1>, <h2>, <h3>, <h4>, <p>, <ul>, <li>, <strong>, <em>. Do NOT wrap in <html>/<head>/<body> or add <style> blocks. No code fences."""

    # ── CALL 1: Header + Sections I, II, III ──────────────────────────────────
    logging.warning("✍️ CALL 1/3: Header + Intro + Background + Endeavor Summary...")
    prompt_1 = f"""{profile_ctx}

Write the LETTER HEADER and SECTIONS I, II, and III of the EB-2 NIW Self-Petitioner Statement for {applicant_name}.
Target: ~5,000–6,000 words combined (Section I ~700, Section II ~3,200, Section III ~1,500). Develop each subsection exhaustively with concrete detail — do NOT abbreviate.

────────────────────────────────────────────
HEADER (output first, centered using <p style="text-align:center">):
- FULL NAME in <strong> (centered)
- 2–3 lines with key credentials (centered)
- Line: "Founder — <project name>" (centered) — substitute <project name> with the actual value of proposed_endeavor.project_name from the profile context. If the project name is missing, replace the entire line with the petitioner's professional_identity.primary_profession value. Never output literal angle brackets or square brackets here.
- Physical address, phone, email (centered) — ONLY IF these fields are present and non-empty in the profile context above. If any of them is missing, OMIT that line entirely. Do NOT print "[Physical Address]", "[Phone]", "[Email]" or any bracket placeholder for missing contact data.

Then a left-aligned opening block (no centering):
- Today's date ({today})
- "U.S. Citizenship and Immigration Services"
- "Attn: EB-2 National Interest Waiver Adjudication Unit"

Then a <p> block with the case caption:
- "<strong>Re:</strong>" followed by the letter title
- "Self-Petitioner: <strong>{applicant_name.upper()}</strong>"
- "Nationality: …"
- "Proposed Endeavor: <em>…</em>" (long description in italics)

Then salutation: "Dear Immigration Officer:"

────────────────────────────────────────────
SECTION I — INTRODUCTION AND PURPOSE OF THIS STATEMENT
<h1>I. INTRODUCTION AND PURPOSE OF THIS STATEMENT</h1>
- Paragraph 1: Legal identification of petitioner, statutory basis (INA §203(b)(2)(B)) and reference to Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).
- Paragraph 2: Summary of academic credentials and professional trajectory with SPECIFIC YEARS and EXACT institution names.
- Paragraph 3: Why this endeavor — personal, non-technical voice. Mention committed capital, IP, relationships cultivated.
- Close with this declaration WRAPPED IN <em> tags:
  "I make this statement under penalty of perjury, and I declare that the information presented herein is true, complete, and accurate to the best of my knowledge and belief."

────────────────────────────────────────────
SECTION II — PROFESSIONAL BACKGROUND AND THE PATH THAT LED ME TO THIS ENDEAVOR
<h1>II. MY PROFESSIONAL BACKGROUND AND THE PATH THAT LED ME TO THIS ENDEAVOR</h1>

Use these EXACT subsection headings (each as <h2><strong><em>…</em></strong></h2>):

A. Academic Foundation [and Specialized Training]
   - Each degree: full name, field, institution, country, year, U.S. equivalency evaluation if mentioned
   - GPA if mentioned
   - Direct relevance of curriculum to the proposed endeavor

B. More Than {{N}} Years of Continuous Professional Experience  (REPLACE {{N}} with the actual integer from professional_identity.years_experience in the profile context. If years_experience is missing, use the heading "Continuous Professional Experience" without any year count — never leave a literal placeholder like "[X]" or "{{N}}" in the output.)
   - Chronological organization with upward trajectory
   - For EACH position: exact title, employer, location, dates, key responsibilities, quantified achievements, connection to the proposed endeavor

C. Independent Validation of My Track Record
   - For EACH expert/recommendation signatory referenced: full name + degree/title + institution + years of experience + nature of relationship (years of direct observation, supervision, or independent evaluation without prior collaboration) + EXPLICIT statement of financial independence
   - VERBATIM QUOTE of their key observation about the petitioner, in quotation marks, with full attribution
   - Cite Exhibit number for each letter

D. Direct Observation of the Problem the Endeavor Is Designed to Solve
   - Show the petitioner has been a sustained on-the-ground witness to the national problem
   - Use phrases like "I have personally observed…", "I have personally absorbed, in my own [context]…", "Across [X] years I have been a sustained, professional, on-the-ground witness to…"

E. Why This Endeavor, and Why Me
   - Articulate the unique convergence of competencies that defines the petitioner (do NOT say "unique" — demonstrate it through the specific combination)

────────────────────────────────────────────
SECTION III — SUMMARY OF THE PROPOSED ENDEAVOR
<h1>III. SUMMARY OF THE PROPOSED ENDEAVOR</h1>
- Layered technical architecture (4–5 layers typically — name each layer and describe it)
- Quantitative project KPIs (percentages, dollars, timelines)
- Capital structure (founder %, partners %, grants %)
- EXPLICIT mention of the USPTO provisional patent if it exists (with reference to Exhibit number)

{RULES}"""

    # ── CALL 2: Sections IV (Prong 1) + V (Prong 2) ───────────────────────────
    logging.warning("✍️ CALL 2/3: Prong 1 + Prong 2...")
    prompt_2 = f"""{profile_ctx}

Write SECTIONS IV and V of the EB-2 NIW Self-Petitioner Statement for {applicant_name}.
Target: ~5,000–6,000 words combined (Section IV ~2,500, Section V ~3,000). Develop each subsection exhaustively with concrete citations, statistics, dollar amounts, federal-policy references, and verbatim quotes from expert letters.

────────────────────────────────────────────
SECTION IV — PRONG 1: THE PROPOSED ENDEAVOR HAS SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE
<h1>IV. PRONG 1 — THE PROPOSED ENDEAVOR HAS SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE</h1>

Use these EXACT subsection headings (each as <h2><strong><em>…</em></strong></h2>):

A. Substantial Merit
   - Argue the merit of the endeavor with reference to documented evidence, methodologies, and prior validation
   - Quote independent signatories verbatim where they have spoken to merit, with full attribution and Exhibit number

B. National Importance
   Provide FIVE distinct reasons, each in its OWN paragraph, opening with the exact ordinal phrasing below:
   - "First, the affected population is national in scope…" — cite specific demographic statistics with year and source (BLS, Census, CDC, etc.)
   - "Second, the economic and fiscal consequences…" — quantify in dollars, jobs, productivity loss
   - "Third, [project-specific dimension]…" — tie to a specific dimension only this endeavor addresses
   - "Fourth, declared federal-policy alignment…" — cite specific federal laws, agencies, Executive Orders, or strategic plans the project advances
   - "Fifth, [replicability / scalability / sustainability]…" — argue why this can scale beyond a single jurisdiction or pilot

Use the phrase "substantial merit and national importance" at least once. Reference Matter of Dhanasar at least once in this section.

────────────────────────────────────────────
SECTION V — PRONG 2: I AM WELL-POSITIONED TO ADVANCE THE PROPOSED ENDEAVOR
<h1>V. PRONG 2 — I AM WELL-POSITIONED TO ADVANCE THE PROPOSED ENDEAVOR</h1>

Use these EXACT subsection headings (each as <h2><strong><em>…</em></strong></h2>):

A. Education and Specialized Knowledge
   - For EACH degree: full name, field, institution, country, year, U.S. equivalency evaluation
   - Concrete link to the competencies the endeavor demands

B. Record of Success
   - For EACH proprietary methodology / framework: full name, acronym expanded, problem it solves, ALL phases described, where documented, expert validation quote (verbatim, attributed, with Exhibit), evidence of effectiveness
   - Quantified achievements (programs implemented, beneficiaries reached, partnerships, pilot status)

C. Plan for Future Activities
   - Year 1 implementation plan
   - 1–5 year scaling plan
   - Committed partnerships, technology resources, financial sustainability model
   - Mention the USPTO provisional patent here as part of the future-activities IP roadmap (with Exhibit reference)

D. Support from Relevant Stakeholders
   List EVERY recommendation/expert letter with enumerated markers (i), (ii), (iii), … For each:
   - Full name + complete credentials (degrees, titles)
   - Organization and position
   - Years of experience
   - Nature of relationship with the petitioner + explicit financial-independence statement
   - VERBATIM QUOTE of their key endorsement, in quotation marks, with attribution and Exhibit number
   Pattern to follow (substitute every angle-bracketed field with the actual value from expert_endorsements in the profile context; if a field is genuinely missing, write a fluent paraphrase that omits the missing element — NEVER output literal angle brackets, square brackets, or placeholder text like "[Title]" / "[Institution]" / "[X] years"):
   "(i) <Full Name>, <Title>, <Institution> (<years of experience> years of experience). <Nature of relationship + financial-independence statement>. As <Mr./Ms./Dr.> <Last Name> independently observed: '<exact verbatim quote>' (Exhibit <N>)."

Use the phrase "well-positioned to advance the proposed endeavor" at least once.

{RULES}"""

    # ── CALL 3: Sections VI (Prong 3) + VII (Additional) + VIII (Conclusion) + Closing + Enclosures ─
    logging.warning("✍️ CALL 3/3: Prong 3 + Additional Considerations + Conclusion + Enclosures...")
    prompt_3 = f"""{profile_ctx}

Write SECTIONS VI, VII, and VIII plus the LETTER CLOSING and ENCLOSURES LIST of the EB-2 NIW Self-Petitioner Statement for {applicant_name}.
Target: ~3,500–4,500 words combined (Section VI ~2,000, Section VII ~1,000, Section VIII ~700, plus closing and enclosures). Develop each subsection with concrete detail and verbatim citations — do NOT abbreviate.

────────────────────────────────────────────
SECTION VI — PRONG 3: ON BALANCE, WAIVING THE JOB-OFFER AND LABOR-CERTIFICATION REQUIREMENTS WOULD BENEFIT THE UNITED STATES
<h1>VI. PRONG 3 — ON BALANCE, WAIVING THE JOB-OFFER AND LABOR-CERTIFICATION REQUIREMENTS WOULD BENEFIT THE UNITED STATES</h1>

Use these EXACT subsection headings (each as <h2><strong><em>…</em></strong></h2>):

A. The Endeavor Is Entrepreneurial, Not an Employment Vacancy
   - Establish there is no specific U.S. employer/job to fill — the petitioner is the founder
   - Cite Dhanasar guidance on entrepreneurial and self-directed projects

B. The Endeavor Creates Jobs for U.S. Workers Rather Than Competing for Them
   - Specific number and types of jobs the endeavor will create (with timeline)
   - Argue complementarity (not competition) with the U.S. labor market

C. The Time Sensitivity of the National Need Weighs Against PERM Delay
   - QUANTIFY the cost of a 12-to-18-month PERM delay in concrete units
     (e.g., "A 12-to-18-month PERM delay therefore translates, in expected value, into approximately
     [N] [units of harm — e.g., people without service, dollars in unrealized productivity, preventable incidents]
     that would not be prevented during the delay window alone.")
   - Cite the national-importance figures from Section IV to ground the quantification

D. The Convergence of Competencies Cannot Be Sourced Through PERM
   - The skill set is "structurally rare in the labor market" OR "exists in too few professionals to populate one"
   - Demonstrate that no PERM recruitment process could realistically identify a substitute
   - Build on the unique-convergence argument from Section II.E

Use the phrase "on balance, it would be beneficial to the United States to waive..." in this section.

────────────────────────────────────────────
SECTION VII — ADDITIONAL CONSIDERATIONS
<h1>VII. ADDITIONAL CONSIDERATIONS</h1>

Use these EXACT subsection headings (each as <h2><strong><em>…</em></strong></h2>):

A. Personal Capital Commitment and Accountability
   - Concrete financial commitment to the endeavor (founder capital, percentage of net worth committed, equity stakes)
   - Argue accountability beyond a typical employee role

B. Intellectual-Property Contribution
   - USPTO provisional patent (if applicable) — describe the IP, its function in the endeavor, and reference the Exhibit
   - Trademarks, copyrights, proprietary methodologies registered or in process

C. Commitment to U.S. Regulatory Compliance and [Applicable Framework]
   - Identify the specific U.S. regulatory frameworks the endeavor will adhere to (HIPAA, FERPA, FDA, EPA, SEC, state licensing, etc. — whichever applies)
   - State the petitioner's commitment to operating under those frameworks

────────────────────────────────────────────
SECTION VIII — CONCLUSION AND RESPECTFUL REQUEST
<h1>VIII. CONCLUSION AND RESPECTFUL REQUEST</h1>

- Paragraph recapitulating the three prongs — substantial merit + well-positioned + waiver beneficial — within the meaning of Matter of Dhanasar
- Formal request for approval of the I-140 petition
- Close with this declaration WRAPPED IN <em> tags (REPEATED from Section I — required):
  "I make this statement under penalty of perjury, and I declare that the information presented herein is true, complete, and accurate to the best of my knowledge and belief."

────────────────────────────────────────────
LETTER CLOSING (output after Section VIII):
- "Respectfully submitted,"
- Blank line for signature (use <p>&nbsp;</p> or two <br/>)
- Full name in <strong> (no centering — left aligned)
- 2–3 lines with credentials and "Founder — <project name>" role (substitute <project name> with proposed_endeavor.project_name from the profile context; if missing, use professional_identity.primary_profession instead. Never output literal angle brackets or square brackets here.)

────────────────────────────────────────────
ENCLOSURES (output last):
<h1>ENCLOSURES</h1>
Numbered list of EVERY exhibit referenced. Use the exact exhibit list below — each item as "Exhibit [N]: [filename] — [document type/description]".

{exhibit_list}

{RULES}"""

    # ── Execute all 3 calls, threading previously drafted sections forward ─────
    # Each subsequent call receives the prior section text so it can maintain
    # consistency in names, dates, dollar figures, expert quotes, and avoid
    # repeating content the earlier section already covered.
    section_contents = []
    call_specs = [
        ("Header+Sections_I-III", prompt_1),
        ("Sections_IV-V_Prongs1-2", prompt_2),
        ("Sections_VI-VIII+Closing+Enclosures", prompt_3),
    ]
    for i, (name, base_prompt) in enumerate(call_specs, start=1):
        if section_contents:
            previous = "\n\n".join(section_contents)
            prompt = (
                "=== PREVIOUSLY DRAFTED SECTIONS OF THIS SAME LETTER ===\n"
                "(Use these for consistency — keep the SAME names, dates, dollar figures, "
                "expert credentials, and verbatim quotes already used. Build on them; "
                "do NOT contradict or repeat content already written above. You may briefly "
                "reference earlier sections by their roman numeral.)\n\n"
                f"{previous}\n\n"
                "=== END OF PREVIOUSLY DRAFTED SECTIONS — NOW WRITE THE NEW SECTIONS BELOW ===\n\n"
                + base_prompt
            )
        else:
            prompt = base_prompt
        content = await _call_ai_with_fallback(openrouter_key, openai_client, system_prompt, prompt, name)
        section_contents.append(content)
        logging.warning(f"✅ Section {i}/3 done: {len(content)} chars")

    final_content = "\n\n".join(section_contents)
    logging.warning(f"✅ CARTA COMPLETA: {len(final_content)} chars ({len(final_content.split())} words approx)")
    return final_content


async def generate_v2_letter_improved(session_id: str, db, openai_client):
    """
    PROCESO PRINCIPAL DE GENERACIÓN DE CARTA V2 - VERSIÓN MEJORADA
    
    Este proceso puede tomar 15-20 minutos pero produce una carta de alta calidad.
    """
    import time
    start_time = time.time()
    
    try:
        logging.warning(f"{'='*60}")
        logging.warning(f"🚀 INICIANDO GENERACIÓN DE CARTA V2 MEJORADA")
        logging.warning(f"   Session: {session_id}")
        logging.warning(f"{'='*60}")
        
        # Get session data
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            logging.error("Sesión no encontrada")
            return
        
        applicant_name = session.get('applicant_name', 'The Applicant')
        classifications = session.get('classifications', [])
        files = session.get('files', [])
        
        logging.warning(f"📋 Solicitante: {applicant_name}")
        logging.warning(f"📁 Documentos: {len(files)}")
        
        # =====================================================================
        # FASE 1: EXTRAER CONTENIDO COMPLETO DE TODOS LOS DOCUMENTOS
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"📝 FASE 1: Extrayendo contenido de {len(files)} documentos...")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "extracting", "progress": 35, "progress_message": "Fase 1: Extrayendo contenido de documentos..."}}
        )
        
        document_contents = await extract_all_document_contents(session_id, db, files, classifications)
        
        logging.warning(f"✅ Fase 1 completada - {len(document_contents)} documentos extraídos")
        
        # =====================================================================
        # FASE 2: ANÁLISIS PROFUNDO DE CADA DOCUMENTO
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"🔍 FASE 2: Analizando cada documento en profundidad...")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "extracting", "progress": 50, "progress_message": "Fase 2: Analizando documentos..."}}
        )
        
        all_analyses = []
        docs_list = list(document_contents.values())
        
        for i, doc_content in enumerate(docs_list):
            progress = 50 + int((i / len(docs_list)) * 15)
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    "progress": progress,
                    "progress_message": f"Analizando: {doc_content['filename']} ({i+1}/{len(docs_list)})"
                }}
            )
            
            logging.info(f"   Analizando: {doc_content['filename']}")
            analysis = await deep_analyze_document(openai_client, doc_content, applicant_name)
            all_analyses.append(analysis)
            
            # Pequeña pausa para no saturar la API
            await asyncio.sleep(0.5)
        
        logging.warning(f"✅ Fase 2 completada - {len(all_analyses)} documentos analizados")
        
        # =====================================================================
        # FASE 3: CREAR PERFIL COMPLETO DEL SOLICITANTE
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"🧠 FASE 3: Creando perfil completo del solicitante...")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "synthesizing", "progress": 70, "progress_message": "Fase 3: Sintetizando perfil del solicitante..."}}
        )
        
        applicant_profile = await create_comprehensive_profile(openai_client, applicant_name, all_analyses)
        
        logging.warning(f"✅ Fase 3 completada - Perfil creado")
        logging.warning(f"   Profesión identificada: {applicant_profile.get('professional_identity', {}).get('primary_profession', 'N/A')}")
        logging.warning(f"   Empleador actual: {applicant_profile.get('current_employment', {}).get('employer', 'N/A')}")
        
        # =====================================================================
        # FASE 4: GENERAR LA CARTA
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"✍️ FASE 4: Generando carta de auto-petición...")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "drafting", "progress": 78, "progress_message": "Fase 4: Redactando carta (3 secciones, ~30 min)..."}}
        )
        
        # Crear lista de exhibits
        exhibit_list = "\n".join([
            f"Exhibit {c.get('exhibit_number', i+1)}: {c.get('filename')} ({c.get('document_type', 'document')})"
            for i, c in enumerate(classifications)
        ])
        
        content_en = await generate_precise_letter(openai_client, applicant_name, applicant_profile, all_analyses, exhibit_list)
        
        logging.warning(f"✅ Fase 4 completada - Carta generada ({len(content_en)} caracteres)")
        
        # =====================================================================
        # FASE 5: TRADUCIR AL ESPAÑOL
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"🌐 FASE 5: Traduciendo al español...")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "translating", "progress": 90, "progress_message": "Fase 5: Traduciendo al español..."}}
        )
        
        content_es = await translate_letter_to_spanish(openai_client, content_en)
        
        logging.warning(f"✅ Fase 5 completada - Traducción lista")
        
        # =====================================================================
        # GUARDAR RESULTADO FINAL
        # =====================================================================
        logging.warning(f"\n{'─'*50}")
        logging.warning(f"💾 Guardando resultado final...")
        
        # Create the final letter document
        from models.self_petition_v2 import SelfPetitionV2Letter
        letter = SelfPetitionV2Letter(
            user_id=session.get('user_id'),
            client_id=session.get('client_id'),
            session_id=session_id,
            applicant_name=applicant_name,
            total_documents=len(classifications),
            document_summary=[{
                "filename": c.get('filename'),
                "type": c.get('document_type'),
                "exhibit": c.get('exhibit_number')
            } for c in classifications],
            content_en=content_en,
            content_es=content_es,
            status="completed"
        )
        
        await db.self_petition_v2_letters.insert_one(letter.model_dump())
        
        # Update session as completed
        total_time = time.time() - start_time
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "completed",
                "progress": 100,
                "progress_message": f"¡Carta completada en {total_time/60:.1f} minutos!",
                "content_en": content_en,
                "content_es": content_es,
                "applicant_profile": applicant_profile,
                "document_analyses": all_analyses,  # Guardar los análisis para referencia
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logging.warning(f"\n{'='*60}")
        logging.warning(f"✅ GENERACIÓN COMPLETADA EXITOSAMENTE")
        logging.warning(f"   Tiempo total: {total_time/60:.1f} minutos")
        logging.warning(f"   Carta en inglés: {len(content_en)} caracteres")
        logging.warning(f"   Carta en español: {len(content_es)} caracteres")
        logging.warning(f"{'='*60}")
        
    except Exception as e:
        logging.error(f"❌ ERROR EN GENERACIÓN: {str(e)}")
        import traceback
        traceback.print_exc()
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "error",
                "error_message": f"Error en generación: {str(e)}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


async def translate_letter_to_spanish(openai_client, content_en: str) -> str:
    """Traducir la carta al español — paralelo con timeout y fallback Gemini/GPT-4o."""
    import asyncio
    import httpx
    import os
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    OR_HEADERS = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://redaccion.urpeintegralservices.co",
        "X-Title": "SmartDocs Creator",
    }

    # Split into chunks
    max_chunk = 12000
    chunks = []
    current = ""
    for line in content_en.split('\n'):
        if len(current) + len(line) > max_chunk:
            if current:
                chunks.append(current.strip())
            current = line
        else:
            current += '\n' + line
    if current.strip():
        chunks.append(current.strip())
    if not chunks:
        chunks = [content_en]

    logging.warning(f"🌐 Traduciendo {len(chunks)} chunks en paralelo...")

    async def translate_chunk(i, chunk):
        sys_msg = "You are a professional legal translator. Translate the following EB-2 NIW immigration letter content from English to Spanish. Preserve all HTML tags exactly as they are. Maintain the same professional legal tone and structure. Do NOT add any commentary."
        user_msg = f"Translate to Spanish (preserve HTML tags):\n\n{chunk}"

        # 1. Gemini 3 Pro via OpenRouter (fast, no content filter issues)
        if openrouter_key:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=OR_HEADERS,
                        json={"model": "google/gemini-3-pro-preview",
                              "messages": [{"role": "system", "content": sys_msg},
                                           {"role": "user", "content": user_msg}],
                              "temperature": 0.3, "max_tokens": 16000}
                    )
                if resp.status_code == 200:
                    c = resp.json()['choices'][0]['message']['content']
                    if len(c.strip()) > 100:
                        logging.warning(f"  ✅ Chunk {i+1}/{len(chunks)} translated (Gemini, {len(c)} chars)")
                        return c
            except Exception as e:
                logging.warning(f"  ⚠️ Chunk {i+1} Gemini failed: {str(e)[:80]}. Trying GPT-4o...")

        # 2. GPT-4o with timeout
        try:
            resp2 = await asyncio.wait_for(
                openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": sys_msg},
                               {"role": "user", "content": user_msg}],
                    temperature=0.3, max_tokens=16000
                ),
                timeout=90.0
            )
            c = resp2.choices[0].message.content
            logging.warning(f"  ✅ Chunk {i+1}/{len(chunks)} translated (GPT-4o, {len(c)} chars)")
            return c
        except Exception as e:
            logging.error(f"  ❌ Chunk {i+1} all models failed: {str(e)[:100]}. Keeping original.")
            return chunk  # fallback: keep English

    # Run all chunks in parallel
    results = await asyncio.gather(*[translate_chunk(i, ch) for i, ch in enumerate(chunks)])
    translated = '\n'.join(results)
    logging.warning(f"✅ Traducción completa: {len(translated)} chars")
    return translated
