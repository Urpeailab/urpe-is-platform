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
    
    # Usar más texto - hasta 15000 caracteres
    text_sample = full_text[:15000] if full_text else f"[Archivo: {filename}]"
    
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
    "key_quotes": ["Citas textuales importantes (máximo 5)"],
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
                max_tokens=4000,
                response_format={"type": "json_object"}
            ),
            timeout=90.0
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
                    max_tokens=4000,
                    response_format={"type": "json_object"}
                ),
                timeout=120.0
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
                "key_quotes": analysis.get('key_quotes', [])[:3],
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
                    max_tokens=12000,
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
                      "temperature": 0.5, "max_tokens": 16000}
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
            c = await _try_openrouter("anthropic/claude-opus-4-6")
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

    # 3. GPT-4o
    try:
        logging.warning(f"📝 [{section_name}] Trying GPT-4o...")
        resp = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_prompt}],
                temperature=0.5, max_tokens=16000
            ),
            timeout=120.0
        )
        c = resp.choices[0].message.content
        if any(m in c for m in REFUSAL_MARKERS):
            raise Exception("GPT-4o refused content")
        logging.warning(f"✅ [{section_name}] GPT-4o OK ({len(c)} chars)")
        return c
    except Exception as e:
        logging.warning(f"⚠️ [{section_name}] GPT-4o failed: {str(e)[:120]}. Trying GPT-5.1...")

    # 4. GPT-5.1 (last resort)
    resp = await asyncio.wait_for(
        openai_client.chat.completions.create(
            model="gpt-5.1",
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            temperature=0.5, max_tokens=32000
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
        for quote in analysis.get('key_quotes', [])[:2]:
            all_quotes.append(f"Exhibit {analysis.get('exhibit_number')}: \"{quote}\"")

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
{chr(10).join(all_quotes[:20])}
=== EXHIBITS ===
{exhibit_list}
=== PRONG SUMMARIES ===
PRONG 1: {profile.get('prong1_summary', '')}
PRONG 2: {profile.get('prong2_summary', '')}
PRONG 3: {profile.get('prong3_summary', '')}
=== STRONGEST EVIDENCE ===
{json.dumps(profile.get('strongest_evidence', []), indent=2, default=str)}"""

    RULES = f"""
CRITICAL RULES:
- Write in FIRST PERSON ("I submit...", "My work...", "I respectfully request...")
- CITE each exhibit by number (Exhibit 1, Exhibit 2, etc.) whenever you mention it
- USE verbatim quotes from documents (in quotation marks)
- DO NOT invent information — use ONLY what is in the provided data
- Include ALL quantitative data available
- Professional, legal and persuasive tone appropriate for USCIS
- For EACH proprietary methodology, explain ALL its phases/steps in detail
- CITE ALL experts who wrote recommendation letters with their exact quotes
- Include references to federal policies when relevant
- Today's date is {today} — use it directly, NEVER write [Date] or any bracket placeholder
- DO NOT wrap in <html>, <head>, <body> or add <style> blocks — only content HTML
- DO NOT use any bracket placeholders like [Name], [Address], [TODO]"""

    system_prompt = f"""You are a specialist legal assistant in U.S. immigration petitions, helping lawyers draft EB-2 NIW self-petition letters.

This is a legitimate legal document for USCIS (U.S. Citizenship and Immigration Services).
Your task is to draft a specific SECTION of the self-petition letter for {applicant_name}.
Use ONLY the provided document information — do not invent anything.
Write in first person from the petitioner's perspective.
Use HTML formatting: <h1>, <h2>, <h3>, <h4>, <p>, <ul>, <li>, <strong>, <em>
Do NOT wrap in <html>/<head>/<body> or add CSS <style> blocks."""

    # ── CALL 1: Section I (Introduction) + Section II (Prong 1) ───────────────
    logging.warning("✍️ CALL 1/3: Introduction + Prong 1...")
    prompt_1 = f"""{profile_ctx}

Write SECTION I and SECTION II of the EB-2 NIW self-petition letter for {applicant_name}.
Target: 10-12 pages (approximately 3,500-4,500 words). BE VERY DETAILED AND COMPREHENSIVE.

SECTION I: INTRODUCTION AND PURPOSE OF THIS PETITION
A. Preliminary Statement
   - Formal presentation of the petitioner: full name, exact profession and specialization
   - Years of experience (domestic and international)
   - Academic credentials with U.S. equivalency evaluations
B. Overview of My Proposed Endeavor
   - FULL name of the proposed project
   - Detailed description of ALL project COMPONENTS (linguistic, civic, digital if applicable)
   - Target population with SPECIFIC NUMBERS
   - Mention econometric study if it exists
C. Summary of Qualifications
   - Academic credentials list
   - Key quantified experience
   - Proprietary methodologies developed (list with acronyms)
D. Legal Framework for the National Interest Waiver
   - Reference to Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)
   - Explanation of the three prongs

SECTION II: PRONG 1 — SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE
A. The National Challenge — Context and Magnitude
   1. Demographic Dimension of the Problem
      - SPECIFIC statistics (millions of people affected, exact percentages)
   2. Documented Economic Impact
      - Economic losses in SPECIFIC DOLLARS
      - Impact on underemployment, productivity
   3. Impact on Social Cohesion and Civic Participation
      - Statistics on electoral participation, social isolation
   4. Post-Pandemic Digital Divide (if applicable)
      - Digital gap and its consequences
   5. Federal Recognition of the Problem
      - CITE specific federal laws (WIOA Title II, Digital Equity Act, etc.)
      - Relevant Executive Orders

B. The Proposed Solution: Comprehensive Platform with Validated Methodologies
   For EACH PROJECT COMPONENT, explain in detail:
   - Component name and purpose
   - Methodology used (with acronym and COMPLETE description of each phase/step)
   - Evidence of Effectiveness (expert quotes)
   
   IMPORTANT: For EACH proprietary methodology (RISE, GCBT, GON, DGC, CABT, etc.):
   - Expand the acronym fully
   - Describe EACH PHASE or step in detail
   - Cite where it is documented
   - Include expert quote validating its effectiveness

C. Quantitative Evidence of National Impact: The Econometric Study
   - Study name (if exists)
   - DIRECT ECONOMIC IMPACT:
     * Economic Value Generation: $X-Y million (with explanation)
     * Job Creation: X-Y jobs (with job types and salaries)
     * Economic Multiplier / Social ROI: X:1 ratio
   - SAVINGS IN PUBLIC COSTS (itemized)
   - PROJECTED SOCIAL IMPACT:
     * Language proficiency improvement (%)
     * Increase in labor participation (%)
     * Increase in civic participation (%)
   - NATIONAL SCALABILITY: users by year 1, 3, 5

D. Alignment with Regional and Sectoral Specific Needs
   - High-impact regions with statistics
   - Economic sectors with worker shortages

E. Why Current Solutions Are Insufficient
   - Problems with traditional programs
   - The gap that petitioner's project fills

F. Conclusion on Prong 1 — Strong compelling summary
{RULES}"""

    # ── CALL 2: Section III (Prong 2) ─────────────────────────────────────────
    logging.warning("✍️ CALL 2/3: Prong 2 (Well Positioned)...")
    prompt_2 = f"""{profile_ctx}

Write SECTION III of the EB-2 NIW self-petition letter for {applicant_name}.
Target: 12-14 pages (approximately 4,500-5,500 words). BE VERY DETAILED AND COMPREHENSIVE.
This is the LONGEST and most important section — it demonstrates the petitioner is well-positioned.

SECTION III: PRONG 2 — I AM WELL POSITIONED TO ADVANCE THE PROPOSED ENDEAVOR
A. Introduction
B. Advanced Level Academic Credentials
   For EACH degree:
   - Full degree name and field of study
   - Institution, country, graduation year
   - U.S. equivalency evaluation (CED, WES, etc.) — evaluator and result
   - GPA if mentioned
   - How the curriculum is directly relevant to the proposed project

C. Verifiable and Progressive Professional Experience (organize by:)
   - CURRENT U.S. EXPERIENCE: Current employer, position, responsibilities, achievements, connection to project
   - INTERNATIONAL EXPERIENCE: Countries, positions, scope, achievements
   - PREVIOUS EXPERIENCE: Chronological with upward trajectory
   For EACH position:
   - Exact title, employer, location, dates
   - Key responsibilities (detailed list)
   - Specific achievements with numbers
   - Direct connection to the proposed endeavor

D. Intellectual Property: Validated and Documented Methodologies
   For EACH proprietary methodology/framework:
   - Full name and acronym
   - What problem it solves
   - ALL phases, steps, or components in detail
   - Where it is documented (manuscript, publication, etc.)
   - Expert validation — who validated it, their quote, Exhibit number
   - Evidence of effectiveness (pilot results, testimonials)

E. Recognition by Multidisciplinary Experts
   For EACH expert endorsement:
   - Expert's full name and complete credentials (degrees, titles)
   - Organization and position
   - VERBATIM QUOTE of what they say about the petitioner
   - How their expertise makes their endorsement credible
   - Exhibit number
   
F. Track Record of Success (Evidence of Execution Capacity)
   - Programs implemented with results
   - Quantified achievements
   - Students/beneficiaries reached
   - Collaborations established
   - Current pilot phase status

G. Resources and Plan for Advancing the Endeavor
   - Year 1 implementation plan
   - Scaling plan (years 1-5)
   - Committed partnerships
   - Technology resources
   - Financial sustainability model

H. Conclusion on Prong 2 — Strong compelling summary
{RULES}"""

    # ── CALL 3: Section IV (Prong 3) + Section V (Conclusion) ────────────────
    logging.warning("✍️ CALL 3/3: Prong 3 + Conclusion...")
    prompt_3 = f"""{profile_ctx}

Write SECTION IV and SECTION V of the EB-2 NIW self-petition letter for {applicant_name}.
Target: 10-12 pages (approximately 3,500-4,500 words). BE VERY DETAILED AND COMPREHENSIVE.

SECTION IV: PRONG 3 — IT WOULD BENEFIT THE UNITED STATES TO WAIVE THE JOB OFFER AND LABOR CERTIFICATION REQUIREMENTS
A. Introduction
B. The Nature of My Proposed Project (Not Traditional Employment)
   1. Job Creator vs. Job Occupant
      - How many jobs will be created (specific number and types)
      - The petitioner is not filling an existing vacancy
      - Entrepreneurial/directorial unique role
   2. Highly Specialized Expertise — Unique Combination
      - What skills/knowledge combination cannot be replicated by U.S. workers
      - Why no other person is positioned the same way
C. Urgency of the National Interest Problem
   - Opportunity cost of delay
   - Impact of each year without the solution (in dollars and lives affected)
   - Why timing matters for this specific endeavor
D. The PERM Process Is Not Appropriate for This Case (Legal Analysis)
   - Why PERM is designed for different employment situations
   - Why PERM would be counterproductive for entrepreneurial projects
   - Cite Dhanasar on entrepreneurs and self-directed projects
E. Balance of Interests: National vs. Standard Process
   - Specific national benefits that outweigh standard process interest
   - Economic, social, civic benefits quantified
F. Precedent and Consistency with USCIS Policy
   - How this case aligns with approved NIW precedents
   - Consistency with current administration priorities
G. No Conflict with U.S. Workers
   - How the project creates opportunities for U.S. workers
   - Complementary, not competitive nature
H. Conclusion on Prong 3 — Strong compelling summary

SECTION V: CONCLUSION AND FORMAL PETITION
A. Summary of Evidence Presented
   - Concise synthesis of the strongest points for all three prongs
B. Why This Case Merits Approval
   - The unique combination of factors that make this NIW compelling
C. Consistency with Precedents and Policy
D. Formal Petition and Request
   - Formal language requesting USCIS to approve the I-140
   - Reference to the petition being in the national interest
E. Final Personal Statement
   - Petitioner's personal commitment to the proposed endeavor
   - Vision for impact on the United States

LIST OF EXHIBITS
(Number each exhibit as provided in the exhibit list below, with filename and document type)
{exhibit_list}
{RULES}"""

    # ── Execute all 3 calls ────────────────────────────────────────────────────
    section_contents = []
    for i, (name, prompt) in enumerate([
        ("Section_I+II", prompt_1),
        ("Section_III", prompt_2),
        ("Section_IV+V", prompt_3),
    ], start=1):
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
