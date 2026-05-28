"""
Intent Letters Router — Cartas de Intención / Personal Statement EB-2 NIW
Written in first person by the petitioner, following Matter of Dhanasar 3-prong framework.
"""

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import docx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PyPDF2 import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from fastapi.responses import StreamingResponse
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intent-letters", tags=["Intent Letters"])

# ── Injected at startup ────────────────────────────────────────────────────────
_db = None
_get_current_user = None
_call_openai_gpt4o = None
_call_gemini_flash_lite = None
_call_openai_gpt5 = None


def init_router(db, get_current_user_fn, call_openai_gpt4o_fn,
                call_gemini_flash_lite_fn, call_openai_gpt5_fn):
    global _db, _get_current_user, _call_openai_gpt4o, _call_gemini_flash_lite, _call_openai_gpt5
    _db = db
    _get_current_user = get_current_user_fn
    _call_openai_gpt4o = call_openai_gpt4o_fn
    _call_gemini_flash_lite = call_gemini_flash_lite_fn
    _call_openai_gpt5 = call_openai_gpt5_fn


def _get_db():
    return _db


async def get_current_user_wrapper(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    if _get_current_user is None:
        raise RuntimeError("get_current_user not initialized.")
    return await _get_current_user(credentials)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_text(content: bytes, filename: str) -> str:
    """Extract plain text from PDF, DOCX or TXT bytes."""
    fn = filename.lower()
    if fn.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    elif fn.endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    else:
        return content.decode("utf-8", errors="ignore")


def _parse_json_safe(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {}


ANTI_PLACEHOLDER_RULE = """
CRITICAL ANTI-PLACEHOLDER RULE:
Never write placeholder text like [INSERT DATA], [TO BE DETERMINED], [SPECIFIC METRIC],
[ORGANIZATION NAME], [YEAR], [PERCENTAGE], [CITY], [SOURCE], or ANY text inside brackets
that signals missing data. If you lack a specific value, derive a realistic, context-appropriate
estimate from the documents provided, or omit the detail entirely. Every bracket in the final
output is a disqualifying defect. Write as if submitting directly to USCIS today.
"""

INTENT_LETTER_SYSTEM_PROMPT = """You are a senior U.S. immigration attorney with 20+ years of experience
writing personal statements for EB-2 NIW I-140 petitions. You draft compelling, evidence-based
first-person narratives that follow the Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) framework.
Your letters are approved at a 95%+ rate. You write in formal, precise, legal-grade English,
always grounding claims in specific achievements, metrics, and national-level evidence.
You never fabricate statistics; you derive realistic figures from the documents provided.

⚠️ ABSOLUTE OUTPUT RULE — ZERO SQUARE BRACKETS IN THE LETTER:
NEVER write text inside square brackets [like this] in the final letter output.
Replace every data point with real extracted information. If unavailable, write naturally without it.
WRONG: "I hold a [degree] from [University]" — CORRECT: "I hold a Ph.D. in Biomedical Engineering from Johns Hopkins University"
"""


# ── Background generation ──────────────────────────────────────────────────────

async def _generate_intent_letter_background(
    letter_id: str,
    cv_bytes: bytes, cv_filename: str,
    project_bytes: bytes, project_filename: str,
    support_bytes: Optional[bytes], support_filename: Optional[str],
    signer_bytes: Optional[bytes], signer_filename: Optional[str],
    today_str: str, client_id: Optional[str], user_id: str
):
    db = _get_db()

    async def _update(pct: int, msg: str, extra: dict = None):
        upd = {
            "progress_percentage": pct,
            "progress_message": msg,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if extra:
            upd.update(extra)
        await db.intent_letters.update_one({"id": letter_id}, {"$set": upd})

    try:
        # ── Step 1: Extract text ────────────────────────────────────────────────
        await _update(10, "Extrayendo texto de los documentos...")
        cv_text = _extract_text(cv_bytes, cv_filename)
        project_text = _extract_text(project_bytes, project_filename)
        support_text = _extract_text(support_bytes, support_filename) if support_bytes else ""
        signer_text = _extract_text(signer_bytes, signer_filename) if signer_bytes else ""

        # ── Step 2: Analyze all documents ──────────────────────────────────────
        await _update(25, "Analizando perfil y proyecto con IA...")

        # Build SIGNER section only when a signer CV was provided; when absent
        # (petitioner self-signs), omit it so the LLM doesn't invent credentials.
        signer_block = (
            f"\n**SIGNER CV (person who will sign the letter — may be the "
            f"petitioner themselves or a third party such as an employer, "
            f"investor, or client):**\n{signer_text[:6000]}\n"
            if signer_text else ""
        )

        analysis_prompt = f"""Analyze the following documents and extract structured information
for an EB-2 NIW personal statement (intent letter). Return ONLY valid JSON.

**PETITIONER CV:**
{cv_text[:8000]}

**PROJECT DESCRIPTION:**
{project_text[:8000]}

**SUPPORTING DOCUMENTS (if any):**
{support_text[:4000]}
{signer_block}
Return this JSON structure:
{{
  "petitioner_name": "Full name",
  "petitioner_field": "Specific technical domain (e.g., Healthcare AI, Cybersecurity)",
  "petitioner_degree": "Highest degree and institution",
  "petitioner_position": "Current title and organization",
  "years_experience": "Years of experience in the field",
  "key_achievements": "Publications, patents, awards, grants with specific numbers",
  "unique_skills": "3-4 rare skill combinations not common in U.S. workforce",
  "project_title": "Official project title",
  "project_description": "Detailed technical description of the proposed endeavor",
  "national_importance": "Why this work matters at the U.S. national level (not just local/regional)",
  "prong1_evidence": "Specific data points supporting substantial merit and national importance",
  "prong2_evidence": "Track record, milestones, collaborators proving petitioner is well-positioned",
  "prong3_argument": "Why waiving labor certification benefits the U.S. more than standard process",
  "federal_alignment": "Specific U.S. federal laws, executive orders, or national priorities this addresses",
  "economic_impact": "Quantified economic or social impact (jobs, cost savings, revenue, users)",
  "geographic_reach": "Number of states, organizations, or beneficiaries affected",
  "future_plan": "Concrete 3-5 year execution plan with milestones and partnerships",
  "signer_name": "Full name of the person who will sign the letter (from SIGNER CV if provided, else from PETITIONER CV)",
  "signer_title": "Professional title and organization of the signer",
  "signer_credentials": "Key qualifications of the signer (degree, years of experience, awards, publications)",
  "signer_relationship": "Relationship of the signer to the petitioner. A Letter of Intent in EB-2 NIW is MOST COMMONLY signed by an INVESTOR committing capital. Use 'investor' as the DEFAULT unless the signer's CV clearly indicates another role. Allowed values: 'investor' (default — venture capitalist, angel investor, private equity, family office, or any individual/entity committing funds), 'employer' (only if the signer's CV explicitly shows HR/CEO/founder hiring authority AND there is a concrete job offer), 'client' (only if signer leads a purchasing organization with a concrete contract), 'academic_advisor' (only if signer is a research PI at a university), 'business_partner' (co-founder/partner), 'collaborator' (last resort)",
  "signer_commitment": "The specific commitment. If investor: investment amount (USD), equity stake, funding round, use of funds, milestones. If employer: job title, salary, start date, responsibilities. If client: contract value, duration, scope. Extract the EXACT numbers/terms from the SIGNER CV or supporting documents — never invent amounts."
}}"""

        analysis_raw = await asyncio.wait_for(
            _call_openai_gpt4o(
                "You are an expert document analyst. Return only valid JSON.",
                analysis_prompt, temperature=0.2, max_tokens=3000
            ),
            timeout=120.0
        )
        extracted = _parse_json_safe(analysis_raw)
        if not extracted:
            raise ValueError("Could not parse document analysis response")

        petitioner_name = extracted.get("petitioner_name", "the Petitioner")
        signer_name = extracted.get("signer_name") or "the Signer"
        signer_title = extracted.get("signer_title", "") or ""
        signer_credentials = extracted.get("signer_credentials", "") or ""
        signer_relationship = (extracted.get("signer_relationship") or "investor").strip().lower()
        signer_commitment = extracted.get("signer_commitment", "") or ""
        # A Letter of Intent is most commonly signed by an INVESTOR committing
        # capital to the petitioner's endeavor. If the analysis yields an
        # ambiguous relationship ("self"/"petitioner"/empty), default to
        # "investor" rather than a generic "collaborator" to produce the
        # strongest, most USCIS-relevant commitment paragraph.
        if signer_relationship in ("self", "", "petitioner"):
            signer_relationship = "investor"

        # ── Step 3: Generate English Letter of Intent (third-party) ────────────
        await _update(45, "Redactando Letter of Intent en inglés...")

        # Signer is always a third party (employer/investor/client/etc).
        # The letter is written in THIRD PERSON from the signer's voice,
        # expressing a concrete commitment to the petitioner's endeavor.
        rel_label = {
            "employer": "prospective U.S. employer",
            "investor": "prospective investor",
            "client": "client / business partner",
            "academic_advisor": "academic advisor / research collaborator",
            "business_partner": "business partner",
            "collaborator": "professional collaborator",
        }.get(signer_relationship, "professional collaborator")
        signer_section = f"""
## SIGNER INFORMATION (the person who will SIGN this Letter of Intent — NOT the petitioner):
- Signer Name: {signer_name}
- Signer Title/Organization: {signer_title}
- Signer Credentials: {signer_credentials}
- Relationship to Petitioner: {rel_label}
- Specific Commitment to Petitioner: {signer_commitment}

The letter MUST be written in THIRD PERSON from the perspective of the signer,
who is expressing a concrete, actionable commitment to the petitioner's
U.S.-based endeavor. The signer's own CV is attached to the petition as an
enclosure — reference it at the end of the letter as
"Enclosed: curriculum vitae of {signer_name}".
"""
        voice_instructions = (
            f"Write entirely in THIRD PERSON from the signer's voice ({signer_name}, {signer_title}). "
            f"Refer to the petitioner as \"{petitioner_name}\" or \"Mr./Ms./Dr. [Last name]\". "
            f"Do NOT use \"I\" to mean the petitioner. Do NOT write as if the petitioner is speaking."
        )
        # Pick a writing-style profile for the signer (60/40 weighted), plus a
        # randomized sign-off compatible with the profile mood, a "style salt"
        # to break LLM caching, and a randomized temperature. These four
        # together make two letters by the same signer look distinctly
        # different — no more "all letters read the same".
        from letter_format_profiles import (
            pick_profile_for_signer,
            pick_sign_off,
            make_style_salt,
            pick_temperature,
        )
        format_profile = pick_profile_for_signer(
            f"{signer_title} {signer_credentials}",
            random_ratio=0.4,
        )
        chosen_sign_off = pick_sign_off(format_profile)
        style_salt = make_style_salt()
        gen_temperature = pick_temperature()

        signature_block = (
            f'"{chosen_sign_off}\\n{signer_name}\\n{signer_title}\\n'
            f'[email/phone if present in signer CV]\\n'
            f'Enclosed: curriculum vitae of {signer_name}"'
        )
        paragraph_count_hint = "8-11 flowing paragraphs (LOIs are focused and concise)"

        generation_prompt = f"""Generate a complete, professional EB-2 NIW Letter of Intent (third-party)
following the Matter of Dhanasar framework. The letter is SIGNED BY A THIRD PARTY
(employer/investor/client/collaborator) who SUPPORTS the petitioner.

{style_salt}

{format_profile['prompt_instructions']}

**TODAY'S DATE:** {today_str}
**PETITIONER:** {petitioner_name}
**SIGNER:** {signer_name} ({signer_relationship})

{ANTI_PLACEHOLDER_RULE}

---
## PETITIONER INFORMATION:
- Name: {extracted.get('petitioner_name')}
- Field: {extracted.get('petitioner_field')}
- Degree: {extracted.get('petitioner_degree')}
- Current Position: {extracted.get('petitioner_position')}
- Years of Experience: {extracted.get('years_experience')}
- Key Achievements: {extracted.get('key_achievements')}
- Unique Skills: {extracted.get('unique_skills')}

## PROPOSED ENDEAVOR:
- Project Title: {extracted.get('project_title')}
- Description: {extracted.get('project_description')}
- National Importance: {extracted.get('national_importance')}
- Federal Alignment: {extracted.get('federal_alignment')}
- Economic/Social Impact: {extracted.get('economic_impact')}
- Geographic Reach: {extracted.get('geographic_reach')}
- Future Plan: {extracted.get('future_plan')}

## EVIDENCE:
- Prong 1 Evidence: {extracted.get('prong1_evidence')}
- Prong 2 Evidence: {extracted.get('prong2_evidence')}
- Prong 3 Argument: {extracted.get('prong3_argument')}
{signer_section}
---
## VOICE & PERSPECTIVE:
{voice_instructions}

## MANDATORY FORMAT — Flowing letter (NO section headers):

CRITICAL FORMAT RULES:
- Write as a continuous letter with {paragraph_count_hint}.
- DO NOT use section titles, section numbers, or heading-style text of any kind.
- DO NOT label sections as "I.", "II.", "SECTION 1", "PRONG 1:", "CONCLUSION:", or similar.
- DO NOT use <h1>, <h2>, <h3>, <h4>, or any HTML heading tags.
- Use ONLY <p> tags for all paragraph content.
- Use <strong> only for metrics or key terms WITHIN a paragraph, never as a standalone title.
- Do NOT insert empty <p> or <br> tags between paragraphs.
- The letter reads as a continuous professional narrative — not a formatted document.

LETTER CONTENT (one paragraph per item — signer's voice in THIRD PERSON, no titles):

Paragraph 1 (Header + Introduction): Write date ({today_str}), USCIS service center address. Then: "Re: Letter of Intent in Support of EB-2 National Interest Waiver Petition for {petitioner_name}". Salutation: "Dear USCIS Adjudicating Officer:". The SIGNER introduces themselves: full name, title, organization, and briefly the nature of their authority/credentials (reference the attached CV). State the purpose: "I am writing to formally express my organization's intent to [commit/invest/hire/collaborate with] {petitioner_name} in connection with [the endeavor]." Cite Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).

Paragraph 2 (Signer's Qualifications): Describe the signer's expertise, role, and authority to make this commitment. Years of experience, relevant track record, portfolio/role highlights. Close with: "My full credentials are set forth in the attached curriculum vitae."

Paragraph 3 (Relationship & How the Signer Knows the Petitioner): How the signer came to know the petitioner's work — publications, prior collaboration, proposal review, introduction by mutual colleague. Establish credibility of the assessment.

Paragraph 4 (Assessment of the Petitioner's Endeavor): The signer's technical/business assessment of the petitioner's proposed endeavor. Substance, feasibility, alignment with market/federal priorities.

Paragraph 5 (National Importance + Federal Alignment): Why this endeavor matters at the NATIONAL level. Cite specific U.S. federal laws/programs and a government statistic. Close with: Prong 1 of Matter of Dhanasar, 26 I&N Dec. 884 is satisfied.

Paragraph 6 (Specific Commitment — the core of the LOI): THE MOST IMPORTANT PARAGRAPH. Describe the SPECIFIC, ACTIONABLE commitment in full detail. If employer: exact job title, salary, start date, responsibilities, number of U.S. jobs created. If investor: investment amount, terms, equity stake, use of funds. If client: contract value, duration, scope of work, economic impact. Use ONLY the specifics from "Specific Commitment to Petitioner" in the provided data — no placeholders.

Paragraph 7 (Petitioner Well-Positioned — Prong 2): Specific reasons why the petitioner is well-positioned: past achievements (with metrics), publications, patents, awards. Based on the signer's own evaluation. Close with: Prong 2 of Matter of Dhanasar is satisfied.

Paragraph 8 (Economic/Social Impact + Prong 3): Why waiving labor certification serves the national interest more than the standard process. Concrete economic multiplier: jobs supported, revenue projected, beneficiaries. Close with: Prong 3 of Matter of Dhanasar is satisfied.

Paragraph 9 (Conclusion + Exhibit List): Strong endorsement: "Based on {signer_name}'s professional assessment, {petitioner_name}'s endeavor serves the U.S. national interest and warrants the granting of the National Interest Waiver." List 2-3 key exhibits (the commitment itself, the signer's CV, any prior documented collaboration). Close with: {signature_block}

---
## CRITICAL REQUIREMENTS:
1. Cite "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)" in the letter.
2. Use {today_str} as the letter date.
3. Replace ALL placeholder text — ZERO brackets in output.
4. Length: 1,500–2,500 words (LOIs are focused and concise).
5. All metrics must include: baseline + result + % change + time period + beneficiaries.
6. OUTPUT FORMAT: ONLY <p> tags. NEVER use <h1>, <h2>, <h3>, <h4>. No HTML heading tags whatsoever."""

        from llm_fallback import call_llm_with_fallback
        letter_content_en = await call_llm_with_fallback(
            system_prompt=INTENT_LETTER_SYSTEM_PROMPT + ANTI_PLACEHOLDER_RULE,
            user_prompt=generation_prompt,
            primary_gemini_fn=_call_gemini_flash_lite,
            temperature=gen_temperature,
            max_tokens=10000,
            min_chars=500,
            label=f"intent-letter/{letter_id[:8]}",
            timeout_secs=180.0,
        )
        logger.info(
            f"🎨 intent letter generated | profile={format_profile['id']} "
            f"sign_off={chosen_sign_off!r} temp={gen_temperature}"
        )

        # ── Step 4: Translate to Spanish ───────────────────────────────────────
        await _update(80, "Traduciendo al español...")

        translation_prompt = f"""Translate this EB-2 NIW personal statement from English to Spanish.
Maintain ALL formatting (HTML tags, section numbers, bold markers).
Keep proper nouns in English: Matter of Dhanasar, institution names, agency names,
law names (H.R./P.L. numbers), USCIS, EB-2 NIW, Form I-140.
Use formal Spanish (usted form for addressing USCIS, first person for petitioner).
Spanish date format: "10 de abril de 2026".

ENGLISH LETTER:
{letter_content_en}

Provide ONLY the Spanish translation, no explanations."""

        letter_content_es = await asyncio.wait_for(
            _call_openai_gpt4o(
                "You are a professional legal translator specializing in U.S. immigration documents. "
                "Translate accurately while preserving all HTML formatting.",
                translation_prompt, temperature=0.2, max_tokens=8000
            ),
            timeout=150.0
        )

        # Clean placeholder remnants
        def _clean(txt):
            """Aggressively remove ALL [PLACEHOLDER] patterns from generated letters."""
            if not txt:
                return txt
            # Strip markdown code fences — plain AND wrapped in <p> tags
            txt = txt.strip()
            txt = re.sub(r'^```(?:html|markdown)?\s*\n?', '', txt)
            txt = re.sub(r'\n?```\s*$', '', txt.strip())
            txt = re.sub(r'<p>\s*```+\s*(?:html|markdown)?\s*</p>\s*', '', txt, flags=re.IGNORECASE)
            # Replace date placeholders
            for dp in [r'\[DATE\]', r'\[TODAY\]', r'\[CURRENT\s+DATE\]', r'\[Month,?\s*Year\]',
                       r'\[Month\s+DD,?\s*YYYY\]', r'\[Month\s+\w+,?\s*\d{4}\]']:
                txt = re.sub(dp, today_str, txt, flags=re.IGNORECASE)
            # Remove entire lines that are solely a placeholder
            lines = [ln for ln in txt.split('\n') if not re.match(r'^\s*\[[^\[\]]+\]\s*$', ln)]
            txt = '\n'.join(lines)
            # Remove ALL remaining [bracket content] — any length, any case
            txt = re.sub(r'\[[^\[\]]+\]', lambda m: m.group(0) if re.match(r'^\[\d\]$', m.group(0)) else '', txt)
            # Remove empty <p> tags
            txt = re.sub(r'<p>\s*</p>', '', txt)
            # Fix sentence artifacts
            txt = re.sub(r'  +', ' ', txt)
            txt = re.sub(r' ([,.:;])', r'\1', txt)
            txt = re.sub(r',\s*,', ',', txt)
            txt = re.sub(r'\(\s*\)', '', txt)
            txt = re.sub(r'\n{3,}', '\n\n', txt)
            txt = re.sub(r'including\s*[,.]', 'including relevant professional associations.', txt, flags=re.IGNORECASE)
            txt = re.sub(r'member of\s*[,.]', 'member of several professional organizations.', txt, flags=re.IGNORECASE)
            return txt

        letter_content_en = _clean(letter_content_en)
        letter_content_es = _clean(letter_content_es or letter_content_en)

        await _update(100, "Carta de intención generada exitosamente", {
            "status": "completed",
            "petitioner_name": petitioner_name,
            "petitioner_field": extracted.get("petitioner_field", ""),
            "project_title": extracted.get("project_title", ""),
            "letter_mode": "third_party_loi",
            "signer_name": signer_name,
            "signer_title": signer_title,
            "signer_relationship": signer_relationship,
            "signer_commitment": signer_commitment,
            "content_en": letter_content_en,
            "content_es": letter_content_es,
            "extracted_data": extracted,
            # Persist the chosen visual profile so the PDF download uses the
            # same fonts/margins/section style as the text was written for.
            "format_profile_id": format_profile["id"],
        })
        logger.info(f"✅ Intent letter {letter_id} completed")

    except Exception as e:
        logger.error(f"❌ Intent letter background failed {letter_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        db = _get_db()
        await db.intent_letters.update_one(
            {"id": letter_id},
            {"$set": {
                "status": "error",
                "error_message": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_intent_letter(
    background_tasks: BackgroundTasks,
    petitioner_cv: UploadFile = File(..., description="CV del Peticionario / Cliente (obligatorio)"),
    project_info: UploadFile = File(..., description="Descripción del Proyecto (obligatorio)"),
    signer_cv: UploadFile = File(..., description="CV del Firmante (obligatorio) — empleador, inversor, cliente o colaborador que apoya al peticionario"),
    support_document: Optional[UploadFile] = File(None, description="Documento de apoyo (opcional: patente, publicación, etc.)"),
    client_id: Optional[str] = Form(None),
    current_user=Depends(get_current_user_wrapper)
):
    """
    Generate a complete EB-2 NIW Letter of Intent — ALWAYS signed by a third
    party (employer, investor, client, academic advisor, or collaborator) who
    supports the petitioner's endeavor. The signer's CV is mandatory because
    the letter relies on the signer's own credentials to lend weight to the
    commitment.

    Generated in third person from the signer's voice, 8-11 paragraphs,
    1,500–2,500 words, with a mandatory "Specific Commitment" paragraph
    tailored to the signer's relationship and tied to the 3 Dhanasar prongs.

    Returns immediately with letter_id and status='generating'. Poll GET /intent-letters/{id}.
    """
    db = _get_db()
    letter_id = str(uuid.uuid4())
    today_str = datetime.now().strftime("%B %d, %Y")

    cv_bytes = await petitioner_cv.read()
    project_bytes = await project_info.read()
    signer_bytes = await signer_cv.read()
    signer_filename = signer_cv.filename
    support_bytes = await support_document.read() if support_document else None
    support_filename = support_document.filename if support_document else None

    letter_doc = {
        "id": letter_id,
        "user_id": current_user.id,
        "client_id": client_id,
        "petitioner_name": "",
        "petitioner_field": "",
        "project_title": "",
        "visa_type": "EB-2 NIW",
        "letter_mode": "third_party_loi",
        "signer_name": "",
        "signer_title": "",
        "signer_relationship": "",
        "content_en": "",
        "content_es": "",
        "status": "generating",
        "progress_percentage": 5,
        "progress_message": "Iniciando generación...",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.intent_letters.insert_one(letter_doc)

    background_tasks.add_task(
        _generate_intent_letter_background,
        letter_id,
        cv_bytes, petitioner_cv.filename,
        project_bytes, project_info.filename,
        support_bytes, support_filename,
        signer_bytes, signer_filename,
        today_str, client_id, current_user.id
    )

    return {
        "letter_id": letter_id,
        "status": "generating",
        "letter_mode": "third_party_loi",
        "message": "Generación de Letter of Intent iniciada en segundo plano"
    }


@router.get("")
async def list_intent_letters(
    client_id: Optional[str] = None,
    current_user=Depends(get_current_user_wrapper)
):
    """List all intent letters (filter by client_id if provided)."""
    db = _get_db()
    query = {"status": {"$ne": "deleted"}}
    if client_id:
        query["client_id"] = client_id
    letters = await db.intent_letters.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"letters": letters, "count": len(letters)}


@router.get("/{letter_id}")
async def get_intent_letter(letter_id: str, current_user=Depends(get_current_user_wrapper)):
    """Get a specific intent letter by ID (status + content) — cleaned on-the-fly."""
    db = _get_db()
    letter = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter:
        raise HTTPException(status_code=404, detail="Intent letter not found")
    # Clean content retroactively for letters stored with old format
    import re as _r2
    def _quick_clean(txt):
        if not txt: return txt
        txt = txt.strip()
        txt = _r2.sub(r'^```(?:html|markdown)?\s*\n?', '', txt)
        txt = _r2.sub(r'\n?```\s*$', '', txt.strip())
        txt = _r2.sub(r'<p>\s*`{1,3}\s*(?:html|markdown)?\s*</p>\s*', '', txt, flags=_r2.IGNORECASE)
        txt = _r2.sub(r'\[[^\[\]]+\]', lambda m: m.group(0) if _r2.match(r'^\[\d\]$', m.group(0)) else '', txt)
        txt = _r2.sub(r'<p>\s*</p>', '', txt)
        txt = _r2.sub(r'  +', ' ', txt)
        txt = _r2.sub(r' ([,.:;])', r'\1', txt)
        return txt
    if letter.get('content_en'):
        letter['content_en'] = _quick_clean(letter['content_en'])
    if letter.get('content_es'):
        letter['content_es'] = _quick_clean(letter['content_es'])
    return letter


@router.post("/{letter_id}/translate")
async def translate_intent_letter(letter_id: str, current_user=Depends(get_current_user_wrapper)):
    """(Re)translate the intent letter to Spanish."""
    db = _get_db()
    letter = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter:
        raise HTTPException(status_code=404, detail="Intent letter not found")
    if letter.get("content_es"):
        return {"content_es": letter["content_es"], "message": "Spanish version already exists"}

    content_en = letter.get("content_en", "")
    if not content_en:
        raise HTTPException(status_code=400, detail="No English content to translate")

    translation_prompt = f"""Translate this EB-2 NIW personal statement from English to Spanish.
Keep all HTML tags, section numbers, proper nouns (USCIS, Matter of Dhanasar, EB-2 NIW, Form I-140),
institution names, law citations, and H.R./P.L. numbers in English.
Use formal Spanish (first person for petitioner, usted when addressing USCIS).
Spanish date format: dd de mes de yyyy.

ENGLISH:
{content_en}

Provide ONLY the Spanish translation."""

    content_es = await _call_openai_gpt4o(
        "Expert legal translator for U.S. immigration documents.",
        translation_prompt, temperature=0.2, max_tokens=8000
    )
    if not content_es:
        raise HTTPException(status_code=500, detail="Translation failed")

    await db.intent_letters.update_one(
        {"id": letter_id},
        {"$set": {"content_es": content_es, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"content_es": content_es, "message": "Letter translated to Spanish successfully"}


@router.post("/{letter_id}/edit")
async def edit_intent_letter(
    letter_id: str,
    edit_request: dict,
    current_user=Depends(get_current_user_wrapper)
):
    """Edit the intent letter with AI using free-text instructions."""
    db = _get_db()
    letter = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter:
        raise HTTPException(status_code=404, detail="Intent letter not found")

    instructions = edit_request.get("instructions", "").strip()
    if not instructions:
        raise HTTPException(status_code=400, detail="Edit instructions are required")

    current_content = letter.get("content_en", "")
    edit_prompt = f"""You are editing an EB-2 NIW personal statement.

CURRENT LETTER:
{current_content}

EDIT INSTRUCTIONS:
{instructions}

Provide the complete revised letter incorporating the changes. Maintain:
- First-person voice ("I", "my")
- All 7 mandatory sections
- Matter of Dhanasar citations
- Professional legal tone
- HTML formatting

Generate the revised letter in English only."""

    revised = await _call_gemini_flash_lite(
        INTENT_LETTER_SYSTEM_PROMPT + ANTI_PLACEHOLDER_RULE,
        edit_prompt, temperature=0.5, max_tokens=10000
    )
    if not revised:
        raise HTTPException(status_code=500, detail="Edit failed")

    await db.intent_letters.update_one(
        {"id": letter_id},
        {"$set": {
            "content_en": revised,
            "content_es": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"content": revised, "message": "Letter edited successfully"}


@router.delete("/{letter_id}")
async def delete_intent_letter(letter_id: str, current_user=Depends(get_current_user_wrapper)):
    """Soft delete an intent letter."""
    db = _get_db()
    letter = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter:
        raise HTTPException(status_code=404, detail="Intent letter not found")

    result = await db.intent_letters.update_one(
        {"id": letter_id},
        {"$set": {
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user.id
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to delete letter")
    return {"message": "Carta de intención eliminada correctamente"}


@router.get("/{letter_id}/download")
async def download_intent_letter(
    letter_id: str,
    language: str = "en",
    current_user=Depends(get_current_user_wrapper)
):
    """Download intent letter as PDF in specified language (en/es)."""
    from bs4 import BeautifulSoup

    db = _get_db()
    letter_doc = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter_doc:
        raise HTTPException(status_code=404, detail="Intent letter not found")

    content = letter_doc.get("content_es" if language == "es" else "content_en", "")
    if not content:
        content = letter_doc.get("content_en", "")
    if not content:
        raise HTTPException(status_code=400, detail="No content available for download")

    # ── Clean content before PDF generation ──────────────────────────────────
    content = content.strip()
    content = re.sub(r'^```(?:html|markdown)?\s*\n?', '', content)
    content = re.sub(r'\n?```\s*$', '', content.strip())
    content = re.sub(r'<p>\s*`{1,3}\s*(?:html|markdown)?\s*</p>\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\[[^\[\]]+\]', lambda m: m.group(0) if re.match(r'^\[\d\]$', m.group(0)) else '', content)
    content = re.sub(r'<p>\s*</p>', '', content)
    content = re.sub(r'<p>\s*[,.:;]\s*</p>', '', content)
    content = re.sub(r'  +', ' ', content)
    content = re.sub(r' ([,.:;])', r'\1', content)

    # Convertir markdown inline (**bold**, *italic*, ****) → XML inline de ReportLab
    # ANTES del parseo HTML para que se convierta aunque esté dentro de <p>/<strong>/etc.
    from pdf_utils import md_inline_to_rl
    content = md_inline_to_rl(content)

    petitioner = letter_doc.get("petitioner_name", "Petitioner")
    project = letter_doc.get("project_title", "EB-2 NIW Petition")
    lang_label = "Español" if language == "es" else "English"

    # Resolve the visual profile this letter was authored under (saved at
    # generation time as format_profile_id) so the PDF fonts/margins match
    # the writing voice. Falls back to classic_legal for legacy letters that
    # were created before this field was added.
    from letter_format_profiles import get_profile
    from pdf_letter_utils import prepare_pdf_settings, inject_signature_spacer
    _profile = get_profile(letter_doc.get("format_profile_id", "classic_legal"))
    _p = prepare_pdf_settings(_profile)

    # ── Build PDF ──────────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=_p["right_margin"],
        leftMargin=_p["left_margin"],
        topMargin=_p["top_margin"],
        bottomMargin=_p["bottom_margin"],
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("IntentTitle", parent=styles["Heading1"],
                                  fontSize=14, spaceAfter=8, textColor=colors.HexColor("#1a1a2e"),
                                  fontName=_p["font_bold"])
    heading_style = ParagraphStyle("IntentHeading", parent=styles["Heading2"],
                                    fontSize=_p["font_size_section"] + 1, spaceAfter=6, spaceBefore=12,
                                    textColor=colors.HexColor("#2c3e50"), fontName=_p["font_bold"])
    subheading_style = ParagraphStyle("IntentSub", parent=styles["Heading3"],
                                       fontSize=_p["font_size_section"], spaceAfter=4, spaceBefore=8,
                                       textColor=colors.HexColor("#34495e"), fontName=_p["font_bold"])
    body_style = ParagraphStyle("IntentBody", parent=styles["Normal"],
                                 fontSize=_p["font_size_body"], leading=_p["leading"], spaceAfter=6,
                                 fontName=_p["font_body"], textColor=colors.HexColor("#2c2c2c"))
    meta_style = ParagraphStyle("IntentMeta", parent=styles["Normal"],
                                  fontSize=_p["font_size_body"] - 1.5, leading=13,
                                  textColor=colors.HexColor("#555555"),
                                  fontName=_p["font_body"])

    story = []

    # Cover header
    story.append(Paragraph(f"EB-2 NIW — Personal Statement / Letter of Intent", title_style))
    story.append(Paragraph(f"Petitioner: {petitioner}", meta_style))
    story.append(Paragraph(f"Proposed Endeavor: {project}", meta_style))
    story.append(Paragraph(f"Language: {lang_label}", meta_style))
    story.append(Spacer(1, 0.3 * inch))

    # ── HTML → ReportLab ───────────────────────────────────────────────────────
    def _to_rl_safe(element):
        html = element.decode_contents()
        html = re.sub(r'<strong\b[^>]*>(.*?)</strong>', r'<b>\1</b>', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<em\b[^>]*>(.*?)</em>', r'<i>\1</i>', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<b\b[^>]*>(.*?)</b>', r'<b>\1</b>', html, flags=re.DOTALL)
        html = re.sub(r'<i\b[^>]*>(.*?)</i>', r'<i>\1</i>', html, flags=re.DOTALL)
        html = re.sub(r'<br\s*/?>', '<br/>', html, flags=re.IGNORECASE)
        html = re.sub(r'<(?!/?b>|/?i>|/?u>|br/>)[^>]+>', '', html)
        html = re.sub(r'&(?!amp;|lt;|gt;|quot;|#\d+;)', '&amp;', html)
        return html.strip()

    def _safe_para(markup, style, fallback=""):
        try:
            return Paragraph(markup, style)
        except Exception:
            safe = re.sub(r'<[^>]+>', '', markup)
            try:
                return Paragraph(safe or fallback, style)
            except Exception:
                return None

    is_html = bool(re.search(r'<\s*(?:h[1-6]|p|ul|ol|li|div)\b', content, re.IGNORECASE))

    if is_html:
        soup = BeautifulSoup(content, 'html.parser')

        def _add(el):
            if not hasattr(el, 'name') or not el.name:
                return
            tag = el.name.lower()
            plain = el.get_text(separator=' ', strip=True)
            if not plain:
                return
            if tag == 'h1':
                story.append(Spacer(1, 0.2 * inch))
                p = _safe_para(_to_rl_safe(el), title_style, plain)
                if p: story.append(p)
            elif tag == 'h2':
                story.append(Spacer(1, 0.15 * inch))
                p = _safe_para(_to_rl_safe(el), heading_style, plain)
                if p: story.append(p)
            elif tag in ('h3', 'h4', 'h5', 'h6'):
                story.append(Spacer(1, 0.1 * inch))
                p = _safe_para(_to_rl_safe(el), subheading_style, plain)
                if p: story.append(p)
            elif tag == 'p':
                p = _safe_para(_to_rl_safe(el), body_style, plain)
                if p:
                    story.append(p)
                    story.append(Spacer(1, 0.04 * inch))
            elif tag in ('ul', 'ol'):
                for li in el.find_all('li', recursive=False):
                    li_plain = li.get_text(strip=True)
                    if li_plain:
                        p = _safe_para(f'• {_to_rl_safe(li)}', body_style, f'• {li_plain}')
                        if p: story.append(p)
            elif tag in ('div', 'section', 'article', 'main', 'body'):
                for child in el.children:
                    _add(child)
            else:
                p = _safe_para(_to_rl_safe(el), body_style, plain)
                if p: story.append(p)

        for el in soup.children:
            _add(el)
    else:
        # Markdown fallback
        for line in content.split('\n'):
            stripped = line.strip()
            if not stripped:
                story.append(Spacer(1, 0.08 * inch))
                continue
            if stripped.startswith('#'):
                lvl = len(stripped) - len(stripped.lstrip('#'))
                text = stripped.lstrip('#').strip()
                st = title_style if lvl == 1 else (heading_style if lvl == 2 else subheading_style)
                story.append(Spacer(1, 0.12 * inch))
                story.append(Paragraph(text, st))
            else:
                fmt = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', stripped)
                fmt = re.sub(r'\*(.*?)\*', r'<i>\1</i>', fmt)
                p = _safe_para(fmt, body_style, stripped)
                if p: story.append(p)

    # Reserve ~1 inch of vertical whitespace after the sign-off line so the
    # signer can sign by hand. Without this, the printed name sits directly
    # under "Sincerely," with no room for an actual signature.
    inject_signature_spacer(story, height=70)

    doc.build(story)
    buffer.seek(0)

    filename = f"intent_letter_{petitioner.replace(' ', '_')}_{language}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{letter_id}/download-docx")
async def download_intent_letter_docx(
    letter_id: str,
    language: str = "en",
    current_user=Depends(get_current_user_wrapper)
):
    """Download intent letter as Microsoft Word (.docx) — opens cleanly in Google Docs."""
    from docx_utils import build_docx_response

    db = _get_db()
    letter_doc = await db.intent_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter_doc:
        raise HTTPException(status_code=404, detail="Intent letter not found")

    content = letter_doc.get("content_es" if language == "es" else "content_en", "") or letter_doc.get("content_en", "")
    if not content:
        raise HTTPException(status_code=400, detail="No content available for download")

    # Light cleanup (strip code fences)
    content = content.strip()
    content = re.sub(r'^```(?:html|markdown)?\s*\n?', '', content)
    content = re.sub(r'\n?```\s*$', '', content.strip())

    petitioner = letter_doc.get("petitioner_name", "Petitioner")
    project = letter_doc.get("project_title", "EB-2 NIW Petition")

    # Detect if content is HTML or markdown
    is_html = bool(re.search(r'<(p|h[1-6]|div|table|ul|ol)\b', content, re.IGNORECASE))

    return build_docx_response(
        content=content,
        title=project,
        filename_stem=f"Intent_Letter_{petitioner.replace(' ', '_')}",
        doc_type="Letter of Intent" if language == 'en' else "Carta de Intención",
        author=petitioner,
        language=language,
        is_html=is_html,
        # Letters don't need the heavy cover page — keep it tight.
        add_cover=False,
    )
