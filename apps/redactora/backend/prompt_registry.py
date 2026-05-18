"""
Prompt Registry — Defines all editable prompt modules for the Admin Prompt Manager.

Each module entry contains:
  - label: Display name
  - icon: Emoji icon
  - color: Hex color for the UI card
  - description: Brief description of the module
  - prompts: Dict of {key: {label, description, category, get_default}}

The `get_default()` callable returns the current default content for a prompt key.
This allows lazy loading and avoids importing everything at module level.
"""

from typing import Dict, Any, Callable, Optional


def _load_v3_defaults() -> Dict[str, Any]:
    """Lazy-load defaults from business_plan_prompt_v3.py"""
    from business_plan_prompt_v3 import (
        SYSTEM_PROMPT_V3, ABSOLUTE_PROHIBITIONS, CITATION_STANDARDS,
        MASTER_FIGURES_GUIDE, DOCUMENT_STRUCTURE_V3, SELF_AUDIT_CHECKLIST,
        WRITING_GUIDELINES, SECTION_TITLES_V3, get_section_prompt_v3
    )
    
    # Placeholder context for generating section defaults (for display only)
    _p = {'project_title': '[TÍTULO DEL PROYECTO]', 'project_description': '[DESCRIPCIÓN DEL PROYECTO]'}
    _c = {'author_name': '[NOMBRE DEL SOLICITANTE]', 'author_credentials': '[CREDENCIALES DEL CV]'}
    
    prompts = {
        "system_prompt": {
            "label": "Prompt del Sistema (Persona Monica)",
            "description": "La identidad, filosofía y objetivo central de Monica como estratega NIW.",
            "category": "Sistema",
            "default": SYSTEM_PROMPT_V3,
        },
        "absolute_prohibitions": {
            "label": "Prohibiciones Absolutas (P1-P15)",
            "description": "Reglas P1-P15 que nunca se pueden violar. Protegen contra rechazos USCIS.",
            "category": "Reglas",
            "default": ABSOLUTE_PROHIBITIONS,
        },
        "citation_standards": {
            "label": "Estándares de Citación",
            "description": "Formato obligatorio para citar fuentes. Crítico para credibilidad del caso.",
            "category": "Reglas",
            "default": CITATION_STANDARDS,
        },
        "master_figures_guide": {
            "label": "Guía de Cifras Maestras (Pro Forma)",
            "description": "Cifras financieras consistentes usadas en todo el documento.",
            "category": "Finanzas",
            "default": MASTER_FIGURES_GUIDE,
        },
        "document_structure": {
            "label": "Estructura del Documento (10 Secciones)",
            "description": "Requisitos de longitud, tablas y estructura por sección.",
            "category": "Estructura",
            "default": DOCUMENT_STRUCTURE_V3,
        },
        "self_audit_checklist": {
            "label": "Auto-Auditoría Pre-Envío",
            "description": "Checklist contra razones conocidas de rechazo USCIS.",
            "category": "Calidad",
            "default": SELF_AUDIT_CHECKLIST,
        },
        "writing_guidelines": {
            "label": "Guía de Redacción (Tono y Estilo)",
            "description": "Tono, voz, frases prohibidas y frases preferidas.",
            "category": "Redacción",
            "default": WRITING_GUIDELINES,
        },
    }
    
    # Add section instruction prompts (1-10)
    for i, title in enumerate(SECTION_TITLES_V3, 1):
        full = get_section_prompt_v3(i, title, _p, _c)
        # Extract the instructions portion (after the context block)
        # The context block ends at "============================================================\n" (last occurrence)
        marker = "============================================================\n"
        parts = full.split(marker)
        instructions = parts[-1].strip() if len(parts) > 1 else full
        
        prompts[f"section_{i}_instructions"] = {
            "label": f"Sección {i}: {title}",
            "description": f"Instrucciones de redacción para la Sección {i} del Plan de Negocios V3.",
            "category": f"Sección {i}",
            "default": instructions,
        }
    
    return prompts


def _load_v1_defaults() -> Dict[str, Any]:
    """Lazy-load V1 business plan group system messages from server.py constants"""
    return {
        "group1_system_message": {
            "label": "Grupo 1: Cover + Resumen Ejecutivo + Prong 1 (Secciones 1-3)",
            "description": "System message para el Grupo 1 del Plan de Negocio V1.",
            "category": "Grupo 1",
            "default": """You are an expert immigration attorney specialized in EB-2 NIW petitions for USCIS.

🚨🚨🚨 CV COHERENCE RULE #1 🚨🚨🚨

❌ ABSOLUTELY PROHIBITED:
- Inventing companies where the applicant has NOT worked
- Attributing experience or achievements NOT mentioned in the CV
- Creating fictitious projects, publications, or certifications
- Citing years of experience that do not match the CV
- Inventing collaborations with undocumented organizations

✅ REQUIRED:
- ONLY use information that APPEARS in the provided CV
- Mention the REAL companies where the applicant worked
- Years of experience MUST match the CV EXACTLY
- Connect the REAL CV experience with the proposed project
- If the CV shows limited experience, adapt the project to that reality

CRITICAL REQUIREMENTS:
1. TARGET LENGTH: 30-35 pages TOTAL for the complete document (NOT per section)
2. CONDENSATION: Eliminate ALL repetition - if a fact is mentioned once, DO NOT repeat it
3. EVIDENCE: Every claim must have a citation (Source, Year)
4. NO FILLER: No promotional language, no vague claims, no repetition
5. PROFESSIONAL TONE: Legal-technical, policy-aligned
6. CV COHERENCE: 100% alignment with applicant's documented experience

❌ AVOID: "Significant impact", "growing market", "innovative" without specific evidence
✅ USE: Specific numbers, dollar amounts, percentages with citations

The document must be CONCISE, EVIDENCE-BACKED, and COHERENT with the applicant's CV.""",
        },
        "group2_system_message": {
            "label": "Grupo 2: Posicionamiento + Problema + Cualificaciones (Secciones 4-7)",
            "description": "System message para el Grupo 2 del Plan de Negocio V1.",
            "category": "Grupo 2",
            "default": """You are an expert immigration attorney specialized in EB-2 NIW petitions.

🚨🚨🚨 CV COHERENCE - CRITICAL FOR SECTION 6 (QUALIFICATIONS) 🚨🚨🚨

❌ ABSOLUTELY PROHIBITED:
- Inventing companies, institutions, or universities NOT mentioned in the CV
- Attributing undocumented academic degrees or certifications
- Creating fictitious work experience
- Exaggerating years of experience beyond what the CV indicates
- Citing publications, patents, or awards not listed in the CV

✅ REQUIRED FOR SECTION 6 (Qualifications):
- ACCURATELY TRANSCRIBE the education from the CV (real universities, real degrees)
- LIST ONLY the companies where the applicant REALLY worked according to the CV
- Achievements must be EXTRACTED from the CV, not invented
- If the CV shows experience in another country, present it as transferable
- Use the EXACT YEARS of experience shown in the CV

CRITICAL REQUIREMENTS:
1. TARGET: 30-35 pages TOTAL document - these 4 sections = 10-12 pages MAX
2. NO REPETITION: If a fact was in Sections 1-3, DO NOT repeat it. Use "see Section X"
3. TABLES: Include at least 1 table per section where data is presented
4. CITATIONS: Every statistic must have (Source, Year)
5. QUANTIFICATION: No vague claims - specific numbers only
6. CV FIDELITY: Section 6 MUST reflect ONLY what is documented in the applicant's CV

Structure each section with clear subsections (4.1, 4.2, etc.)""",
        },
        "group3_system_message": {
            "label": "Grupo 3: Indicadores + Alcance + Ejecución + Financiero (Secciones 8-11)",
            "description": "System message para el Grupo 3. Incluye el Pro Forma y fases de inversión.",
            "category": "Grupo 3",
            "default": """You are an expert immigration attorney specialized in EB-2 NIW petitions.

═══════════════════════════════════════════════════════════
🚨 8 MANDATORY CORRECTIVE RULES FOR THIS GROUP
═══════════════════════════════════════════════════════════

🚨 RULE 1 - TABLE INTEGRITY:
- NO duplicate rows (e.g., "Jobs Supported" repeated 4 times)
- NO placeholder data (e.g., "1.00 | 1.00 | 1.00")
- NO empty or nonsensical rows
- Each row MUST have unique and relevant data

🚨 RULE 2 - PROHIBITION OF FABRICATED PERCENTILES:
- NEVER multiply percentages: "8.2% × 2.3% × 12.1% = 0.0004%"
- NEVER use "top 0.07%" or "combined probability"
- USE factual descriptions of qualifications

🚨 RULE 3 - NUMERICAL CONSISTENCY:
- Pro Forma figures are MASTER for the entire document
- Year 5 clients: 100-120 (ALWAYS use this figure)
- Revenue: $65K/$145K/$280K/$420K/$580K
- Direct jobs: 1/2/3/4/5-6

🚨 RULE 4 - PHASE 2 LINKED TO VISA APPROVAL:
- PHASE 2 MUST include: "Upon approval of the NIW petition..."
- This phrase is MANDATORY in the Phase 2 description

🚨 RULE 5 - COMPLETE ELIMINATION OF CAPITAL-FREE:
❌ PROHIBITED: "capital-free", "zero capital", "sweat equity", "minimal investment"
✅ REQUIRED: $110,000 USD initial capital

🚨 RULE 6 - GOVERNMENT SOURCES ≥70%:
- Prioritize: SBA, BLS, Census Bureau, Federal Reserve, DOL, GAO
- Maximum 30% private sources

🚨 RULE 7 - IMPACT PROPORTIONAL TO CAPITAL:
- Direct jobs: 3-6 (MAXIMUM, NOT thousands)
- Indirect jobs: 20-50 (differentiated)
- NO: "30,000 jobs", "$500M impact"

🚨 RULE 8 - FINAL VERIFICATION:
Before generating, verify:
□ Tables without duplicates □ Consistent figures □ Phase 2 with visa
□ No capital-free □ No fabricated percentiles □ Realistic impact

CRITICAL: These 4 sections = 8-12 pages MAX total.
Section 10 MUST include startup costs table and 4-phase breakdown.
Section 11 MUST include complete Pro Forma table.
NO repetition of previously stated facts.""",
        },
        "group4_system_message": {
            "label": "Grupo 4: Metodología + Riesgos + Resultados (Secciones 12-14)",
            "description": "System message para el Grupo 4 del Plan de Negocio V1.",
            "category": "Grupo 4",
            "default": """You are an expert immigration attorney specialized in EB-2 NIW petitions.

🚨 RULE 1 - TABLE INTEGRITY:
- NO duplicate rows in Risk Table (e.g., "Market Risk" repeated)
- NO placeholder data (e.g., "Medium | Medium | TBD")
- Each row MUST be unique with specific data

🚨 RULE 2 - NO FABRICATED PERCENTILES:
- NO "top 0.07%", NO percentage multiplication
- Use factual descriptions of qualifications

🚨 RULE 3 - NUMERICAL CONSISTENCY:
- Revenue: $65K/$145K/$280K/$420K/$580K (EXACT)
- Year 5 clients: 100-120
- Direct jobs: 5-6 (Year 5)

🚨 RULE 5 - NO CAPITAL-FREE:
- NO "capital-free", "zero capital", "minimal investment"
- Project capital: $110,000 USD

🚨 RULE 7 - PROPORTIONAL IMPACT:
- Direct jobs: 3-6 (NOT thousands)
- Indirect jobs: 20-50 (differentiated)
- NO: "$500M impact", "30,000 jobs"

CRITICAL: These 3 sections = 5-8 pages MAX total.
Emphasize national interest and quantifiable impact.
Tables required for risks and expected results - NO DUPLICATE ROWS.
Strong connection to Dhanasar Prong 1.""",
        },
        "group5_system_message": {
            "label": "Grupo 5: Governance + Referencias + Prong 3 (Secciones 15-19)",
            "description": "System message para el Grupo 5. Incluye bibliografía y justificación Prong 3.",
            "category": "Grupo 5",
            "default": """You are an expert immigration attorney specialized in EB-2 NIW petitions.

🚨 CRITICAL RULES FOR GROUP 5 - SECTION 19 IS THE MOST PROBLEMATIC

🚨 RULE 1 - TABLE INTEGRITY:
- No duplicate rows (no repeated "Compliance Team", no repeated "Efforts")
- No placeholder data (no "Research | Research | Research")
- No empty rows or junk content

🚨 RULE 3 - NUMERICAL CONSISTENCY (CRITICAL FOR SECTION 19):
- Direct jobs: 5-6 (NOT 15+, NOT "Year 1: 2, Year 2: 3 additional = 15")
- Cumulative clients: 250-350 (NOT 500+)
- Year 5 revenue: $580,000 (NOT $2.85M)
- Client impact: ~$11M (NOT $42.75M)
- Indirect jobs: 50-75 (NOT 1,250)

🚨 RULE 7 - PROPORTIONAL IMPACT:
A $110K business with $580K in Year 5 revenue CANNOT project:
- "$42.75M cumulative client economic impact" ← PROHIBITED
- "1,250+ indirect jobs" ← PROHIBITED
- "2,000+ professionals trained" ← PROHIBITED

REALISTIC FIGURES:
- ~$11M total client impact
- 50-75 indirect jobs
- 750-900 professionals trained

🚨 ANNEXES: Each one MUST be UNIQUE

CRITICAL: These 5 sections = 7-10 pages MAX total.
Section 19 (Prong 3) is CRITICAL - make the strongest possible case for waiver.
Include the Dhanasar 3-Prong Compliance Matrix table with UNIQUE rows.
Bibliography must be comprehensive with 25-30 sources (70% government).
Reference Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) explicitly.""",
        },
    }


def _load_whitepaper_defaults() -> Dict[str, Any]:
    """Lazy-load whitepaper NIW defaults"""
    try:
        from whitepaper_eb2_niw_strict import (
            SECTION_TITLES_EB2_NIW,
            get_master_system_prompt
        )
        # Generate a template version with placeholders
        template_prompt = get_master_system_prompt(
            author_name="[NOMBRE DEL AUTOR]",
            author_credentials="[CREDENCIALES DEL SOLICITANTE]",
            project_title="[TÍTULO DEL PROYECTO]",
            project_description="[DESCRIPCIÓN DEL PROYECTO]"
        )
        
        prompts = {
            "master_system_prompt": {
                "label": "System Prompt Maestro (White Paper EB-2 NIW)",
                "description": "Instrucciones principales para generar el White Paper. Define el rol, reglas de no-invención y formato de exhibits.",
                "category": "Sistema",
                "default": template_prompt,
            }
        }
        
        # Add section titles for reference (not directly editable yet)
        for i, title in enumerate(SECTION_TITLES_EB2_NIW, 1):
            prompts[f"section_{i}_title"] = {
                "label": f"Sección {i}: {title}",
                "description": f"Instrucciones específicas para la sección '{title}'.",
                "category": f"Sección {i}",
                "default": f"# Sección {i}: {title}\n\n[Instrucciones específicas de redacción para esta sección se generan dinámicamente basadas en el CV y proyecto del solicitante]",
            }
        
        return prompts
    except Exception as e:
        return {
            "master_system_prompt": {
                "label": "System Prompt Maestro",
                "description": "Instrucciones principales para generar White Papers NIW.",
                "category": "Sistema",
                "default": f"[Error cargando defaults: {str(e)}]",
            }
        }


def _load_econometric_defaults() -> Dict[str, Any]:
    """Lazy-load econometric study defaults"""
    try:
        from econometric_prompt_v2 import (
            SYSTEM_MESSAGE_GENERATION,
            SYSTEM_MESSAGE_TRANSLATION,
            USER_PROMPT_GENERATION_TEMPLATE,
            USER_PROMPT_TRANSLATION_TEMPLATE
        )
        return {
            "generation_system_message": {
                "label": "System Message — Generación (Inglés)",
                "description": "Instrucciones para el econometrista experto. Reglas de proyecciones realistas, citas completas y consistencia entre secciones.",
                "category": "Generación",
                "default": SYSTEM_MESSAGE_GENERATION,
            },
            "generation_user_template": {
                "label": "User Prompt Template — Generación",
                "description": "Template del prompt de usuario para generar el estudio econométrico completo.",
                "category": "Generación",
                "default": USER_PROMPT_GENERATION_TEMPLATE,
            },
            "translation_system_message": {
                "label": "System Message — Traducción (Español)",
                "description": "Instrucciones para el traductor profesional de estudios econométricos.",
                "category": "Traducción",
                "default": SYSTEM_MESSAGE_TRANSLATION,
            },
            "translation_user_template": {
                "label": "User Prompt Template — Traducción",
                "description": "Template del prompt de usuario para traducir el estudio al español.",
                "category": "Traducción",
                "default": USER_PROMPT_TRANSLATION_TEMPLATE,
            },
        }
    except Exception as e:
        return {"error": {"label": "Error", "description": str(e), "category": "Error", "default": str(e)}}


def _load_niw_plan_defaults() -> Dict[str, Any]:
    """Lazy-load NIW business plan (section-by-section) defaults"""
    try:
        from niw_prompt_config import NIW_SYSTEM_PROMPT_COMPLETE
        return {
            "master_system_prompt": {
                "label": "System Prompt Maestro — Plan de Negocio NIW (Secciones)",
                "description": "Instrucciones maestras versión 4.0 con las 8 reglas correctivas obligatorias. Usado en la generación sección por sección.",
                "category": "Sistema",
                "default": NIW_SYSTEM_PROMPT_COMPLETE,
            }
        }
    except Exception as e:
        return {"error": {"label": "Error", "description": str(e), "category": "Error", "default": str(e)}}


def _load_patent_defaults() -> Dict[str, Any]:
    """Lazy-load USPTO patent defaults"""
    try:
        from patent_prompt_config import get_uspto_system_message, USPTO_PATENT_ATTORNEY_SYSTEM_MESSAGE
        return {
            "uspto_system_message": {
                "label": "USPTO Patent Attorney System Message",
                "description": "Instrucciones para el agente redactor de patentes USPTO. Incluye reglas de terminología precisa, precisión numérica y especificidad de claims.",
                "category": "Sistema",
                "default": USPTO_PATENT_ATTORNEY_SYSTEM_MESSAGE,
            }
        }
    except Exception as e:
        return {"error": {"label": "Error", "description": str(e), "category": "Error", "default": str(e)}}


# ============================================================
# MAIN PROMPT MODULES REGISTRY
# ============================================================

PROMPT_MODULES: Dict[str, Dict[str, Any]] = {
    "business_plan_v3": {
        "label": "Plan de Negocio V3 (Prueba Híbrido)",
        "icon": "🧪",
        "color": "#6366f1",
        "description": "Prompt híbrido Dhanasar Framework v3.1 — especificidad V3 + densidad V1. 10 secciones con tablas mandatorias y bibliografía APA.",
        "loader": _load_v3_defaults,
        "_cache": None,
    },
    "business_plan_v1": {
        "label": "Plan de Negocio V1 (Actual)",
        "icon": "📋",
        "color": "#10b981",
        "description": "Plan de Negocio original con 19 secciones en 5 grupos. System messages para cada grupo de generación.",
        "loader": _load_v1_defaults,
        "_cache": None,
    },
    "whitepaper_niw": {
        "label": "White Paper EB-2 NIW",
        "icon": "📄",
        "color": "#f59e0b",
        "description": "White Paper para peticiones EB-2 NIW. 17 secciones con política de cero invención y referencias a exhibits.",
        "loader": _load_whitepaper_defaults,
        "_cache": None,
    },
    "econometric_study": {
        "label": "Estudio Econométrico",
        "icon": "📊",
        "color": "#ec4899",
        "description": "Generador de estudios econométricos completos para NIW. Reglas de proyecciones realistas y consistencia entre 16 secciones.",
        "loader": _load_econometric_defaults,
        "_cache": None,
    },
    "niw_plan_sections": {
        "label": "NIW Business Plan (Secciones)",
        "icon": "🏛️",
        "color": "#8b5cf6",
        "description": "Plan de Negocio NIW con generación sección por sección. System prompt v4.0 con 8 reglas correctivas.",
        "loader": _load_niw_plan_defaults,
        "_cache": None,
    },
    "patent_uspto": {
        "label": "Patente USPTO",
        "icon": "⚙️",
        "color": "#0ea5e9",
        "description": "Redactor de patentes USPTO Professional Edition v3.0. Terminología precisa, claims específicos y cumplimiento MPEP.",
        "loader": _load_patent_defaults,
        "_cache": None,
    },
}


def get_module_prompts(module_id: str) -> Optional[Dict[str, Any]]:
    """Get all prompts for a module, using cached loader if available."""
    module = PROMPT_MODULES.get(module_id)
    if not module:
        return None
    
    if module["_cache"] is None:
        try:
            module["_cache"] = module["loader"]()
        except Exception as e:
            module["_cache"] = {
                "load_error": {
                    "label": "Error al cargar",
                    "description": f"Error: {str(e)}",
                    "category": "Error",
                    "default": str(e),
                }
            }
    
    return module["_cache"]


def get_prompt_default(module_id: str, key: str) -> Optional[str]:
    """Get the default content for a specific prompt key."""
    prompts = get_module_prompts(module_id)
    if not prompts:
        return None
    prompt_def = prompts.get(key)
    if not prompt_def:
        return None
    return prompt_def.get("default", "")


def get_all_module_info() -> list:
    """Return basic info about all modules (without prompt content) for listing."""
    return [
        {
            "id": mid,
            "label": m["label"],
            "icon": m["icon"],
            "color": m["color"],
            "description": m["description"],
            "prompt_count": len(get_module_prompts(mid) or {}),
        }
        for mid, m in PROMPT_MODULES.items()
    ]
