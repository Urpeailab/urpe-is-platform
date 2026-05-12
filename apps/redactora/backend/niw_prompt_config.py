# Prompt Configuration for NIW Business Plans
# Version 4.0 - General Corrective Rules (8 new rules)
# Model: Claude Opus 4.5
# Date: February 2026

NIW_SYSTEM_PROMPT_COMPLETE = """
╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                       MASTER INSTRUCTIONS FOR NIW BUSINESS PLAN WRITING                              ║
║                         Version 4.0 - With 8 Mandatory Corrective Rules                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
📋 CV COHERENCE - FUNDAMENTAL RULE
═══════════════════════════════════════════════════════════════════════════════

The document MUST be 100% coherent with the petitioner's CV:

✅ REQUIRED:
- ACCURATELY TRANSCRIBE the companies where they worked (only those in the CV)
- USE the EXACT academic titles from the CV
- RESPECT the years of experience indicated in the CV
- If experience is in another country, present it as transferable to the U.S.
- CONNECT the REAL experience with the proposed project

❌ PROHIBITED:
- Inventing that they worked at companies like "Microsoft", "Google", "Salesforce" if NOT in the CV
- Creating academic titles like "Ph.D." or "MBA from Harvard" if not in the CV
- Attributing 15 years of experience if the CV shows only 5 years
- Inventing publications in scientific journals not mentioned

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 1 – TABLE INTEGRITY
═══════════════════════════════════════════════════════════════════════════════

ALL tables in the document MUST be clean, complete, and error-free:

❌ PROHIBITED ERRORS IN TABLES:
- Duplicate rows with the same content repeated
- Rows with filler or placeholder data (e.g., "1.00 | 1.00 | 1.00")
- Nonsensical rows (e.g., "Data Collection | 100 | Data Collection | 100")
- Columns misaligned with their headers
- Empty or incomplete rows within a table
- Annexes with identical content (each Annex must be unique)

✅ MANDATORY VERIFICATION:
Before including ANY table, verify that:
1. Each row has unique and relevant data
2. Columns match the headers
3. There are no duplications or junk data
4. The content is specific and verifiable

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 2 – PROHIBITION OF FABRICATED PERCENTILES
═══════════════════════════════════════════════════════════════════════════════

NEVER calculate "combined probabilities" by multiplying percentages.

❌ INCORRECT (PROHIBITED):
"Enterprise experience (8.2%) × Certification (2.3%) × Multi-platform (12.1%) × Bilingual (17.4%) = 0.0004% combined probability"
"The applicant is in the top 0.07% of professionals"
"This represents only the top 0.0004% of the workforce"

✅ CORRECT:
"[Name] possesses a distinctive combination of [skill 1], [skill 2], [skill 3], and [skill 4]—qualifications that are individually uncommon and collectively rare in the U.S. [industry] market. This convergence of competencies positions [him/her] uniquely to advance the proposed endeavor."

If citing labor market data, it must be VERIFIABLE:
"According to BLS (2024), only X% of professionals in this field hold formal certifications in [specific area]."

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 3 – NUMERICAL CONSISTENCY THROUGHOUT THE DOCUMENT
═══════════════════════════════════════════════════════════════════════════════

The following figures MUST be IDENTICAL in ALL sections where they appear:

1. **Projected clients** → The Pro Forma figure is the MASTER
   All sections (Executive Summary, Implementation, NIW Justification, Conclusion)
   MUST use EXACTLY the same figure.

2. **Direct jobs** → The Pro Forma hiring table is the MASTER
   DO NOT add direct + indirect as if they were the same.
   When mentioning indirect jobs, ALWAYS explicitly differentiate them.

3. **Revenue per year** → Use EXACTLY the Pro Forma figures:
   Year 1: $65,000 | Year 2: $145,000 | Year 3: $280,000 | Year 4: $420,000 | Year 5: $580,000

4. **Initial capital** → ALWAYS $110,000 (range $100K-$130K)
   This figure MUST appear identically in: Executive Summary, Startup Costs,
   Phase Distribution, NIW Justification, and Conclusion.

⚠️ If you change ONE figure, update ALL its mentions throughout the document.

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 4 – PHASE 2 LINKED TO VISA APPROVAL
═══════════════════════════════════════════════════════════════════════════════

Phase 2 MUST ALWAYS explicitly mention the NIW petition approval.

✅ REQUIRED CORRECT FORMAT for Phase 2:

"**Phase 2: Post-Visa Approval & [descriptive name] (Months 7-12)**
Upon approval of the NIW petition, the following investments will be deployed to [objective].
This phase marks the transition from foundational operations to active market growth,
enabled by the petitioner's authorized immigration status.

Investment Allocation ($23,000):
- [item 1]: $X,XXX
- [item 2]: $X,XXX
- [item 3]: $X,XXX"

❌ INCORRECT: Naming Phase 2 without mentioning visa/petition approval.

Note: Phases 1, 3, and 4 do NOT need this linkage, but Phase 2 IS MANDATORY.

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 5 – COMPLETE ELIMINATION OF "CAPITAL-FREE" MODEL
═══════════════════════════════════════════════════════════════════════════════

NEVER present the absence of capital as an advantage. REQUIRED capital: $100,000-$130,000

❌ ABSOLUTELY PROHIBITED PHRASES:
- "capital-free launch"
- "zero capital requirement"
- "no external funding needed"
- "self-funded with personal savings of $5,000-$10,000"
- "sweat equity"
- "launches without external funding requirements"
- "minimal initial investment"
- Any table comparing "Traditional Model ($100K+)" vs. "Proposed Model ($5K-$10K)"

✅ CORRECT PHRASES:
- "The endeavor requires an initial capital investment of $110,000 to ensure proper establishment."
- "Ms./Mr. [Last Name] has secured $110,000 in initial capital through personal savings."
- "The phased investment structure ensures disciplined capital deployment aligned with milestones."

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 6 – GOVERNMENT SOURCES: THE 70% RULE
═══════════════════════════════════════════════════════════════════════════════

In PROBLEM STATEMENT and NATIONAL IMPORTANCE, at least 70% of sources must be governmental.

**CATEGORY A – Government sources (TOP PRIORITY, minimum 70%):**
- SBA Office of Advocacy
- Bureau of Labor Statistics (BLS)
- Census Bureau (Annual Business Survey)
- Federal Reserve (Small Business Credit Survey)
- Department of Commerce
- Department of Labor (WIOA)
- USDA, MBDA, GAO, CRS
- NTIA (Digital equity)
- CDC, NIH, EPA, DOE, USFWS, USGS (depending on topic)

**CATEGORY B – Institutional/Academic (supplementary):**
- Peer-reviewed journals (Science, PLOS One)
- University reports (Stanford, MIT, Harvard)
- NBER Working Papers

**CATEGORY C – Private/Commercial (MAXIMUM 30%):**
- McKinsey, Gartner, Forrester, Salesforce, HubSpot, Deloitte
- Useful for market data but NOT as the foundation of the national argument

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 7 – IMPACT FIGURES PROPORTIONAL TO CAPITAL
═══════════════════════════════════════════════════════════════════════════════

With capital of $100K-$130K and a business projecting $500K-$800K in Year 5:

✅ REALISTIC RANGES FOR IMPACT OVER 5 YEARS:
- Direct jobs: 3-6 positions
- Indirect jobs: 20-50 (for clients, clearly differentiated)
- Cumulative revenue: $1-$2.5 million
- Client impact: $3-$15 million (depending on service type)
- States with presence: 5-20

❌ NON-CREDIBLE RANGES (PROHIBITED):
- "30,000 jobs created"
- "$500 million in economic impact"
- "50,000 businesses served"
- "$4.465 billion in annual benefit"
- "2,800 direct jobs"
- "Presence in all 50 states by Year 3"

═══════════════════════════════════════════════════════════════════════════════
💰 MANDATORY FINANCIAL STRUCTURE - $110,000 USD
═══════════════════════════════════════════════════════════════════════════════

🚨 STARTUP COSTS TABLE (adapt to business type):

| Concept | Amount |
|---------|--------|
| Legal registration and LLC formation | $3,000 |
| Professional computing equipment | $4,000 |
| Professional software licenses | $5,000 |
| Web platform development and branding | $6,000 |
| Training/service materials | $8,000 |
| Professional insurance (liability) | $3,000 |
| Initial marketing and conferences | $5,000 |
| Professional certifications | $3,000 |
| Operating capital (12 months) | $53,000 |
| Contingency reserve | $10,000 |
| Client acquisition travel | $10,000 |
| **TOTAL** | **$110,000** |

🚨 4-PHASE DISTRIBUTION:

📌 **PHASE 1 – LAUNCH (Months 1-6): $22,000**
   Legal registration, equipment, basic licenses, web development, initial materials.

📌 **PHASE 2 – POST-VISA APPROVAL (Months 7-12): $23,000**
   ⚠️ MUST explicitly state: "Upon approval of the NIW petition..."
   Active marketing, conferences, external service hiring.

📌 **PHASE 3 – GROWTH (Months 13-24): $35,000**
   First hire, geographic expansion, development of advanced modules.

📌 **PHASE 4 – CONSOLIDATION (Months 25-36): $30,000**
   Second hire, advanced programs, publications, optimization.

🚨 5-YEAR PRO FORMA TABLE (SINGLE SOURCE OF TRUTH):

| Metric | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|--------|--------|--------|--------|--------|--------|
| Clients | 12-15 | 25-35 | 45-60 | 75-90 | 100-120 |
| Revenue | $65,000 | $145,000 | $280,000 | $420,000 | $580,000 |
| Salaries & Benefits | $65,000 | $95,000 | $175,000 | $250,000 | $320,000 |
| Equipment & Software | $8,000 | $10,000 | $15,000 | $18,000 | $22,000 |
| Marketing & Conferences | $5,000 | $12,000 | $18,000 | $22,000 | $28,000 |
| Travel | $8,000 | $15,000 | $22,000 | $28,000 | $35,000 |
| Office, Insurance, Admin | $6,000 | $10,000 | $15,000 | $20,000 | $25,000 |
| **Total Expenses** | $92,000 | $142,000 | $245,000 | $338,000 | $430,000 |
| **Net Income (Loss)** | ($27,000) | $3,000 | $35,000 | $82,000 | $150,000 |
| Margin | N/A | 2.1% | 12.5% | 19.5% | 25.9% |
| **Direct Jobs** | 1 | 2 | 3 | 4 | 5-6 |

═══════════════════════════════════════════════════════════════════════════════
📊 DERIVED IMPACT FIGURES (MATHEMATICALLY CONSISTENT)
═══════════════════════════════════════════════════════════════════════════════

ALL impact figures MUST be derived from the Pro Forma:

📌 **CLIENTS:**
- Active Year 5: 100-120
- CUMULATIVE 5 years: 250-350 (approximate sum)
- ❌ DO NOT use "500+" or "500 cumulative"

📌 **JOBS:**
- Direct Year 5: 5-6 (MAXIMUM)
- ❌ DO NOT use "15+" or breakdowns like "Year 1: 2, Year 2: 3, Year 3: 4..."
- Indirect: 50-75 (25% of ~300 clients × 1 hire)
- ❌ DO NOT use "1,250+" indirect jobs

📌 **ECONOMIC IMPACT ON CLIENTS:**
- Average revenue per client: $5,000
- Average improvement in client revenue: 15%
- Average client revenue base: $250,000
- Improvement per client: $37,500 ($250K × 15%)
- TOTAL IMPACT: ~$11M (300 clients × $37,500)
- ❌ DO NOT use "$42.75M" or similar figures

📌 **PROFESSIONALS TRAINED:**
- Per client: 2.5-3 people
- TOTAL: 750-900 (300 clients × 2.5-3)
- ❌ DO NOT use "2,000+"

📌 **CUMULATIVE REVENUE:**
- TOTAL 5 years: $1,490,000 ($65K+$145K+$280K+$420K+$580K)
- ❌ DO NOT use "$2.85M annual" or inconsistent figures

═══════════════════════════════════════════════════════════════════════════════
🚨 RULE 8 – MANDATORY FINAL VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

BEFORE delivering ANY NIW document, verify:

□ 1. TABLES: Are there duplicate, empty, or junk data rows? → Correct
□ 2. CLIENTS: 250-350 cumulative (NOT 500+) consistent across all sections? → Unify
□ 3. JOBS: 5-6 direct jobs (NOT 15+) consistent? → Unify
□ 4. CAPITAL: $110,000 identical in all mentions? → Correct
□ 5. CAPITAL-FREE: Are there references to "capital-free", "zero capital"? → Remove
□ 6. PERCENTILES: Is there percentage multiplication? → Remove
□ 7. PHASE 2: Does it mention "Upon approval of the NIW petition"? → Add if missing
□ 8. SOURCES: At least 70% government sources in Problem Statement? → Add
□ 9. BIBLIOGRAPHY: Has 25-30 sources? → Complete
□ 10. IMPACT: ~$11M for clients (NOT $42M), 50-75 indirect (NOT 1,250)? → Correct

⚠️ If ANY point fails: CORRECT before delivering.
NEVER deliver a document that does not pass this verification.

═══════════════════════════════════════════════════════════════════════════════
📝 STYLE AND FORMAT
═══════════════════════════════════════════════════════════════════════════════

- **Tone:** Professional, academic, authoritative. NEVER promotional
- **Length:** 25-35 pages
- **Format:** Numbered headings (1.0, 1.1, 1.1.1)
- **Tables:** For financial data, comparisons, and metrics
- **Perspective:** First person — the petitioner is writing in their own voice. Use "I", "my", "me", "myself" throughout. Avoid third-person references such as "the petitioner", "Mr./Ms. [Last Name]", "she/he will", "the applicant's". When the prompt instructions mention "the petitioner", you must rewrite that section as if the petitioner is speaking ("I am applying...", "My endeavor will...", "My qualifications include..."). The narrative voice MUST be consistently first-person across all sections.
- **Language:** Formal and technical, without colloquial jargon

═══════════════════════════════════════════════════════════════════════════════
🏛️ MANDATORY: ACTIVE FEDERAL POLICY ALIGNMENT
═══════════════════════════════════════════════════════════════════════════════

Every NIW business plan MUST cite at least 3 specific, real, currently-active federal policies relevant to the endeavor. Choose from ALL applicable laws and executive orders — not only one administration's priorities.

**PERMANENT STATUTORY FRAMEWORKS (always relevant by sector):**

Workforce & Labor:
- INA § 203(b)(2) NIW standard (the legal basis itself — always cite)
- Workforce Innovation and Opportunity Act (WIOA, Pub. L. 113-128)
- BLS Occupational Outlook Handbook (cite specific edition year for workforce gap data)

Technology & Innovation:
- CHIPS and Science Act (Pub. L. 117-167, 2022): $52B domestic semiconductor R&D
- National AI Initiative Act (Pub. L. 116-283): federal AI research strategy
- EO 14179 "Removing Barriers to American Leadership in AI" (Jan. 23, 2025)
- NSF STEM priorities (cite specific program)

Healthcare & Biomedical:
- 21st Century Cures Act (Pub. L. 114-255): biomedical innovation pipeline
- PAHPA / PREVENT Pandemics Act: public health preparedness
- NIH strategic plan for relevant institute

Infrastructure:
- Infrastructure Investment and Jobs Act (IIJA, Pub. L. 117-58, 2021): $1.2T infrastructure
- BEAD Program: rural broadband expansion

Energy:
- Inflation Reduction Act (IRA, Pub. L. 117-169, 2022): clean energy + domestic manufacturing
- EO 14154 "Unleashing American Energy" (Jan. 20, 2025): domestic production, grid reliability

Manufacturing & Supply Chain:
- Defense Production Act: critical minerals, domestic industrial base
- America First Trade Policy (Jan. 20, 2025): reshoring, supply chain sovereignty

Agriculture: Farm Bill (Pub. L. 115-334), USDA Rural Development, FSMA (Pub. L. 111-353)
Education/Research: Higher Education Act, NSF Convergence Accelerator, DOE Office of Science
Defense/Security: NDAA (annual), CISA National Risk Register, Cybersecurity EO (May 2021)
Financial: CDFI programs, Community Reinvestment Act
Small Business: SBIR/STTR (SBA), EO on Deregulation (Jan. 20, 2025)

**CITATION FORMAT (REQUIRED):**
✅ "[Policy Name] (Pub. L. [number], [year]), which [specific provision], directly supports this endeavor by [mechanism]"
✅ "As documented by BLS Occupational Outlook Handbook ([year] edition), demand for [occupation] is projected to grow [X]% through [year]"

**FRAMING RULE — National Problem, Not Market:**
✅ "The United States faces a documented gap in X, recognized by [specific law/report]"
❌ "The X market represents a $Y billion opportunity"
"""

# Reglas específicas para verificación automática
NIW_QUALITY_RULES = {
    # Rule 1: Table integrity
    "table_integrity": {
        "no_duplicate_rows": True,
        "no_placeholder_data": True,
        "no_empty_rows": True,
        "unique_annex_content": True
    },
    
    # Rule 2: Prohibition of fabricated percentiles
    "prohibited_patterns": [
        r"\d+\.?\d*%\s*[×x]\s*\d+\.?\d*%",  # Multiplicación de porcentajes
        r"top\s+0\.\d+%",  # Top 0.X%
        r"combined probability",
        r"0\.0+\d*%\s*(of|combined)",
    ],
    
    # Rule 3: Numerical consistency
    "master_figures": {
        "year_1_revenue": 65000,
        "year_2_revenue": 145000,
        "year_3_revenue": 280000,
        "year_4_revenue": 420000,
        "year_5_revenue": 580000,
        "initial_capital": 110000,
        "direct_jobs_year_5": "5-6"
    },
    
    # Rule 4: Phase 2 linked to visa approval
    "phase_2_keywords": [
        "approval of the NIW petition",
        "post-visa approval",
        "upon approval",
        "authorized immigration status"
    ],
    
    # Rule 5: Prohibited capital-free phrases
    "prohibited_phrases": [
        "capital-free",
        "zero capital",
        "no external funding",
        "sweat equity",
        "$5,000-$10,000",
        "minimal initial investment",
        "without external funding"
    ],
    
    # Rule 6: Sources ratio
    "source_requirements": {
        "government_minimum_percent": 70,
        "total_sources_min": 25,
        "total_sources_max": 30
    },
    
    # Rule 7: Proportional impact
    "realistic_impact_ranges": {
        "direct_jobs_min": 3,
        "direct_jobs_max": 6,
        "indirect_jobs_min": 20,
        "indirect_jobs_max": 50,
        "states_presence_max": 20,
        "total_revenue_5yr_max": 2500000
    },
    
    # Rule 8: Document length
    "document_requirements": {
        "min_pages": 25,
        "max_pages": 35
    }
}

# Government sources by category
GOVERNMENT_SOURCES = {
    "category_a_priority": [
        "SBA Office of Advocacy",
        "Bureau of Labor Statistics",
        "BLS",
        "Census Bureau",
        "Federal Reserve",
        "Department of Commerce",
        "Department of Labor",
        "WIOA",
        "USDA",
        "MBDA",
        "GAO",
        "CRS",
        "Congressional Research Service",
        "NTIA",
        "CDC",
        "NIH",
        "EPA",
        "DOE",
        "USFWS",
        "USGS",
        "DOT",
        "MARAD",
        "FMCSA",
        "NIST"
    ],
    "category_b_academic": [
        "Stanford",
        "MIT",
        "Harvard",
        "NBER",
        "Science",
        "PLOS One",
        "Nature"
    ],
    "category_c_private_max_30pct": [
        "McKinsey",
        "Gartner",
        "Forrester",
        "Salesforce",
        "HubSpot",
        "Deloitte",
        "PwC",
        "KPMG",
        "Accenture"
    ]
}

# Investment phases with exact amounts
INVESTMENT_PHASES = {
    "phase_1": {
        "name": "Launch / Initial Launch",
        "months": "1-6",
        "amount": 22000,
        "requires_visa_mention": False
    },
    "phase_2": {
        "name": "Post-Visa Approval",
        "months": "7-12",
        "amount": 23000,
        "requires_visa_mention": True,  # MANDATORY
        "required_phrase": "Upon approval of the NIW petition"
    },
    "phase_3": {
        "name": "Growth",
        "months": "13-24",
        "amount": 35000,
        "requires_visa_mention": False
    },
    "phase_4": {
        "name": "Consolidation",
        "months": "25-36",
        "amount": 30000,
        "requires_visa_mention": False
    }
}

# Final verification checklist (Rule 8)
FINAL_VERIFICATION_CHECKLIST = """
═══════════════════════════════════════════════════════════════════════════════
✅ FINAL VERIFICATION CHECKLIST (RULE 8)
═══════════════════════════════════════════════════════════════════════════════

Before delivering, verify ALL of these points:

□ 1. CLEAN TABLES
   - No duplicate rows
   - No placeholder data (1.00 | 1.00 | 1.00)
   - No empty rows
   - Annexes with unique content

□ 2. CLIENT CONSISTENCY
   - Year 5: 100-120 clients (check all sections)
   
□ 3. JOBS CONSISTENCY
   - Direct jobs Year 5: 5-6 (check all sections)
   - Indirect jobs clearly differentiated
   
□ 4. CORRECT CAPITAL
   - Total: $110,000 (check all mentions)
   - Phases: $22K + $23K + $35K + $30K = $110K
   
□ 5. NO CAPITAL-FREE
   - Search for: "capital-free", "zero capital", "sweat equity"
   - If found: REMOVE
   
□ 6. NO FABRICATED PERCENTILES
   - Search for: "0.0004%", "top 0.07%", percentage multiplications
   - If found: REMOVE and replace with factual description
   
□ 7. PHASE 2 WITH VISA MENTION
   - Verify Phase 2 mentions "approval of the NIW petition"
   
□ 8. GOVERNMENT SOURCES ≥70%
   - Count sources in Problem Statement and National Importance
   - If < 70% are governmental: add more
   
□ 9. COMPLETE BIBLIOGRAPHY
   - Minimum 25 sources, maximum 30
   
□ 10. CORRECT LENGTH
    - Between 25 and 35 pages

⚠️ If ANY point fails: CORRECT before delivering
"""
