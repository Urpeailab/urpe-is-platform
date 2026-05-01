"""
EB-2 NIW White Paper Prompts - Evaluator-Compliant Version
Based on comprehensive USCIS evaluator guidelines for National Interest Waiver petitions.

CRITICAL CORRECTIONS IMPLEMENTED:
1. Part 2.5 as independent section (10-12 pages minimum)
2. Evidence references mandatory (Exhibit X, page Y)
3. Specific numbers, not generic descriptions
4. Scarcity analysis with 3 formal methods
5. Historical benchmarking with actual numbers
6. Methodologies with quantified results
7. Track record statements with evidence
8. Federal law citations with USC/CFR numbers
9. Page count distribution requirements
10. Scarcity as explicit percentile/number
11. Comparative tables with Evidence column
12. Mitigation sections with historical solutions
13. References with Specific Citation field
14. Industry averages must be verifiable
15. Conservative projection methodology
"""

# 17 section titles (includes Part 2.5)
SECTION_TITLES_17 = [
    "Executive Summary",                          # Part 1
    "Context and Problem",                        # Part 2
    "Evidence of Exceptional Ability",            # Part 2.5
    "Target Audience and Use Cases",              # Part 3
    "State of the Art and Gap Analysis",          # Part 4
    "Requirements and Assumptions",               # Part 5
    "Architecture / Solution Design",             # Part 6
    "Implementation Methodology",                 # Part 7
    "Evaluation and Metrics",                     # Part 8
    "Results and Analysis",                       # Part 9
    "Security, Privacy and Compliance",           # Part 10
    "Reliability, Scalability and Costs",         # Part 11
    "Risks, Limitations and Mitigation",          # Part 12
    "Roadmap",                                    # Part 13
    "Conclusions and Recommendations",            # Part 14
    "References",                                 # Part 15
    "Appendices and Evidence Checklist"           # Part 16
]

# Display numbers for Parts (2.5 mapping)
SECTION_DISPLAY_NUMBERS = {
    1: "1", 2: "2", 3: "2.5", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7",
    9: "8", 10: "9", 11: "10", 12: "11", 13: "12", 14: "13", 15: "14", 16: "15", 17: "16"
}


def get_eb2_niw_system_message(author_name: str, author_credentials: str, technical_domain: str,
                               project_title: str, project_description: str, target_audience: str) -> str:
    """
    Returns the USCIS-compliant system message for EB-2 NIW white paper generation.
    CRITICAL: Contains strict anti-invention rules to prevent hallucination.
    """
    return f"""You are an expert technical writer specializing in EB-2 NIW (National Interest Waiver) white papers for USCIS petitions.

# ⚠️⚠️⚠️ CRITICAL ANTI-INVENTION RULES ⚠️⚠️⚠️

**ABSOLUTE PROHIBITION: DO NOT INVENT ANY INFORMATION ABOUT THE PETITIONER.**

The ONLY information you may use about {author_name} is what appears in AUTHOR_CREDENTIALS below.
Everything else MUST be described qualitatively based on the role and field in the credentials.

## WHAT YOU MUST NOT DO:
❌ DO NOT invent job titles, roles, or positions not in credentials
❌ DO NOT invent company names or organizations not in credentials  
❌ DO NOT invent metrics, percentages, or numbers for the author
❌ DO NOT invent years of experience
❌ DO NOT invent certifications not explicitly listed
❌ DO NOT invent achievements, awards, or recognitions
❌ DO NOT invent team sizes managed
❌ DO NOT invent revenue figures handled
❌ DO NOT invent client numbers
❌ DO NOT assume information from project_description is author's past experience

## WHAT YOU MUST DO:
✅ Use ONLY credentials explicitly provided: "{author_credentials}"
✅ When author metrics are missing, describe the ROLE QUALITATIVELY ("The petitioner has demonstrated expertise in...") without inventing numbers
✅ For any missing specific metric, use the ROLE DESCRIPTION from credentials as context
✅ Industry statistics may come from external sources (cite them)
✅ The project_description contains FUTURE PLANS, not past achievements
✅ If credentials mention a company/organization, you may describe its general characteristics from industry knowledge

## ⛔ WHAT IS ABSOLUTELY FORBIDDEN (DOCUMENT INVALIDATION):
❌ DO NOT write `[pending information]` — EVER. This appears literally in the final PDF.
❌ DO NOT write `[... — describe qualitatively]` — EVER. These are visible in the PDF and make the document unprofessional.
❌ DO NOT write `[TBD]`, `[INSERT HERE]`, `[TO BE PROVIDED]`, or any bracket placeholder.
❌ If you lack a specific number, write a qualitative sentence instead.
   WRONG: "The petitioner managed [team size — describe qualitatively] engineers"
   RIGHT: "The petitioner's credentials reflect progressive leadership responsibilities in engineering teams"

## AUTHOR_CREDENTIALS (THIS IS THE ONLY SOURCE FOR AUTHOR BACKGROUND):
```
{author_credentials}
```

## PROJECT_DESCRIPTION (THIS IS FUTURE PLANS, NOT PAST ACHIEVEMENTS):
```
{project_description}
```

If credentials are limited, the white paper should:
1. Focus more on the PROJECT'S national importance (Prong 1)
2. Describe author's specific metrics QUALITATIVELY when exact figures are not in credentials (Prong 2)
3. Explain what EVIDENCE would be needed to strengthen the case

# THREE PRONGS TO PROVE
1. **Prong 1**: The proposed endeavor has SUBSTANTIAL MERIT and NATIONAL IMPORTANCE
2. **Prong 2**: The petitioner ({author_name}) is WELL POSITIONED to advance the endeavor
3. **Prong 3**: On balance, it would be BENEFICIAL to the U.S. to waive labor certification

# EVIDENCE RULES

## Rule 1: Evidence References Are MANDATORY
- Claims from credentials: "([Credential Name], Exhibit [X])"
- For claims needing verification: describe the activity qualitatively without using bracket placeholders
- Industry statistics: cite the source "(Source Name, Year, page X)"

## Rule 2: How to Handle Missing Information
For any information not in the credentials:
- DO NOT write `[... — describe qualitatively]`, `[pending information]`, or ANY placeholder
- DO write qualitative language that is true based on the role/field described in credentials
- Example: Instead of "managed [team size — describe qualitatively] engineers", write "led engineering teams"
- Example: Instead of "[revenue figure — describe qualitatively]", write "contributed to organizational revenue growth"

If specific credential info would significantly strengthen a claim:
- Add a footnote: "Note: Employment verification from [Company] would further substantiate this claim."
- Do NOT write the footnote as a bracket placeholder in the main text

## Rule 3: Tables Must Have Evidence Column
| Metric | Industry Average (Source) | Author's Achievement | Evidence |
| Efficiency | 70% (Gartner, 2023) | Based on role as [credential role] | Credential: [Credential Name] |

Tables MUST NOT contain `[... — describe qualitatively]` or `[pending information]` cells.
If a cell value is unknown, describe qualitatively or use "Not applicable" or a conservative estimate from industry context.

## Rule 4: Federal Citations Format
"[Program Name] ([## U.S.C. § ####])"

# PETITIONER INFORMATION
- Name: {author_name}
- Credentials: {author_credentials}
- Domain: {technical_domain}

# PROJECT INFORMATION (FUTURE PLANS)
- Title: {project_title}
- Target Audience: {target_audience}

# OUTPUT REQUIREMENTS
- Write in ENGLISH only
- Professional, evidence-based tone
- NEVER write [... — describe qualitatively], [pending information], [TBD], or ANY bracket placeholder in the text
- Industry data may use external sources (cited)
- Focus on project merit when author credentials are limited
- Describe missing credential metrics QUALITATIVELY - not with visible placeholders

Remember: A white paper with clear qualitative arguments and NO visible placeholders is PROFESSIONAL. A document with [pending information] visible to the reader looks incomplete."""


def get_section_prompts_eb2_niw(
    project_title: str,
    author_name: str,
    author_credentials: str,
    project_description: str,
    target_audience: str,
    technical_domain: str
) -> dict:
    """
    Returns comprehensive section prompts following EB-2 NIW evaluator guidelines.
    All 17 sections including Part 2.5.
    """
    
    prompts = {
        # ============================================================================
        # PART 1: Executive Summary (2-3 pages)
        # ============================================================================
        1: f"""## Part 1. Executive Summary

⚠️ CRITICAL ANTI-INVENTION RULE: 
- AUTHOR CREDENTIALS ARE LIMITED TO: "{author_credentials}"
- DO NOT invent achievements, metrics, or experience not in those credentials
- For any author metric not explicitly in credentials: use qualitative language ('demonstrated expertise in...', 'led initiatives in...')
- Industry statistics may use external sources (cite them)

Generate a comprehensive executive summary (2-3 pages, ~1500-2000 words) with MANDATORY structure:

### I. NATIONAL IMPORTANCE (Prong 1)

This section uses INDUSTRY DATA (external sources are OK):

**Problem Quantification with Sources:**
- Total affected population: [Exact number] ([Government source], [Year], page [#])
- Economic impact: $[Amount] ([Source], [Year])
- Calculation shown: [X] entities x $[Y] per entity = $[Z] total
- Growth trend: [X%] over [Y years] ([Source])

**Federal Initiatives Alignment** (MINIMUM 2 with USC citations):
1. **[Federal Program/Law Name]** ([Citation: ## U.S.C. § ####])
   - Objective: "[Quote from official source]"
   - Project alignment: [How {project_title} advances this objective]
   - Source: [Official .gov URL]

2. **[Second Federal Program]** ([Citation])
   [Same structure]

### II. AUTHOR'S QUALIFICATIONS (Prong 2 Summary)

⚠️ USE ONLY THESE CREDENTIALS - DO NOT ADD ANYTHING ELSE:
"{author_credentials}"

**What We Know (from credentials):**
[List ONLY what is explicitly stated in the credentials above]

**What Evidence Is Needed:**
[List what documentation would strengthen the case]

**Comparative Metrics Table** (use [describe based on credentials] for author's values if not in credentials):

| Metric | Industry Average (Source, Year) | {author_name}'s Achievement | Evidence Reference |
|--------|--------------------------------|----------------------------|-------------------|
| [Metric 1] | [X%] ([Source]) | [specific value from employer — describe qualitatively] | [Employment verification — describe qualitatively] |
| [Metric 2] | [Y%] ([Source]) | [specific value — describe qualitatively] | [Document type — describe qualitatively] |

**Scarcity Analysis** (based on credentials provided):
- From credentials: {author_credentials}
- Scarcity calculation: [If credentials are limited, state: "Detailed scarcity analysis requires additional credential documentation"]

### III. WAIVER JUSTIFICATION (Prong 3 Summary)
- Based on credentials provided and project scope
- Note: Focus on qualitative role descriptions to strengthen this prong

### IV. PROJECT OVERVIEW (from project description)
- Project: {project_title}
- Description: {project_description}
- Target Audience: {target_audience}
- Technical Domain: {technical_domain}

### V. ABOUT THE AUTHOR

Write biography using ONLY: "{author_credentials}"

⚠️ DO NOT ADD:
- Years of experience not stated
- Companies not mentioned
- Metrics or achievements not listed
- Certifications not specified

FORMAT:
"{author_name} holds [credentials from list]. [If credentials are limited, state:] Additional documentation of professional experience, including employment verification letters and performance metrics, will strengthen the evidentiary record for this petition."

REQUIRED: List what additional evidence is needed at the end of this section.""",

        # ============================================================================
        # PART 2: Context and Problem (3-5 pages)
        # ============================================================================
        2: f"""## Part 2. Context and Problem

⚠️ This section focuses on INDUSTRY CONTEXT and PROBLEM DEFINITION.
- Industry data from external sources is OK (cite them)
- DO NOT invent author's past achievements in this section

Generate comprehensive context (3-5 pages, ~2500-3500 words):

### Technical Background of {technical_domain}

**Current Industry State with Quantified Data:**
- Market size: $[X] ([Government/research source], [Year])
- Number of practitioners: [X] ([BLS SOC Code reference])
- Growth rate: [X%] CAGR ([Source])
- Key trends with statistics

**Problem Definition with Impact Calculation:**

| Problem Dimension | Current State | Quantified Impact | Source |
|-------------------|---------------|-------------------|--------|
| [Dimension 1] | [Description] | $[X] / [Y] affected | ([Source], [Year], p.[#]) |
| [Dimension 2] | | | |
| [Dimension 3] | | | |

**Total Problem Scope Calculation:**
- Affected population: [X] entities ([Source])
- Impact per entity: $[Y] annually ([Source])
- Total national impact: [X] x $[Y] = $[Z] per year
- At current trajectory: $[A] by [Year] ([Source])

### Current Solutions and Their Limitations

| Solution | Provider | Market Share | Key Limitation | Gap for Target Audience |
|----------|----------|--------------|----------------|------------------------|
| [Solution 1] | [Company] | [X%] | [Specific limitation] | [What's missing] |
| [Solution 2] | | | | |
| [Solution 3] | | | | |

### Federal Policy Alignment (MANDATORY - 2+ programs with USC citations)

**1. [Federal Program Name]** ([## U.S.C. § ####])
- Statutory Purpose: "[Quote from legislation]"
- Section Reference: Section [X](a)(#)
- Project Alignment: [Specific connection to {project_title}]
- Quantified Connection: [How project advances this by $X or Y%]
- Official Source: [.gov URL]

**2. [Second Federal Program]** ([## U.S.C. § #### or ## CFR § ####])
[Same detailed structure]

### Why Action is Needed NOW

**Urgency Factors:**
1. [Factor 1]: Quantified cost of delay = $[X] per [timeframe]
2. [Factor 2]: [Y%] growth in problem over [Z years] ([Source])
3. [Factor 3]: Federal deadline or initiative timeline

**Cost of Inaction Calculation:**
- Current annual impact: $[X]
- Growth rate: [Y%] per year ([Source])
- 3-year projected cost if unaddressed: $[X] x (1 + [Y%])^3 = $[Z]

Project Context:
- Title: {project_title}
- Description: {project_description}
- Domain: {technical_domain}

CRITICAL: All statistics MUST have verifiable sources with page numbers.""",

        # ============================================================================
        # PART 2.5: Evidence of Exceptional Ability (10-12 pages) - CRITICAL SECTION
        # ============================================================================
        3: f"""## Part 2.5: Evidence of Exceptional Ability (Prong 2 - NIW Criteria)

⚠️⚠️⚠️ CRITICAL ANTI-INVENTION WARNING ⚠️⚠️⚠️

THE AUTHOR'S CREDENTIALS ARE LIMITED TO:
"{author_credentials}"

FOR THIS SECTION:
- DO NOT invent metrics, achievements, or experience not in credentials
- DO NOT assume information from project_description is past experience
- For ALL metrics not explicitly in credentials: use qualitative language ('demonstrated expertise', 'achieved results in')
- Focus on what EVIDENCE would be required to establish exceptional ability

If credentials are minimal, this section should:
1. Explain what each subsection SHOULD contain
2. For ALL specific values not in credentials: describe the activity/role qualitatively
3. Provide templates for evidence collection
4. Be honest about evidence gaps

---

### A. Quantifiable Performance Metrics (2-3 pages)

⚠️ AUTHOR CREDENTIALS: "{author_credentials}"

**What We Know From Credentials:**
[List ONLY what is explicitly in the credentials - do not add]

**Metrics Comparison Table:**
(Use [describe based on credentials] for author's values since specific metrics are not in credentials)

| Metric | Industry Average (Source, Year) | {author_name}'s Achievement | Evidence Reference |
|--------|--------------------------------|----------------------------|-------------------|
| [Metric 1] | [X%] ([Source], [Year]) | [value from employment verification — describe qualitatively] | [Employment letter confirming this metric — describe qualitatively] |
| [Metric 2] | [Y%] ([Source]) | [specific value — describe qualitatively] | [Performance review or letter — describe qualitatively] |
| [Metric 3] | [Z%] ([Source]) | [specific value — describe qualitatively] | [Documentation type — describe qualitatively] |

**Evidence Required to Complete This Section:**
1. Employment verification letter(s) confirming specific metrics
2. Performance reviews with quantified achievements
3. Client testimonials or references
4. Project documentation with measurable outcomes

---

### B. Formal Recognition of Expertise (2-3 pages)

Based on credentials: "{author_credentials}"

**Credentials to Document:**
[Parse and list each credential from the credentials string]

For EACH credential found in "{author_credentials}":

**[Credential Name from credentials]**
- Issuing Organization: [Name if known, or NEEDED]
- Date Obtained: [verification from issuing org — describe qualitatively]
- Scarcity: [Research percentage of professionals with this credential]
- Evidence: [Certificate copy or verification letter — describe qualitatively]

**If credentials mention certifications:**
- Research the scarcity of that certification
- Cite the certifying body's statistics if public

**Evidence Required:**
1. Certificate copies for each credential listed
2. Verification letters from issuing organizations
3. Statistics on certification rarity (from certifying bodies)

---

### C. Innovation and Original Contributions (3-4 pages)

⚠️ IMPORTANT: Methodologies must be documented, not invented.

**From credentials: "{author_credentials}"**

If credentials do NOT explicitly mention methodologies developed:

**Evidence Needed to Document Original Contributions:**
1. Employment letters describing unique approaches developed
2. Project documentation showing innovation
3. Supervisor attestations about original contributions
4. Any publications, presentations, or training materials created

**Template for Methodology Documentation:**
[Provide the template structure, but mark all values as NEEDED]

| Attribute | Value |
|-----------|-------|
| Organization | [from employment verification — describe qualitatively] |
| Role | [from employment letter — describe qualitatively] |
| Methodology Name | [description of approach — describe qualitatively] |
| Results Achieved | [quantified metrics from employer — describe qualitatively] |
| Evidence | [employment letter or project documentation — describe qualitatively] |

**Guidance for Client:**
To strengthen this section, obtain letters from past employers describing:
- Specific processes or approaches you developed
- Quantified results of those approaches
- Recognition you received for innovation

---

### D. Sustained National/International Impact Potential (2-3 pages)

This section can use INDUSTRY DATA (external sources) combined with PROJECT GOALS:

**Market Analysis** (from research, cite sources):
- Total addressable market: [X] ([Source])
- Economic value: $[Y] ([Source])
- Growth projections: [Z%] ([Source])

**Projected Impact of {project_title}:**
(These are PROJECTIONS based on project description, not past achievements)

From project description: "{project_description}"
[Summarize projected impact from the project description]

**Connection to Author's Qualifications:**
Based on "{author_credentials}", the author brings:
[List only what credentials support, use NEEDED for gaps]

---

### E. Comparison to Available U.S. Workers (2-3 pages)

**Standard Professional Profile in {technical_domain}:**
(Use industry research, cite sources)

| Attribute | Typical Professional | Source |
|-----------|---------------------|--------|
| Education | [Level] | BLS, [Year] |
| Experience | [X years] | O*NET, [Year] |
| Certifications | [Common ones] | [Association], [Year] |

**Author's Differentiating Factors:**
From credentials "{author_credentials}":
[List only what is in credentials]

**Scarcity Analysis:**
⚠️ With limited credentials, provide methodology but mark values as NEEDED:

**Method 1: Professional Network Search**
[Conduct LinkedIn search with parameters based on credentials — describe qualitatively]
- Search terms: [Based on credentials provided]
- Expected result: [actual search data — describe qualitatively]

**Method 2: BLS Data Analysis**
[Use actual BLS data for the occupation, cite sources]
- For credentials overlap: [specific calculation once credentials verified — describe qualitatively]

**Evidence Required for Scarcity Claim:**
1. LinkedIn search results (screenshots)
2. Professional association membership data
3. Certification body statistics

---

AUTHOR INFORMATION (THE ONLY SOURCE FOR AUTHOR DATA):
- Name: {author_name}
- Credentials: {author_credentials}
- Domain: {technical_domain}

PROJECT INFORMATION (FUTURE PLANS, NOT PAST EXPERIENCE):
- Title: {project_title}
- Description: {project_description}
- Target Audience: {target_audience}

CRITICAL REMINDER:
This section MUST be honest about evidence gaps. A white paper with clear [describe based on credentials] markers is more valuable for USCIS preparation than one with invented information that will be discovered during adjudication.""",


        # ============================================================================
        # PART 3: Target Audience and Use Cases (4-6 pages)
        # ============================================================================
        4: f"""## Part 3. Target Audience and Use Cases

Generate comprehensive audience analysis (4-6 pages):

### Primary User Profiles

Based on: {target_audience}

**Profile 1: [Primary User Type]**
- Demographics: [Specific numbers from sources]
- Size of segment: [X] in U.S. ([Source], [Year])
- Current challenges (quantified):
  - Challenge 1: [Impact: $X or Y%] ([Source])
  - Challenge 2: [Impact] ([Source])
- Current solutions used and limitations
- Willingness to pay: $[Range] ([Market research source if available])

**Profile 2: [Secondary User Type]**
[Same structure]

### Use Case Prioritization Matrix

| Use Case ID | Description | Users Affected | Economic Impact | Feasibility | Priority | {author_name}'s Qualification |
|-------------|-------------|----------------|-----------------|-------------|----------|------------------------------|
| UC-1 | [Description] | [X] | $[Y] | [H/M/L] | [P1/P2/P3] | [Specific experience/credential] |
| UC-2 | | | | | | |
| UC-3 | | | | | | |

### Why {author_name} is Uniquely Qualified for This Audience

**Current Market Gap:**
[Analysis of existing professionals serving this audience and their limitations - cite specific shortcomings]

**{author_name}'s Bridge Profile:**

The combination of:
- {author_credentials}
- Experience in {technical_domain}

Creates unique capability because:
1. [Specific bridge capability 1] - addresses gap of [specific limitation]
2. [Specific bridge capability 2] - fills need for [specific requirement]
3. [Specific bridge capability 3] - provides [specific value]

**Quantified Opportunity:**
"{author_name}'s [unique qualification] enables service to [specific population] ([X] entities contributing $[Y] to U.S. economy annually, per [Source]). Currently, only [Z%] of professionals in {technical_domain} offer [specific capability combination] ([Source]), leaving [A%] of [target audience] underserved. This represents a $[B] market gap."

**Evidence:**
- [Relevant credential, Exhibit [#]] demonstrates [specific capability]
- [Employment history item] shows experience with [relevant population]

Project: {project_title}
Description: {project_description}""",

        # ============================================================================
        # PART 4: State of the Art and Gap Analysis (5-7 pages)
        # ============================================================================
        5: f"""## Part 4. State of the Art and Gap Analysis

Generate comprehensive analysis (5-7 pages):

### Current Landscape in {technical_domain}

**Market Overview:**
- Total market value: $[X] ([Source], [Year])
- Key players: [List with market shares if available]
- Growth trajectory: [X%] CAGR ([Source])

**Existing Solutions Analysis:**

| Solution | Provider | Approach | Strengths | Limitations | Market Share | Gap Remaining |
|----------|----------|----------|-----------|-------------|--------------|---------------|
| [Solution 1] | [Real company] | [Technical approach] | [Specific strength] | [Specific limitation] | [X%] | [What's not addressed] |
| [Solution 2] | | | | | | |
| [Solution 3] | | | | | | |
| [Solution 4] | | | | | | |

### Gap Analysis Summary

| Gap ID | Description | Population Affected | Economic Impact | Current Workarounds |
|--------|-------------|---------------------|-----------------|---------------------|
| G-1 | [Specific gap] | [X] entities | $[Y] annually | [How currently handled] |
| G-2 | | | | |
| G-3 | | | | |

### {author_name}'s Differential Advantage

For EACH competitive advantage (minimum 3):

**[Advantage 1: e.g., "Resource-Constrained Implementation Expertise"]**

**Origin of Methodology:**
{author_name} developed [approach name] at [organization] ([dates]) while [context requiring this innovation].

**Documented Results:**
| Metric | Industry Benchmark | {author_name}'s Result | Differential | Evidence |
|--------|-------------------|----------------------|--------------|----------|
| [Metric 1] | [X%] ([Source]) | [Y%] | +[Z]% | [Exhibit [#]] OR [describe based on credentials] |
| [Metric 2] | | | | |

**Scarcity of This Capability:**
- [X%] of practitioners in {technical_domain} have documented success in [specific capability context] ([Source])
- {author_name}'s demonstrated results place in top [Y%]

**Transferability to {project_title}:**
This approach transfers directly because:
1. [Similarity 1] between [original context] and [proposed endeavor context]
2. [Similarity 2]

[REPEAT for Advantage 2 and Advantage 3]

### Why Current Market Cannot Serve This Need

**Labor Market Analysis:**
- Total professionals in {technical_domain}: [X] (BLS, [Year])
- With required combination of [qualifications]: ~[Y] (calculated in Part 2.5)
- Currently serving {target_audience}: [Z] (estimate based on [methodology])
- Gap: [Y - Z] = [A] professional deficit

**Conclusion:**
The gap analysis reveals that [specific problem] affecting [X] entities ($[Y] economic impact) remains unaddressed due to [specific reason]. {author_name}'s unique combination of [qualifications] positions them to address this $[Y] gap where [X%] of current practitioners cannot.

Project description: {project_description}
Author credentials: {author_credentials}""",

        # ============================================================================
        # PART 5: Requirements and Assumptions (3-4 pages)
        # ============================================================================
        6: f"""## Part 5. Requirements and Assumptions

Generate requirements specification (3-4 pages):

### Functional Requirements

Derived from: {project_description}

| ID | Requirement | Priority | Source (from Description) | Success Criteria |
|----|-------------|----------|---------------------------|------------------|
| FR-1 | [Requirement statement] | Must Have | "[Quote from description]" | [Measurable criteria] |
| FR-2 | | Should Have | | |
| FR-3 | | Nice to Have | | |

### Non-Functional Requirements (Service Level Objectives)

| Category | Requirement | Target | Industry Standard | Source | Justification |
|----------|-------------|--------|-------------------|--------|---------------|
| Performance | [Requirement] | [Target value] | [Standard] | ([Source], [Year]) | [Why this target] |
| Scalability | [Requirement] | [Target] | [Standard] | | |
| Security | [Requirement] | [Target] | [Standard] | | |
| Reliability | [Requirement] | [Target] | [Standard] | | |
| Compliance | [Requirement] | [Target] | [Standard] | | |

### Technical Constraints

| Constraint | Description | Impact | Mitigation Approach |
|------------|-------------|--------|---------------------|
| [Constraint 1] | [Description] | [What this limits] | [How {author_name} will address] |
| [Constraint 2] | | | |

### Assumptions and Dependencies

| ID | Assumption | Risk if Invalid | Contingency | Validation Method |
|----|------------|-----------------|-------------|-------------------|
| A-1 | [Assumption statement] | [What happens if wrong] | [Alternative approach] | [How to verify] |
| A-2 | | | | |

### Requirements Traceability

All requirements trace to:
1. Project description: {project_description}
2. Target audience needs: {target_audience}
3. Domain standards: {technical_domain}

Each requirement links to verifiable source material.""",

        # ============================================================================
        # PART 6: Architecture / Solution Design (4-6 pages)
        # ============================================================================
        7: f"""## Part 6. Architecture / Solution Design

Generate architecture design (4-6 pages) that leverages {author_name}'s proven expertise:

### High-Level Architecture Overview

**System Context:**
[Description of overall system boundaries and external interactions]

**Core Components:**

| Component | Purpose | Technology Choice | Justification | {author_name}'s Relevant Experience |
|-----------|---------|-------------------|---------------|-------------------------------------|
| [Component 1] | [Function] | [Technology] | [Why chosen] | [Related experience from credentials] |
| [Component 2] | | | | |
| [Component 3] | | | | |

### Component Design Details

For each major component:

**[Component Name]**
- **Purpose**: [What it does]
- **Inputs**: [What it receives]
- **Outputs**: [What it produces]
- **Key Technical Decisions**:
  - Decision 1: [What] - Rationale: [Why]
  - Decision 2: [What] - Rationale: [Why]
- **Connection to {author_name}'s Expertise**: [How credentials/experience inform this design]

### Data Architecture

| Data Entity | Purpose | Storage | Access Patterns | Security Classification |
|-------------|---------|---------|-----------------|------------------------|
| [Entity 1] | [Purpose] | [Where stored] | [Read/Write patterns] | [Classification] |
| [Entity 2] | | | | |

### Why This Architecture Reflects {author_name}'s Expertise

**Design Decisions Informed by Experience:**

1. **[Decision 1]**: Based on {author_name}'s experience at [organization] where [similar challenge] was addressed using [approach]. Result: [outcome with metric] (Evidence: [Exhibit [#]] OR [describe based on credentials]).

2. **[Decision 2]**: Leverages {author_name}'s [certification/credential] which requires expertise in [relevant area]. This ensures [specific benefit].

3. **[Decision 3]**: Incorporates methodology developed in [context], which achieved [result] and transfers to this architecture because [reasoning].

### Security Architecture

| Security Layer | Implementation | Standard Compliance | {author_name}'s Relevant Experience |
|----------------|----------------|---------------------|-------------------------------------|
| [Layer 1] | [How implemented] | [Standard met] | [Related experience] |
| [Layer 2] | | | |

### Integration Points

| Integration | External System | Protocol | Security Measure |
|-------------|-----------------|----------|------------------|
| [Integration 1] | [System] | [Protocol] | [Security] |

Project: {project_title}
Description: {project_description}
Domain: {technical_domain}""",

        # ============================================================================
        # PART 7: Implementation Methodology (10-15 pages) - CRITICAL EXPANDED SECTION
        # ============================================================================
        8: f"""## Part 7. Implementation Methodology

CRITICAL SECTION - MINIMUM 10-15 PAGES REQUIRED

Generate comprehensive implementation methodology with MANDATORY "Proven Methodologies" section BEFORE phases:

---

## Integration of {author_name}'s Proven Methodologies

MINIMUM 2-3 methodologies, each 2-3 pages with full detail:

### [Methodology 1 Name] (Developed at [Organization], [Year Range])

#### Origin and Development Context

**Organizational Setting:**

| Attribute | Detail |
|-----------|--------|
| Organization | [Full legal name], [industry sector], [size: X employees] |
| {author_name}'s Role | [Exact title], reporting to [position/level] |
| Department/Team | [Team size], [scope of responsibility] |
| Challenge Addressed | [Specific problem with quantified impact: $X cost or Y% inefficiency] |
| Constraints | Budget: $[X], Timeline: [Y months], Resources: [Z FTE] |

**Development Process:**
- Timeframe: [Month Year] to [Month Year] ([X months total])
- Technical Approach:
  1. [Step 1 of methodology development]
  2. [Step 2]
  3. [Step 3]
  4. [Step 4]
  [8-12 lines total describing what was done and how]
- Tools/Technologies Used: [Specific list]
- Team Size and {author_name}'s Role: [X] people; {author_name} served as [lead/coordinator/implementer]
- Investment: [Hours/budget allocated to development]

#### Documented Results and Evidence

**MINIMUM 3 QUANTIFIED METRICS:**

**Metric 1: [Name - e.g., "User Adoption Rate"]**

| Phase | Value | Date Measured | Source | Context |
|-------|-------|---------------|--------|---------|
| Baseline (Before) | [X%] | [Month Year] | [System logs/survey/report] | [X%] of [Y total users] = [Z absolute] |
| Result (After) | [A%] | [Month Year] | [System logs/survey/report] | [A%] of [Y total users] = [B absolute] |

- **Improvement Calculation**: From [X%] to [A%] = [A-X] percentage points = [(A-X)/X x 100]% relative improvement
- **Timeframe**: Achieved in [number] months
- **Evidence**: [Employment verification letter from [Name], [Title], dated [Date], Exhibit [#], page [#], paragraph [#]]
  
  OR if not available:
  
  [Employer verification of this metric. Letter should confirm:
  - Employment dates at [Organization — describe qualitatively]
  - Role as [Title]
  - Baseline value of [X%] and final value of [A%]
  - Timeframe of improvement]

**Metric 2: [Name - e.g., "Process Efficiency Gain"]**
[Same detailed structure with table, calculation, and evidence]

**Metric 3: [Name - e.g., "Cost Reduction"]**
[Same detailed structure]

**Population Served / Scale Indicators:**
- Number of users directly impacted: [X]
- Number of entities/departments: [Y]
- Transaction volume processed: [Z] per [month/year]
- Geographic scope: [Description]
- Duration methodology remained in use: [X months/years - showing sustained impact]

#### Transferability to {project_title}

**Parallel Challenges Analysis:**

| Challenge Dimension | Original Context ([Organization]) | {project_title} Context | Similarity Score | Explanation |
|---------------------|----------------------------------|------------------------|------------------|-------------|
| Budget constraints | $[X]/year for [scope] | Expected $[Y] for [scope] | [High/Med/Low]: [%] | [Why similar] |
| User technical level | [Description with specifics] | [Description] | [Score] | [Explanation] |
| Scale | [X users], [Y transactions/month] | Expected [A users], [B transactions] | [Score] | [Explanation] |
| Timeline pressure | [X months to deliver] | [Y months projected] | [Score] | |
| [Add more dimensions as relevant] |

**What Transfers Directly** (no modification needed):
1. [Principle/process 1]: [Explanation of why it applies unchanged]
2. [Principle/process 2]: [Explanation]
3. [Principle/process 3]: [Explanation]

**What Requires Adaptation:**
1. [Aspect 1]: [How it differs] -> [How will be adapted] -> [Why adaptation is feasible]
2. [Aspect 2]: [Difference] -> [Adaptation] -> [Feasibility]

**Projected Impact with Explicit Calculation:**

"At [Organization], this methodology achieved [X%] improvement in [metric]. {project_title} targets [population description] with current baseline estimated at [Y metric value] ([Source if available]).

Applying conservative [Z%] improvement (accounting for differences: [factor 1], [factor 2]):

**Calculation:**
- Historical achievement: [X%]
- Conservative adjustment factor: [0.7-0.9] (because [specific reasons])
- Adjusted projection: [X%] x [adjustment] = [Z%]
- For [A number] entities in target population:
  - Per-entity impact: [calculation]
  - Aggregate annual impact: [A] x [per-entity] = $[Total]

**Evidence Supporting Projection:**
- Historical: [X%] achieved (Evidence: [Exhibit reference])
- Adjustment rationale: [Specific factors considered]
- Industry validation: [Source] reports similar implementations achieve [range]%
- {author_name}'s projection of [Z%] is within validated range and below personal historical achievement, demonstrating credibility and conservatism."

#### Validation and Recognition

**Internal Validation** (from organization where developed):
- Quote from supervisor: "[Exact quote or paraphrase about methodology effectiveness]"
- Source: [Name], [Title], [Organization], [Date]
- Reference: [Employment letter, Exhibit [#], page [#]] OR [LinkedIn recommendation, Exhibit [#]]

**External Validation** (if applicable):
- Methodology presented at: [Conference/event if any]
- Adopted by: [Other teams/organizations if any]
- Publications: [If methodology was documented/published]

**Originality Evidence:**
- Literature search: Searched [databases] for "[search terms]" on [date]
- Results: [X] publications found, but none address [specific unique aspect]
- Conclusion: Represents original contribution to {technical_domain}
- Documentation: [Exhibit [#] - search results] OR [Formal literature search documentation — describe qualitatively]

---

### [Methodology 2 Name] (Developed at [Organization], [Year Range])

[REPEAT ENTIRE STRUCTURE from Methodology 1]

---

### [Methodology 3 Name] (if applicable)

[REPEAT STRUCTURE]

---

## Implementation Phases

### Phase 1: Foundation & MVP (Months 1-3)

| Milestone | Deliverable | Success Criteria | Risk Mitigation |
|-----------|-------------|------------------|-----------------|
| M1.1 | [Deliverable] | [Measurable criteria] | [How {author_name}'s experience mitigates] |
| M1.2 | | | |

**Resource Requirements:**
- Team: [Composition]
- Budget: $[Range]
- Infrastructure: [Requirements]

### Phase 2: Pilot & Validation (Months 4-6)

[Same structured format]

### Phase 3: Production & Scale (Months 7-12)

[Same structured format]

### Quality Assurance Framework

| QA Activity | Methodology | Criteria | Frequency |
|-------------|-------------|----------|-----------|
| [Activity 1] | [Approach] | [Standards] | [When] |
| [Activity 2] | | | |

### Resource and Budget Summary

| Phase | Duration | Team Size | Estimated Budget | Key Dependencies |
|-------|----------|-----------|------------------|------------------|
| Phase 1 | 3 months | [X] FTE | $[Range] | [Dependencies] |
| Phase 2 | 3 months | [X] FTE | $[Range] | |
| Phase 3 | 6 months | [X] FTE | $[Range] | |

---

Author credentials: {author_credentials}
Project description: {project_description}
Target audience: {target_audience}

CRITICAL: The proven methodologies section must be 6+ pages with full detail as shown.""",

        # ============================================================================
        # PART 8: Evaluation and Metrics (4-6 pages)
        # ============================================================================
        9: f"""## Part 8. Evaluation and Metrics

Generate evaluation framework (4-6 pages) with MANDATORY historical benchmarking:

### Key Performance Indicators

For EACH KPI (MINIMUM 5 KPIs with full structure):

---

**KPI 1: [Name - e.g., "User Adoption Rate"]**

**Definition:**
- Metric: [What is measured]
- Formula: [Calculation method]
- Measurement frequency: [Daily/Weekly/Monthly]
- Data source: [Where data comes from]

**Target**: [Specific value] with confidence interval [Range]

**Benchmarking Against {author_name}'s Historical Performance** (MANDATORY for each KPI):

**Historical Performance at [Organization]:**

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Context | [Role], [Organization], [Start date] to [End date] | Employment records |
| Baseline (start) | [Specific number/percentage] | [Source: system/report] |
| Final Result (end) | [Specific number/percentage] | [Source] |
| Improvement | [Calculation] = [X%] change | |
| Timeframe | Achieved in [X months/years] | |
| Scale | [Number] users/entities/transactions | |
| Evidence | [Employment letter from [Name], [Title], Exhibit [#], page [#], paragraph [#]] | |

OR if specific data not documented:
[Employment verification confirming [metric name — describe qualitatively] achievement of [value] at [Organization]. Letter should include baseline, result, and timeframe.]

**Industry Benchmark Comparison:**

| Benchmark | Value | Source | Year | Page/Section |
|-----------|-------|--------|------|--------------|
| Industry average | [X%] | [Source Name] | [Year] | p. [#] |
| Top quartile | [Y%] | [Source] | [Year] | |
| {author_name}'s historical | [Z%] | Employment verification | | |

- Differential: {author_name}'s [Z%] vs. industry [X%] = [Z-X] percentage points above average
- Percentile: {author_name}'s performance in top [calculation]% of practitioners

**Adjustment for {project_title}:**

| Factor | Original Context | {project_title} Context | Adjustment Impact |
|--------|-----------------|------------------------|-------------------|
| [Factor 1] | [Description] | [Description] | [Easier/Harder: X%] |
| [Factor 2] | | | |

- Target set at: [A%]
- Adjustment calculation: Historical [Z%] x [adjustment factor 0.7-1.0] = [A%]
- Rationale: Target represents [ratio, e.g., 0.85x] of historical achievement to account for [specific contextual differences]

**Credibility Statement:**
"This target of [A%] is not aspirational or theoretical. It represents a [conservative projection from / reduction from] {author_name}'s documented performance of [Z%] at [Organization], adjusted by [factor] to account for [contextual differences: factor 1, factor 2]. The target remains [B%] above industry average of [X%], demonstrating both achievability based on track record and competitive advantage."

---

**KPI 2: [Name]**
[REPEAT FULL STRUCTURE]

---

**KPI 3: [Name]**
[REPEAT FULL STRUCTURE]

---

**KPI 4: [Name]**
[REPEAT FULL STRUCTURE]

---

**KPI 5: [Name]**
[REPEAT FULL STRUCTURE]

---

### Metrics Dashboard Summary

| KPI | Target | Industry Avg (Source) | {author_name}'s Historical | Adjustment Factor | Evidence |
|-----|--------|----------------------|---------------------------|-------------------|----------|
| [KPI 1] | [Target] | [X%] ([Source], p.[#]) | [Y%] | x[factor] | [Exhibit [#]] |
| [KPI 2] | | | | | |
| [KPI 3] | | | | | |
| [KPI 4] | | | | | |
| [KPI 5] | | | | | |

### Success Milestone Criteria

| Milestone | Timeline | KPIs Involved | Threshold for Success | Decision Point |
|-----------|----------|---------------|----------------------|----------------|
| MVP Launch | Month 3 | KPI 1, KPI 2 | [Thresholds] | Go/No-Go for Phase 2 |
| Pilot Complete | Month 6 | All KPIs | [Thresholds] | Scale decision |
| Production | Month 12 | All KPIs | [Final targets] | Success declaration |

Project: {project_title}
Author: {author_name}
Credentials: {author_credentials}""",

        # ============================================================================
        # PART 9: Results and Analysis (3-4 pages)
        # ============================================================================
        10: f"""## Part 9. Results and Analysis

Generate expected results analysis (3-4 pages) with conservative projection methodology:

### Projected Outcomes Framework

**Projection Methodology Transparency:**

All projections in this section follow this methodology:
1. Start with {author_name}'s documented historical result
2. Analyze contextual differences (harder/easier factors)
3. Apply conservative adjustment factor (0.7-0.9)
4. Validate against industry benchmarks
5. Show all calculations explicitly

---

### Result Category 1: [Primary Outcome - e.g., "Operational Efficiency Gains"]

**Historical Baseline:**

| Attribute | Value | Source |
|-----------|-------|--------|
| Context | {author_name} at [Organization], [Role], [Dates] | Employment records |
| Achievement | [X%] improvement in [metric] | [Exhibit [#], page [#]] |
| Scale | [Y] users/entities impacted | |
| Conditions | [Specific circumstances] | |

**Contextual Differences Analysis:**

| Factor | Makes Projection EASIER | Makes Projection HARDER |
|--------|------------------------|------------------------|
| [Factor 1] | [If applicable: description] | [If applicable: description] |
| [Factor 2] | | |
| [Factor 3] | | |

**Net Assessment**: {project_title} context is [easier/harder/similar] due to [primary factors]

**Conservative Adjustment Calculation:**

```
Historical result:        [X%]
Adjustment factor:        x [0.7-0.9] (because [specific reasons])
----------------------------------------
Projected result:         [Y%]
```

**Validation Against Industry:**
- Projected [Y%] vs. industry average [A%] ([Source], [Year]) = still [Y-A]% above benchmark
- Even with conservative adjustment, projection exceeds industry standard

---

### Result Category 2: [Economic Impact]

**Projected Impact Calculation:**

**Year 1 (Conservative - 0.1% market penetration):**

| Component | Value | Calculation | Source/Basis |
|-----------|-------|-------------|--------------|
| Target entities | [X] | [Total market Y] x 0.1% = [X] | [Market source] |
| Per-entity improvement | [Z%] | Historical [W%] x 0.8 adjustment = [Z%] | [Evidence ref] |
| Per-entity economic value | $[A] | [Calculation based on improvement] | |
| **Total Year 1 Impact** | $[Total] | [X] x $[A] = $[Total] | |

**Year 3 (Projected - 0.5% market penetration):**
[Same calculation structure with 0.5% penetration]

**Cumulative 5-Year Impact:**
[Projection with growth assumptions stated]

---

### Result Category 3: [Job Creation/Support]

**Direct Employment:**
- {author_name} + [X] additional team members by Year [Y]

**Indirect Employment Calculation:**
- Per [Source], every $[X] in [industry] creates [Y] indirect jobs
- Projected economic activity: $[Z]
- Calculation: $[Z] / $[X] x [Y] = [Result] indirect jobs supported
- Source: [Specific reference for multiplier used]

---

### Comparison Table: Current State vs. Projected

| Metric | Current State | Projected State (Year 1) | Projected (Year 3) | Improvement | Evidence Basis |
|--------|--------------|-------------------------|-------------------|-------------|----------------|
| [Metric 1] | [Current] | [Projected] | [Projected] | [%] | [Historical evidence ref] |
| [Metric 2] | | | | | |
| [Metric 3] | | | | | |

### Confidence and Limitations

**High Confidence Projections** (based on direct historical correlation):
- [Projection 1]: [Explanation of strong evidence basis]

**Moderate Confidence Projections** (based on similar but not identical experience):
- [Projection 2]: [Explanation]

**Assumptions That Could Affect Results:**
1. [Assumption 1]: If invalid, impact would be [X%] reduction
2. [Assumption 2]: If invalid, impact would be [Y%] reduction

CRITICAL: Present PROJECTED results. Do not claim results as achieved. All projections must show calculation methodology and evidence basis.

Project: {project_title}
Description: {project_description}""",

        # ============================================================================
        # PART 10: Security, Privacy and Compliance (3-4 pages)
        # ============================================================================
        11: f"""## Part 10. Security, Privacy and Compliance

Generate security analysis (3-4 pages) with regulatory citations:

### Security Framework

**Security Architecture Overview:**

| Layer | Implementation | Standard Met | {author_name}'s Relevant Experience |
|-------|----------------|--------------|-------------------------------------|
| Data at Rest | [Encryption approach] | [Standard, e.g., AES-256] | [Related experience from credentials] |
| Data in Transit | [Protocol] | [Standard, e.g., TLS 1.3] | |
| Access Control | [Mechanism] | [Standard] | |
| Authentication | [Method] | [Standard] | |

### Privacy Considerations

**Data Handling Framework:**

| Data Category | Classification | Handling Procedure | Retention Period | Deletion Process |
|---------------|----------------|-------------------|------------------|------------------|
| [Category 1] | [PII/Sensitive/Public] | [Procedure] | [Period] | [Process] |
| [Category 2] | | | | |

### Regulatory Compliance (WITH CITATIONS)

For EACH applicable regulation:

**1. [Regulation Name]** ([## U.S.C. § #### or ## CFR § ####])

| Attribute | Detail |
|-----------|--------|
| Full Citation | [Title ##, Section ###] |
| Requirement Summary | [What the regulation requires] |
| Applicability | [Why this applies to {project_title}] |
| Compliance Approach | [How requirements will be met] |
| Evidence of Compliance | [Documentation to be maintained] |
| {author_name}'s Experience | [Relevant compliance experience from credentials] |

**2. [Second Regulation]** ([Citation])
[Same structure]

**3. [Third Regulation if applicable]** ([Citation])
[Same structure]

### Risk Assessment Matrix

| Risk ID | Category | Description | Likelihood | Impact | Risk Score | Mitigation | {author_name}'s Relevant Experience |
|---------|----------|-------------|------------|--------|------------|------------|-------------------------------------|
| SR-1 | [Security/Privacy/Compliance] | [Description] | [H/M/L] | [H/M/L] | [Score] | [Approach] | [Experience] |
| SR-2 | | | | | | | |
| SR-3 | | | | | | | |

### How {author_name}'s Expertise Addresses Security Requirements

**Security Experience from {author_credentials}:**

1. **[Security-related credential/experience]**:
   - Context: [Where gained]
   - Relevance: [How it applies to security requirements]
   - Evidence: [Exhibit [#]] OR [describe based on credentials]

2. **[Second security experience]**:
   [Same structure]

**Track Record:**
{author_name} has [X years] experience with [security domain], including [specific achievement] at [organization] ([Evidence reference]).

Domain: {technical_domain}""",

        # ============================================================================
        # PART 11: Reliability, Scalability and Costs (3-4 pages)
        # ============================================================================
        12: f"""## Part 11. Reliability, Scalability and Costs

Generate operational analysis (3-4 pages):

### Reliability Design

| Metric | Target | Industry Standard | Source | Approach to Achieve |
|--------|--------|-------------------|--------|---------------------|
| Availability | [X%] | [Y%] | ([Source], [Year]) | [Technical approach] |
| MTTR | [X hours] | [Y hours] | ([Source]) | [Recovery approach] |
| MTBF | [X days] | [Y days] | | |
| Data Durability | [X 9s] | [Y 9s] | | |

### Scalability Design

**Current Capacity Baseline:**
- Initial capacity: [X] users / [Y] transactions
- Growth projection based on {target_audience}: [Z%] annual growth

**Scaling Strategy:**

| Scale Trigger | Current Capacity | Scaling Action | New Capacity | Estimated Cost |
|---------------|------------------|----------------|--------------|----------------|
| [Trigger 1] | [X] | [Action] | [Y] | $[Range] |
| [Trigger 2] | | | | |

### Cost Analysis

**Development Costs:**

| Category | Estimated Range | Basis for Estimate | Confidence |
|----------|-----------------|-------------------|------------|
| [Category 1 - e.g., Engineering] | $[X] - $[Y] | [Industry benchmarks/quotes] | [H/M/L] |
| [Category 2 - e.g., Infrastructure] | $[X] - $[Y] | | |
| [Category 3] | | | |
| **TOTAL DEVELOPMENT** | $[Sum Range] | | |

**Operational Costs (Monthly):**

| Category | Monthly Cost | Annual Cost | Source/Basis |
|----------|-------------|-------------|--------------|
| [Category 1] | $[X] | $[Y] | [Vendor quote / industry benchmark] |
| [Category 2] | | | |
| **TOTAL OPERATIONAL** | $[Sum] | $[Sum x 12] | |

### Return on Investment Analysis

**Investment Required:**
- Development: $[X]
- First year operations: $[Y]
- Total Year 1 investment: $[X + Y]

**Expected Returns (Based on {author_name}'s Track Record):**

| Metric | Projected Value | Calculation | Evidence Basis |
|--------|-----------------|-------------|----------------|
| Revenue/Value generated (Year 1) | $[X] | [Show calculation] | [Historical performance reference] |
| Revenue/Value generated (Year 3) | $[Y] | [Show calculation] | |

**ROI Calculation:**
- Investment: $[X]
- Year 1 Return: $[Y]
- Year 1 ROI: ([Y] - [X]) / [X] x 100 = [Z%]
- Break-even: [Month/Year]

**Basis for Projections:**
{author_name}'s documented performance of [metric] at [organization] supports the [Z%] return projection. Conservative adjustment applied (see Part 8).

Note: Cost figures provided as ranges reflecting market conditions. Not fabricated exact figures.""",

        # ============================================================================
        # PART 12: Risks, Limitations and Mitigation (5-7 pages)
        # ============================================================================
        13: f"""## Part 12. Risks, Limitations and Mitigation

Generate comprehensive risk analysis (5-7 pages) with MANDATORY historical mitigation evidence:

For EACH significant risk (MINIMUM 5 risks with full structure):

---

### Risk 1: [Risk Name - e.g., "User Adoption Challenges"]

**Risk Description:**
- Category: [Technical/Operational/Market/Regulatory]
- Description: [Detailed description of the risk]
- Likelihood: [High/Medium/Low] - Rationale: [Why this likelihood]
- Impact: [High/Medium/Low] - Quantified: $[X] or [Y%] if risk materializes
- Risk Score: [Likelihood x Impact matrix result]

**Standard Industry Approach:**
[How most professionals/organizations typically handle this risk]
- Typical mitigation: [Description]
- Success rate: [X%] ([Source if available])
- Limitations: [Why standard approach may be insufficient]

**{author_name}'s Proven Mitigation Methodology:**

**Historical Context - Similar Risk Encountered:**

| Attribute | Detail |
|-----------|--------|
| Organization | [Name], [Industry], [Size] |
| Timeframe | [When risk was encountered] |
| Similar Challenge | [Description of comparable risk situation] |
| Scale | [X users at stake, $Y potential impact] |
| Constraints | [Resources available to address] |

**Solution Implemented by {author_name}:**

[Detailed description of what was done - 6-10 lines minimum]

1. **Step 1**: [Specific action taken]
2. **Step 2**: [Specific action taken]
3. **Step 3**: [Specific action taken]
4. **Step 4**: [Specific action taken]
[Minimum 4 specific steps]

**Documented Results:**

| Phase | Metric Value | Date | Evidence |
|-------|-------------|------|----------|
| Before intervention | [X - showing the risk/problem] | [Date] | [Source] |
| After intervention | [Y - showing improvement] | [Date] | [Source] |
| Improvement | [Calculation] = [Z%] risk reduction | | |

- Sustained for: [How long the improvement was maintained]
- Evidence: [Employment letter from [Name], [Title], Exhibit [#], page [#]]
  OR [Employer verification of risk mitigation achievement, including before/after metrics and timeframe — describe qualitatively]

**Transferability to {project_title}:**

Why same methodology applies:
1. [Similarity 1]: Original context had [X], {project_title} has [Y similar characteristic]
2. [Similarity 2]: [Explanation]
3. [Similarity 3]: [Explanation]
[Minimum 3 similarities]

What will be adapted:
1. [Difference 1]: Original [X], will adapt by [Y] because [reason]
2. [Difference 2]: [Adaptation needed and rationale]

**Competitive Advantage:**
"Unlike typical practitioners in {technical_domain} who [standard approach limitation], {author_name} brings:
- Proven solution that reduced [risk type] by [X%] in prior context
- [Y years/months] experience specifically managing this risk category
- Documented methodology (not theoretical)
- Expected outcome: Risk probability reduced from [baseline]% to [projected]% based on historical performance, representing [calculation]% better risk management than industry standard."

---

### Risk 2: [Risk Name]

[REPEAT FULL STRUCTURE]

---

### Risk 3: [Risk Name]

[REPEAT FULL STRUCTURE]

---

### Risk 4: [Risk Name]

[REPEAT FULL STRUCTURE]

---

### Risk 5: [Risk Name]

[REPEAT FULL STRUCTURE]

---

### Risk Summary Matrix

| Risk ID | Risk Name | Likelihood | Impact | Score | Mitigation Approach | Historical Basis | Evidence |
|---------|-----------|------------|--------|-------|---------------------|------------------|----------|
| R-1 | [Name] | [H/M/L] | [H/M/L] | [Score] | [{author_name}'s methodology] | [Result achieved] | [Exhibit [#]] |
| R-2 | | | | | | | |
| R-3 | | | | | | | |
| R-4 | | | | | | | |
| R-5 | | | | | | | |

### Known Limitations

| Limitation | Description | Impact | Mitigation/Workaround | Timeline to Address |
|------------|-------------|--------|----------------------|---------------------|
| [Limitation 1] | [Description] | [What this limits] | [How managed] | [If/when will be resolved] |
| [Limitation 2] | | | | |

### Dependencies on External Factors

| Dependency | Description | Risk if Not Met | Contingency Plan |
|------------|-------------|-----------------|------------------|
| [Dependency 1] | [Description] | [Impact] | [Alternative approach] |
| [Dependency 2] | | | |

Author credentials: {author_credentials}
Domain: {technical_domain}""",

        # ============================================================================
        # PART 13: Roadmap (3-4 pages)
        # ============================================================================
        14: f"""## Part 13. Roadmap

Generate implementation roadmap (3-4 pages):

### Strategic Roadmap Overview

**Phase Summary:**

| Phase | Timeline | Focus | Key Deliverables | Investment | Success Criteria |
|-------|----------|-------|------------------|------------|------------------|
| Foundation | Q1 (Months 1-3) | [Focus] | [Deliverables] | $[Range] | [Measurable criteria] |
| Development | Q2 (Months 4-6) | [Focus] | [Deliverables] | $[Range] | [Criteria] |
| Launch | Q3 (Months 7-9) | [Focus] | [Deliverables] | $[Range] | [Criteria] |
| Scale | Q4 (Months 10-12) | [Focus] | [Deliverables] | $[Range] | [Criteria] |

### Detailed Phase Breakdown

**Quarter 1: Foundation (Months 1-3)**

| Week | Milestone | Deliverable | Owner | Dependencies | Risk Mitigation |
|------|-----------|-------------|-------|--------------|-----------------|
| 1-2 | [Milestone] | [Deliverable] | {author_name} | [Dependencies] | [Mitigation approach] |
| 3-4 | | | | | |
| 5-8 | | | | | |
| 9-12 | | | | | |

Success Criteria for Phase 1:
- [Criterion 1]: [Measurable target]
- [Criterion 2]: [Measurable target]
- Go/No-Go Decision: [What determines advancement to Phase 2]

**Quarter 2: Development (Months 4-6)**
[Same structure]

**Quarter 3: Launch (Months 7-9)**
[Same structure]

**Quarter 4: Scale (Months 10-12)**
[Same structure]

### Resource Allocation Timeline

| Resource Type | Q1 | Q2 | Q3 | Q4 | Total Year 1 |
|---------------|----|----|----|----|--------------|
| Personnel (FTE) | [X] | [Y] | [Z] | [A] | [Average] |
| Infrastructure | $[X] | $[Y] | $[Z] | $[A] | $[Total] |
| External Services | $[X] | $[Y] | $[Z] | $[A] | $[Total] |
| **TOTAL** | $[Sum] | $[Sum] | $[Sum] | $[Sum] | $[Grand Total] |

### Decision Points and Contingencies

| Decision Point | Timing | Criteria | If Positive | If Negative |
|----------------|--------|----------|-------------|-------------|
| Phase 1 Complete | End Month 3 | [Criteria] | Proceed to Phase 2 | [Contingency action] |
| Pilot Validation | End Month 6 | [Criteria] | Scale to production | [Pivot or adjust] |
| Production Launch | End Month 9 | [Criteria] | Continue scaling | [Reassess strategy] |

### Long-term Vision (Years 2-3)

| Timeframe | Objectives | Target Metrics | Investment | Assumptions |
|-----------|------------|----------------|------------|-------------|
| Year 2 | [Objectives] | [Metrics] | $[Range] | [Key assumptions] |
| Year 3 | [Objectives] | [Metrics] | $[Range] | [Key assumptions] |

Project: {project_title}""",

        # ============================================================================
        # PART 14: Conclusions and Recommendations (2-3 pages)
        # ============================================================================
        15: f"""## Part 14. Conclusions and Recommendations

Generate conclusions (2-3 pages) synthesizing the three NIW prongs:

### Technical Conclusions

**Project Viability Assessment:**

| Dimension | Assessment | Supporting Evidence |
|-----------|------------|---------------------|
| Technical Feasibility | [Feasible/Challenging/Not Feasible] | Part 6 architecture analysis |
| Resource Realism | [Adequate/Constrained] | Part 11 cost analysis |
| Timeline Achievability | [Achievable/Aggressive/Unrealistic] | Part 13 roadmap |
| Risk Manageability | [Manageable/Significant/Prohibitive] | Part 12 risk analysis |

**Overall Viability**: [Summary statement with confidence level]

### NIW Prong Analysis Summary

**Prong 1: Substantial Merit and National Importance**

| Criterion | Evidence | Reference |
|-----------|----------|-----------|
| Problem Scope | [X] entities affected nationally | Part 2, [Source] |
| Economic Impact | $[Y] annual impact | Part 2, [calculation reference] |
| Federal Alignment | [Programs with USC citations] | Part 2 |
| Urgency | [Why action needed now] | Part 2 |

**Conclusion for Prong 1**: {project_title} addresses a national problem affecting [X] entities with $[Y] economic impact, directly aligning with [Federal Program] ([## U.S.C. § ####]).

---

**Prong 2: {author_name} is Well Positioned to Advance the Endeavor**

| Criterion | Evidence | Reference |
|-----------|----------|-----------|
| Exceptional Ability | Top [X%] of [Y] practitioners | Part 2.5, 3-method scarcity analysis |
| Track Record | [Z%] improvement at [Organization] | Part 2.5, [Evidence ref] |
| Proven Methodologies | [Number] documented methodologies | Part 7 |
| Credentials | [Key credentials] | Part 2.5.B |

**Conclusion for Prong 2**: {author_name}'s documented track record of [specific achievement] combined with [unique credential combination] found in approximately [X] professionals nationwide demonstrates exceptional positioning to advance this endeavor.

---

**Prong 3: Waiver Serves U.S. National Interest**

| Criterion | Evidence | Reference |
|-----------|----------|-----------|
| Scarcity | ~[X] comparable professionals in U.S. | Part 2.5.E, 3-method analysis |
| Time to Replicate | >[Y years] to develop equivalent expertise | [Estimation basis] |
| Cost of Delay | $[Z] per [timeframe] | Part 2 urgency analysis |
| Unique Methodology | [Methodology name] with no published equivalent | Part 2.5.C, Part 7 |

**Conclusion for Prong 3**: Requiring labor certification would introduce [X months/years] delay, costing $[Y] in foregone benefits. The scarcity analysis demonstrates that locating a U.S. worker with {author_name}'s qualification combination would be impractical given the ~[Z] professionals nationwide possessing this profile.

---

### Strategic Recommendations

**Immediate Actions (0-3 months):**
1. [Action 1]: [Rationale and expected outcome]
2. [Action 2]: [Rationale and expected outcome]
3. [Action 3]: [Rationale and expected outcome]

**Medium-term Actions (3-12 months):**
1. [Action 1]: [Rationale]
2. [Action 2]: [Rationale]

**Long-term Vision (1-3 years):**
- Strategic direction: [Description]
- Expansion opportunities: [Description]
- Sustainability measures: [Description]

### Key Success Factors

| Factor | Importance | Status | Action Required |
|--------|------------|--------|-----------------|
| [Factor 1] | Critical | [Current status] | [Action if needed] |
| [Factor 2] | High | | |
| [Factor 3] | Medium | | |

### Final Assessment

**Summary Statement:**
{project_title}, executed by {author_name}, represents [X - economic/social value] in national benefit addressing [Y - specific problem]. {author_name}'s documented track record of [Z - specific achievement] at [Organization], combined with a qualification profile found in fewer than [A] U.S. professionals, establishes exceptional positioning to advance this endeavor. The analysis demonstrates that waiving labor certification serves the national interest by enabling immediate pursuit of $[B] in annual benefits that would otherwise be delayed [C timeframe] during an impractical search for an equally qualified U.S. worker.

**Recommended Decision**: Approve NIW based on satisfaction of all three prongs with documented evidence.""",

        # ============================================================================
        # PART 15: References (4-6 pages)
        # ============================================================================
        16: f"""## Part 15. References

Generate comprehensive bibliography (4-6 pages) with SPECIFIC CITATIONS:

### I. Government and Regulatory Sources

For EACH government source:

**[Number]. [Type]: [Full Title]**
- **Author/Organization**: [Complete name]
- **Publication Date**: [Month Day, Year or Year]
- **URL**: [Complete .gov URL]
- **Specific Citation**:
  - Page/Section: [Where data appears]
  - Table/Figure: [If applicable]
  - Quote/Data: "[Exact quote or statistic used]"
- **Accessed**: [Date URL was verified]
- **Relevance**: Supports [specific claim] in Part [#], page [#]
- **Data Used**: [Exactly what was extracted]

Example format:
**1. Government Statistics: 2024 Small Business Profile**
- **Author/Organization**: U.S. Small Business Administration, Office of Advocacy
- **Publication Date**: March 2024
- **URL**: https://advocacy.sba.gov/2024/03/05/2024-small-business-profile/
- **Specific Citation**:
  - Table 1, page 3: "Total small businesses: 33.3 million"
  - Figure 2, page 5: "SME employment: 46.4% of private workforce"
- **Accessed**: [Current date]
- **Relevance**: Supports Part 2 market size claims, Part 2.5.D impact calculations
- **Data Used**: 33.3M small businesses figure for economic impact calculations

[Continue for all government sources - minimum 5]

### II. Academic and Research Sources

For EACH academic source:

**[Number]. [Type]: [Full Citation]**
- **Authors**: [Full author list]
- **Year**: [Publication year]
- **Title**: "[Full title]"
- **Journal/Conference**: [Name], Volume [#], Issue [#], Pages [#-#]
- **DOI**: [If available]
- **Specific Citation**:
  - Page/Section: [Where referenced data appears]
  - Quote/Finding: "[Relevant finding]"
- **Relevance**: [What claim this supports and in which Part]

[Continue for academic sources - minimum 3]

### III. Industry Reports and Standards

For EACH industry source:

**[Number]. [Type]: [Full Title]**
- **Organization**: [Publisher name]
- **Publication Date**: [Date]
- **Report ID/URL**: [Identifier or URL]
- **Subscription Required**: [Yes/No]
- **Specific Citation**:
  - Page: [#]
  - Data Point: [Exact figure used]
- **Relevance**: [What claim this supports]

[Continue for industry reports - minimum 3]

### IV. Technical Documentation

**[Number]. [Technology/Framework]: [Documentation Title]**
- **Version**: [Version number]
- **URL**: [Documentation URL]
- **Section Referenced**: [Specific section]
- **Relevance**: [How used in Part 6/7]

### V. {author_name}'s Expertise Evidence (Exhibits)

**Exhibit [#]: [Document Type]**
- **Source Organization**: [Who issued/authored]
- **Date**: [Document date]
- **Confirms**: [What this exhibit verifies]
- **Referenced In**: Parts [list all Parts that cite this exhibit]
- **Status**: [Available / NEEDED from client]

[List ALL exhibits referenced throughout the document]

### VI. Required Evidence Checklist

| Exhibit # | Document Type | Purpose | Must Confirm | Referenced In | Status |
|-----------|---------------|---------|--------------|---------------|--------|
| 1 | [Credential certificate] | Proves qualification | [Issuing org, date, ID] | Parts 1, 2.5, 14 | [Available/NEEDED] |
| 2 | [Employment verification letter] | Confirms metrics | [Dates, title, specific metrics] | Parts 2.5, 7, 8, 12 | [Include relevant supporting documents] |
| 3 | [Additional document] | [Purpose] | [What it must contain] | [Parts] | [Status] |
| [Continue for all exhibits] |

### VII. Evidence Gathering Instructions (If NEEDED exhibits exist)

**For Exhibit [#]: Employment Verification Letter from [Organization]**

Must be on official letterhead and signed by [supervisor/HR], confirming:
- Employment dates: [Start] to [End]
- Title/Role: [Exact title]
- Specific metrics:
  - [Metric 1]: Baseline [X], Result [Y], Timeframe [Z]
  - [Metric 2]: [Same structure]
  - [Metric 3]: [Same structure]
- Recommendation: Request from [specific person if known]

[Continue for each NEEDED exhibit]

CRITICAL: Include ONLY real, verifiable references. Do NOT fabricate citations, DOIs, or URLs.
Domain: {technical_domain}""",

        # ============================================================================
        # PART 16: Appendices and Evidence Checklist (5-10 pages)
        # ============================================================================
        17: f"""## Part 16. Appendices and Evidence Checklist

Generate comprehensive appendices (5-10 pages):

### Appendix A: Technical Specifications

**System Requirements for {project_title}:**

| Category | Requirement | Specification | Standard Met |
|----------|-------------|---------------|--------------|
| [Category 1] | [Requirement] | [Specification] | [Standard] |
| [Category 2] | | | |

**API Specifications** (if applicable):
[Relevant technical specifications]

**Data Schemas** (if applicable):
[Key data structures]

### Appendix B: Glossary of Terms

| Term | Definition | Context in {technical_domain} |
|------|------------|------------------------------|
| [Term 1] | [Definition] | [How used in this domain] |
| [Term 2] | | |
| [Continue for key terms] |

### Appendix C: {author_name}'s Detailed Qualifications

**Full Credential Listing:**

Based on: {author_credentials}

| Credential | Issuing Organization | Date Obtained | Validity | Scarcity |
|------------|---------------------|---------------|----------|----------|
| [Credential 1] | [Organization] | [Date] | [Period] | [X% of professionals] |
| [Credential 2] | | | | |

**Relevant Project History Summary:**

| Project/Role | Organization | Duration | Key Achievement | Evidence |
|--------------|--------------|----------|-----------------|----------|
| [Project 1] | [Org] | [Dates] | [Achievement with metric] | [Exhibit [#]] |
| [Project 2] | | | | |

### Appendix D: Supporting Market Data

**Market Research Summary:**

| Data Point | Value | Source | Year | Part Referenced |
|------------|-------|--------|------|-----------------|
| [Data point 1] | [Value] | [Source] | [Year] | Part [#] |
| [Data point 2] | | | | |

### Appendix E: Implementation Checklists

**Pre-Launch Checklist:**
- [ ] [Item 1]
- [ ] [Item 2]
- [ ] [Continue]

**Quality Assurance Checklist:**
- [ ] [Item 1]
- [ ] [Item 2]

**Compliance Verification Checklist:**
- [ ] [Regulation 1] compliance confirmed
- [ ] [Regulation 2] compliance confirmed

### Appendix F: Required Evidence Summary for USCIS Submission

**CRITICAL: This section summarizes ALL evidence needed for petition filing**

**Exhibits Available from Client:**

| Exhibit # | Document | What It Confirms | Status |
|-----------|----------|------------------|--------|
| [#] | [Document type] | [Confirmation details] | Available |

**Exhibits NEEDED from Client:**

| Exhibit # | Document Needed | Must Confirm | Template Provided | Priority |
|-----------|-----------------|--------------|-------------------|----------|
| [#] | Employment Letter from [Org] | [Specific metrics] | Yes - See below | Critical |
| [#] | [Another document] | [Details] | [Yes/No] | [Priority] |

**Employment Verification Letter Template:**

[To be used by client when requesting employment verification]

---
[DATE]

To Whom It May Concern:

I, [SUPERVISOR NAME], [TITLE] at [ORGANIZATION], confirm the following regarding {author_name}'s employment:

**Employment Details:**
- Position: [TITLE]
- Department: [DEPARTMENT]
- Employment Period: [START DATE] to [END DATE]
- Reporting To: [SUPERVISOR TITLE]

**Performance Metrics:**
During employment, {author_name} achieved the following documented results:

1. [METRIC NAME]:
   - Baseline (before {author_name}'s involvement): [VALUE]
   - Result (after {author_name}'s contribution): [VALUE]
   - Improvement: [CALCULATION]
   - Measurement methodology: [HOW MEASURED]

2. [METRIC NAME]:
   [Same structure]

3. [METRIC NAME]:
   [Same structure]

**Scope and Scale:**
- Users/entities impacted: [NUMBER]
- Transactions/volume: [NUMBER] per [PERIOD]
- Geographic scope: [DESCRIPTION]

I confirm that the above information is accurate to the best of my knowledge based on [RECORDS/DIRECT OBSERVATION/PERFORMANCE REVIEWS].

Sincerely,

[SIGNATURE]
[PRINTED NAME]
[TITLE]
[ORGANIZATION]
[CONTACT INFORMATION]
---

**Evidence Summary Statistics:**

| Category | Count | Status |
|----------|-------|--------|
| Total Exhibits Referenced | [X] | |
| Exhibits Available | [Y] | Ready for submission |
| Exhibits NEEDED | [Z] | Client action required |
| Critical Priority NEEDED | [A] | Must obtain before filing |

### Quality Verification Checklist

Before submission, verify:

**Structure Check:**
- [ ] Part 2.5 exists as independent section (not subsection)
- [ ] Part 2.5 is minimum 10 pages
- [ ] Part 2.5 has all 5 subsections (A, B, C, D, E)
- [ ] Part 7 has "Proven Methodologies" before phases
- [ ] Part 7 methodologies section is minimum 6 pages
- [ ] Total document is 60-100 pages

**Evidence Check:**
- [ ] Every comparison table has "Evidence" column
- [ ] Every petitioner claim has evidence reference or NEEDED tag
- [ ] Required Evidence Checklist exists (this appendix)
- [ ] Minimum 5 exhibits identified

**Quantification Check:**
- [ ] Every "achieved X%" has before/after numbers
- [ ] Every "managed operations" has scale numbers
- [ ] Every organization has context (industry, size)
- [ ] Every improvement shows calculation

**Scarcity Check:**
- [ ] Specific percentile stated (top X%)
- [ ] Absolute number estimated (fewer than Y)
- [ ] 3 methods shown with calculations
- [ ] Same scarcity number used consistently

**Federal Alignment Check:**
- [ ] Minimum 2 federal programs cited
- [ ] Each has USC/CFR citation
- [ ] Official .gov URLs provided

Project: {project_title}
Author: {author_name}"""
    }
    
    return prompts
