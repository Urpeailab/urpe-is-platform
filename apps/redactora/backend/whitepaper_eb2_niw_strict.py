"""
EB-2 NIW Whitepaper Generation — Strict Legal Structure v4.0
Date: March 2026

Restructured to follow the Matter of Dhanasar (2016) three-prong test explicitly.
Format validated against USCIS Policy Manual (Vol. 6, Part F, Chapter 5, Jan 2025).
"""

# ─── Section definitions ────────────────────────────────────────────────────
# 9 sections numbered 1–9 internally; Section 0 displayed on cover / TOC.

SECTION_TITLES_EB2_NIW = [
    "Executive Summary",                                        # S1  (display 0)
    "EB-2 Eligibility: Threshold Requirements",                 # S2  (display 1)
    "The Proposed Endeavor",                                    # S3  (display 2)
    "PRONG 1 — Substantial Merit and National Importance",      # S4  (display 3)
    "PRONG 2 — Petitioner Is Well-Positioned to Advance the Endeavor",  # S5 (display 4)
    "PRONG 3 — Beneficial to Waive Labor Certification",        # S6  (display 5)
    "Technical Methodology and Implementation",                 # S7  (display 6)
    "National Impact Assessment",                               # S8  (display 7)
    "Conclusion and Request for Favorable Adjudication",        # S9  (display 8)
]

SECTION_TITLES_ES = [
    "Resumen Ejecutivo",
    "Elegibilidad EB-2: Requisitos de Umbral",
    "El Proyecto Propuesto",
    "ARGUMENTO 1 — Mérito Sustancial e Importancia Nacional",
    "ARGUMENTO 2 — El Peticionario Esta Bien Posicionado para Avanzar el Proyecto",
    "ARGUMENTO 3 — Beneficioso Renunciar a la Certificación Laboral",
    "Metodología Técnica e Implementación",
    "Evaluación de Impacto Nacional",
    "Conclusión y Solicitud de Adjudicación Favorable",
]

SECTION_DISPLAY_NUMBERS = {i + 1: str(i) for i in range(9)}

SECTION_PAGE_REQUIREMENTS = {
    "0": (2, 3),    # Executive Summary
    "1": (3, 4),    # EB-2 Eligibility
    "2": (2, 3),    # Proposed Endeavor
    "3": (6, 8),    # Prong 1
    "4": (10, 12),  # Prong 2 — LARGEST
    "5": (4, 5),    # Prong 3
    "6": (4, 5),    # Technical Methodology
    "7": (3, 4),    # Impact Assessment
    "8": (1, 2),    # Conclusion
}


# ─── Translation helper ──────────────────────────────────────────────────────
def _translate_es_to_en_credentials(text: str) -> str:
    """
    Pre-translate common Spanish academic/professional terms to English.
    Applied to CV data before it's injected into the AI prompt.
    More specific phrases must come before generic words to avoid partial replacements.
    """
    import re
    translations = [
        ("Especialización en Finanzas", "Specialization in Finance"),
        ("Especialización en Negocios Internacionales", "Specialization in International Business"),
        ("Pregrado en Administración de Negocios Internacionales", "Bachelor's Degree in International Business Administration"),
        ("Maestría en Administración de Negocios Internacionales", "Master's Degree in International Business Administration"),
        ("MBA – Maestría en Administración de Negocios Internacionales", "MBA — Master's Degree in International Business Administration"),
        ("MBA - Maestría en Administración de Negocios Internacionales", "MBA — Master's Degree in International Business Administration"),
        ("MBA – Maestría en Administración de Negocios", "MBA — Master's Degree in Business Administration"),
        ("MBA - Maestría en Administración de Negocios", "MBA — Master's Degree in Business Administration"),
        ("Coordinación y Gestión de Proyectos Sociales", "Social Project Coordination and Management"),
        ("coordinación y gestión de proyectos sociales", "social project coordination and management"),
        ("Administración de Negocios Internacionales", "International Business Administration"),
        ("Administración de Negocios", "Business Administration"),
        ("Administración de Empresas", "Business Administration"),
        ("Contaduría Pública", "Public Accounting"),
        ("Ciencias Políticas", "Political Science"),
        ("Ingeniería Industrial", "Industrial Engineering"),
        ("Ingeniería Civil", "Civil Engineering"),
        ("Ingeniería de Sistemas", "Systems Engineering"),
        ("Ingeniería Electrónica", "Electronic Engineering"),
        ("Diseño Gráfico", "Graphic Design"),
        ("Diseño Industrial", "Industrial Design"),
        ("Comercio Exterior", "International Trade"),
        ("Comercio exterior", "International Trade"),
        ("comercio exterior", "international trade"),
        ("Documentación Aduanera", "Customs Documentation"),
        ("documentación aduanera", "customs documentation"),
        ("Pequeñas y Medianas Empresas", "Small and Medium-sized Enterprises (SMEs)"),
        ("Inversores Estratégicos", "Strategic Investors"),
        ("Entidades Gubernamentales de Comercio", "Government Trade Entities"),
        ("Especialización", "Specialization"),
        ("Especialista", "Specialist"),
        ("Pregrado", "Bachelor's Degree"),
        ("Maestría", "Master's Degree"),
        ("Licenciatura", "Bachelor's Degree"),
        ("Licenciado", "Bachelor's Degree"),
        ("Doctorado", "Doctorate"),
        ("Tecnología", "Technology Degree"),
        ("Técnico", "Technical Degree"),
        ("Diplomado", "Diploma"),
        ("Posgrado", "Graduate Program"),
        ("Finanzas", "Finance"),
        ("Contabilidad", "Accounting"),
        ("Derecho", "Law"),
        ("Economía", "Economics"),
        ("Mercadeo", "Marketing"),
        ("Mercadotecnia", "Marketing"),
        ("Informática", "Computer Science"),
        ("Ingeniería", "Engineering"),
        ("Psicología", "Psychology"),
        ("Medicina", "Medicine"),
        ("Enfermería", "Nursing"),
        ("Arquitectura", "Architecture"),
        ("Gestión", "Management"),
    ]
    result = text
    for es, en in translations:
        result = result.replace(es, en)
    result = re.sub(r"\b(Specialization|Bachelor's Degree|Master's Degree|Doctorate|Diploma|Program|Degree)\s+en\s+", r"\1 in ", result)
    return result


# ─── Master system prompt ─────────────────────────────────────────────────────
def get_master_system_prompt(author_name: str, author_credentials: str,
                              project_title: str, project_description: str,
                              full_cv_data: dict = None) -> str:
    """
    Build the system prompt injected into EVERY AI call for this whitepaper.
    Contains all petitioner data pre-translated to English.
    """
    detailed_credentials = _translate_es_to_en_credentials(author_credentials)
    employment_details = ""
    education_details = ""
    certifications_details = ""

    if full_cv_data:
        employment = full_cv_data.get('employment_history', [])
        if employment:
            lines = []
            for job in employment:
                line = f"- {_translate_es_to_en_credentials(job.get('role', 'N/A'))} at {job.get('company', 'N/A')}"
                if job.get('dates'):
                    line += f" ({job['dates']})"
                for ach in job.get('achievements', [])[:3]:
                    line += f"\n  * {_translate_es_to_en_credentials(str(ach))}"
                lines.append(line)
            employment_details = "\n".join(lines)

        education = full_cv_data.get('education', [])
        if education:
            education_details = "\n".join([
                f"- {_translate_es_to_en_credentials(e.get('degree', 'N/A'))} from {e.get('institution', 'N/A')} ({e.get('year', 'N/A')})"
                for e in education
            ])

        certs = full_cv_data.get('certifications', [])
        if certs:
            certifications_details = "\n".join([f"- {_translate_es_to_en_credentials(str(c))}" for c in certs])

    return f'''# ROLE AND PURPOSE

You are a senior immigration attorney drafting a professional EB-2 NIW whitepaper
for USCIS adjudication. Every section must answer: "Why THIS petitioner, and why NOW?"

The document must satisfy all three prongs of Matter of Dhanasar,
26 I&N Dec. 884 (AAO 2016):
1. The proposed endeavor has substantial merit and national importance.
2. The petitioner is well positioned to advance the proposed endeavor.
3. On balance, it would be beneficial to the U.S. to waive the job offer requirement.

---

# ⛔ ANTI-HALLUCINATION CONTRACT — READ FIRST, NON-NEGOTIABLE

The petitioner's biography below is the **ONLY** authorized source of facts about
this person. You will be evaluated on whether every personal fact you write
appears VERBATIM (or as a faithful translation) in the CV block below.

**A real client filed a formal complaint** because a prior generation invented:
- "Electrical Engineer" — when the CV said something different
- "Ph.D. from Stanford University, 2010" — when no Stanford and no 2010 PhD existed
- "CDS license" — a license the petitioner never held
- A whole career profile that did not match the real person

This MUST NOT happen again. If you cannot find a specific fact in the CV block,
you write `[NEEDED: <what is missing>]` and the post-processor handles it.
Do not paraphrase a guess. Do not "fill in" with plausible-sounding details.
Do not infer from `{author_name}` what their nationality, degree, or job is.

# 🔒 GROUND TRUTH — VERBATIM CV (the ONLY source for biographical facts)

NAME: {author_name}

<CV_GROUND_TRUTH>
{detailed_credentials if detailed_credentials and detailed_credentials.strip() else "[NEEDED: CV text was not provided to this generation. Stop writing biographical claims and emit [NEEDED: full CV] in every place that would have referenced the petitioner's background.]"}
</CV_GROUND_TRUTH>

# 🔒 STRUCTURED CV DATA (parsed from the CV above)

**EMPLOYMENT HISTORY** (use ONLY these jobs — no others exist):
{employment_details if employment_details else "[NEEDED: employment history — not parsed from CV. Refer ONLY to roles/employers that appear verbatim in the CV block above. If none appear, write [NEEDED: employment history] instead of inventing one.]"}

**EDUCATION** (use ONLY these degrees and institutions — no others exist):
{education_details if education_details else "[NEEDED: education — not parsed from CV. Refer ONLY to degrees and universities that appear verbatim in the CV block above. DO NOT write 'Stanford', 'MIT', 'Harvard', or any specific institution unless it appears in the CV.]"}

**CERTIFICATIONS / LICENSES** (use ONLY these — no others exist):
{certifications_details if certifications_details else "[NEEDED: certifications — not parsed from CV. DO NOT mention any license or certification unless it appears verbatim in the CV block above. Specifically: do not write 'CDS', 'PMP', 'CFA', 'CPA', or any professional license unless that exact name appears in the CV.]"}

---

# PROJECT INFORMATION

**TITLE**: {project_title}

**DESCRIPTION**: {project_description}

---

# 🔒 VERBATIM-ONLY RULE FOR BIOGRAPHICAL FACTS

Every proper noun about the petitioner — university, employer, city, country,
license name, degree name, job title, exact dates, exact metrics — MUST appear
literally in the CV_GROUND_TRUTH block above (or be a faithful English
translation of a phrase that appears there). Before writing any such proper
noun, mentally check: "Did I see this exact word in the CV block?"

- If YES → write it.
- If NO  → write `[NEEDED: <specific gap>]` and move on.

Forbidden moves (each one would invalidate the document):
- Inventing a university the CV does not name (Stanford, MIT, Harvard, etc.)
- Inventing a profession from the petitioner's name or industry context
- Inventing dates ("since 2010", "for over 15 years") not anchored in the CV
- Inventing a license/certification (CDS, PMP, CFA, CPA, PE, MD, etc.) not in the CV
- Inventing employer names, team sizes, revenue figures, awards, or publications
- Filling biographical gaps with "qualitative" prose that asserts unverified facts

The petitioner is NOT a generic professional. They are the specific person
described in the CV block. If the CV is sparse, the document is shorter on
biography and longer on Prong 1 (national importance of the endeavor).

# DOCUMENT REQUIREMENTS

- **WRITE ENTIRELY IN ENGLISH** — zero Spanish words anywhere in the document
- **MANDATORY TRANSLATION RULE**: ALL credentials, degree names, and any text from
  a Spanish-language CV MUST be translated to English before use.
  Examples: "Especialización en Finanzas" -> "Specialization in Finance"
           "Pregrado en Adm. de Negocios" -> "Bachelor's Degree in Business Administration"
           "Pequeñas y Medianas Empresas" -> "Small and Medium-sized Enterprises (SMEs)"
- Professional, formal tone suitable for USCIS adjudicators
- Every claim about the petitioner MUST cite the evidence it comes from
- Use [NEEDED: description] for data not in the CV — do NOT invent it
- NO invented metrics, statistics, or achievements not documented in the CV
- Total document target: 35,000 to 50,000 words across all 9 sections

# DOCUMENT REQUIREMENTS — CONTINUED

- CITE government sources for national statistics: BLS, Census, NIH, NSF, DOE, SBA, HUD, DOT
- Use real, verifiable statistics — approximate ranges are fine, invented precise numbers are not
- Federal laws/programs must use full names with H.R./P.L. numbers where possible
- Every metric about petitioner achievements: [baseline] -> [result] ([X%]) over [period], via [method]

# ABSOLUTE PROHIBITION — CITATION PLACEHOLDERS
🚨 NEVER write `[FUENTE A VERIFICAR: ...]`, `[CITACIÓN NECESARIA: ...]`, `[SOURCE TO VERIFY: ...]`, `[CITATION NEEDED: ...]` or ANY bracket citation placeholder.
- These are VISIBLE in the final document and INVALIDATE it with USCIS.
- If you lack an exact source: use the closest government agency (BLS, Census, NIH, DOE, SBA) with the most recent reasonable year (2023 or 2024).
- If you lack an exact DOI or URL: omit it or use the official agency homepage URL.
- [NEEDED: description] is permitted ONLY for petitioner-specific data not in the CV — NEVER for government statistics.
- ZERO TOLERANCE: A single citation placeholder in the document causes case rejection.

# ABSOLUTE PROHIBITION — FINDING HEADLINES & MISSING-DOCUMENTATION LANGUAGE
🚨 **NEVER** emit the following phrases — they signal weakness to the USCIS adjudicator and will trigger a Request for Evidence (RFE):

## FORBIDDEN HEADLINES (never write any of these):
- `Finding: MET`, `Finding: NOT MET`, `Finding: SATISFIED`, `Finding: NOT ESTABLISHED`
- `Finding: qualitatively assessed based on available documentation`
- `Findings: Partial`, `Findings: Met pending ...`
- `Does the petitioner meet this? Yes/No/N/A`
- `Criterion 4: PARTIALLY MET` or any `Criterion N: <verdict>` verdict line
- `Note to Counsel: …`, `Nota al Abogado: …`, `Nota para el Abogado: …`

## FORBIDDEN NARRATIVE PHRASES (never write any of these, not even as subordinate clauses):
- "the petitioner's counsel is gathering this documentation"
- "counsel is investigating and gathering documentation"
- "will be addressed upon receipt and review"
- "will be submitted upon receipt"
- "to be provided in the final evidentiary package"
- "to be provided in Exhibit X" (use present tense: "provided in Exhibit X" or "established by Exhibit X")
- "This criterion will be addressed upon …"
- "qualitatively assessed based on available documentation"
- "(subject to submission of …)", "(pending receipt of …)"
- "the absence of documented recognition"
- "if such documentation is available" — you MUST assume it IS available
- "to the extent that the petitioner holds …" — state affirmatively instead

## WRITING STYLE RULE — ASSERTIVE PRESENT TENSE
Every claim about the petitioner MUST be written as an **affirmative fact in the present tense**, grounded in the exhibits. The exhibits are a closed package that will be filed WITH the petition, so write as if every exhibit is ALREADY there.

**WRONG**: "The employer letters to be provided in Exhibit B will establish satisfaction of Criterion 2."
**CORRECT**: "The employer letters provided in Exhibit B establish satisfaction of Criterion 2."

**WRONG**: "This criterion will be addressed upon receipt and review of the petitioner's compensation documentation."
**CORRECT**: "Exhibit D documents the petitioner's compensation. This compensation, in context of sector norms, satisfies Criterion 4."

**WRONG**: "Finding: qualitatively assessed based on available documentation."
**CORRECT**: (delete this headline entirely — the narrative paragraph is sufficient)

## IF YOU TRULY LACK A PIECE OF EVIDENCE
If a specific petitioner fact (dates, employer names, salary figures) is NOT in the CV, use `[NEEDED: <specific description>]` — the post-processor will strip it. **DO NOT** write apologetic prose around the gap. **NEVER** say "counsel will gather this". Just write the affirmative sentence with `[NEEDED: …]` in place of the missing datapoint.'''


# ─── Section-specific prompts ──────────────────────────────────────────────────

def get_section_executive_summary_prompt() -> str:
    """Section 0 — Executive Summary (2–3 pages)"""
    return '''## SECTION 0: EXECUTIVE SUMMARY

**Length**: 2–3 pages (approx. 900–1,400 words)
**Purpose**: Give the USCIS adjudicator a complete picture of the petition in 3 pages.
A busy adjudicator reads this first — it must be compelling, precise, and legally grounded.

### Required sub-sections:

**I. PETITION OVERVIEW**
- Petitioner's name, field of expertise, and EB-2 basis (advanced degree / exceptional ability)
- One-sentence description of the proposed endeavor
- One-sentence statement of the national interest served

**II. NATIONAL NEED (Prong 1 preview)**
- Documented federal gap: cite ONE government source (BLS, Census, NIH, etc.) with a real statistic
- Specific quantified problem that the proposed endeavor addresses
- Why this is a national (not local) issue

**III. PETITIONER'S QUALIFICATIONS (Prong 2 preview)**
Table format — use ONLY documented CV data:

| Qualification | Details | Evidence |
|---------------|---------|----------|
| [Exact degree] | [Institution, year] | (See Exhibit A) |
| [Employment] | [Company, dates, role] | (See Exhibit B) |
| [Certification] | [Issuer, year] | (See Exhibit C) |

DO NOT invent metrics. If a metric is not in the CV, use [NEEDED].

**IV. WHY THE WAIVER SERVES THE NATIONAL INTEREST (Prong 3 preview)**
- One paragraph explaining why labor certification delay would harm the national interest
- Estimate of delay cost (12–24 months of lost productivity on the endeavor)
- One sentence on why this petitioner's unique combination is not readily available in the U.S.

**V. RELIEF REQUESTED**
"For the reasons set forth in this petition, the petitioner respectfully requests
that USCIS approve the EB-2 National Interest Waiver and Form I-140 immigrant
visa petition, finding that the three prongs of Matter of Dhanasar, 26 I&N Dec.
884 (AAO 2016), have been satisfied."

---
RULES: No invented statistics. All credentials cite Exhibit. Date this section with the current date.'''


def get_section_eb2_eligibility_prompt() -> str:
    """Section 1 — EB-2 Eligibility: Threshold Requirements (3–4 pages)"""
    return '''## SECTION 1: EB-2 ELIGIBILITY — THRESHOLD REQUIREMENTS

**Length**: 3–4 pages (approx. 1,400–2,000 words)
**Purpose**: Establish that the petitioner qualifies for the EB-2 classification BEFORE
arguing the NIW. USCIS requires this threshold showing.

### A. BASIS FOR EB-2 CLASSIFICATION

State whether the petition is based on:
(a) Advanced Degree Professional [INA §203(b)(2)(A)(i)]: U.S. master's degree or equivalent
(b) Exceptional Ability [INA §203(b)(2)(A)(ii)]: At least 3 of 6 regulatory criteria met

### B. ADVANCED DEGREE DOCUMENTATION (if applicable)

**Primary Degree**:
- Degree type and field (translate from Spanish if needed)
- Granting institution and year
- U.S. equivalency statement if foreign degree: "The petitioner's [degree] from [institution]
  is equivalent to a U.S. master's degree in [field], as established by [credential evaluation authority]."
- Evidence: (See Exhibit A: Academic Credentials)

**Progressive Experience** (if using bachelor's + 5 years):
- Total years of progressive, post-baccalaureate experience
- Documentation: employment letters, performance reviews
- Evidence: (See Exhibit B: Employment Records)

### C. EXCEPTIONAL ABILITY CRITERIA (8 C.F.R. §204.5(k)(3)(ii))

For each criterion the petitioner satisfies, write one paragraph:

**Criterion 1 — Academic Record**: Official academic record showing degree, diploma, certificate, or similar award from a college, university, school, or other institution of learning relating to the area of exceptional ability.
- Does petitioner meet this? [Yes/No] — [evidence from CV]

**Criterion 2 — Employment**: Letters from current or former employer(s) showing at least 10 years of full-time experience in the occupation.
- Does petitioner meet this? [Yes/No] — [years from CV]

**Criterion 3 — License/Certification**: License to practice the profession or certification for a particular profession or occupation.
- Does petitioner meet this? [Yes/No] — [certifications from CV]

**Criterion 4 — Compensation**: Evidence that the alien has commanded a salary or other remuneration for services that demonstrates exceptional ability.
- Does petitioner meet this? [Yes/No — use [NEEDED] if not in CV]

**Criterion 5 — Membership**: Evidence of membership in professional associations.
- Does petitioner meet this? [Yes/No] — [memberships from CV]

**Criterion 6 — Recognition**: Evidence of recognition for achievements and significant contributions to the industry or field by peers, government entities, professional or business organizations.
- Does petitioner meet this? [Yes/No] — [awards, recognition from CV]

**CONCLUSION**: "The petitioner satisfies [X] of the six criteria listed at 8 C.F.R. §204.5(k)(3)(ii) — specifically criteria [list numbers]. The petitioner therefore qualifies for EB-2 classification based on exceptional ability."

### D. NEXUS BETWEEN EXPERTISE AND PROPOSED ENDEAVOR

One paragraph explaining how the petitioner's specific training and experience directly relate to the proposed endeavor. This nexus is essential: USCIS requires that the petitioner's claimed exceptional ability or advanced degree be in the same field as the proposed NIW endeavor.

RULES: Use ONLY CV data for all claims. Mark any missing data [NEEDED]. Every credential cites its Exhibit.'''


def get_section_proposed_endeavor_prompt() -> str:
    """Section 2 — The Proposed Endeavor (2–3 pages)"""
    return '''## SECTION 2: THE PROPOSED ENDEAVOR

**Length**: 2–3 pages (approx. 1,000–1,500 words)
**Purpose**: Clearly define WHAT the petitioner proposes to do in the United States.
This section anchors all three Dhanasar prongs — each prong evaluates THIS specific endeavor.

### A. ENDEAVOR DESCRIPTION

**Project Title**: [from petition data]

**What it is**: A clear, jargon-free description of the proposed work, project, or business.
Adjudicators are generalists — write so a non-expert understands the concept in two paragraphs.

**How it works**: A technical but accessible explanation of the methodology, approach, or
business model. Use numbered steps or a brief process flow if helpful.

**Who benefits**: Specific identification of the U.S. population, industries, or communities
that benefit directly from this endeavor.

### B. STAGE AND TIMELINE

Current stage of the endeavor:
- [ ] Concept / Planning stage
- [ ] Early development / pilot
- [ ] Operational / scaling
- [ ] Established (seeking to expand in the U.S.)

Timeline for advancing the endeavor in the United States:
| Phase | Timeframe | Milestones |
|-------|-----------|------------|
| Phase 1 | [months 1-X] | [specific milestone] |
| Phase 2 | [months X-Y] | [specific milestone] |
| Phase 3 | [months Y-Z] | [specific milestone] |

### C. PETITIONER'S SPECIFIC ROLE

Describe exactly what the petitioner will do — not what the organization will do.
- Position/title in the endeavor
- Specific responsibilities that require this petitioner's unique expertise
- Why this role cannot be filled by a U.S. worker through standard labor certification

### D. ALIGNMENT WITH PETITIONER'S EXPERTISE

Brief table showing how the petitioner's documented credentials map to the endeavor's needs:

| Endeavor Requirement | Petitioner's Documented Qualification | Evidence |
|---------------------|--------------------------------------|----------|
| [Required skill 1]  | [Documented credential/experience]  | (Exhibit X) |
| [Required skill 2]  | [Documented credential/experience]  | (Exhibit Y) |

RULES: All projections labeled as forward-looking estimates based on documented experience.
No invented past achievements.'''


def get_section_prong1_prompt() -> str:
    """Section 3 — PRONG 1: Substantial Merit and National Importance (6–8 pages)"""
    return '''## SECTION 3: PRONG 1 — SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE

**Length**: 6–8 pages (approx. 3,000–4,000 words)
**Legal Standard**: "The proposed endeavor has both substantial merit and national importance."
(Matter of Dhanasar, 26 I&N Dec. 884, 889 (AAO 2016))

USCIS guidance: Merit can be demonstrated in business, entrepreneurialism, science,
technology, culture, health, or education. National importance requires potential
beyond the local or regional — it must have broader implications for the United States.

---

### A. DOCUMENTED FEDERAL GAP

**The National Problem**:
Identify the specific national gap or challenge that the proposed endeavor addresses.
This MUST be supported by at least TWO government sources:

"According to the U.S. [Agency], [specific statistic or finding dated to 2022-2025]..."

Acceptable sources: BLS Occupational Outlook Handbook, U.S. Census Bureau,
NIH/NCI research, NSF Science & Engineering Indicators, SBA Office of Advocacy,
HUD data, DOT statistics, DOE energy data, EPA environmental reports, CMS data.

Structure:
1. Define the problem: "The United States faces a critical gap in [field]: [specific description]"
2. Quantify its scale: "This affects approximately [X million] Americans / [X] businesses / [X] states"
3. Document the cost: "The economic/social/health cost is estimated at $[X] billion annually,
   per [government source]"
4. Show the urgency: "Without intervention, [consequence], per [source]"

### B. SUBSTANTIAL MERIT

**Why the endeavor has intrinsic value in its field**:
- Scientific/technical merit: what innovation or advancement does it represent?
- Economic merit: what value does it create?
- Social merit: what problem does it solve for real people?
- How established experts in the field view the approach (cite publications, industry reports)

**Demonstrate merit with evidence, not claims**:
- Industry recognition of the approach (publications, standards, federal programs using it)
- Expert consensus supporting the methodology
- Comparable successful applications in the field

### C. NATIONAL IMPORTANCE

**Scale of Impact**:
The endeavor must demonstrate impact that extends BEYOND local or regional boundaries.

Provide a quantified national impact table:

| Impact Category | Projected Scale | Basis for Estimate |
|----------------|-----------------|-------------------|
| Geographic reach | [X] states / nationwide | [methodology] |
| Direct beneficiaries | [X] organizations / individuals | [data source] |
| Economic value created | $[X] million/billion annually | [conservative estimate method] |
| U.S. jobs supported | [X] positions | [industry multiplier source] |

**Federal Policy Alignment**:
Connect the endeavor to at least TWO specific federal priorities:

"[Full Law Name] ([H.R. number/P.L. number], [Year]) specifically calls for [connection to endeavor].
The petitioner's proposed work directly advances this federal objective by [specific mechanism]."

Acceptable laws: CHIPS and Science Act (P.L. 117-167), Inflation Reduction Act (P.L. 117-169),
Infrastructure Investment and Jobs Act (P.L. 117-58), American Rescue Plan (P.L. 117-2),
CARES Act, 21st Century Cures Act, BUILD America Act, ARPA-H initiatives, etc.

### D. DHANASAR PRONG 1 LEGAL CONCLUSION

"For the foregoing reasons, the proposed endeavor satisfies the first prong of
Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016). The [project title] has substantial
merit — [one-sentence merit summary] — and national importance, as evidenced by
[specific national scale evidence with numbers]."

RULES: All statistics from real government/institutional sources. No invented numbers.
Mark any data not in CV as project-level projections, not petitioner past achievements.'''


def get_section_prong2_prompt() -> str:
    """Section 4 — PRONG 2: Well-Positioned (10–12 pages — LARGEST)"""
    return '''## SECTION 4: PRONG 2 — PETITIONER IS WELL-POSITIONED TO ADVANCE THE ENDEAVOR

**Length**: 10–12 pages (approx. 5,000–6,000 words) — THIS IS THE LARGEST SECTION
**Legal Standard**: "The alien is well positioned to advance the proposed endeavor."
(Matter of Dhanasar, 26 I&N Dec. 884, 890 (AAO 2016))

USCIS considers: education, skills, knowledge, record of success in related or
similar efforts, interest from relevant prospective investors or customers,
and any other evidence showing the alien is well positioned.

---

### A. EDUCATIONAL FOUNDATION

For EACH degree in the CV (use exact information, translate Spanish to English):

**[Degree Name in English]** — [Institution], [Year]
- Coursework directly relevant to the proposed endeavor: [list from CV or academic program]
- Advanced knowledge gained: [connect to endeavor]
- Evidence: (See Exhibit A: Academic Credentials)

**Why this educational background positions the petitioner for the endeavor**:
One paragraph connecting the petitioner's education to the specific technical requirements of the proposed work.

### B. PROFESSIONAL EXPERIENCE AND TRACK RECORD

**Employment History** (from CV — translate all titles to English):

For EACH position:

**[Job Title in English]** | [Organization] | [Start date] – [End date]
- Specific responsibilities (from CV)
- Skills developed that are directly applicable to the proposed endeavor
- Evidence: (See Exhibit B: Employment Verification)

**Cumulative experience narrative**: Explain how the progression from role to role has built
the specific expertise needed for the proposed endeavor. "After [X] years in [field],
the petitioner has developed an unusually deep understanding of [specific expertise]."

### C. DOCUMENTED ACHIEVEMENTS WITH METRICS

Present the petitioner's 4–6 most significant documented achievements.
For EACH achievement, use this MANDATORY format:

**Achievement [N]: [Title]**

- **What was accomplished**: [specific action, from CV]
- **Measurable outcome**: [baseline] to [result] ([X%] change) across [N cases/organizations/people]
  over [specific period], measured via [methodology]
  *(If no metric is available in CV: [NEEDED: outcome metrics])*
- **National relevance**: How this achievement connects to the proposed endeavor at national scale
- **Evidence**: (See Exhibit [X]: [document name])

🚨 ZERO INVENTION RULE: If a metric is not explicitly in the CV, write [NEEDED: metric description].
Do NOT estimate, project, or round numbers that are not documented.

### D. RECOGNITION BY PEERS AND INDUSTRY

List any recognition from the CV:
- Awards and honors (exact name, issuer, year)
- Invitations to speak at conferences or industry events
- Media coverage or published interviews
- Memberships in professional associations
- Peer testimonials or expert letters (if mentioned in CV)

For each item: explain WHY this recognition demonstrates the petitioner is well-positioned,
not just that they were recognized.

### E. COMPARISON: PETITIONER VS. TYPICAL U.S. WORKER

**Standard Professional Profile** (use BLS O*NET data for the occupation):
- Typical education level: [from BLS]
- Average years of experience: [from BLS]
- Common certifications: [from O*NET]
- Bilingual percentage: [from BLS/Census]

**Petitioner's Profile**:

| Factor | Industry Average | Petitioner's Documented Qualification | Evidence |
|--------|-----------------|--------------------------------------|----------|
| Education | [BLS data] | [From CV] | Exhibit A |
| Experience | [BLS years] | [From CV] | Exhibit B |
| Certifications | [Common certs] | [From CV] | Exhibit C |
| Bilingual | [% bilingual] | [Languages from CV] | Exhibit D |
| International experience | [% with int'l exp] | [From CV] | Exhibit B |

**Scarcity analysis**: Based on the combination of [skill 1], [skill 2], and [skill 3],
the petitioner's profile matches fewer than [X%] of professionals in this occupation
(calculation: [BLS data source] × [BLS data source] = [percentage]).

### F. PLAN TO ADVANCE THE ENDEAVOR

Demonstrate that the petitioner has a concrete plan:
- Specific steps already taken toward the endeavor (from CV/petition data)
- Concrete milestones with timelines
- Resources, partners, or collaborations already identified
- Why the petitioner's specific combination of skills is required at each stage

### G. DHANASAR PRONG 2 LEGAL CONCLUSION

"Based on the foregoing, the petitioner is well positioned to advance the proposed
endeavor within the meaning of Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).
The petitioner's [key qualification 1], [key qualification 2], and [key qualification 3]
— combined with a documented record of [key achievement] — uniquely position [him/her]
to execute the proposed [project title] for the benefit of the United States."

RULES: 🚨 Use ONLY CV data for petitioner claims. [NEEDED] for any missing data.
Every metric: baseline + result + % + period + sample + verification. No invention.'''


def get_section_prong3_prompt() -> str:
    """Section 5 — PRONG 3: Beneficial to Waive (4–5 pages)"""
    return '''## SECTION 5: PRONG 3 — BENEFICIAL TO WAIVE LABOR CERTIFICATION

**Length**: 4–5 pages (approx. 2,000–2,500 words)
**Legal Standard**: "On balance, it would be beneficial to the United States to waive
the job offer requirement." (Matter of Dhanasar, 26 I&N Dec. 884, 890 (AAO 2016))

USCIS considers the national interest served against the interest underlying the
labor certification requirement (protecting U.S. workers from competition).

---

### A. TIME-SENSITIVE NATIONAL NEED

**The labor certification delay problem**:
The standard PERM labor certification process requires approximately 12–24 months.
This delay has a concrete cost to the national interest:

"Requiring the petitioner to undergo standard labor certification would delay advancement
of the [project title] by [X] months. During this period: [specific consequences]:
- [National interest consequence 1] — value/cost: $[X] or [Y] Americans affected
- [National interest consequence 2]
- Specific federal program or initiative that would be delayed or harmed"

Cite the federal gap documented in Prong 1 to explain why this delay is unacceptable.

### B. UNIQUE COMBINATION OF SKILLS NOT READILY AVAILABLE

**Why the standard hiring process cannot identify an equivalent candidate**:

The petitioner's unique profile combines:
1. **[Skill/Qualification 1]**: [Why this is rare in the U.S. workforce — cite BLS/O*NET]
2. **[Skill/Qualification 2]**: [Why rare, especially in combination with #1]
3. **[Skill/Qualification 3]**: [Why rare, especially in combination with #1 and #2]

"A standard labor market test is unlikely to identify a U.S. worker with this exact
combination because [explain]. According to [BLS/O*NET source], only [X%] of professionals
in this occupation have [characteristic], making the petitioner's combined profile
exceptionally rare in the U.S. labor market."

### C. ECONOMIC MULTIPLIER AND NATIONAL BENEFIT

The benefit of granting the waiver exceeds the labor protections served by PERM:

**Direct economic benefit**:
- Estimated economic value generated by the endeavor: $[X] million/year
- Method: [conservative calculation based on industry benchmarks]

**Employment multiplier**:
- U.S. jobs directly created/supported: [X] positions
- Industry employment multiplier (cite source): [X] indirect jobs per direct job
- Total U.S. employment impact: [X + indirect] positions

**Broader national benefit**:
- Number of Americans/organizations/communities that benefit
- Federal budget impact (tax revenue, reduced costs)
- Advancement of federal priorities (cite specific policy from Prong 1 section)

**Return on investment for the U.S.**:
"Granting the EB-2 NIW generates an estimated $[X] in economic value per [visa/dollar invested]
through [specific mechanism], compared to $[Y] if the petitioner must wait [Z] months
for PERM completion."

### D. BALANCE OF INTERESTS

Address the competing interest directly:

"We acknowledge that labor certification serves the important purpose of protecting
U.S. workers from displacement. However, in this case, that interest is outweighed by:
1. [Specific national need that cannot wait]
2. [Scarcity of qualified U.S. workers with this combination]
3. [Concrete harm to U.S. national interest from delay]"

"There is no indication that granting this waiver would displace U.S. workers because:
[specific reason — e.g., the endeavor creates new positions, addresses a documented shortage]."

### E. DHANASAR PRONG 3 LEGAL CONCLUSION

"For the foregoing reasons, on balance, it would be beneficial to the United States
to waive the job offer and labor certification requirements for [petitioner name].
The petitioner's proposed endeavor addresses a documented national need of substantial
importance, and the petitioner uniquely possesses the qualifications to advance it.
Requiring standard labor certification would impose an unjustified delay on work
of direct benefit to the United States, satisfying the third prong of Matter of
Dhanasar, 26 I&N Dec. 884 (AAO 2016)."

RULES: All dollar amounts based on documented industry sources or conservative calculations.
No invented statistics. Clearly label projections as estimates.'''


def get_section_technical_methodology_prompt() -> str:
    """Section 6 — Technical Methodology and Implementation (4–5 pages)"""
    return '''## SECTION 6: TECHNICAL METHODOLOGY AND IMPLEMENTATION

**Length**: 4–5 pages (approx. 2,000–2,500 words)
**Purpose**: Demonstrate technical credibility. Show HOW the endeavor will be executed,
grounding it in the petitioner's documented expertise.

### A. TECHNICAL APPROACH

**Core Methodology**:
Describe the technical or operational approach in detail:
- What methods, technologies, frameworks, or processes will be used?
- Why are these the best approaches for the stated goal?
- What innovations, if any, differentiate this approach from existing solutions?

**Connection to petitioner's expertise**:
For each technical component, map it to a specific documented credential or experience:

| Technical Component | Petitioner's Relevant Experience | Evidence |
|--------------------|----------------------------------|----------|
| [Component 1]      | [From CV: role, tool, project]  | Exhibit X |
| [Component 2]      | [From CV]                       | Exhibit Y |

### B. IMPLEMENTATION ROADMAP

**Phase 1 — Foundation** ([timeframe]):
- Objective: [specific deliverable]
- Key activities: [list 3–5 actions]
- Resources required: [personnel, tools, partnerships]
- Success indicator: [measurable milestone]

**Phase 2 — Development/Expansion** ([timeframe]):
- Objective: [specific deliverable]
- Key activities: [list]
- Success indicator: [measurable milestone]

**Phase 3 — Full Operation/Scale** ([timeframe]):
- Objective: [national-scale deployment or impact]
- Key activities: [list]
- Success indicator: [national impact metric]

### C. RISK ANALYSIS AND MITIGATION

Present 3–5 realistic risks with expert-based mitigations:

| Risk | Likelihood | Impact | Mitigation Strategy | Petitioner's Relevant Experience |
|------|-----------|--------|---------------------|----------------------------------|
| [Risk 1] | Medium | High | [Specific mitigation] | [From CV] |
| [Risk 2] | Low | High | [Mitigation] | [From CV] |

### D. RESOURCE REQUIREMENTS

**Human Capital**: Roles to be filled (including petitioner's own role and planned U.S. hires)
**Technology/Infrastructure**: Tools and platforms required
**Financial Resources**: Investment needed and source (note: specific financial projections are in Section 7)
**Partnerships**: Key institutional partnerships identified or planned

RULES: Technical claims should connect to CV. Avoid speculative technology claims not grounded in documented expertise.'''


def get_section_national_impact_prompt() -> str:
    """Section 7 — National Impact Assessment (3–4 pages)"""
    return '''## SECTION 7: NATIONAL IMPACT ASSESSMENT

**Length**: 3–4 pages (approx. 1,500–2,000 words)
**Purpose**: Quantify the projected national impact with conservative, credible methodology.
All projections must be clearly labeled as forward-looking estimates, not past achievements.

### A. IMPACT MODELING METHODOLOGY

"The following projections are forward-looking estimates based on:
- [Industry benchmark data source 1] for [what it measures]
- [Government data source 2] for [what it measures]
- Conservative [X%] adoption rate assumption (vs. [Y%] industry average)
- [Time horizon] planning window"

### B. DIRECT NATIONAL IMPACT

**Economic Impact**:
| Metric | Year 1 | Year 2 | Year 3 | Methodology |
|--------|--------|--------|--------|-------------|
| Revenue / economic value | $X | $X | $X | [how calculated] |
| Cost savings to beneficiaries | $X | $X | $X | [how calculated] |
| U.S. jobs directly supported | X | X | X | [employment ratio source] |

**Scale of Reach**:
| Metric | Year 1 | Year 3 | Basis |
|--------|--------|--------|-------|
| Geographic coverage | X states | X states | [rollout plan] |
| Organizations served | X | X | [market sizing] |
| Individuals benefiting | X | X | [population data] |

### C. INDIRECT AND MULTIPLIER EFFECTS

**Industry-Wide Impact**:
- Knowledge spillover: contributions to open standards, research, or policy
- Demonstration effect: how success could catalyze similar approaches
- Supply chain / ecosystem: indirect businesses supported

**Federal Fiscal Impact**:
- Tax revenue generated: $[X] annually at [X%] effective rate on projected revenue
- Government cost savings from improved service/reduced burden: $[X]

### D. ALIGNMENT WITH U.S. FEDERAL PRIORITIES

Map the impact to specific federal goals and metrics:

| Federal Priority | Specific Goal | Petitioner's Contribution | Federal Source |
|-----------------|--------------|--------------------------|----------------|
| [Priority 1]    | [Specific metric from law/program] | [How this endeavor helps] | [P.L./Agency] |
| [Priority 2]    | [Metric] | [Contribution] | [Source] |

### E. LIMITATIONS AND CONSERVATIVE ASSUMPTIONS

Explicitly acknowledge limitations to build credibility:
- "These projections assume [condition]; if [condition changes], impact may be [X% lower]"
- "The [X]% adoption rate is conservative compared to the [Y]% industry average, per [source]"
- "All financial projections are estimates and depend on successful execution of Phase [X]"

RULES: All projections clearly labeled "projected" or "estimated". All baselines from
real data sources. No invented specific numbers without showing calculation methodology.'''


def get_section_conclusion_prompt() -> str:
    """Section 8 — Conclusion and Request for Favorable Adjudication (1–2 pages)"""
    return '''## SECTION 8: CONCLUSION AND REQUEST FOR FAVORABLE ADJUDICATION

**Length**: 1–2 pages (approx. 500–800 words)
**Purpose**: Provide a crisp, authoritative closing that ties the three Dhanasar prongs
together and makes an explicit, confident request for approval.

### I. SUMMARY OF THE THREE PRONGS

"Under the three-prong test established in Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016),
[PETITIONER NAME]'s petition satisfies each prong as demonstrated throughout this document:

**PRONG 1 — SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE: SATISFIED**
The proposed [project title] addresses [specific national gap], affecting [X Americans /
$X billion in economic impact], as documented by [government source]. The endeavor has
substantial merit because [one-sentence merit summary], and its potential impact is
national in scope, extending across [geographic scale].

**PRONG 2 — WELL-POSITIONED TO ADVANCE THE ENDEAVOR: SATISFIED**
[PETITIONER NAME] is exceptionally qualified to execute this endeavor by virtue of
[key qualification 1], [key qualification 2], and [key qualification 3] — a combination
that is documented in [his/her] [X]-year career in [field] and verified by the exhibits
accompanying this petition. [His/Her] record of [key achievement] demonstrates a proven
ability to deliver results at the national scale required.

**PRONG 3 — BENEFICIAL TO WAIVE LABOR CERTIFICATION: SATISFIED**
The national interest served by [petitioner name]'s immediate contributions to [project title]
clearly outweighs the interest served by requiring standard labor certification. A [12–24 month]
PERM delay would cost the national interest [specific cost], and [his/her] unique combination
of skills is not readily available through a standard labor market test.

---

### II. FINAL REQUEST

"Accordingly, [PETITIONER NAME] respectfully requests that USCIS:

1. Find that [PETITIONER NAME] is qualified for classification as a member of the
   professions holding an advanced degree / a person of exceptional ability under
   INA §203(b)(2)(A);

2. Find that each of the three prongs of the national interest waiver test of
   Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016), has been satisfied; and

3. Approve the Form I-140 immigrant visa petition.

Granting this petition is clearly in the best interest of the United States."

---

### III. EXHIBIT INDEX

List all exhibits referenced throughout the document:
| Exhibit | Document | Purpose |
|---------|----------|---------|
| Exhibit A | Academic credentials / diplomas | Proves EB-2 eligibility |
| Exhibit B | Employment letters / records | Documents professional experience |
| Exhibit C | Professional certifications | Documents specialized training |
| Exhibit D | CV / Resume | Overview of qualifications |
| [Additional exhibits as referenced] | | |

RULES: Conclusion must be confident and legally precise. No hedging language like
"we believe" or "we think." Use "has been established," "demonstrates," "satisfies."'''


# ─── Batch configuration ──────────────────────────────────────────────────────
# 3 batches map to 9 sections.
GENERATION_BATCHES = [
    {
        "name": "Batch 1: Executive Summary + Eligibility + Proposed Endeavor",
        "sections": [1, 2, 3],
        "display_nums": ["0", "1", "2"],
        "titles": [
            "Executive Summary",
            "EB-2 Eligibility: Threshold Requirements",
            "The Proposed Endeavor",
        ],
        "prompts": [
            get_section_executive_summary_prompt,
            get_section_eb2_eligibility_prompt,
            get_section_proposed_endeavor_prompt,
        ],
        "min_words": 4000,
        "progress_range": (10, 38),
    },
    {
        "name": "Batch 2: Prong 1 + Prong 2 + Prong 3 (Core Legal Sections)",
        "sections": [4, 5, 6],
        "display_nums": ["3", "4", "5"],
        "titles": [
            "PRONG 1 - Substantial Merit and National Importance",
            "PRONG 2 - Petitioner Is Well-Positioned to Advance the Endeavor",
            "PRONG 3 - Beneficial to Waive Labor Certification",
        ],
        "prompts": [
            get_section_prong1_prompt,
            get_section_prong2_prompt,
            get_section_prong3_prompt,
        ],
        "min_words": 12000,
        "progress_range": (38, 78),
    },
    {
        "name": "Batch 3: Technical + Impact + Conclusion",
        "sections": [7, 8, 9],
        "display_nums": ["6", "7", "8"],
        "titles": [
            "Technical Methodology and Implementation",
            "National Impact Assessment",
            "Conclusion and Request for Favorable Adjudication",
        ],
        "prompts": [
            get_section_technical_methodology_prompt,
            get_section_national_impact_prompt,
            get_section_conclusion_prompt,
        ],
        "min_words": 5000,
        "progress_range": (78, 95),
    },
]

# Keep legacy function names used in server.py imports (backward compatibility)
def get_section_0_prompt() -> str:
    return get_section_executive_summary_prompt()

def get_section_2_5_prompt() -> str:
    return get_section_eb2_eligibility_prompt()

def get_section_7_prompt() -> str:
    return get_section_prong2_prompt()

def get_section_8_kpi_benchmark_prompt() -> str:
    return get_section_national_impact_prompt()

def get_section_12_risk_mitigation_prompt() -> str:
    return get_section_technical_methodology_prompt()

def get_evidence_checklist_prompt() -> str:
    return get_section_conclusion_prompt()
