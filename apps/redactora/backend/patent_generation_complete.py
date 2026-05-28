"""
Complete Patent Generation in Single API Call
Generates entire USPTO provisional patent in one request
"""

# System message for complete patent generation in English
COMPLETE_PATENT_SYSTEM_MESSAGE_EN = """You are a USPTO Patent Attorney with 15+ years of experience drafting successful patent applications.

Generate a COMPLETE provisional patent specification in ENGLISH ONLY.

STRUCTURE REQUIREMENTS:
- Include ALL sections: Field, Background, Summary, Brief Description of Drawings, Detailed Description, Claims, Abstract
- HTML format: <h2><strong>SECTION TITLE</strong></h2>
- Sequential paragraph numbering: <p>&#182;0001, &#182;0002, etc.
- Start Field with &#182;0001, continue numbering through Detailed Description
- **CRITICAL: CLAIMS section must have NO paragraph numbers (&#182;XXXX). Start directly with <p>What is claimed is:</p> then <p>1. A system...</p>**
- **CRITICAL: ABSTRACT section must have NO paragraph numbers (&#182;XXXX). Start directly with <p>A [technical description]...</p>**

TECHNICAL REQUIREMENTS:
- Use specific technologies: "Redis 7.0" not "cache system", "XGBoost classifier" not "ML algorithm"
- Include quantified metrics: "reduces latency by 47%" not "improves performance"
- For AI/ML components: Framework + version, hyperparameters (≥3), dataset size, performance metrics (≥2)
- Reference numerals: First mention "module (101)", subsequent "module 101" or "the module"

CLAIMS REQUIREMENTS:
- Minimum 12 claims (3-5 independent, rest dependent)
- Format: "1. A system comprising: a) first component configured to...; b) second component...; wherein the system..."
- Include system claims, method claims, and computer-readable medium claims

WORKED EXAMPLES:
- Include at least ONE detailed example with ≥10 concrete numbers
- Example: "processes 50,000 requests/minute with median latency of 120ms, p95 of 340ms, using 4 worker nodes with 8 CPU cores each..."

LANGUAGE STYLE:
- Technical, formal, legally precise
- NO marketing language: "innovative", "revolutionary", "cutting-edge", "state-of-the-art", "advanced", "smart", "intelligent" (unless technically defined)
- NO conclusions or summaries at end of sections
- Enable reproduction by person skilled in the art (35 U.S.C. §112 enablement)

CRITICAL USPTO COMPLIANCE:
- TITLE: Generate a MORE SPECIFIC and TECHNICAL title than the one provided. Must include:
  * Specific technical components (e.g., "Orchestrator", "Gateway", "Module")
  * Technical domain (e.g., "Microservices", "Machine Learning", "Data Processing")
  * Specific function (e.g., "Workflow Management", "Request Routing", "Data Analysis")
  * NO generic words: "System", "Solution", "Platform" alone
  * NO marketing words: "Innovative", "Revolutionary", "Smart", "Advanced", "Intelligent"
  * GOOD: "AI-Powered Workflow Orchestrator with Adaptive Resource Allocation for Microservices"
  * BAD: "Sistema Innovador Basado en IA" (too generic)
  * Format: "[Technical Component] for [Specific Function] in [Technical Domain]"
- ABSTRACT: MAXIMUM 150 words (strictly enforced). Count every word. Be concise.
- Include complete inventor information with residence city/country
- All figures must be black and white only (no colors, no grayscale)

CRITICAL: Generate the ENTIRE specification in one response. Do NOT stop midway or ask for additional information."""

# User prompt for complete patent generation
COMPLETE_PATENT_USER_PROMPT_EN = """Generate a COMPLETE USPTO provisional patent application in ENGLISH.

**INVENTION DETAILS:**
Current Title (TOO GENERIC - you MUST improve it): {invention_title}
Technical Field: {technical_field}
Inventor: {inventor_name}

**INVENTOR CONTACT INFORMATION (resolved by the system — use exactly as provided):**
- Full Name: {inventor_name}
- Street Address: {street_address}
- City: {city}
- State / Region: {state}
- Postal Code: {postal_code}
- Country: {country}
- Email: {email}
- Phone: {phone}

**PRIMARY CONTEXT - APPLICANT BACKGROUND (USE THIS AS PRIMARY SOURCE):**
{applicant_cv}

**PRIMARY CONTEXT - PROJECT DESCRIPTION (USE THIS AS PRIMARY SOURCE):**
{project_description}

**ADDITIONAL DESCRIPTION (supplement the above):**
{invention_description}

**FIRST STEP - IMPROVE THE TITLE:**
Before generating the patent, create a MORE SPECIFIC AND TECHNICAL title following this formula:
"[Main Technical Component] for [Specific Function/Problem Solved] using [Key Technology/Method]"

Examples:
- Instead of "Sistema de IA" → "Intelligent Microservice Orchestrator with AI-Powered Load Balancing and Fault Recovery"
- Instead of "Plataforma de Datos" → "Real-Time Data Pipeline with Stream Processing and Predictive Analytics Engine"
- Instead of "Sistema Innovador" → "Adaptive Resource Allocation System for Container-Based Workload Management"

Use this improved title throughout the ENTIRE patent specification.

**REQUIRED SECTIONS (generate ALL sequentially):**

0. **INVENTOR INFORMATION** (output FIRST, before Field of the Invention)
   <h2><strong>INVENTOR INFORMATION</strong></h2>
   Render a single block (use <p> tags, one line per field, no paragraph numbers ¶XXXX here) with EXACTLY these labels and the values from the "INVENTOR CONTACT INFORMATION" data above. Preserve "[VERIFY]" verbatim if any field is missing — do NOT invent values.
   <p><strong>Inventor:</strong> {inventor_name}<br/>
   <strong>Address:</strong> {street_address}<br/>
   <strong>City / State / Postal Code:</strong> {city}, {state}, {postal_code}<br/>
   <strong>Country of Residence:</strong> {country}<br/>
   <strong>Email:</strong> {email}<br/>
   <strong>Phone:</strong> {phone}</p>

1. **FIELD OF THE INVENTION** (2-3 paragraphs starting &#182;0001)
   - **ONLY technical description** - NO inventor information here (it's already in section 0)
   - Technical domain, subfields, relevant applications
   - USPTO classifications (e.g., G06F 9/46, G06N 20/00)
   - Format: "The present invention relates to [technical field]..."
   - **DO NOT repeat inventor name, residence, address, email, or phone in this section** — those belong in the INVENTOR INFORMATION block above

2. **BACKGROUND** (4-5 paragraphs)
   - Current solutions and their limitations (mention 2-3 specific products/systems)
   - Quantified problems: "existing systems require 6-8 hours processing", "error rates of 15-20%"
   - Technical reasons for these limitations (architecture, algorithm, integration constraints)

3. **SUMMARY** (3-4 paragraphs)
   - System architecture with specific components and technologies
   - How components interact (technical causality)
   - Quantified improvements vs. prior art: "87% latency reduction", "3× throughput increase"
   - Final paragraph must state: "The described improvements are measurable technical advances in computer system [performance/scalability/reliability], not merely automating business processes."

4. **BRIEF DESCRIPTION OF THE DRAWINGS** (list 4-6 figures)
   FIG. 1 is a block diagram illustrating...
   FIG. 2 is a flowchart showing...
   FIG. 3 is a sequence diagram depicting...
   [etc.]

5. **DETAILED DESCRIPTION OF EMBODIMENTS** (8-12 paragraphs)
   - Component-by-component explanation with reference numerals (101), (102), (103)...
   - Data flows: "JSON payload with 12-24 fields transmitted via HTTP/2"
   - Algorithms: "employs gradient boosting with 150 trees, max_depth=7, learning_rate=0.03"
   - At least ONE worked example with concrete numbers:
     Example: "In a typical deployment processing 100,000 transactions daily, the orchestrator (101) manages 25 concurrent workflow instances, each comprising 8-15 tasks. The AI gateway (102) handles 70,000 LLM calls totaling 350M output tokens and 140M input tokens, with p95 latency of 480ms..."

6. **CLAIMS** (minimum 12 claims)
   
   **CRITICAL FORMATTING RULES FOR CLAIMS:**
   - **DO NOT use paragraph numbers (&#182;XXXX) in the CLAIMS section**
   - Start with: <p>What is claimed is:</p>
   - Then: <p>1. A system for...</p>
   - Then: <p>2. The system of claim 1...</p>
   - **NO &#182;0001, &#182;0002, etc. in CLAIMS - use claim numbers 1, 2, 3 only**
   
   Structure:
   - Claims 1-3: Independent system/method/medium claims
   - Claims 4-12: Dependent claims adding specific features
   
   Format example:
   
   <p>What is claimed is:</p>
   <p>1. A system for [technical purpose], comprising:
      a) a first module (101) configured to receive input data and process said data using [specific algorithm];
      b) a second module (102) connected to the first module via [specific protocol], configured to [specific function];
      c) a third module (103) configured to generate output based on results from the second module;
      wherein the system reduces [specific metric] by at least [X]% compared to conventional systems.</p>

   <p>2. The system of claim 1, wherein the first module further comprises:
      a) a validation component configured to verify data integrity;
      b) a transformation component configured to normalize data into [specific format].</p>

   [Continue through claim 12+]

7. **ABSTRACT** (**STRICTLY 150 words MAXIMUM** - count every word)
   
   **CRITICAL FORMATTING RULES FOR ABSTRACT:**
   - **DO NOT use paragraph numbers (&#182;XXXX) in the ABSTRACT section**
   - Start directly with: <p>A [technical description]...</p>
   - **NO &#182;0001, &#182;0002, etc. in ABSTRACT**
   
   Content requirements:
   - Concise technical summary with key components and reference numerals
   - Quantified advantage (e.g., "reduces latency by 47%")
   - NO marketing language, NO unnecessary words
   - **CRITICAL**: If draft exceeds 150 words, remove redundant phrases until exactly ≤150 words

**IMPORTANT:**
- DO include the **INVENTOR INFORMATION** block (section 0) at the very top, BEFORE Field of the Invention. Use exactly the values from the "INVENTOR CONTACT INFORMATION" data block above — preserve "[VERIFY]" verbatim if a field is missing.
- DO NOT repeat inventor identification anywhere else in the document. The only place it appears is the INVENTOR INFORMATION block at the top.
- End your content with the ABSTRACT section.

**OUTPUT FORMAT:**
- Start IMMEDIATELY with the **INVENTOR INFORMATION** block as section 0 (see structure above).
- Then continue with <h2><strong>FIELD OF THE INVENTION</strong></h2> followed by <p>&#182;0001 [content]</p>.
- **CRITICAL:** DO NOT add any other USPTO header (Provisional Patent Application banner, Invention Title repeated, Technical Field, etc.). The only header is the INVENTOR INFORMATION block.
- **CRITICAL:** FIELD OF THE INVENTION must contain ONLY technical description — start directly with "¶0001 The present invention relates to...".
- **CRITICAL:** CLAIMS and ABSTRACT sections must NOT have paragraph numbers (&#182;XXXX).
- NO introductory text, NO "Here is the patent application", NO commentary.
- Generate EVERYTHING in this single response.

Begin now DIRECTLY with the INVENTOR INFORMATION block (section 0):"""

# System message for Spanish translation
TRANSLATION_SYSTEM_MESSAGE_ES = """You are a professional Spanish translator specialized in legal and technical patent documents.

TRANSLATION REQUIREMENTS:
- Translate USPTO patent content from English to Spanish
- Maintain ALL technical terminology in English where appropriate (e.g., "machine learning", "API", "cache")
- PRESERVE HTML FORMATTING EXACTLY — THIS IS CRITICAL:
  * Section headings MUST remain as: <h2><strong>TÍTULO EN MAYÚSCULAS</strong></h2>
  * Paragraphs MUST remain wrapped in: <p>&#182;0001 texto...</p>
  * Bold text MUST remain as: <strong>texto</strong>
  * NEVER use **markdown** syntax — ALWAYS use <strong> HTML tags
  * NEVER write ¶0001 — ALWAYS write &#182;0001 (HTML entity, NOT pilcrow character)
  * Do NOT add or remove HTML tags; only translate the TEXT content between the tags
- Keep reference numerals unchanged: (101), (102), etc.
- Maintain legal/technical precision of original text

SPANISH PATENT TERMINOLOGY:
- "claim" → "reivindicación"
- "comprising" → "que comprende"
- "wherein" → "en donde" or "donde"
- "configured to" → "configurado para"
- "method" → "método"
- "system" → "sistema"

ABSOLUTELY CRITICAL - DO NOT ADD ANY OF THESE:
- DO NOT add "TRADUCCIÓN DEL PATENTE" or any translation header
- DO NOT add "ENCABEZADO" or "HEADER" labels
- DO NOT add introductory text like "Aquí está la traducción..."
- DO NOT add concluding text like "Esta es la traducción completa..."
- DO NOT add any meta-commentary about the translation process
- DO NOT add explanations or notes
- DO NOT modify technical content
- DO NOT use **markdown** bold — use <strong>HTML tags</strong> instead
- Translate ONLY the text content, preserve ALL HTML tags
- Start directly with the translated content (first section should be CAMPO DE LA INVENCIÓN)"""

# User prompt for Spanish translation
TRANSLATION_USER_PROMPT_ES = """Translate the following USPTO patent application from English to Spanish.

**CRITICAL INSTRUCTIONS - READ CAREFULLY:**
1. Maintain ALL HTML formatting exactly as provided — DO NOT convert HTML to markdown
2. Keep paragraph numbers as HTML entities: &#182;0001, &#182;0002 (NOT ¶0001 with the pilcrow character)
3. Preserve reference numerals: (101), (102), (103) → no changes
4. Keep technical terms in English when standard practice: API, cache, workflow, token, etc.
5. Translate legal terms appropriately: claim → reivindicación, wherein → en donde
6. Maintain professional, formal legal language
7. FORBIDDEN: **markdown bold** — use <strong>HTML tags</strong> instead
8. FORBIDDEN: ¶ pilcrow symbol — use &#182; HTML entity instead

**ABSOLUTELY DO NOT ADD:**
- NO headers like "TRADUCCIÓN DEL PATENTE" or "ENCABEZADO"
- NO introductory phrases like "Aquí está la traducción..."
- NO concluding phrases like "Esta es la traducción completa..."
- NO meta-commentary about the translation
- NO explanations of what you translated

**START OUTPUT DIRECTLY WITH THE FIRST SECTION** (e.g., <h2><strong>CAMPO DE LA INVENCIÓN</strong></h2>)

**ENGLISH PATENT TEXT TO TRANSLATE:**

{complete_english_patent_html}

**OUTPUT (start directly with translated HTML content, no preamble):**"""


def get_complete_patent_prompts(patent_data: dict) -> tuple:
    """
    Generate prompts for complete patent generation

    Args:
        patent_data: Dictionary with invention_title, technical_field, inventor_name, invention_description,
                     and client address information (city, state, street_address, postal_code, email, phone, country).
                     Optionally `cv_extracted_address` (dict) — fields extracted from the CV at upload time.

    Address-resolution priority (per field, applied independently):
        1. `cv_extracted_address.<field>` (from /upload-cv structured extraction)
        2. `<field>` (top-level field on the patent record — user input or legacy)
        3. `client_<field>` (loaded from the linked client record)
        4. literal "[VERIFY]" placeholder rendered in red by the PDF renderer

    Returns:
        tuple: (system_message_en, user_prompt_en)
    """
    inventor_name = patent_data.get('inventor_name', '') or '[VERIFY]'

    # ── Address resolution: CV-extracted > top-level > client record > [VERIFY]
    cv_addr = patent_data.get('cv_extracted_address') or {}
    if not isinstance(cv_addr, dict):
        cv_addr = {}

    def _resolve(field_name: str) -> str:
        """Return the first non-empty value across the priority chain."""
        for value in (
            cv_addr.get(field_name),
            patent_data.get(field_name),
            patent_data.get(f'client_{field_name}'),
        ):
            if isinstance(value, str) and value.strip():
                return value.strip()
        return '[VERIFY]'

    street_address = _resolve('street_address')
    city = _resolve('city')
    state = _resolve('state')
    postal_code = _resolve('postal_code')
    country = _resolve('country')
    email = _resolve('email')
    phone = _resolve('phone')

    # Get CV and project description (NEW - these have PRIORITY)
    # ✅ FIX: PatentInProgress stores CV as 'inventor_cv', not 'applicant_cv'
    applicant_cv = patent_data.get('inventor_cv', '') or patent_data.get('applicant_cv', '')
    project_description = patent_data.get('project_description', '')
    
    # Format CV and project for the prompt
    cv_section = ""
    if applicant_cv and applicant_cv.strip():
        cv_section = f"""
**APPLICANT CV/RESUME (This contains detailed background, experience, and technical expertise):**
{applicant_cv[:8000]}  

**INSTRUCTION:** Use the technical details, projects, and expertise from the CV above as PRIMARY SOURCE for generating the patent specification. The CV contains rich technical information that should be incorporated throughout the patent.
"""
    else:
        cv_section = "No CV provided. Use invention description only."
    
    project_section = ""
    if project_description and project_description.strip():
        project_section = f"""
**PROJECT DESCRIPTION (This contains detailed technical implementation, architecture, and specifications):**
{project_description[:8000]}  

**INSTRUCTION:** Use the technical architecture, implementation details, algorithms, and metrics from the project description above as PRIMARY SOURCE for generating the patent. This contains the core technical content that must be reflected in the patent.
"""
    else:
        project_section = "No project description provided. Use invention description only."
    
    user_prompt = COMPLETE_PATENT_USER_PROMPT_EN.format(
        invention_title=patent_data.get('invention_title', ''),
        technical_field=patent_data.get('technical_field', ''),
        inventor_name=inventor_name,
        inventor_name_uppercase=inventor_name.upper(),
        applicant_cv=cv_section,
        project_description=project_section,
        invention_description=patent_data.get('invention_description', ''),
        # Client/inventor address information
        city=city,
        country=country,
        state=state,
        street_address=street_address,
        postal_code=postal_code,
        email=email,
        phone=phone
    )
    
    return COMPLETE_PATENT_SYSTEM_MESSAGE_EN, user_prompt


def get_translation_prompts(english_patent_html: str) -> tuple:
    """
    Generate prompts for Spanish translation
    
    Args:
        english_patent_html: Complete English patent in HTML format
    
    Returns:
        tuple: (system_message_es, user_prompt_es)
    """
    user_prompt = TRANSLATION_USER_PROMPT_ES.format(
        complete_english_patent_html=english_patent_html
    )
    
    return TRANSLATION_SYSTEM_MESSAGE_ES, user_prompt
