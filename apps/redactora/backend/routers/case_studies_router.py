"""
Case Studies Router — Harvard-style business case studies for NIW petitions
Extracted from server.py for better code organization.
"""

import io
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_utils import pdf_safe as _pdf_safe

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY


def _md_inline_to_html(text: str) -> str:
    """Convert inline Markdown to ReportLab-compatible HTML tags.
    
    Handles:
    - **bold** / __bold__ → <b>bold</b>
    - *italic* / _italic_ → <i>italic</i> (only when not part of bold)
    - `code` → <font name="Courier">code</font>
    - ~~strike~~ → <strike>strike</strike>
    - Unicode subscripts (₀-₉) → <sub>N</sub>
    - Unicode superscripts (⁰-⁹) → <sup>N</sup>
    
    Assumes text has already been passed through _pdf_safe() (HTML-escaped).
    """
    if not text:
        return text
    # Bold first (handles both ** and __)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
    # Inline code
    text = re.sub(r'`([^`\n]+?)`', r'<font name="Courier">\1</font>', text)
    # Strike-through
    text = re.sub(r'~~(.+?)~~', r'<strike>\1</strike>', text)
    # Italic — only single * or _ that is NOT adjacent to another * or _ (so we don't eat bold tags)
    text = re.sub(r'(?<![\*\w])\*([^\*\n]+?)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'(?<![_\w])_([^_\n]+?)_(?!_)', r'<i>\1</i>', text)
    # Unicode subscripts → <sub>N</sub>  (Helvetica/Times don't have subscript glyphs → black squares)
    _subs = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
             '₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x',
             'ₕ':'h','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₚ':'p','ₛ':'s','ₜ':'t'}
    _sups = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
             '⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e',
             'ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o',
             'ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z'}
    # Collapse runs of consecutive subscripts/superscripts into ONE <sub>/<sup> tag.
    def _collapse(match, mapping, tag):
        inner = ''.join(mapping.get(ch, ch) for ch in match.group(0))
        return f'<{tag}>{inner}</{tag}>'
    if any(c in text for c in _subs):
        text = re.sub('[' + re.escape(''.join(_subs.keys())) + ']+',
                      lambda m: _collapse(m, _subs, 'sub'), text)
    if any(c in text for c in _sups):
        text = re.sub('[' + re.escape(''.join(_sups.keys())) + ']+',
                      lambda m: _collapse(m, _sups, 'sup'), text)
    return text

logger = logging.getLogger(__name__)

# Module-level dependencies injected via init_router()
_db = None
_openai_client = None
_get_current_user = None
_evaluate_document_coherence = None
_extract_text_from_file = None
_call_gpt4o = None  # Helper with built-in 429 retry + OpenRouter fallback
_call_claude_opus = None  # Primary helper: Claude Opus 4.7 → 4.5 → Sonnet 4.5 → Gemini 2.5 Pro
_call_cheap_evaluator = None  # Cheap evaluator: Gemini Flash → Claude Haiku → GPT-4o-mini


def init_router(
    database,
    openai_client,
    get_current_user_func,
    evaluate_document_coherence_func,
    extract_text_from_file_func,
    call_gpt4o_func=None,
    call_claude_opus_func=None,
    call_cheap_evaluator_func=None,
):
    global _db, _openai_client, _get_current_user
    global _evaluate_document_coherence, _extract_text_from_file, _call_gpt4o, _call_claude_opus, _call_cheap_evaluator
    _db = database
    _openai_client = openai_client
    _get_current_user = get_current_user_func
    _evaluate_document_coherence = evaluate_document_coherence_func
    _extract_text_from_file = extract_text_from_file_func
    _call_gpt4o = call_gpt4o_func
    _call_claude_opus = call_claude_opus_func
    _call_cheap_evaluator = call_cheap_evaluator_func
    logger.info("✅ Case Studies Router initialized with dependencies")


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_router() first.")
    return _db


async def _llm_call(system: str, user: str, *, model: str = "gpt-4o", temperature: float = 0.7, max_tokens: int = 16000) -> str:
    """Call LLM with automatic fallback to OpenRouter on 429/5xx.
    
    Uses injected `_call_gpt4o` helper (which has retry + OpenRouter fallback)
    when available. Falls back to direct OpenAI client for unsupported models
    (e.g., gpt-4o-mini which _call_gpt4o maps internally).
    """
    if _call_gpt4o is not None:
        # _call_gpt4o always uses gpt-4o with fallback to OpenRouter openai/gpt-4o,
        # anthropic/claude-sonnet-4.5, google/gemini-2.5-pro. Good enough for all use cases.
        return await _call_gpt4o(
            system_message=system,
            user_message=user,
            temperature=temperature,
            max_tokens=max_tokens
        )
    # Fallback (should not happen in production if init_router is called correctly)
    resp = await _openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens
    )
    return resp.choices[0].message.content


async def get_current_user_wrapper(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Wrapper that calls the injected get_current_user function"""
    if _get_current_user is None:
        raise RuntimeError("get_current_user not initialized. Call init_router() first.")
    return await _get_current_user(credentials)


# ──────────────────────────────────────────────
# Background generation task
# ──────────────────────────────────────────────

async def run_case_study_generation_background(
    study_id: str,
    user_id: str,
    client_id: str,
    client_name: str,
    author_name: str,
    title: str,
    project_text: str,
    support_texts: list,
    cv_content: str
):
    """Background task for case study generation to avoid gateway timeout"""
    db = get_db()
    logger.info(f"📚 [BACKGROUND] Starting case study generation {study_id}...")
    logger.info(
        f"📊 [BACKGROUND] Input - Project: {len(project_text)} chars, "
        f"Support: {len(support_texts)} files, "
        f"CV: {'Yes (' + str(len(cv_content)) + ' chars)' if cv_content else 'No'}"
    )

    try:
        await db.case_studies.update_one(
            {"id": study_id},
            {"$set": {"status": "generating", "updated_at": datetime.now(timezone.utc)}}
        )

        MAX_PROJECT_CHARS = 30000
        MAX_SUPPORT_CHARS = 15000
        MAX_CV_CHARS = 20000

        project_text_limited = project_text[:MAX_PROJECT_CHARS]
        cv_text_limited = cv_content[:MAX_CV_CHARS] if cv_content else ""

        other_support_texts = []
        for text in support_texts:
            if cv_content and text == cv_content:
                continue
            if len(text) > MAX_SUPPORT_CHARS:
                other_support_texts.append(text[:MAX_SUPPORT_CHARS] + "\n...[contenido truncado]...")
            else:
                other_support_texts.append(text)

        context = f"PROJECT DESCRIPTION:\n{project_text_limited}\n\n"
        if cv_text_limited:
            context += (
                f"\n{'='*79}\n"
                f"CURRICULUM VITAE / RESUME OF {author_name.upper()}\n"
                f"(Use this to accurately describe the beneficiary's background)\n"
                f"{'='*79}\n\n{cv_text_limited}\n\n"
            )
        if other_support_texts:
            context += f"ADDITIONAL SUPPORTING DOCUMENTS:\n{chr(10).join(other_support_texts)}\n\n"

        system_prompt = f"""[SYSTEM]
You are **Monica**, a senior business case writer trained in the Harvard Business School (HBS) style, specializing in technical documentation for USCIS National Interest Waiver (NIW) petitions.

Your mission is to produce **20–28 page business cases (≈7,000–9,000 words)** that serve as evidence for **Prong 1 of Matter of Dhanasar** (Substantial Merit & National Importance).

[CRITICAL: USE PROVIDED CV/RESUME DATA]
Extract and use REAL information from the CV/Resume. NEVER invent degrees, employers, skills, or achievements.

[CRITICAL: BENEFICIARY AS PROTAGONIST]
- Identity Lock: Use the APPLICANT/BENEFICIARY NAME provided. This person is the ARCHITECT and VISIONARY.
- Active Agent: "{author_name} developed...", "{author_name} architected...", "Under {author_name}'s leadership..."
- Avoid Passive Voice: NEVER "the platform did X" - ALWAYS "{author_name} designed the platform to do X"

[VOLUME STRATEGY - ACHIEVE 20-28 PAGES]
EXPAND aggressively on technical details, architecture decisions, vendor/tool comparisons, before/after metrics tables,
implementation timelines month-by-month, risk mitigation strategies, and national scalability roadmaps.
Every section must include concrete numbers, specific technologies, named frameworks, and measurable KPIs.
Include AT LEAST 3 detailed tables (Before/After Metrics, Technology Stack, Scalability Projections).

[MANDATORY STRUCTURE — EXPAND EVERY SECTION]
**I. EXECUTIVE SUMMARY & COVER PAGE** (500-700 words) — [NI]
**II. ORGANIZATIONAL CONTEXT & INDUSTRY LANDSCAPE** (1,000-1,300 words) — [SM]
   - Industry analysis with data
   - Competitive landscape
   - Market forces (Porter-style)
**III. THE CHALLENGE: PROBLEM DEFINITION** (900-1,100 words) — [NI]
   - Technical problem in depth
   - Business impact quantified
   - Why existing solutions failed
**IV. THE SOLUTION: TECHNICAL ARCHITECTURE** (2,000-2,500 words) — [SM]
   - Architecture diagram description (component by component)
   - Technology stack rationale (table)
   - Design decisions and trade-offs
   - Implementation phases (month-by-month)
   - Integration points
**V. RESULTS, METRICS & KPIs** (1,000-1,200 words) — [SM][NI]
   - Before/After comparison table (5+ KPIs)
   - Financial impact ($, %)
   - Operational impact (time saved, efficiency gained)
   - Quality/reliability improvements
**VI. TESTIMONIALS & INDUSTRY VALIDATION** (600-800 words) — [NI][PR]
   - Internal stakeholder voices (team members, leadership)
   - External validations (clients, partners, media)
   - Awards/recognition if applicable
**VII. NATIONAL SCALABILITY & REPLICATION FRAMEWORK** (1,000-1,300 words) — [NI][PR]
   - U.S. market sizing
   - Sectoral replicability (which industries benefit)
   - Federal priorities alignment
   - 3-year national rollout plan
**VIII. CONCLUSION & NATIONAL INTEREST DEMONSTRATION** (500-700 words) — [NI]
   - How the case proves Prong 1 (Substantial Merit + National Importance)
   - Forward-looking national impact

[OUTPUT PROTOCOL]
Generate the COMPLETE DOCUMENT in ONE response. Use Markdown headers (#, ##, ###) and real Markdown tables.
Target 7,000-9,000 words minimum."""

        user_prompt = (
            f"{context}\n**APPLICANT/BENEFICIARY NAME: {author_name}**\n\n"
            f"Generate a COMPLETE Harvard-style business case study. "
            f"{author_name} must be the protagonist throughout every section. "
            f"Target: 20-28 pages / 7,000-9,000 words. Include at least 3 detailed tables "
            f"(Before/After Metrics, Technology Stack with version/vendor, Scalability Projections)."
        )

        # 🎯 PRIMARY: Use Claude Opus 4.7 for the main case study generation (highest quality).
        # Falls back automatically: Opus 4.7 → Opus 4.5 → Sonnet 4.5 → Gemini 2.5 Pro.
        # Uses call_claude_opus if injected; otherwise falls back to _llm_call (gpt-4o chain).
        if _call_claude_opus is not None:
            content_en = await _call_claude_opus(
                system_message=system_prompt,
                user_message=user_prompt,
                temperature=0.7,
                max_tokens=32000
            )
        else:
            content_en = await _llm_call(
                system=system_prompt,
                user=user_prompt,
                temperature=0.7,
                max_tokens=32000
            )
        # 🔁 Auto-continuation: if produced short output (<6,500 words),
        # request continuation to reach the 7,000-9,000 target.
        en_word_count = len(content_en.split()) if content_en else 0
        if en_word_count < 6500:
            logger.warning(f"⚠️ Case study produced only {en_word_count} words (<6500). Requesting continuation...")
            try:
                continuation_user = (
                    f"Here is the partial case study you started:\n\n{content_en}\n\n"
                    f"🚨 CONTINUE and EXPAND aggressively. The current draft has only {en_word_count} words "
                    f"and is INCOMPLETE. Target 7,000-9,000 words total. "
                    f"Add detailed Technical Architecture (component-by-component), "
                    f"before/after metrics tables with 5+ KPIs, vendor/tool comparison tables, "
                    f"month-by-month implementation timeline, stakeholder testimonials, "
                    f"industry validation, and a complete National Scalability section with 3-year rollout plan. "
                    f"Add AT LEAST 3,500 more words. Maintain the protagonist voice of {author_name}. "
                    f"Do NOT repeat content already written — CONTINUE from where it left off or "
                    f"EXPAND underdeveloped sections with deeper technical detail."
                )
                if _call_claude_opus is not None:
                    continuation = await _call_claude_opus(
                        system_message=system_prompt,
                        user_message=continuation_user,
                        temperature=0.7,
                        max_tokens=32000
                    )
                else:
                    continuation = await _llm_call(
                        system=system_prompt,
                        user=continuation_user,
                        temperature=0.7,
                        max_tokens=32000
                    )
                if continuation and len(continuation.split()) > 800:
                    content_en = content_en.rstrip() + "\n\n" + continuation.lstrip()
                    logger.warning(f"✅ Case study continuation added: new total = {len(content_en.split())} words")
            except Exception as cont_err:
                logger.warning(f"⚠️ Case study continuation failed ({cont_err}) — keeping partial content")
        logger.info(f"📝 [BACKGROUND] English done for {study_id} ({len(content_en.split())} words), translating...")

        content_es = await _llm_call(
            system=(
                "You are a professional translator specializing in business and academic documents. "
                "Translate from English to Spanish, maintaining professional tone, structure, and technical terminology."
            ),
            user=content_en,
            temperature=0.3,
            max_tokens=16000
        )
        logger.info(f"📝 [BACKGROUND] Spanish done for {study_id}, evaluating coherence...")

        import json as _json_mod
        full_doc_content = content_es if content_es else content_en

        # ── Phase 1: CV Fabrication Check (only if CV was provided) ──────────────
        phase1_result = {
            "cv_score": 100, "fabricated_data": [], "fabrication_count": 0,
            "reflects_cv": "N/A", "correct_experience_years": "N/A",
            "summary": "Sin CV adjunto"
        }
        if cv_content and len(cv_content) > 100:
            try:
                p1_messages = [
                    {"role": "system", "content": "Eres un evaluador de documentos empresariales. Responde SOLO con JSON válido."},
                    {"role": "user", "content": f"""Verifica si este caso de estudio refleja FIELMENTE el CV del autor.

CV DEL AUTOR: {author_name}
{cv_content[:12000]}

CONTENIDO DEL CASO DE ESTUDIO (completo):
{full_doc_content[:20000]}

Extrae TODAS las afirmaciones sobre el autor y verifica cada una.

Responde en JSON:
{{
  "cv_score": <0-100>,
  "fabricated_data": [{{"type": "años_experiencia|certificacion|empresa|logro", "document_text": "...", "correct_or_missing": "..."}}],
  "fabrication_count": <número>,
  "reflects_cv": "Sí|No|Parcialmente",
  "correct_experience_years": "Sí|No|No especificado",
  "summary": "2-3 líneas sobre problemas graves"
}}"""}
                ]
                # Use cheap evaluator (Gemini Flash → Claude Haiku → GPT-4o-mini)
                if _call_cheap_evaluator is not None:
                    p1_resp_content = await _call_cheap_evaluator(
                        system_message=p1_messages[0]["content"],
                        user_message=p1_messages[1]["content"],
                        temperature=0.1,
                        max_tokens=3000,
                        json_mode=True,
                    )
                else:
                    p1_resp_content = await _llm_call(
                        system=p1_messages[0]["content"],
                        user=p1_messages[1]["content"],
                        temperature=0.1,
                        max_tokens=3000
                    )
                # Robust JSON extraction
                _p1 = p1_resp_content.replace('```json','').replace('```','').strip()
                try:
                    phase1_result = _json_mod.loads(_p1)
                except _json_mod.JSONDecodeError:
                    _fb, _lb = _p1.find('{'), _p1.rfind('}')
                    if _fb != -1 and _lb > _fb:
                        phase1_result = _json_mod.loads(_p1[_fb:_lb + 1])
                    else:
                        raise
                logger.info(f"✅ [CS EVAL Phase1] CV Score: {phase1_result.get('cv_score')} | Fabrications: {phase1_result.get('fabrication_count')}")
            except Exception as e:
                logger.warning(f"⚠️ [CS EVAL Phase1] Error: {e}")

        # ── Phase 2: Document Quality & Coherence ─────────────────────────────────
        phase2_result = {"coherence_score": 70, "project_integrated": "Parcialmente",
                         "invented_info": "N/A", "argument_quality": 70, "strengths": [], "weaknesses": [], "recommendation": ""}
        try:
            p2_messages = [
                {"role": "system", "content": "Eres un experto en casos de estudio Harvard. Responde SOLO con JSON válido."},
                {"role": "user", "content": f"""Evalúa la calidad y coherencia de este caso de estudio empresarial.

AUTOR: {author_name}
PROYECTO: {project_text[:2000]}

CONTENIDO COMPLETO:
{full_doc_content[:25000]}

Responde en JSON:
{{
  "coherence_score": <0-100>,
  "project_integrated": "Sí|No|Parcialmente",
  "invented_info": "Sí|No|Parcialmente",
  "argument_quality": <0-100>,
  "harvard_structure_score": <0-100>,
  "strengths": ["fortaleza 1"],
  "weaknesses": ["debilidad 1"],
  "critical_issues": ["problema crítico 1"],
  "recommendation": "recomendación principal",
  "recommendations_for_100": ["acción para llegar a 100"]
}}"""}
            ]
            if _call_cheap_evaluator is not None:
                p2_resp_content = await _call_cheap_evaluator(
                    system_message=p2_messages[0]["content"],
                    user_message=p2_messages[1]["content"],
                    temperature=0.1,
                    max_tokens=3000,
                    json_mode=True,
                )
            else:
                p2_resp_content = await _llm_call(
                    system=p2_messages[0]["content"],
                    user=p2_messages[1]["content"],
                    temperature=0.1,
                    max_tokens=3000
                )
            _p2 = p2_resp_content.replace('```json','').replace('```','').strip()
            try:
                phase2_result = _json_mod.loads(_p2)
            except _json_mod.JSONDecodeError:
                _fb, _lb = _p2.find('{'), _p2.rfind('}')
                if _fb != -1 and _lb > _fb:
                    phase2_result = _json_mod.loads(_p2[_fb:_lb + 1])
                else:
                    raise
            logger.info(f"✅ [CS EVAL Phase2] Doc score: {phase2_result.get('coherence_score')}")
        except Exception as e:
            logger.warning(f"⚠️ [CS EVAL Phase2] Error: {e}")

        # ── Aggregate ──────────────────────────────────────────────────────────────
        cv_sc  = phase1_result.get('cv_score', 100)
        doc_sc = phase2_result.get('coherence_score', 70)
        final  = round(cv_sc * 0.35 + doc_sc * 0.65) if cv_content else doc_sc
        fab_count = phase1_result.get('fabrication_count', 0)
        if fab_count > 0:
            final = max(0, final - min(fab_count * 5, 25))

        coherence_evaluation = {
            "coherence_score":          final,
            "cv_coherence_score":       cv_sc,
            "document_quality_score":   doc_sc,
            "fabrication_count":        fab_count,
            "reflects_cv":              phase1_result.get('reflects_cv', 'N/A'),
            "correct_experience_years": phase1_result.get('correct_experience_years', 'N/A'),
            "project_integrated":       phase2_result.get('project_integrated', 'N/A'),
            "invented_info":            phase2_result.get('invented_info', 'N/A'),
            "argument_quality":         phase2_result.get('argument_quality', 0),
            "harvard_structure_score":  phase2_result.get('harvard_structure_score', 0),
            "strengths":                phase2_result.get('strengths', []),
            "weaknesses":               phase2_result.get('weaknesses', []),
            "fabricated_data":          phase1_result.get('fabricated_data', []),
            "critical_issues":          phase2_result.get('critical_issues', []),
            "recommendation":           phase2_result.get('recommendation', ''),
            "recommendations_for_100":  phase2_result.get('recommendations_for_100', []),
            "summary":                  phase1_result.get('summary', phase2_result.get('recommendation', '')),
            "evaluation_type":          "case_study_thorough"
        }
        await db.case_studies.update_one(
            {"id": study_id},
            {"$set": {
                "content_en": content_en,
                "content_es": content_es,
                "coherence_evaluation": coherence_evaluation,
                "status": "completed",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        logger.info(
            f"✅ [BACKGROUND] Case study {study_id} completed! "
            f"Coherence: {coherence_evaluation.get('coherence_score', 0)}"
        )

    except Exception as e:
        logger.error(f"❌ [BACKGROUND] Error generating case study {study_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        await db.case_studies.update_one(
            {"id": study_id},
            {"$set": {
                "status": "failed",
                "error_message": str(e),
                "updated_at": datetime.now(timezone.utc)
            }}
        )


def _generate_case_study_pdf(content: str, client_name: str, author_name: str, language: str) -> bytes:
    """Generate PDF from markdown case study content."""
    buffer = io.BytesIO()
    lang_label = "Business Case Study"

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=72,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        title=f"{lang_label} - {client_name}",
        author=author_name,
        subject="Harvard-Style Business Case Study"
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'],
        fontSize=18, textColor=colors.black,
        spaceAfter=20, alignment=TA_CENTER, fontName='Helvetica-Bold'
    )
    heading_style = ParagraphStyle(
        'CustomHeading', parent=styles['Heading2'],
        fontSize=14, textColor=colors.black,
        spaceAfter=12, spaceBefore=12, fontName='Helvetica-Bold'
    )
    subheading_style = ParagraphStyle(
        'CustomSubheading', parent=styles['Heading3'],
        fontSize=12, textColor=colors.black,
        spaceAfter=10, spaceBefore=10, fontName='Helvetica-Bold'
    )
    body_style = ParagraphStyle(
        'CustomBody', parent=styles['BodyText'],
        fontSize=11, leading=16, alignment=TA_JUSTIFY,
        spaceAfter=6, fontName='Helvetica'
    )

    story = []
    story.append(Paragraph(f"{lang_label}<br/>{client_name}", title_style))
    story.append(Spacer(1, 0.3 * inch))

    content = re.sub(r'```markdown\s*', '', content)
    content = re.sub(r'```\s*', '', content)

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            story.append(Spacer(1, 0.1 * inch))
            i += 1
            continue

        # 🎨 Markdown horizontal rule (---/***/___/===) → DROP entirely.
        # The user explicitly requested no horizontal divider lines in the
        # final case-study PDF. Section headings already give visual breaks,
        # so adding a thin grey line on top creates clutter.
        if re.match(r'^[\-\*_=]{3,}$', line):
            i += 1
            continue

        # Drop stray standalone "..." that some LLMs emit as weak separators
        if line in ('...', '…'):
            i += 1
            continue

        if line.startswith('|') and i + 1 < len(lines) and lines[i + 1].strip().startswith('|'):
            table_lines = [line]
            i += 1
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1

            table_data = []
            for tl in table_lines:
                if '---' in tl or '====' in tl:
                    continue
                cells = [_pdf_safe(cell.strip()) for cell in tl.split('|')[1:-1]]
                if cells:
                    # Convert inline markdown (italic/bold/code) inside table cells too
                    cells = [_md_inline_to_html(c) for c in cells]
                    table_data.append(cells)

            if table_data:
                # Calculate column widths based on page usable width (letter = 8.5in,
                # minus 1in margins = 6.5in usable). Distribute equally so wide
                # tables don't overflow the right margin. Individual cells wrap
                # automatically because the content is rendered via Paragraph.
                from reportlab.lib.pagesizes import letter as _letter
                from reportlab.lib.units import inch as _inch
                _usable_width = _letter[0] - 2 * _inch  # 6.5 inches
                _num_cols = max(len(row) for row in table_data) if table_data else 1
                _col_width = _usable_width / _num_cols

                # Wrap every cell in a Paragraph so ReportLab applies wrapping
                # inside the fixed-width column instead of letting the cell grow.
                _cell_style = ParagraphStyle(
                    'TableCell', parent=styles['Normal'],
                    fontSize=9, leading=11, alignment=0,
                )
                wrapped_rows = []
                for ri, row in enumerate(table_data):
                    wrapped_row = []
                    for cell in row:
                        try:
                            wrapped_row.append(Paragraph(cell or '&nbsp;', _cell_style))
                        except Exception:
                            # Fall back to stripping all markup if it's malformed
                            import re as _re_cell
                            plain = _re_cell.sub(r'<[^>]+>', '', cell or '')
                            wrapped_row.append(Paragraph(_pdf_safe(plain) or '&nbsp;', _cell_style))
                    # Pad row to num_cols so ReportLab doesn't raise on ragged rows
                    while len(wrapped_row) < _num_cols:
                        wrapped_row.append(Paragraph('&nbsp;', _cell_style))
                    wrapped_rows.append(wrapped_row)

                pdf_table = Table(
                    wrapped_rows,
                    colWidths=[_col_width] * _num_cols,
                    repeatRows=1,  # repeat header on page breaks
                )
                pdf_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(pdf_table)
                story.append(Spacer(1, 0.2 * inch))
            continue

        # Match any # heading level (robust: tolerates missing space, extra
        # spaces, #### with or without space after the hashes, etc.)
        _h_m = re.match(r'^(#{1,6})\s*(.+?)\s*$', line)
        
        def _safe_add(text_html, style, fallback_text):
            """Append a Paragraph; if the HTML is malformed and ReportLab raises,
            fall back to plain-text so one bad line doesn't kill the whole PDF."""
            try:
                story.append(Paragraph(text_html, style))
            except Exception as _p_err:
                logger.warning(f"⚠️ Paragraph render failed ('{str(_p_err)[:80]}'), using plain text fallback")
                try:
                    # Strip ALL HTML-like tags for safety and try again
                    plain = re.sub(r'<[^>]+>', '', text_html)
                    plain = _pdf_safe(plain)
                    story.append(Paragraph(plain, style))
                except Exception:
                    # Last resort: raw escaped text as body
                    story.append(Paragraph(_pdf_safe(fallback_text), body_style))
        
        if _h_m:
            _hashes, _htxt = _h_m.groups()
            _htxt = _htxt.lstrip('#').strip()
            # Process inline markdown in headings too (authors sometimes use **bold** in titles)
            _htxt_html = _md_inline_to_html(_pdf_safe(_htxt))
            if len(_hashes) == 1:
                _safe_add(_htxt_html, title_style, _htxt)
            elif len(_hashes) == 2:
                _safe_add(_htxt_html, heading_style, _htxt)
            else:  # 3+ all use subheading
                _safe_add(_htxt_html, subheading_style, _htxt)
        elif line.startswith('**') and line.endswith('**') and line.count('**') == 2:
            # Pure bold line like **Section Title** → render as bold body, not subheading
            _safe_add(f"<b>{_pdf_safe(line[2:-2])}</b>", body_style, line[2:-2])
        elif line.startswith('- ') or line.startswith('* '):
            text = _md_inline_to_html(_pdf_safe(line[2:]))
            _safe_add(f"• {text}", body_style, line[2:])
        else:
            text = _md_inline_to_html(_pdf_safe(line))
            _safe_add(text, body_style, line)

        i += 1

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


# ──────────────────────────────────────────────
# Router and endpoints
# ──────────────────────────────────────────────

router = APIRouter(prefix="/case-studies", tags=["Case Studies"])


@router.post("/generate")
async def generate_case_study(
    background_tasks: BackgroundTasks,
    project_description: UploadFile = File(...),
    cv_file: Optional[UploadFile] = File(None),
    support_files: list[UploadFile] = File(default=[]),
    client_id: str = Form(...),
    title: Optional[str] = Form(None),
    current_user=Depends(get_current_user_wrapper),
):
    """Generate a Harvard-style business case study (async background processing)"""
    db = get_db()
    try:
        study_id = str(uuid.uuid4())

        project_content = await project_description.read()
        project_filename = (project_description.filename or "document.txt").lower()
        try:
            project_text = _extract_text_from_file(project_content, project_filename)
        except Exception as e:
            logger.warning(f"extract_text_from_file failed, falling back: {e}")
            try:
                project_text = project_content.decode('utf-8')
            except UnicodeDecodeError:
                project_text = project_content.decode('utf-8', errors='ignore')

        cv_content = None
        cv_author_name = None
        if cv_file and cv_file.filename:
            cv_bytes = await cv_file.read()
            cv_filename = cv_file.filename.lower()
            try:
                cv_content = _extract_text_from_file(cv_bytes, cv_filename)
                lines = cv_content.split('\n')[:40]
                skip_patterns = ['curriculum vitae', 'resume', 'cv', 'hoja de vida',
                                  'experience', 'education', 'skills', 'contact', 'profile', 'summary']
                for line in lines:
                    line = line.strip()
                    if not line or len(line) < 5:
                        continue
                    if any(p in line.lower() for p in skip_patterns):
                        continue
                    if any(kw in line.lower() for kw in ['nombre:', 'name:']):
                        parts = line.split(':')
                        if len(parts) > 1:
                            cv_author_name = parts[1].strip()
                            break
                    words = line.split()
                    if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
                        if not any(ind in line.lower() for ind in ['20', '19', 'inc', 'llc', 'university']):
                            cv_author_name = line
                            break
            except Exception as e:
                logger.warning(f"CV extraction failed: {e}")

        support_texts = []
        for sf in support_files:
            if sf and sf.filename:
                content_bytes = await sf.read()
                try:
                    text = _extract_text_from_file(content_bytes, sf.filename.lower())
                    support_texts.append(text)
                except Exception:
                    try:
                        support_texts.append(content_bytes.decode('utf-8', errors='ignore'))
                    except Exception:
                        pass

        client_name = None
        if client_id:
            client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0, "name": 1})
            if client_doc:
                client_name = client_doc.get("name")

        author_name = cv_author_name

        if not cv_content:
            for i, file in enumerate(support_files):
                filename_lower = (file.filename or "").lower()
                if any(kw in filename_lower for kw in ['cv', 'resume', 'curriculum', 'hoja de vida']):
                    cv_content = support_texts[i] if i < len(support_texts) else None
                    break

        if not author_name:
            for line in project_text.split('\n')[:15]:
                line = line.strip()
                for kw in ['autor:', 'author:', 'nombre:', 'name:']:
                    if kw in line.lower():
                        parts = line.lower().split(kw)
                        if len(parts) > 1:
                            potential = parts[1].strip().split(',')[0].split('\n')[0]
                            if potential and len(potential) < 50:
                                author_name = potential.title()
                                break
                if author_name:
                    break

        if not author_name:
            author_name = client_name

        case_study_doc = {
            "id": study_id,
            "user_id": current_user.id,
            "client_id": client_id,
            "client_name": client_name,
            "author_name": author_name,
            "title": title if title else f"Caso de Estudio: {client_name}",
            "content_en": "",
            "content_es": "",
            "current_language": "en",
            "coherence_evaluation": {},
            "status": "generating",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        await db.case_studies.insert_one(case_study_doc)

        background_tasks.add_task(
            run_case_study_generation_background,
            study_id, current_user.id, client_id, client_name, author_name,
            title if title else f"Caso de Estudio: {client_name}",
            project_text, support_texts, cv_content if cv_content else ""
        )

        return {
            "id": study_id,
            "status": "generating",
            "message": "El caso de estudio se está generando. Por favor espere unos minutos y actualice la página."
        }

    except Exception as e:
        logger.error(f"❌ Error initiating case study generation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating case study: {str(e)}")


@router.get("")
async def get_case_studies(
    client_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user_wrapper),
):
    """Get all case studies for current user (excluding deleted)"""
    db = get_db()
    if client_id:
        query_filter = {"client_id": client_id, "status": {"$ne": "deleted"}}
    else:
        query_filter = {"user_id": current_user.id, "status": {"$ne": "deleted"}}

    case_studies = await db.case_studies.find(query_filter, {"_id": 0}).to_list(1000)
    return {"case_studies": case_studies}


@router.get("/{study_id}")
async def get_case_study(study_id: str, current_user=Depends(get_current_user_wrapper)):
    """Get specific case study"""
    db = get_db()
    case_study = await db.case_studies.find_one({"id": study_id}, {"_id": 0})
    if not case_study:
        raise HTTPException(status_code=404, detail="Case study not found")
    return case_study


@router.put("/{study_id}")
async def update_case_study(
    study_id: str,
    content_en: str = Form(...),
    content_es: Optional[str] = Form(None),
    current_language: str = Form("en"),
    current_user=Depends(get_current_user_wrapper),
):
    """Update case study content"""
    db = get_db()
    case_study = await db.case_studies.find_one(
        {"id": study_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not case_study:
        raise HTTPException(status_code=404, detail="Case study not found")

    update_fields = {
        "content_en": content_en,
        "current_language": current_language,
        "updated_at": datetime.now(timezone.utc)
    }
    if content_es:
        update_fields["content_es"] = content_es

    await db.case_studies.update_one({"id": study_id}, {"$set": update_fields})
    return {"message": "Case study updated successfully"}


@router.get("/{study_id}/download")
async def download_case_study(
    study_id: str,
    language: str = Query("en"),
    current_user=Depends(get_current_user_wrapper),
):
    """Download case study as PDF"""
    db = get_db()
    case_study = await db.case_studies.find_one({"id": study_id}, {"_id": 0})
    if not case_study:
        raise HTTPException(status_code=404, detail="Case study not found")

    content = case_study.get('content_es' if language == 'es' else 'content_en', '')
    if not content:
        raise HTTPException(status_code=404, detail="Content not available in requested language")

    client_name = case_study.get('client_name', 'Client')
    author_name = case_study.get('author_name', client_name)

    try:
        pdf_bytes = _generate_case_study_pdf(content, client_name, author_name, language)
    except Exception as pdf_err:
        import traceback
        logger.error(f"❌ PDF generation failed for case study {study_id} (lang={language}): {pdf_err}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF: {str(pdf_err)[:200]}. El contenido está guardado; contacte al administrador."
        )

    lang_suffix = "ES" if language == "es" else "EN"
    client_clean = re.sub(r'[^\w\-_]', '', client_name.replace(' ', '_'))
    filename = f"Case_Study_{client_clean}_{lang_suffix}.pdf" if client_clean else f"Case_Study_{lang_suffix}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{study_id}/download-docx")
async def download_case_study_docx(
    study_id: str,
    language: str = Query("en"),
    current_user=Depends(get_current_user_wrapper),
):
    """Download case study as Microsoft Word (.docx) — preserves formatting
    when uploaded to Google Drive and opened in Google Docs."""
    from docx_utils import build_docx_response

    db = get_db()
    case_study = await db.case_studies.find_one({"id": study_id}, {"_id": 0})
    if not case_study:
        raise HTTPException(status_code=404, detail="Case study not found")
    content = case_study.get('content_es' if language == 'es' else 'content_en', '')
    if not content:
        raise HTTPException(status_code=404, detail="Content not available in requested language")
    client_name = case_study.get('client_name', 'Client')
    title = case_study.get('title') or f"Case Study: {client_name}"
    client_clean = re.sub(r'[^\w\-_]', '', client_name.replace(' ', '_')) or "Client"

    return build_docx_response(
        content=content,
        title=title,
        filename_stem=f"Case_Study_{client_clean}",
        doc_type="Case Study" if language == 'en' else "Caso de Estudio",
        author=client_name,
        language=language,
    )


@router.delete("/{study_id}")
async def delete_case_study(study_id: str, current_user=Depends(get_current_user_wrapper)):
    """Delete case study"""
    db = get_db()
    result = await db.case_studies.update_one(
        {"id": study_id, "user_id": current_user.id},
        {"$set": {"status": "deleted", "updated_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Case study not found")
    return {"message": "Case study deleted successfully"}


@router.post("/{study_id}/retry-generation")
async def retry_case_study_generation(
    study_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_wrapper),
):
    """Retry generation of a case study that failed or got stuck."""
    db = get_db()
    study = await db.case_studies.find_one({"id": study_id})
    if not study:
        raise HTTPException(status_code=404, detail="Case study not found")

    if study.get("status") == "completed" and study.get("content_en"):
        return {"message": "Case study is already completed", "study_id": study_id, "status": "completed"}

    client_id = study.get("client_id")
    client_name = study.get("client_name", "")
    author_name = study.get("author_name", client_name)
    title = study.get("title", f"Caso de Estudio: {client_name}")

    await db.case_studies.update_one(
        {"id": study_id},
        {"$set": {"status": "generating", "error_message": None, "updated_at": datetime.now(timezone.utc)}}
    )

    background_tasks.add_task(
        run_case_study_generation_background,
        study_id, current_user.id, client_id, client_name, author_name, title,
        f"Generate a Harvard-style business case study for {author_name}. Project: {title}",
        [], ""
    )

    return {"message": "Case study regeneration started", "study_id": study_id, "status": "generating"}
