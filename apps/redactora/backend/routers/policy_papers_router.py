"""
Policy Papers Router — Economic Impact Analysis / Social Impact Reports for NIW petitions
Extracted from server.py for better code organization.
"""

import asyncio
import io
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form,
    HTTPException, Query, Response, UploadFile
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_utils import pdf_safe as _pdf_safe

from reportlab.lib.pagesizes import letter as letter_size
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import SimpleDocTemplate

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Module-level dependencies (injected via init_router)
# ──────────────────────────────────────────────
_db = None
_openai_client = None
_get_current_user = None
_evaluate_document_coherence = None
_extract_text_from_pdf_robust = None
_call_gpt4o = None  # Helper with built-in 429 retry + OpenRouter fallback
_call_claude_opus = None  # Primary helper: Claude Opus 4.7 → 4.5 → Sonnet 4.5 → Gemini 2.5 Pro
_call_cheap_evaluator = None  # Cheap evaluator: Gemini Flash → Claude Haiku → GPT-4o-mini


def init_router(
    database,
    openai_client,
    get_current_user_func,
    evaluate_document_coherence_func,
    extract_text_from_pdf_robust_func,
    call_gpt4o_func=None,
    call_claude_opus_func=None,
    call_cheap_evaluator_func=None,
):
    global _db, _openai_client, _get_current_user
    global _evaluate_document_coherence, _extract_text_from_pdf_robust, _call_gpt4o, _call_claude_opus, _call_cheap_evaluator
    _db = database
    _openai_client = openai_client
    _get_current_user = get_current_user_func
    _evaluate_document_coherence = evaluate_document_coherence_func
    _extract_text_from_pdf_robust = extract_text_from_pdf_robust_func
    _call_gpt4o = call_gpt4o_func
    _call_claude_opus = call_claude_opus_func
    _call_cheap_evaluator = call_cheap_evaluator_func
    logger.info("✅ Policy Papers Router initialized with dependencies")


async def _llm_call(system: str, user: str, *, temperature: float = 0.7, max_tokens: int = 16000) -> str:
    """Call LLM with automatic fallback to OpenRouter on 429/5xx."""
    if _call_gpt4o is not None:
        return await _call_gpt4o(
            system_message=system,
            user_message=user,
            temperature=temperature,
            max_tokens=max_tokens
        )
    resp = await _openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens
    )
    return resp.choices[0].message.content


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_router() first.")
    return _db


async def get_current_user_wrapper(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    if _get_current_user is None:
        raise RuntimeError("get_current_user not initialized.")
    return await _get_current_user(credentials)


# ──────────────────────────────────────────────
# Utility helpers
# ──────────────────────────────────────────────

def clean_word_counts(content: str) -> str:
    """Remove word count annotations, code fences, and clean unicode from content."""
    if not content:
        return content
    patterns = [
        r'\(\d+-\d+\s*words?\)',
        r'\(\d+\+?\s*words?\)',
        r'Word count:\s*\d+',
        r'\[Word count:\s*\d+\]',
        r'Palabras:\s*\d+',
        r'\(aprox\.\s*\d+\s*palabras\)',
    ]
    cleaned = content
    for pattern in patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    unicode_replacements = {'█': '-', '■': '-', '▪': '-', '□': '-', '●': '*', '○': '*'}
    for char, replacement in unicode_replacements.items():
        cleaned = cleaned.replace(char, replacement)
    cleaned = cleaned.strip()

    # 🧹 Strip leading/trailing markdown code fences that LLMs sometimes wrap
    # entire responses in (e.g. ```plaintext ... ``` or ```markdown ... ```).
    # Only strip if the fences wrap the ENTIRE content (not inline code blocks).
    fence_pattern = r'^```[a-zA-Z0-9_\-]*\s*\n?(.*?)\n?```\s*$'
    m = re.match(fence_pattern, cleaned, flags=re.DOTALL)
    if m:
        cleaned = m.group(1).strip()
    # Also strip a lone leading ```<lang> line and/or trailing ``` line
    # (handles cases where the opening/closing fences are unbalanced).
    cleaned = re.sub(r'^```[a-zA-Z0-9_\-]*\s*\n', '', cleaned)
    cleaned = re.sub(r'\n```\s*$', '', cleaned)
    return cleaned.strip()


async def _extract_binary_pdf_text(doc_text: str, paper_id: str) -> str:
    """Extract text from doc_text that may contain binary PDF data."""
    if not doc_text:
        return ''
    is_binary_pdf = doc_text.startswith('%PDF') or any(
        ord(c) > 127 and ord(c) < 256 for c in doc_text[:100]
    )
    if not is_binary_pdf:
        return doc_text[:3000]
    try:
        pdf_bytes = None
        if isinstance(doc_text, str):
            for encoding in ['latin-1', 'utf-8', 'cp1252', 'iso-8859-1']:
                try:
                    pdf_bytes = doc_text.encode(encoding, errors='replace')
                    break
                except Exception:
                    continue
            if pdf_bytes is None:
                pdf_bytes = doc_text.encode('latin-1', errors='replace')
        else:
            pdf_bytes = doc_text
        extracted_text, method = await _extract_text_from_pdf_robust(pdf_bytes, "policy_paper.pdf")
        if extracted_text and len(extracted_text.strip()) > 50:
            logger.info(f"✅ [{paper_id}] PDF text extracted with {method}: {len(extracted_text)} chars")
            return extracted_text[:3000]
    except Exception as pdf_err:
        logger.warning(f"⚠️ [{paper_id}] Error extracting PDF: {pdf_err}")
    return ''


# ──────────────────────────────────────────────
# Background tasks
# ──────────────────────────────────────────────

async def generate_policy_paper_background(paper_id: str):
    """Background task to generate policy paper."""
    db = get_db()
    try:
        logger.warning(f"🚀 [POLICY] Starting background generation: {paper_id}")

        paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
        if not paper:
            logger.error(f"Paper not found: {paper_id}")
            return

        doc_text = paper.get('doc_text', '')
        author_name = paper.get('author_name', 'Project Lead')

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "progress": 10,
                "progress_message": "Analizando documento de entrada...",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        from social_impact_report_endpoints import SOCIAL_IMPACT_REPORT_SYSTEM_PROMPT

        current_date = datetime.now(timezone.utc)
        date_str = current_date.strftime("%B %d, %Y")
        project_description = f"DOCUMENT: {paper.get('filename', 'document')}\n{doc_text}\n"

        user_prompt = f"""Based on the following project description, generate a comprehensive ECONOMIC IMPACT ANALYSIS report that demonstrates Prong 1 of Matter of Dhanasar.

CURRENT DATE: {date_str}
CLIENT NAME: {author_name}
PROJECT PROPONENT: {author_name}

{project_description}

CRITICAL INSTRUCTIONS:
1. Use "Project Proponent: {author_name}" in the Cover Page
2. Use the client's name "{author_name}" throughout the document
3. DO NOT include any author signature lines like "Monica, Senior Policy Economist" or similar
4. Present this as an objective economic analysis, NOT as a personal opinion piece
5. Use the current date "{date_str}" for the Cover Page
6. DO NOT include word counts like "(400-500 words)" in the output

DENSITY REQUIREMENTS - THIS IS CRITICAL:
- The report MUST be at least 10,000 words (approximately 12-18 pages)
- Introduction section: Include a Literature Review citing at least 5 distinct academic sources
- Methodology section: Explain the mathematical derivation of EVERY formula used
- Each section must meet the minimum word count specified in the structure
- Include comprehensive tables, figures, and analysis throughout

Generate the complete report with all mandatory sections. This should be a comprehensive 10,000-12,000 word document.

IMPORTANT: Generate the COMPLETE report now. Do not ask for clarification - produce the full document immediately."""

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "progress": 20,
                "progress_message": "Generando reporte en inglés con GPT-5.1...",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        try:
            # 🎯 PRIMARY: Use Claude Opus 4.7 (fallback chain: 4.7 → 4.5 → Sonnet 4.5 → Gemini 2.5 Pro)
            # This produces long-form documents (40+ pages / 10k+ words) more reliably than GPT-4o.
            if _call_claude_opus is not None:
                opus_system_prompt = (
                    SOCIAL_IMPACT_REPORT_SYSTEM_PROMPT
                    + "\n\n🚨🚨🚨 MANDATORY LENGTH REQUIREMENT 🚨🚨🚨"
                    + "\nGenerate AT LEAST 10,000 words — minimum 12 pages, ideally 30-45 pages."
                    + "\nExpand EVERY section with detailed analysis, tables, year-by-year projections, and numerical data."
                    + "\nDO NOT produce an executive summary only — produce the FULL report with all mandatory sections."
                )
                logger.info("🎯 Generating with Claude Opus 4.7 primary (with 4.5/Sonnet/Gemini fallback)...")
                report_content_en = await _call_claude_opus(
                    system_message=opus_system_prompt,
                    user_message=user_prompt,
                    temperature=0.7,
                    max_tokens=32000
                )
                logger.info(f"✅ Claude Opus generated: {len(report_content_en)} chars")
            else:
                # Legacy path: try GPT-5.1 primary
                logger.info("🚀 Generating with GPT-5.1 (with OpenRouter fallback)...")
                response = await _openai_client.chat.completions.create(
                    model="gpt-5.1-2025-11-13",
                    messages=[
                        {"role": "system", "content": SOCIAL_IMPACT_REPORT_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.7,
                    max_completion_tokens=32000
                )
                report_content_en = response.choices[0].message.content
                logger.info(f"✅ GPT-5.1 generated: {len(report_content_en)} chars")
        except Exception as model_error:
            logger.warning(f"Primary generation failed ({str(model_error)[:200]}), trying GPT-4o with OpenRouter fallback...")
            gpt4o_system_prompt = (
                SOCIAL_IMPACT_REPORT_SYSTEM_PROMPT
                + "\n\n🚨🚨🚨 MANDATORY LENGTH REQUIREMENT 🚨🚨🚨"
                + "\nGenerate AT LEAST 10,000 words — minimum 12 pages."
                + "\nExpand EVERY section with detailed analysis, tables, year-by-year projections, and numerical data."
                + "\nDO NOT produce an executive summary only — produce the FULL report with all mandatory sections."
            )
            # Use _llm_call which has 429 retry + OpenRouter fallback (openai/gpt-4o → Claude → Gemini)
            # max_tokens=32000 matches the GPT-5.1 primary path. Claude Sonnet 4.5 and Gemini 2.5 Pro
            # both support >32k output tokens; OpenAI gpt-4o (16k cap) will clamp automatically.
            report_content_en = await _llm_call(
                system=gpt4o_system_prompt,
                user=user_prompt,
                temperature=0.7,
                max_tokens=32000
            )
        # 🔁 Auto-continuation: if the generation produced a short response
        # (< 7,000 words), ask to continue / expand with a second call.
        word_count = len(report_content_en.split()) if report_content_en else 0
        if word_count < 7000:
            logger.warning(f"⚠️ Generation produced only {word_count} words (<7000). Requesting continuation...")
            try:
                continuation_system = (
                    SOCIAL_IMPACT_REPORT_SYSTEM_PROMPT
                    + "\n\n🚨 You are EXPANDING a partial report. DO NOT repeat content already written."
                )
                continuation_user = (
                    f"Here is the partial Economic Impact Analysis report you started:\n\n"
                    f"{report_content_en}\n\n"
                    f"🚨 CONTINUE and EXPAND this report. The current draft has only {word_count} words "
                    f"and is INCOMPLETE. Add detailed analysis to any section that is short. "
                    f"Include: full Quantitative Analysis tables (national, regional, scenario), "
                    f"year-by-year projections (Year 1 through Year 5), complete Methodology with "
                    f"formula derivations, detailed Implementation Plan with month-by-month timeline, "
                    f"complete Risk Matrix with probability x impact, and full References section. "
                    f"Your continuation should add AT LEAST 6,000 more words. "
                    f"Do NOT repeat what is already written — CONTINUE from where it left off or "
                    f"EXPAND the underdeveloped sections. Maintain the same professional tone and structure."
                )
                if _call_claude_opus is not None:
                    continuation = await _call_claude_opus(
                        system_message=continuation_system,
                        user_message=continuation_user,
                        temperature=0.7,
                        max_tokens=32000
                    )
                else:
                    continuation = await _llm_call(
                        system=continuation_system,
                        user=continuation_user,
                        temperature=0.7,
                        max_tokens=32000
                    )
                if continuation and len(continuation.split()) > 500:
                    report_content_en = report_content_en.rstrip() + "\n\n" + continuation.lstrip()
                    logger.warning(f"✅ Continuation added: new total = {len(report_content_en.split())} words")
            except Exception as cont_err:
                logger.warning(f"⚠️ Continuation failed ({cont_err}) — keeping partial content")

        report_content_en = clean_word_counts(report_content_en)

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "content_en": report_content_en,
                "progress": 60,
                "progress_message": "Contenido inglés guardado. Traduciendo al español...",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        logger.info(f"✅ English content saved: {len(report_content_en)} chars")

        try:
            translation_prompt = (
                "Translate this comprehensive Economic Impact Analysis report from English to Spanish. "
                "Maintain the institutional tone, all data citations, technical terminology, and the full length. "
                f"Do not summarize or shorten any sections:\n\n{report_content_en}"
            )
            # Use _llm_call which has 429 retry + OpenRouter fallback
            report_content_es = clean_word_counts(await asyncio.wait_for(
                _llm_call(
                    system="You are a professional translator specializing in economic policy documents. Translate without summarizing.",
                    user=translation_prompt,
                    temperature=0.3,
                    max_tokens=16000
                ),
                timeout=300
            ))
            logger.info(f"✅ Spanish translation: {len(report_content_es)} chars")
        except asyncio.TimeoutError:
            logger.warning("⏱️ Translation timeout - using English as fallback")
            report_content_es = report_content_en
        except Exception as trans_error:
            logger.error(f"Translation error: {trans_error}")
            report_content_es = report_content_en

        # Evaluate coherence
        logger.info(f"🔍 [POLICY {paper_id}] Evaluating coherence...")
        evaluation_project_desc = await _extract_binary_pdf_text(doc_text, paper_id)
        if not evaluation_project_desc and report_content_en:
            evaluation_project_desc = f"[Generated from project document]\n{report_content_en[:2000]}"

        coherence_evaluation = await _evaluate_document_coherence(
            document_content=report_content_es[:4000] if report_content_es else report_content_en[:4000],
            author_name=author_name,
            author_cv='',
            project_description=evaluation_project_desc,
            patent_info='',
            document_type="reporte de impacto social"
        )
        logger.info(f"✅ [POLICY {paper_id}] Coherence score: {coherence_evaluation.get('coherence_score', 0)}")

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "content_en": report_content_en,
                "content_es": report_content_es,
                "coherence_evaluation": coherence_evaluation,
                "status": "completed",
                "progress": 100,
                "progress_message": "¡Reporte completado!",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.warning(f"✅ [POLICY] Generation completed: {paper_id}")

    except Exception as e:
        logger.error(f"❌ [POLICY] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "status": "error",
                "progress": 0,
                "progress_message": "Error en generación",
                "error_message": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


async def retry_policy_paper_translation(paper_id: str, content_en: str):
    """Retry only the Spanish translation."""
    db = get_db()
    try:
        logger.info(f"🌐 Retrying translation for {paper_id}")
        # Heartbeat: refresh updated_at so the UI doesn't classify as stale.
        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "progress": 65,
                "progress_message": "Traduciendo reporte al español...",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        translation_prompt = (
            "Translate this comprehensive Economic Impact Analysis report from English to Spanish. "
            "Maintain the institutional tone, all data citations, technical terminology, and the full length:\n\n"
            + content_en
        )
        try:
            # Use _llm_call which has 429 retry + OpenRouter fallback
            report_content_es = clean_word_counts(await asyncio.wait_for(
                _llm_call(
                    system="You are a professional translator specializing in economic policy documents.",
                    user=translation_prompt,
                    temperature=0.3,
                    max_tokens=16000
                ),
                timeout=300
            ))
        except asyncio.TimeoutError:
            logger.warning("⏱️ Translation timeout - using English")
            report_content_es = content_en

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "content_es": report_content_es,
                "status": "completed",
                "progress": 100,
                "progress_message": "¡Traducción completada!",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"✅ Translation retry completed: {paper_id}")

    except Exception as e:
        logger.error(f"❌ Translation retry failed: {str(e)}")
        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "content_es": content_en,
                "status": "completed",
                "progress": 100,
                "progress_message": "Completado (solo inglés)",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


def _generate_policy_paper_pdf(
    content: str,
    project_title: str,
    client_name: str,
    author_name: str,
    language: str
) -> bytes:
    """Generate PDF from markdown policy paper content."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter_size,
        topMargin=0.75 * inch,
        bottomMargin=72,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        title=f"Social Impact Report - {project_title}",
        author=author_name,
        subject="Economic Impact Analysis - National Interest Waiver",
        creator="Economic Research Platform"
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'],
        fontSize=16, textColor=colors.HexColor('#1a365d'),
        spaceAfter=12, spaceBefore=0, alignment=TA_CENTER, fontName='Helvetica-Bold'
    )
    h1_style = ParagraphStyle(
        'H1Custom', parent=styles['Heading1'],
        fontSize=14, textColor=colors.black,
        spaceAfter=8, spaceBefore=16, fontName='Helvetica-Bold'
    )
    h2_style = ParagraphStyle(
        'H2Custom', parent=styles['Heading2'],
        fontSize=12, textColor=colors.black,
        spaceAfter=6, spaceBefore=12, fontName='Helvetica-Bold'
    )
    h3_style = ParagraphStyle(
        'H3Custom', parent=styles['Heading3'],
        fontSize=11, textColor=colors.black,
        spaceAfter=4, spaceBefore=8, fontName='Helvetica-Bold'
    )
    h4_style = ParagraphStyle(
        'H4Custom', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#333333'),
        spaceAfter=3, spaceBefore=6, fontName='Helvetica-Bold'
    )
    body_style = ParagraphStyle(
        'BodyCustom', parent=styles['BodyText'],
        fontSize=10, leading=14, alignment=TA_JUSTIFY,
        spaceAfter=8, spaceBefore=0, fontName='Times-Roman'
    )
    equation_style = ParagraphStyle(
        'EquationStyle', parent=styles['Normal'],
        fontSize=9, leading=13, alignment=TA_LEFT,
        spaceAfter=6, spaceBefore=6,
        fontName='Helvetica',
        leftIndent=24, rightIndent=24,
        backColor=colors.HexColor('#f5f5f5'),
        borderPad=4
    )
    client_style = ParagraphStyle(
        'ClientStyle', parent=styles['Normal'],
        fontSize=9, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=6
    )

    # ── LaTeX → readable text converter ──────────────────────────────────────
    def clean_latex(text: str) -> str:
        """Convert LaTeX math notation to plain readable ASCII text."""
        import re as _re
        # \frac{numerator}{denominator} → (numerator / denominator)
        for _ in range(8):
            text = _re.sub(r'\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}', r'(\1 / \2)', text)
        # \sqrt{x} → sqrt(x)
        text = _re.sub(r'\\sqrt\s*\{([^{}]*)\}', r'sqrt(\1)', text)
        # \text{word} → word
        text = _re.sub(r'\\text\s*\{([^{}]*)\}', r'\1', text)
        # \textbf{x} → x, \textit{x} → x
        text = _re.sub(r'\\text(?:bf|it|rm|sf|tt)\s*\{([^{}]*)\}', r'\1', text)
        # subscript A_{max} → A_max, A_{1,f} → A_1f
        text = _re.sub(r'_\{([^{}]{1,20})\}', lambda m: '_' + m.group(1).replace(',','').replace(' ',''), text)
        # superscript e^{-k t} → e^(-kt), ^{2} → ^2
        text = _re.sub(r'\^\{([^{}]{1,20})\}', lambda m: '^(' + m.group(1) + ')', text)
        # remaining braces
        text = text.replace('{,}', ',').replace('{', '').replace('}', '')
        # Greek letters
        greek = {
            r'\alpha': 'alpha', r'\beta': 'beta', r'\gamma': 'gamma',
            r'\delta': 'delta', r'\epsilon': 'epsilon', r'\varepsilon': 'epsilon',
            r'\zeta': 'zeta', r'\eta': 'eta', r'\theta': 'theta',
            r'\lambda': 'lambda', r'\mu': 'mu', r'\nu': 'nu',
            r'\pi': 'pi', r'\rho': 'rho', r'\sigma': 'sigma',
            r'\tau': 'tau', r'\phi': 'phi', r'\chi': 'chi',
            r'\psi': 'psi', r'\omega': 'omega',
            r'\Gamma': 'Gamma', r'\Delta': 'Delta', r'\Theta': 'Theta',
            r'\Lambda': 'Lambda', r'\Pi': 'Pi', r'\Sigma': 'Sigma',
            r'\Phi': 'Phi', r'\Psi': 'Psi', r'\Omega': 'Omega',
        }
        for latex, plain in greek.items():
            text = text.replace(latex, plain)
        # Math operators/symbols
        replacements = [
            (r'\approx', '~='), (r'\times', 'x'), (r'\cdot', '*'),
            (r'\div', '/'), (r'\pm', '+/-'), (r'\mp', '-/+'),
            (r'\leq', '<='), (r'\geq', '>='), (r'\neq', '!='),
            (r'\ll', '<<'), (r'\gg', '>>'),
            (r'\Rightarrow', '=>'), (r'\rightarrow', '->'),
            (r'\Leftarrow', '<='), (r'\leftarrow', '<-'),
            (r'\leftrightarrow', '<->'), (r'\Leftrightarrow', '<=>'),
            (r'\infty', 'inf'), (r'\partial', 'd'),
            (r'\sum', 'SUM'), (r'\prod', 'PROD'), (r'\int', 'INT'),
            (r'\ln', 'ln'), (r'\log', 'log'), (r'\exp', 'exp'),
            (r'\max', 'max'), (r'\min', 'min'), (r'\lim', 'lim'),
            (r'\left', ''), (r'\right', ''), (r'\big', ''), (r'\Big', ''),
            (r'\mid', '|'), (r'\|', '||'),
            (r'\dots', '...'), (r'\ldots', '...'), (r'\cdots', '...'),
            (r'\quad', '  '), (r'\qquad', '    '),
            (r'\,', ' '), (r'\;', ' '), (r'\:', ' '), (r'\ ', ' '),
            (r'\!', ''), (r'\\', ' '),
        ]
        for latex, plain in replacements:
            text = text.replace(latex, plain)
        # Remove any remaining backslash-commands: \word → word
        text = _re.sub(r'\\([A-Za-z]+)', r'\1', text)
        # Clean up multiple spaces
        text = _re.sub(r'  +', ' ', text).strip()
        return text

    # ── Pre-process: collapse multi-line LaTeX display blocks \[...\] ─────────
    def preprocess_content(raw: str) -> str:
        import re as _re
        # ── LLM/OCR METADATA CLEANUP ─────────────────────────────────────────
        # 1. "End of [Economic Impact Analysis|supplementary appendices|report]..."
        #    closing statements that the LLM appends as USCIS evidentiary meta-notes.
        #    These look authoritative but don't belong in the final PDF.
        raw = _re.sub(
            r'(?im)^\s*End of (?:Economic Impact Analysis|supplementary appendices|report|analysis|document)[\s\S]{0,600}?(?:\n\s*\n|\Z)',
            '\n',
            raw,
        )
        # 2. OCR artifacts like "==End of OCR for page N==" / "==End of OCR page N=="
        raw = _re.sub(r'(?im)^={2,}\s*End of OCR (?:for )?page\s*\d+\s*={2,}\s*$', '', raw)
        raw = _re.sub(r'={2,}\s*End of OCR[^\n]*={2,}', '', raw)
        # 3. "Focus:" metadata lines (doc-type headers emitted by the LLM as
        #    structured preamble but look like labels in the final PDF).
        raw = _re.sub(
            r'(?im)^\s*(?:\*\*)?Focus(?:\*\*)?\s*:\s*[^\n]+\n',
            '',
            raw,
        )
        raw = _re.sub(
            r'(?im)^\s*(?:\*\*)?Document Type(?:\*\*)?\s*:\s*[^\n]+\n',
            '',
            raw,
        )
        raw = _re.sub(
            r'(?im)^\s*(?:\*\*)?Document Classification(?:\*\*)?\s*:\s*[^\n]+\n',
            '',
            raw,
        )
        # 4. Horizontal rule dividers (---, ***, ___) on their own line that
        #    the LLM inserts between sections. The PDF already has heading
        #    styles, so visible lines look like accidental visual artifacts.
        raw = _re.sub(r'(?m)^\s*[-*_]{3,}\s*$', '', raw)
        # 5. "CLOSING STATEMENT" header block — LLM sometimes appends a
        #    final "CLOSING STATEMENT" section that's redundant with the
        #    conclusion. Keep the heading but strip the evidentiary preamble.
        # (Handled by the "End of..." pattern above; no-op stub retained.)

        # 6. Duplicate "ECONOMIC IMPACT ANALYSIS" heading at the very start
        #    of the LLM content. The PDF generator already prints this as
        #    the cover banner (see line ~710), so when the LLM also emits
        #    it as the first H1 of the body the user sees it twice on
        #    page 1. Strip the FIRST occurrence only — preserve any later
        #    section heading that happens to repeat the phrase.
        raw = _re.sub(
            r'\A\s*(?:#{1,3}\s*|\*{0,2}\s*)?'             # optional leading # or **
            r'(?:I\.\s*|1\.\s*)?'                          # optional "I." or "1."
            r'ECONOMIC\s+IMPACT\s+ANALYSIS'
            r'\s*(?:\*{0,2})?\s*:?\s*'
            r'\n+',                                         # consume trailing newlines
            '',
            raw,
            count=1,
            flags=_re.IGNORECASE,
        )
        # Also strip a Spanish duplicate ("ANÁLISIS DE IMPACTO ECONÓMICO")
        raw = _re.sub(
            r'\A\s*(?:#{1,3}\s*|\*{0,2}\s*)?'
            r'(?:I\.\s*|1\.\s*)?'
            r'AN[ÁA]LISIS\s+DE\s+IMPACTO\s+ECON[ÓO]MICO'
            r'\s*(?:\*{0,2})?\s*:?\s*'
            r'\n+',
            '',
            raw,
            count=1,
            flags=_re.IGNORECASE,
        )

        # Strip literal triple-quote fences (''' or """) — the LLM sometimes
        # wraps code/examples in triple quotes instead of Markdown backticks.
        raw = _re.sub(r"^[ \t]*'{3,}[a-zA-Z]*[ \t]*\n", '', raw, flags=_re.MULTILINE)
        raw = _re.sub(r"^[ \t]*'{3,}[ \t]*$", '', raw, flags=_re.MULTILINE)
        raw = raw.replace("'''", '')
        # Also strip any residual Markdown code fences (```lang / ``` )
        raw = _re.sub(r'^[ \t]*`{3,}[a-zA-Z]*[ \t]*\n', '', raw, flags=_re.MULTILINE)
        raw = _re.sub(r'^[ \t]*`{3,}[ \t]*$', '', raw, flags=_re.MULTILINE)
        raw = _re.sub(r'`{3,}[a-zA-Z]*', '', raw)
        raw = raw.replace('```', '')
        # Strip internal tags like [SM], [NI], [PR], [SBCS], [RR], [MM]
        raw = _re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)\]', '', raw)
        raw = _re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)(?:\]\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI))*\]', '', raw)
        # Collapse multi-line \[...\] blocks into a single EQUATION: line
        def collapse_display_eq(m):
            inner = m.group(1).strip()
            inner = _re.sub(r'\s+', ' ', inner)  # collapse internal newlines
            return f'\nEQUATION: {clean_latex(inner)}\n'
        raw = _re.sub(r'\\\[\s*(.*?)\s*\\\]', collapse_display_eq, raw, flags=_re.DOTALL)
        # Convert inline \(...\) to just the cleaned text
        raw = _re.sub(r'\\\(\s*(.*?)\s*\\\)', lambda m: clean_latex(m.group(1)), raw)
        # Also handle $...$ inline math
        raw = _re.sub(r'\$\$\s*(.*?)\s*\$\$', lambda m: f'\nEQUATION: {clean_latex(m.group(1))}\n', raw, flags=_re.DOTALL)
        raw = _re.sub(r'\$([^$\n]{1,200}?)\$', lambda m: clean_latex(m.group(1)), raw)
        return raw

    # ── markdown bold / italic / convert ──────────────────────────────────────
    def convert_bold(text):
        text = _pdf_safe(text)
        # Convert **bold** first (greedy pairs)
        while '**' in text:
            parts = text.split('**', 2)
            if len(parts) >= 3:
                text = parts[0] + '<b>' + parts[1] + '</b>' + parts[2]
            else:
                break
        # Convert *italic* (single asterisks) — only pairs, avoid eating
        # leftover unpaired stars. Also convert _italic_.
        import re as _re_md
        # *something that is not already inside a <b> tag*: simple regex
        # tolerating spaces after/before asterisks (the LLM sometimes emits
        # `* text *` or `*Note: … *` with spaces).
        text = _re_md.sub(
            r'(?<![*<\w])\*\s*([^*\n<>]{1,400}?)\s*\*(?![*\w])',
            lambda m: '<i>' + m.group(1).strip() + '</i>',
            text,
        )
        text = _re_md.sub(
            r'(?<![_\w])_\s*([^_\n<>]{1,400}?)\s*_(?![_\w])',
            lambda m: '<i>' + m.group(1).strip() + '</i>',
            text,
        )
        # Strip any orphan asterisks that remain so they do not appear as
        # literal `*` characters in the PDF (we keep asterisks that are part
        # of bullets — those were already consumed above when `- ` / `* `
        # prefixes matched).
        text = _re_md.sub(r'(?<![a-zA-Z0-9])\*(?![a-zA-Z0-9])', '', text)
        return text

    # ── Pre-process content ───────────────────────────────────────────────────
    content = preprocess_content(content)

    story = []
    # ── COVER PAGE ───────────────────────────────────────────────────────────
    # Dedicated, fully-centered cover styles (do NOT reuse body h2_style which
    # is left-aligned). The cover renders as: large banner → decorative HR →
    # project name → proponent → subtitle → date stamp at the bottom.
    cover_banner_style = ParagraphStyle(
        'CoverBanner',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a365d'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=18, spaceBefore=0, leading=30,
    )
    cover_project_style = ParagraphStyle(
        'CoverProject',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=colors.HexColor('#1a365d'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=14, spaceBefore=0, leading=24,
    )
    cover_proponent_style = ParagraphStyle(
        'CoverProponent',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#555555'),
        alignment=TA_CENTER,
        fontName='Helvetica',
        spaceAfter=6,
    )
    cover_subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Heading3'],
        fontSize=13,
        textColor=colors.black,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=0, spaceBefore=0, leading=18,
    )
    cover_date_style = ParagraphStyle(
        'CoverDate',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        fontName='Helvetica',
    )
    cover_legal_style = ParagraphStyle(
        'CoverLegal',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER,
        fontName='Helvetica-Oblique',
        leading=12,
    )
    cover_doctype_style = ParagraphStyle(
        'CoverDocType',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#444444'),
        alignment=TA_CENTER,
        fontName='Helvetica',
        leading=14,
    )

    from datetime import datetime as _dt
    if language == 'es':
        spanish_months = {
            1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
            5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
            9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
        }
        _now = _dt.now()
        cover_date_text = f"{_now.day} de {spanish_months[_now.month]} de {_now.year}"
        subtitle = "Análisis Prong 1: Mérito Sustancial e Importancia Nacional"
        doctype_text = "Tipo de Documento: Análisis de Impacto Económico"
        legal_text = (
            "Preparado conforme a Matter of Dhanasar, 26 I&amp;N Dec. 884 (AAO 2016)<br/>"
            "Documento de Apoyo para Petición de Inmigración EB-2 NIW"
        )
    else:
        cover_date_text = _dt.now().strftime("%B %d, %Y")
        subtitle = "Prong 1 Analysis: Substantial Merit &amp; National Importance"
        doctype_text = "Document Type: Economic Impact Analysis"
        legal_text = (
            "Prepared pursuant to Matter of Dhanasar, 26 I&amp;N Dec. 884 (AAO 2016)<br/>"
            "EB-2 National Interest Waiver Petition Supporting Document"
        )

    # Top vertical breathing room — push content closer to vertical center.
    story.append(Spacer(1, 1.6 * inch))
    story.append(Paragraph("ECONOMIC IMPACT ANALYSIS", cover_banner_style))
    # Decorative thin rule under the banner.
    story.append(HRFlowable(
        width="40%", thickness=1.2,
        color=colors.HexColor('#1a365d'),
        spaceBefore=0, spaceAfter=18, hAlign='CENTER',
    ))
    story.append(Paragraph(_pdf_safe(project_title), cover_project_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f"Project Proponent: {_pdf_safe(client_name)}", cover_proponent_style))
    story.append(Spacer(1, 0.7 * inch))
    story.append(Paragraph(subtitle, cover_subtitle_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(doctype_text, cover_doctype_style))
    story.append(Spacer(1, 1.0 * inch))
    story.append(HRFlowable(
        width="25%", thickness=0.8,
        color=colors.HexColor('#999999'),
        spaceBefore=0, spaceAfter=12, hAlign='CENTER',
    ))
    story.append(Paragraph(cover_date_text, cover_date_style))
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph(legal_text, cover_legal_style))
    story.append(PageBreak())

    lines = content.split('\n')
    current_list = []
    in_table = False
    table_rows = []

    def flush_list():
        nonlocal current_list
        if current_list:
            for item in current_list:
                story.append(Paragraph('• ' + convert_bold(item), body_style))
            current_list = []

    def flush_table():
        nonlocal table_rows, in_table
        if table_rows:
            try:
                col_count = max(len(r) for r in table_rows)
                padded = [r + [''] * (col_count - len(r)) for r in table_rows]
                table_data = [[Paragraph(cell, body_style) for cell in row] for row in padded]
                col_w = doc.width / col_count
                t = Table(table_data, colWidths=[col_w] * col_count)
                t.setStyle(TableStyle([
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8e8e8')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('PADDING', (0, 0), (-1, -1), 4),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                ]))
                story.append(t)
                story.append(Spacer(1, 0.15 * inch))
            except Exception:
                pass
            table_rows = []
            in_table = False

    def _safe_paragraph(html_text, style, fallback_text=None):
        """Append a Paragraph with fallback to plain text if ReportLab fails to parse."""
        try:
            story.append(Paragraph(html_text, style))
        except Exception as _p_err:
            logger.warning(f"⚠️ Paragraph render failed ('{str(_p_err)[:80]}'), using plain text fallback")
            try:
                plain = re.sub(r'<[^>]+>', '', html_text)
                plain = _pdf_safe(plain)
                story.append(Paragraph(plain, style))
            except Exception:
                if fallback_text:
                    story.append(Paragraph(_pdf_safe(fallback_text), body_style))

    for line in lines:
        ls = line.strip()

        # ── Tables ───────────────────────────────────────────────────────────
        if ls.startswith('|') and ls.endswith('|'):
            if re.match(r'^\|[\s\-:|]+\|$', ls):  # separator row
                continue
            flush_list()
            cells = [convert_bold(cell.strip()) for cell in ls.split('|')[1:-1]]
            table_rows.append(cells)
            in_table = True
            continue
        elif in_table:
            flush_table()

        if not ls:
            continue

        # ── Equation blocks (pre-processed) ──────────────────────────────────
        if ls.startswith('EQUATION:'):
            flush_list()
            eq_text = _pdf_safe(ls[9:].strip())
            _safe_paragraph(eq_text, equation_style, ls[9:].strip())
            continue

        # ── Headings (robust: match any combination of # followed by optional
        #    whitespace; tolerates missing space, tabs, multiple spaces, etc.)
        #    Order: check from longest (6 #) to shortest (1 #) to avoid
        #    misclassifying "### " as "## ").
        _heading_match = re.match(r'^(#{1,6})\s*(.+?)\s*$', ls)
        if _heading_match:
            hashes, heading_text = _heading_match.groups()
            flush_list()
            heading_text = heading_text.lstrip('#').strip()  # extra # if any
            html = convert_bold(heading_text)
            if len(hashes) == 1:
                _safe_paragraph(html, h1_style, heading_text)
            elif len(hashes) == 2:
                _safe_paragraph(html, h2_style, heading_text)
            elif len(hashes) == 3:
                _safe_paragraph(html, h3_style, heading_text)
            else:  # 4, 5 or 6
                _safe_paragraph(html, h4_style, heading_text)

        # ── List items ───────────────────────────────────────────────────────
        elif ls.startswith('- ') or ls.startswith('* '):
            current_list.append(ls[2:])

        # ── Horizontal rule ──────────────────────────────────────────────────
        # ── Markdown horizontal rule (---/***/___/===) → DROP entirely ──────
        # User explicitly requested no horizontal divider lines in the PDF.
        # Section headings already give visual structure.
        elif re.match(r'^[-_=]{3,}\s*$', ls) or re.match(r'^\*{3,}\s*$', ls):
            flush_list()
            continue

        # ── Drop weak standalone separators "..." / "…" ──────────────────────
        elif ls in ('...', '…'):
            flush_list()
            continue

        # ── Regular paragraph ────────────────────────────────────────────────
        else:
            flush_list()
            _safe_paragraph(convert_bold(ls), body_style, ls)

    flush_list()
    flush_table()

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


# ──────────────────────────────────────────────
# Router and endpoints
# ──────────────────────────────────────────────

router = APIRouter(prefix="/policy-papers", tags=["Policy Papers"])


@router.post("/generate")
async def generate_policy_paper(
    file: UploadFile = File(..., description="Project description document"),
    client_id: str = Form(None),
    background_tasks: BackgroundTasks = None,
    current_user=Depends(get_current_user_wrapper),
):
    """Generate a comprehensive social impact report / policy paper — async background processing."""
    db = get_db()
    paper_id = str(uuid.uuid4())
    logger.info(f"📊 Initiating policy paper generation from: {file.filename}")

    try:
        content = await file.read()
        doc_text = content.decode('utf-8', errors='ignore')

        MAX_DOC_CHARS = 40000
        if len(doc_text) > MAX_DOC_CHARS:
            logger.warning(f"⚠️ Document truncated from {len(doc_text)} to {MAX_DOC_CHARS} chars")
            doc_text = doc_text[:MAX_DOC_CHARS] + "\n...[contenido truncado]..."

        author_name = "Project Lead"
        client_name_for_title = ""
        if client_id:
            client = await db.clients.find_one({"id": client_id}, {"_id": 0, "name": 1})
            if client and client.get('name'):
                author_name = client['name']
                client_name_for_title = client['name']

        project_title = f"{client_name_for_title} - National Interest Project" if client_name_for_title else "National Interest Project"
        try:
            if "Title:" in doc_text:
                extracted = doc_text.split("Title:")[1].split("\n")[0].strip()
                if extracted:
                    project_title = f"{client_name_for_title} - {extracted}" if client_name_for_title else extracted
            elif "Project:" in doc_text:
                extracted = doc_text.split("Project:")[1].split("\n")[0].strip()
                if extracted:
                    project_title = f"{client_name_for_title} - {extracted}" if client_name_for_title else extracted
        except Exception:
            pass

        paper_doc = {
            "id": paper_id,
            "user_id": current_user.id,
            "client_id": client_id,
            "project_title": project_title,
            "author_name": author_name,
            "filename": file.filename,
            "doc_text": doc_text,
            "content_en": "",
            "content_es": "",
            "current_language": "en",
            "status": "generating",
            "progress": 0,
            "progress_message": "Iniciando generación...",
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        await db.policy_papers.insert_one(paper_doc)
        logger.info(f"✅ Policy paper record created: {paper_id}")

        background_tasks.add_task(generate_policy_paper_background, paper_id)

        return {
            "paper_id": paper_id,
            "project_title": project_title,
            "status": "generating",
            "message": "Generación iniciada. El proceso puede tomar 5-10 minutos."
        }

    except Exception as e:
        logger.error(f"❌ Error initiating policy paper: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{paper_id}/status")
async def get_policy_paper_status(paper_id: str, current_user=Depends(get_current_user_wrapper)):
    """Get the generation status of a policy paper."""
    db = get_db()
    try:
        paper = await db.policy_papers.find_one(
            {"id": paper_id},
            {"_id": 0, "id": 1, "status": 1, "progress": 1, "progress_message": 1, "error_message": 1}
        )
        if not paper:
            raise HTTPException(status_code=404, detail="Policy paper not found")
        return {
            "id": paper.get('id'),
            "status": paper.get('status'),
            "progress": paper.get('progress', 0),
            "progress_message": paper.get('progress_message', ''),
            "error_message": paper.get('error_message')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting policy paper status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{paper_id}/retry")
async def retry_policy_paper_generation(
    paper_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_wrapper),
):
    """Retry policy paper generation — smart retry based on what already exists."""
    db = get_db()
    try:
        paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
        if not paper:
            raise HTTPException(status_code=404, detail="Policy paper not found")

        content_en = paper.get('content_en', '')

        # 🐛 FIX: ALWAYS bump `updated_at` on retry. The frontend marks any
        # document whose `updated_at` is >20 min old AND whose status is
        # 'generating' as "Atascado". If we don't refresh the timestamp here,
        # the UI immediately re-classifies the doc as stuck the moment the
        # paper-list reloads, even though the background task is genuinely
        # running. The user perceives this as "retry didn't start".
        now_iso = datetime.now(timezone.utc).isoformat()

        if len(content_en) > 500:
            logger.info(f"🔄 Retrying translation only for {paper_id}")
            await db.policy_papers.update_one(
                {"id": paper_id},
                {"$set": {
                    "status": "generating",
                    "progress": 60,
                    "progress_message": "Reintentando traducción al español...",
                    "error_message": None,
                    "updated_at": now_iso,
                }}
            )
            background_tasks.add_task(retry_policy_paper_translation, paper_id, content_en)
            return {"paper_id": paper_id, "status": "generating", "message": "Reintentando traducción"}
        else:
            logger.info(f"🔄 Full regeneration for {paper_id}")
            await db.policy_papers.update_one(
                {"id": paper_id},
                {"$set": {
                    "status": "generating",
                    "progress": 0,
                    "progress_message": "Regenerando reporte completo...",
                    "error_message": None,
                    "updated_at": now_iso,
                }}
            )
            background_tasks.add_task(generate_policy_paper_background, paper_id)
            return {"paper_id": paper_id, "status": "generating", "message": "Regeneración completa iniciada"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying policy paper: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_policy_papers(
    client_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user_wrapper),
):
    """Get all policy papers."""
    db = get_db()
    query = {"status": {"$ne": "deleted"}}
    if client_id:
        query["client_id"] = client_id
    papers = await db.policy_papers.find(query, {"_id": 0}).to_list(1000)
    return {"policy_papers": papers}


@router.get("/{paper_id}")
async def get_policy_paper(paper_id: str, current_user=Depends(get_current_user_wrapper)):
    """Get a specific policy paper."""
    db = get_db()
    paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
    if not paper:
        raise HTTPException(status_code=404, detail="Policy paper not found")
    return paper


@router.get("/{paper_id}/download")
async def download_policy_paper_pdf(
    paper_id: str,
    language: str = Query("en"),
    current_user=Depends(get_current_user_wrapper),
):
    """Download policy paper as PDF."""
    db = get_db()
    try:
        paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
        if not paper:
            raise HTTPException(status_code=404, detail="Policy paper not found")

        content = paper.get(f"content_{language}")
        if not content:
            raise HTTPException(status_code=404, detail=f"Content in {language} not available")

        content = clean_word_counts(content)

        client_id = paper.get('client_id')
        client_name = "Client"
        if client_id:
            client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0, "name": 1})
            if client_doc:
                client_name = client_doc.get('name', 'Client')

        author_name = paper.get('author_name', client_name)
        project_title = paper.get('project_title', 'Economic Impact Analysis')

        pdf_bytes = _generate_policy_paper_pdf(content, project_title, client_name, author_name, language)

        safe_client = re.sub(r'[^\w\s-]', '', client_name).strip().replace(' ', '_')
        filename = f"Social_Impact_Report_{safe_client}_{language.upper()}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"❌ Error generating policy paper PDF for {paper_id} (lang={language}): {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)[:200]}")


@router.get("/{paper_id}/download-docx")
async def download_policy_paper_docx(
    paper_id: str,
    language: str = Query("en"),
    current_user=Depends(get_current_user_wrapper),
):
    """Download policy paper as Microsoft Word (.docx).

    Native Word format imports cleanly into Google Docs preserving
    headings, tables, lists, bold/italic — so users can edit their
    generated reports without losing formatting (which they would lose
    if they tried to convert the PDF to Google Docs)."""
    from docx_utils import build_docx_response

    db = get_db()
    paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
    if not paper:
        raise HTTPException(status_code=404, detail="Policy paper not found")
    content = paper.get(f"content_{language}")
    if not content:
        raise HTTPException(status_code=404, detail=f"Content in {language} not available")
    content = clean_word_counts(content)

    client_id = paper.get('client_id')
    client_name = "Client"
    if client_id:
        client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0, "name": 1})
        if client_doc:
            client_name = client_doc.get('name', 'Client')
    project_title = paper.get('project_title', 'Economic Impact Analysis')

    safe_client = re.sub(r'[^\w\s-]', '', client_name).strip().replace(' ', '_')

    if language == 'es':
        cover_subtitle = "Análisis Prong 1: Mérito Sustancial e Importancia Nacional"
        legal_ref = ("Preparado conforme a Matter of Dhanasar, 26 I&N Dec. 884 "
                     "(AAO 2016) — Documento de Apoyo para Petición EB-2 NIW")
    else:
        cover_subtitle = "Prong 1 Analysis: Substantial Merit & National Importance"
        legal_ref = ("Prepared pursuant to Matter of Dhanasar, 26 I&N Dec. 884 "
                     "(AAO 2016) — EB-2 NIW Petition Supporting Document")

    return build_docx_response(
        content=content,
        title=project_title,
        filename_stem=f"Social_Impact_Report_{safe_client}",
        doc_type="Economic Impact Analysis" if language == 'en' else "Análisis de Impacto Económico",
        author=client_name,
        language=language,
        cover_subtitle=cover_subtitle,
        legal_reference=legal_ref,
    )


@router.delete("/{paper_id}")
async def delete_policy_paper(paper_id: str, current_user=Depends(get_current_user_wrapper)):
    """Soft delete policy paper."""
    db = get_db()
    try:
        paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
        if not paper:
            raise HTTPException(status_code=404, detail="Policy paper not found")

        result = await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "status": "deleted",
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": current_user.id
            }}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to delete policy paper")

        return {"message": "Policy paper movido a la papelera"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting policy paper: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{paper_id}/evaluate-coherence")
async def evaluate_policy_paper_coherence(
    paper_id: str,
    current_user=Depends(get_current_user_wrapper),
):
    """Re-evalúa la coherencia de un policy paper."""
    db = get_db()
    try:
        paper = await db.policy_papers.find_one({"id": paper_id}, {"_id": 0})
        if not paper:
            raise HTTPException(status_code=404, detail="Policy paper not found")

        doc_text = paper.get('doc_text', '')
        content_en = paper.get('content_en', '')
        content_es = paper.get('content_es', '')
        author_name = paper.get('author_name', '')

        logger.info(f"🔍 [RE-EVAL] Policy paper {paper_id}: doc_text length={len(doc_text) if doc_text else 0}")

        evaluation_project_desc = await _extract_binary_pdf_text(doc_text, paper_id)
        if not evaluation_project_desc and content_en:
            evaluation_project_desc = f"[Generated from project document]\n{content_en[:2000]}"
        if not evaluation_project_desc:
            raise HTTPException(status_code=400, detail="No hay contenido disponible para evaluar")

        document_content = content_es[:4000] if content_es else content_en[:4000]
        if not document_content:
            raise HTTPException(status_code=400, detail="El policy paper no tiene contenido generado")

        coherence_evaluation = await _evaluate_document_coherence(
            document_content=document_content,
            author_name=author_name,
            author_cv='',
            project_description=evaluation_project_desc,
            patent_info='',
            document_type="reporte de impacto social"
        )
        logger.info(f"✅ [RE-EVAL] Coherence score: {coherence_evaluation.get('coherence_score', 0)}")

        await db.policy_papers.update_one(
            {"id": paper_id},
            {"$set": {
                "coherence_evaluation": coherence_evaluation,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        return {
            "paper_id": paper_id,
            "coherence_evaluation": coherence_evaluation,
            "message": "Evaluación de coherencia completada"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [RE-EVAL] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
