"""
Enhanced White Paper Prompts for EB-2 NIW Style Documents
Based on USCIS evaluator guidelines for National Interest Waiver petitions.

Key principles:
1. Every section must answer: "Why THIS author and not another professional?"
2. All claims must have evidence references or be marked for client verification
3. Numbers must be specific, not generic
4. Scarcity must be calculated with formal methods
5. Part 2.5 is MANDATORY as independent section
"""

# Section titles for 17-part structure (includes Part 2.5)
SECTION_TITLES_17 = [
    "Executive Summary",                          # 1
    "Context and Problem",                        # 2
    "Evidence of Exceptional Ability",            # 2.5 (stored as section 3)
    "Target Audience and Use Cases",              # 3 -> 4
    "State of the Art and Gap Analysis",          # 4 -> 5
    "Requirements and Assumptions",               # 5 -> 6
    "Architecture / Solution Design",             # 6 -> 7
    "Implementation Methodology",                 # 7 -> 8
    "Evaluation and Metrics",                     # 8 -> 9
    "Results and Analysis",                       # 9 -> 10
    "Security, Privacy and Compliance",           # 10 -> 11
    "Reliability, Scalability and Costs",         # 11 -> 12
    "Risks, Limitations and Mitigation",          # 12 -> 13
    "Roadmap",                                    # 13 -> 14
    "Conclusions and Recommendations",            # 14 -> 15
    "References",                                 # 15 -> 16
    "Appendices"                                  # 16 -> 17
]

# Section number mapping for display (Part 2.5)
SECTION_DISPLAY_NUMBERS = {
    1: "1",
    2: "2", 
    3: "2.5",  # Evidence of Exceptional Ability
    4: "3",
    5: "4",
    6: "5",
    7: "6",
    8: "7",
    9: "8",
    10: "9",
    11: "10",
    12: "11",
    13: "12",
    14: "13",
    15: "14",
    16: "15",
    17: "16"
}

def get_section_prompts(
    project_title: str,
    author_name: str,
    author_credentials: str,
    project_description: str,
    target_audience: str,
    technical_domain: str
) -> dict:
    """
    Returns enhanced section prompts based on EB-2 NIW evaluator guidelines.
    """
    
    prompts = {
        # PART 1: Executive Summary (2-3 pages)
        1: f"""**Part 1. Executive Summary**

Generate a comprehensive executive summary (2-3 pages) with the following structure:

### I. NATIONAL IMPORTANCE (Prong 1)
- Problem with quantifiable data: Cite specific statistics with sources
- Population affected: Provide exact numbers (e.g., "33.2 million small businesses" not "millions of businesses")
- Federal initiatives alignment: Cite at least 2 federal programs with USC/CFR references
- Economic impact projection: Show calculation (e.g., "X entities × $Y impact = $Z total")

### II. AUTHOR'S EXCEPTIONAL QUALIFICATIONS (Prong 2 Summary)

**Comparative Metrics Table** (MANDATORY):
| Metric | Industry Average (Source) | {author_name}'s Achievement | Variance | Evidence |
|--------|---------------------------|----------------------------|----------|----------|
| [Metric 1] | [X%] ([Source, Year]) | [Y%] | +[Z]% | [Document type, Exhibit #] |
| [At least 4 metrics] |

**Unique Qualification Combination**:
Based on: {author_credentials}
- Qualification 1: [X%] of professionals have this
- Qualification 2: [Y%] of professionals have this
- Combined: Top [Z]% (calculation: X% × Y% = Z%)

### III. WAIVER JUSTIFICATION (Prong 3 Summary)
- Scarcity: Fewer than [X] professionals in U.S. with this combination
- Urgency: Cost of delay quantified in $
- Irreplaceability: What makes {author_name} uniquely capable

### IV. PROJECT OVERVIEW
- Project: {project_title}
- Description: {project_description}
- Target Audience: {target_audience}
- Technical Domain: {technical_domain}

### V. ABOUT THE AUTHOR
Write biography for {author_name} using ONLY provided information:
- Credentials: {author_credentials}

Format: "[Name] brings a combination of [specific achievement with number] at [organization], [certification representing top X% of professionals], and [unique capability]—a combination found in fewer than [Y] of the [Z total] professionals in the U.S."

⚠️ CRITICAL RULES:
- Use ONLY information provided - do NOT invent achievements
- Every metric must have a source citation
- Every claim about author must reference evidence or mark as needing verification
- No generic descriptions - use specific numbers""",

        # PART 2: Context and Problem (3-5 pages)
        2: f"""**Part 2. Context and Problem**

Generate comprehensive context (3-5 pages):

### Technical Background of {technical_domain}
- Current state with specific statistics (cite sources)
- Key industry trends with data
- Regulatory environment (cite USC/CFR where applicable)

### Problem Quantification
- Total affected population: [Exact number] ([Source, Year])
- Economic impact calculation:
  - Annual cost: $[X] per [entity/person] ([Source])
  - Total affected: [Y] entities
  - Total impact: $[X] × [Y] = $[Z] annually
- Growth trend: [X%] increase over [Y years] ([Source])

### Current Solutions and Limitations
| Current Solution | Provider | Limitation | Gap |
|-----------------|----------|------------|-----|
| [Solution 1] | [Company] | [Specific limitation] | [What's missing] |

### Federal Policy Alignment
**[Federal Program/Law Name]** ([Citation: ## U.S.C. § ####])
- Objective: "[Quote from official source]"
- Project alignment: [How {project_title} advances this]
- Source: [Official .gov URL]

### Why Action is Needed NOW
- Urgency factor 1: [With quantified impact]
- Urgency factor 2: [With timeline]
- Cost of inaction: $[Amount] over [timeframe]

Project Context:
- Title: {project_title}
- Description: {project_description}
- Domain: {technical_domain}
- Author: {author_name}
- Credentials: {author_credentials}

⚠️ All statistics must have verifiable sources. Use format: "[Statistic] ([Source Name], [Year], page [#])"
""",

        # PART 2.5: Evidence of Exceptional Ability (10-12 pages) - CRITICAL NEW SECTION
        3: f"""**Part 2.5: Evidence of Exceptional Ability (Prong 2 - NIW Criteria)**

THIS IS A CRITICAL SECTION - MINIMUM 10-12 PAGES REQUIRED

Generate comprehensive evidence of {author_name}'s exceptional ability with ALL five subsections:

---

### A. Quantifiable Performance Metrics (2-3 pages)

Create detailed comparison table with MINIMUM 4 metrics:

| Metric | Industry Average (Source) | {author_name}'s Achievement | Variance | Evidence Reference |
|--------|---------------------------|----------------------------|----------|-------------------|
| [Metric 1] | [X%] ([Verifiable source, Year, page]) | [Y%] ([Specific context: Y of Z total]) | +[Diff]% | [Document type, Exhibit #] |
| [Metric 2] | | | | |
| [Metric 3] | | | | |
| [Metric 4] | | | | |

For EACH metric, provide narrative:
- Why this metric matters for {technical_domain}
- How {author_name}'s data was obtained
- What this performance represents nationally (percentile)

---

### B. Formal Recognition of Expertise (2-3 pages)

For EACH credential from: {author_credentials}

**[Credential Name]**
- Issuing Organization: [Name + prestige level]
- Achievement Date: [Month/Year]
- Scarcity Indicators:
  - Only [X%] of professionals in {technical_domain} hold this ([Source])
  - Required [X hours/years] of [study/experience] to obtain
  - Pass rate: [Y%] ([Source if available])
- Relevance to {project_title}: [Specific explanation of how this credential enables the proposed work]
- Evidence: [Certificate copy, Exhibit #]

---

### C. Innovation and Original Contributions (3-4 pages)

Document MINIMUM 2-3 original methodologies:

**[Methodology 1 Name]**

**Development Context**:
- Organization: [Where developed]
- Timeframe: [Start] to [End] ([X months])
- Challenge Addressed: [Specific problem with quantified scope]
- Constraints: [Budget/time/resource limitations]

**Methodology Description**: 
[5-8 lines of technical description - what was done and how]

**Documented Results** (MINIMUM 3 metrics):
| Metric | Baseline (Before) | Result (After) | Improvement | Evidence |
|--------|------------------|----------------|-------------|----------|
| [Metric 1] | [X] ([date]) | [Y] ([date]) | [Z%] | [Exhibit #, page] |
| [Metric 2] | | | | |
| [Metric 3] | | | | |

Population impacted: [Number] people/businesses

**Originality Evidence**:
- Literature search: Searched [databases] on [date]
- Finding: No published framework addresses [specific unique aspect]
- Conclusion: Represents original contribution

**Applicability to {project_title}**: [3-5 lines explaining transfer]

[Repeat for Methodology 2 and 3]

---

### D. Sustained National/International Impact Potential (2-3 pages)

**Addressable Market Analysis**:
- Total market size: [Number] in U.S. ([Source, Year])
- Underserved segment: [Number] currently lack [solution] ([Source])
- Economic value: $[amount] in [relevant metric]

**Projected Impact (Conservative Estimates)**:

**Year 1 (0.1% penetration)**:
- Target: [X] entities
- Direct economic impact calculation:
  - [X] entities × $[Y] impact per entity = $[Z] total
  - Based on [documented result]% improvement
- Jobs supported: [Number]

**Year 3 (0.5% penetration)**:
- Target: [X] entities
- Cumulative impact: $[amount]

---

### E. Comparison to Available U.S. Workers (2-3 pages)

**Standard Professional Profile in {technical_domain}**:
- Average education: [Level] (Bureau of Labor Statistics, [Year])
- Typical experience: [X years] (O*NET OnLine, [Year])
- Common certifications: [List] ([Professional Association], [Year])
- Language capabilities: [X%] monolingual (BLS, [Year])

**{author_name}'s Differentiating Factors** (minimum 4):

| Factor | Industry Standard | {author_name} | Differential | Relevance |
|--------|------------------|---------------|--------------|-----------|
| [Factor 1] | [X%] have this | [Specific qual] | Top [Y%] | [Why it matters] |
| [Factor 2] | | | | |
| [Factor 3] | | | | |
| [Factor 4] | | | | |

**Scarcity Analysis with 3 Methods** (MANDATORY):

**Method 1: Professional Network Search** (conducted [date])
- "[Job title]" in US: [X] results
- Add "[qualification 1]": [Y] results
- Add "[qualification 2]": [Z] results
- Final: [Number] professionals with comparable combination
- Calculation: [Number] / [Total in occupation] = [%]
- Percentile: Top [100-percentage]%

**Method 2: Bureau of Labor Statistics Data**
- Occupation: [SOC Code - Title]
- Total employed in U.S.: [Number] (BLS, [Year])
- With [qualification 1]: [X%]
- With [qualification 2]: [Y%]
- Combined: [X%] × [Y%] = [Z%]
- Calculation: [Total] × [Z%] = [Number] professionals

**Method 3: Professional Association Data**
- [Association Name] members in U.S.: [Number]
- With [certification]: [X] certified
- Estimated with {author_name}'s combination: [Number]

**Scarcity Conclusion**:
Based on 3 verification methods, {author_name} possesses qualification combination found in:
- Estimated [X] to [Y] professionals nationwide
- Representing top [Z%] of [total] in {technical_domain}
- Ratio: 1 in [calculation] professionals

---

Author Information (USE ONLY THIS):
- Name: {author_name}
- Credentials: {author_credentials}
- Domain: {technical_domain}

Project Information:
- Title: {project_title}
- Description: {project_description}
- Target Audience: {target_audience}

⚠️ CRITICAL: This section must be 10-12 pages minimum. Every claim needs evidence reference or verification note.""",

        # PART 3 (displayed as Part 3): Target Audience
        4: f"""**Part 3. Target Audience and Use Cases**

Generate comprehensive audience analysis (4-6 pages):

### Primary User Profiles
Based on: {target_audience}

For each user type:
- Profile description with demographics
- Specific needs and pain points (quantified)
- Current alternatives and their limitations
- Why {author_name} is uniquely qualified to serve them

### Use Cases with Prioritization

| Use Case | Impact (1-5) | Feasibility (1-5) | Priority | Target Users |
|----------|-------------|-------------------|----------|--------------|
| [Case 1] | [Score] | [Score] | [H/M/L] | [Number] |

### Why {author_name} is Uniquely Qualified for This Audience

**Gap in Current Market**: 
[Explain what profiles exist currently and their limitations]

**{author_name}'s Bridge Profile**: 
How the combination of:
- {author_credentials}
- Experience in {technical_domain}
Creates unique capability to serve underserved segments

**Concrete Example**:
"{author_name}'s [unique qualification] enables service to [specific population] ([X] entities contributing $[Y] annually per [Source]). Current market shows only [Z%] of professionals offer [capability], leaving [A%] reporting [barrier] ([Source]). This addresses $[amount] underserved market segment."

Project: {project_title}
Description: {project_description}
""",

        # PART 4 (displayed as Part 4): State of the Art
        5: f"""**Part 4. State of the Art and Gap Analysis**

Generate comprehensive analysis (5-7 pages):

### Current Approaches in {technical_domain}
- Existing solutions (use real, verifiable tools/platforms)
- Major players and their offerings
- Market share data where available

### Comparative Analysis Table

| Solution | Provider | Strengths | Limitations | Gap Addressed by {project_title} |
|----------|----------|-----------|-------------|--------------------------------|
| [Solution 1] | [Real company] | [Specific strength] | [Limitation] | [How proposal fills gap] |

### Gap Analysis
- Technical gaps in current market
- Underserved populations/needs
- Opportunities for innovation

### Differential Advantage of {author_name}'s Approach

For EACH advantage (minimum 2-3):

**[Advantage Name - e.g., "Resource-Constrained Methodology"]**

**Origin of Methodology**:
{author_name} developed [methodology name] at [organization] ([years]) where [context requiring this innovation].

**Documented Results**:
- Metric 1: Improved from [X] to [Y] = [Z%] improvement
- Evidence: [Exhibit #, page #]
- Industry benchmark: [A%] ([Source])
- Differential: [Calculation showing exceeded benchmark]

**Transferability**:
This transfers to {project_title} because:
1. [Similarity 1 between original context and new]
2. [Similarity 2]

**Scarcity**: <[X%] of practitioners have documented success in [specific context]

Author credentials: {author_credentials}
Project description: {project_description}
""",

        # PART 5 (displayed as Part 5): Requirements
        6: f"""**Part 5. Requirements and Assumptions**

Generate requirements specification (3-4 pages):

### Functional Requirements
Derived from: {project_description}

| ID | Requirement | Priority | Trace to Project Description |
|----|-------------|----------|------------------------------|
| FR-1 | [Requirement] | [H/M/L] | [Which part of description] |

### Non-Functional Requirements (SLOs)
Appropriate for {technical_domain}:

| Category | Requirement | Target | Industry Standard | Source |
|----------|-------------|--------|-------------------|--------|
| Performance | [Req] | [Target] | [Standard] | [Source] |
| Scalability | [Req] | [Target] | [Standard] | [Source] |
| Security | [Req] | [Target] | [Standard] | [Source] |

### Technical Assumptions
- Technology stack assumptions
- Resource availability
- External dependencies

### System Constraints
- Budget/resource limitations
- Timeline constraints
- Technical limitations

All requirements must be traceable to: {project_description}
""",

        # PART 6 (displayed as Part 6): Architecture
        7: f"""**Part 6. Architecture / Solution Design**

Generate architecture design (4-6 pages) that leverages {author_name}'s expertise:

### High-Level Architecture
- System components overview
- Data flow description
- Integration points

### Technical Components

For each major component:
- Purpose and functionality
- Technology choices with justification
- How it addresses specific needs from: {project_description}

### Why This Architecture Reflects {author_name}'s Expertise
- Connection to: {author_credentials}
- Leverages experience in: {technical_domain}
- Incorporates proven methodologies

### Security and Compliance Considerations
- Built-in security measures
- Compliance with relevant standards for {technical_domain}

Project: {project_title}
""",

        # PART 7 (displayed as Part 7): Implementation - EXPANDED
        8: f"""**Part 7. Implementation Methodology**

CRITICAL SECTION - MINIMUM 10-15 PAGES REQUIRED

Generate comprehensive implementation plan with MANDATORY "Proven Methodologies" section BEFORE phases:

---

## Integration of {author_name}'s Proven Methodologies

For EACH methodology (MINIMUM 2-3, each 2-3 pages):

### [Methodology Name] (Developed at [Organization], [Years])

#### Origin and Development Context

**Organizational Setting**:
- Organization: [Full name + description]
- {author_name}'s Role: [Title + specific responsibilities]
- Challenge: [Detailed problem description with quantified scope]
- Constraints: [Budget/time/resource limitations]

**Development Process**:
- Timeframe: [X months]
- Methodology: [8-12 lines technical description]
- Tools Used: [Specific list]

#### Documented Results and Evidence

**MINIMUM 3 QUANTIFIED METRICS**:

**Metric 1: [Name]**
- Baseline (before): [Value] ([Source])
- Result (after): [Value] ([Source])
- Improvement: [X%] / [absolute difference]
- Timeframe: Achieved in [X months]
- Evidence: [Employment letter para. X, Exhibit Y, page Z]

**Metric 2: [Name]**
[Same structure]

**Metric 3: [Name]**
[Same structure]

**Population Served**: [Number] people/businesses impacted

#### Transferability to {project_title}

**Parallel Challenges Table**:
| Dimension | Origin Context | {project_title} | Similarity |
|-----------|---------------|-----------------|------------|
| [Dimension 1] | [Description] | [Description] | [High/Med/Low] |
| [Dimension 2] | | | |
| [Dimension 3] | | | |

**Adaptation Strategy**: [What changes, what stays the same]

**Projected Impact with Calculation**:
"At [org], achieved [X%]. {project_title} targets population with [baseline]. Applying conservative [Y%] improvement (accounting for [differences]): [calculation] = [projected result]. For [Z] entities: $[total impact]."

[Repeat for Methodology 2 and 3]

---

## Implementation Phases

### Phase 1: MVP (Months 1-3)
- Core features and deliverables
- Success criteria with specific metrics
- Risk mitigation measures

### Phase 2: Pilot (Months 4-6)
- Expanded testing scope
- User feedback integration process
- Performance validation metrics

### Phase 3: Production (Months 7-12)
- Full deployment strategy
- Scaling approach
- Continuous improvement framework

### Quality Assurance
- Testing methodology
- Validation criteria
- Feedback loops

### Resource Requirements
- Team structure
- Tools and infrastructure
- Budget considerations

Author credentials: {author_credentials}
Project description: {project_description}
Target audience: {target_audience}
""",

        # PART 8 (displayed as Part 8): Evaluation - WITH BENCHMARKING
        9: f"""**Part 8. Evaluation and Metrics**

Generate evaluation framework (4-6 pages) with MANDATORY benchmarking:

### Key Performance Indicators

For EACH KPI (minimum 5):

**[KPI Name]**

**Definition and Formula**:
- Metric: [What is measured]
- Formula: [Calculation method]
- Measurement frequency: [Daily/Weekly/Monthly]

**Target**: [Specific value with justification]

**Benchmarking Against {author_name}'s Historical Performance** (MANDATORY):

**Historical Performance at [Organization]**:
- Context: [Role], [Organization], [dates]
- Baseline (start): [Specific number]
- Final Result (end): [Specific number]
- Improvement: [Calculation] = [X%] change
- Scale: [Number] users/entities
- Evidence: [Employment letter, Exhibit X, page Y]

**Industry Benchmark Comparison**:
- Industry average: [X%] ([Source], [Year])
- {author_name}'s achievement: [Y%]
- Differential: [Y - X] = [Z%] above average

**Adjustment for {project_title}**:
- Target set at: [A%]
- Adjustment rationale: Target represents [ratio] of historical achievement to account for [specific differences]

**Credibility Statement**:
"This target is not aspirational. It represents a conservative projection from {author_name}'s documented performance of [Y%] at [Organization], adjusted by [factor] to account for [contextual differences]. The target remains [Z%] above industry average."

[Repeat structure for each KPI]

### Metrics Dashboard Summary

| KPI | Target | Industry Avg | Historical Basis | Evidence |
|-----|--------|--------------|------------------|----------|
| [KPI 1] | [Target] | [Avg] ([Source]) | [Historical] | [Exhibit] |

Project: {project_title}
Author: {author_name}, {author_credentials}
""",

        # PART 9 (displayed as Part 9): Results
        10: f"""**Part 9. Results and Analysis**

Generate expected results analysis (3-4 pages):

### Projected Outcomes with Conservative Methodology

**Projection Methodology**:

For each projected result:

**[Result Category]**:

**Historical Baseline**:
- Context: [Where {author_name} achieved similar]
- Documented Result: [X%]
- Evidence: [Reference]

**Contextual Differences Analysis**:
- Factors making new context easier: [List]
- Factors making new context harder: [List]

**Conservative Adjustment**:
- Historical result: [X%]
- Adjustment factor: [0.7-0.9] (because [reasons])
- Projected result: [X%] × [factor] = [Y%]

**Validation**: Projected [Y%] vs. industry average [A%] = still [B%] above benchmark

### Impact Projections

**Year 1 (Conservative)**:
- Target reach: [X] entities
- Impact calculation: [X] × $[Y] per entity = $[Z]
- Based on: [documented historical performance]

**Year 3 (Projected)**:
- Scaled impact with calculation shown

### Comparison to Current State

| Metric | Current State | Projected State | Improvement | Basis |
|--------|--------------|-----------------|-------------|-------|
| [Metric 1] | [Current] | [Projected] | [%] | [Historical evidence] |

Project: {project_title}
Description: {project_description}
""",

        # PART 10 (displayed as Part 10): Security
        11: f"""**Part 10. Security, Privacy and Compliance**

Generate security analysis (3-4 pages):

### Security Framework
- Data protection measures appropriate for {technical_domain}
- Access control mechanisms
- Encryption standards

### Privacy Considerations
- Data handling policies
- User consent mechanisms
- Data retention policies

### Regulatory Compliance

For each applicable regulation:

**[Regulation Name]** ([Citation: ## U.S.C. § #### or ## CFR § ####])
- Requirement: [Specific compliance need]
- How addressed: [Implementation approach]
- Evidence of compliance: [Documentation]

### Risk Assessment

| Risk Category | Likelihood | Impact | Mitigation | Owner |
|--------------|------------|--------|------------|-------|
| [Risk 1] | [H/M/L] | [H/M/L] | [Approach] | [Role] |

### How {author_name}'s Expertise Addresses Security
- Relevant experience from: {author_credentials}
- Proven approaches in: {technical_domain}
""",

        # PART 11 (displayed as Part 11): Reliability
        12: f"""**Part 11. Reliability, Scalability and Costs**

Generate operational analysis (3-4 pages):

### Reliability Analysis
- Uptime targets with industry comparison
- Redundancy measures
- Disaster recovery approach

### Scalability Design
- Current capacity baseline
- Growth projections based on: {target_audience}
- Scaling triggers and mechanisms

### Cost Analysis

**Development Costs**:
| Category | Estimated Range | Basis |
|----------|----------------|-------|
| [Category 1] | $[X] - $[Y] | [Industry benchmarks/quotes] |

**Operational Costs**:
| Category | Monthly | Annual | Source |
|----------|---------|--------|--------|
| [Category 1] | $[X] | $[Y] | [Basis] |

**ROI Projection**:
- Investment required: $[X]
- Expected returns (calculation): [Show math]
- Break-even timeline: [Months/Years]
- Basis: {author_name}'s historical performance of [metric]

Note: Cost ranges provided, not fabricated exact figures.
""",

        # PART 12 (displayed as Part 12): Risks - WITH HISTORICAL MITIGATION
        13: f"""**Part 12. Risks, Limitations and Mitigation**

Generate comprehensive risk analysis (5-7 pages) with MANDATORY historical mitigation:

For EACH significant risk (minimum 5):

### [Risk Name]

**Risk Description**:
- Category: [Technical/Operational/Market/Regulatory]
- Likelihood: [High/Medium/Low] with reasoning
- Impact: [High/Medium/Low] with quantified consequence

**Standard Industry Approach**:
[How most professionals handle this - cite source if available]

**Mitigation Through {author_name}'s Demonstrated Expertise**:

**Historical Context - Similar Risk Encountered**:
- Organization: [Name], [when]
- Similar challenge: [Description]
- Scale: [How big - X users, $Y at stake]

**Solution Implemented by {author_name}**:
[6-10 lines describing WHAT was done and HOW]
1. Step 1: [Specific action]
2. Step 2: [Specific action]
3. Step 3: [Specific action]

**Documented Results**:
- Before intervention: [Metric showing problem]
- After intervention: [Improved metric]
- Improvement: [Calculation] = [X%] risk reduction
- Evidence: [Employment letter, Exhibit X, page Y]

**Transferability**:
Why same methodology applies:
1. [Similarity 1]
2. [Similarity 2]
3. [Similarity 3]

**Competitive Advantage**:
Unlike typical practitioners who [limitation], {author_name} brings proven solution reducing [risk aspect] by [X%] based on historical performance.

[Repeat for each major risk]

### Risk Matrix Summary

| Risk | Likelihood | Impact | Mitigation | Historical Basis |
|------|------------|--------|------------|------------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [Approach] | [Evidence ref] |

### Limitations
- Known constraints
- Out of scope items
- Dependencies on external factors

Author credentials: {author_credentials}
Domain: {technical_domain}
""",

        # PART 13 (displayed as Part 13): Roadmap
        14: f"""**Part 13. Roadmap**

Generate implementation roadmap (3-4 pages):

### Strategic Roadmap

**Quarter 1: Foundation**
- Key milestones with specific deliverables
- Success criteria (measurable)
- Resource allocation

**Quarter 2: Development**
- Feature completion targets
- Testing milestones
- User feedback integration points

**Quarter 3: Launch**
- Deployment phases
- Marketing/outreach activities
- Initial user acquisition targets

**Quarter 4: Scale**
- Expansion targets with numbers
- Optimization focus areas
- Long-term sustainability measures

### Timeline Summary

| Phase | Start | End | Key Deliverables | Success Metrics |
|-------|-------|-----|------------------|-----------------|
| Foundation | [Date] | [Date] | [List] | [Metrics] |
| Development | [Date] | [Date] | [List] | [Metrics] |
| Launch | [Date] | [Date] | [List] | [Metrics] |
| Scale | [Date] | [Date] | [List] | [Metrics] |

### Milestones and Decision Points
- Go/no-go criteria at each phase
- Key dependencies
- Contingency triggers

Project: {project_title}
""",

        # PART 14 (displayed as Part 14): Conclusions
        15: f"""**Part 14. Conclusions and Recommendations**

Generate conclusions (2-3 pages) synthesizing the three NIW prongs:

### Technical Conclusions

**Project Viability Assessment**:
- Technical feasibility: [Supported by Part 6 analysis]
- Resource requirements: [From Part 11]
- Timeline realism: [From Part 13]

**National Importance (Prong 1) Summary**:
- Problem scope: [Number] affected, $[Amount] impact ([Source])
- Federal alignment: [Programs cited with USC references]
- Urgency: [Why action needed now]

**{author_name}'s Exceptional Qualification (Prong 2) Summary**:
- Unique combination of: {author_credentials}
- Scarcity: Top [X%] of [Y total] professionals (calculated in Part 2.5)
- Documented track record: [Key metrics from Part 7]

**Waiver Justification (Prong 3) Summary**:
- Scarcity evidence: [X] comparable professionals in U.S.
- Methodology uniqueness: [Name] with no published equivalent
- Time to replicate: >[X] years

### Strategic Recommendations

**Immediate Actions** (0-3 months):
1. [Action with rationale and expected outcome]
2. [Action with rationale]

**Medium-term Actions** (3-12 months):
1. [Action with rationale]
2. [Action with rationale]

**Long-term Vision** (1-3 years):
- Strategic direction
- Expansion opportunities
- Sustainability measures

### Key Success Factors
- Critical dependencies
- Risk factors to monitor
- Support requirements

### Final Assessment
[Synthesize why {project_title}, executed by {author_name}, serves national interest and warrants waiver of labor certification]
""",

        # PART 15 (displayed as Part 15): References
        16: f"""**Part 15. References**

Generate comprehensive bibliography (4-6 pages) with SPECIFIC CITATIONS:

### Government and Regulatory Sources

For each government source:

**[Number]. [Type]: [Full Title]**
- **Author/Organization**: [Complete name]
- **Publication Date**: [Date]
- **URL**: [Complete .gov URL]
- **Specific Citation**: 
  - Page/Section: [Where data appears]
  - Data used: "[Exact quote or statistic]"
- **Relevance**: Supports [specific claim] in Part [X], page [Y]

### Academic and Research Sources

[Same format with DOI where available]

### Industry Reports and Standards

[Same format - note if subscription required]

### {author_name}'s Expertise Evidence

**Exhibit [#]: [Document Type]**
- Source: [Organization]
- Date: [Date]
- Confirms: [What it verifies]
- Referenced in: Parts [list]

### Required Evidence Checklist

| Exhibit # | Document Type | Purpose | Referenced In | Status |
|-----------|---------------|---------|---------------|--------|
| 1 | [Type] | [Purpose] | Parts [X, Y, Z] | [Available/Needed] |

Note: Include ONLY real, verifiable references. Do NOT fabricate citations.
Domain: {technical_domain}
""",

        # PART 16 (displayed as Part 16): Appendices
        17: f"""**Part 16. Appendices**

Generate supplementary materials (5-10 pages):

### Appendix A: Technical Specifications
- Detailed system requirements for {project_title}
- API specifications where relevant
- Data schemas

### Appendix B: Glossary of Terms
Key terminology for {technical_domain} with definitions

### Appendix C: {author_name}'s Detailed Qualifications
- Full credential listing from: {author_credentials}
- Certification details with issuing bodies
- Relevant project history summary

### Appendix D: Supporting Data
- Market research data tables
- Survey results (if applicable)
- Benchmark data sources

### Appendix E: Implementation Checklists
- Pre-launch checklist
- Quality assurance checklist
- Compliance verification

### Appendix F: Evidence Summary

**Required Exhibits for Submission**:

| Exhibit | Document | Must Confirm | Status |
|---------|----------|--------------|--------|
| 1 | [Credential] | [Issuing org, date] | [Status] |
| 2 | [Employment Letter] | [Dates, title, metrics] | [Status] |
| 3 | [Additional] | [Details] | [Status] |

Project: {project_title}
"""
    }
    
    return prompts


def get_system_message(author_name: str, author_credentials: str, technical_domain: str, 
                       project_title: str, project_description: str, target_audience: str) -> str:
    """
    Returns the enhanced system message for EB-2 NIW style white paper generation.
    """
    return f"""You are an expert technical writer specializing in EB-2 NIW (National Interest Waiver) white papers for USCIS petitions.

# CRITICAL PRINCIPLE
Every section must answer implicitly: "Why THIS petitioner ({author_name}) and not another professional?"

The white paper must prove:
1. **Prong 1**: The project has NATIONAL importance (with quantified data)
2. **Prong 2**: THIS PETITIONER is EXCEPTIONALLY qualified (with comparative metrics)
3. **Prong 3**: It benefits the U.S. to waive labor certification (scarcity + urgency)

# MANDATORY RULES

## Evidence Rules
1. Every quantitative claim needs source: "[Statement] ([Source], [Year], page [#])"
2. Every petitioner achievement needs evidence reference: "(Employment Letter, Exhibit [X], page [Y])"
3. Industry averages must be from verifiable Tier 1 sources (BLS, Gartner, professional associations)
4. Scarcity claims must show calculation methodology

## Quantification Rules - NO GENERIC DESCRIPTIONS
❌ WRONG: "large corporation", "managed operations", "improved efficiency"
✅ CORRECT: "[Org Name], [X employees]", "managed [X] users, [Y] transactions", "improved from [A] to [B] = [C%]"

## Scarcity Rules
❌ WRONG: "rare combination", "unique profile", "few professionals"
✅ CORRECT: "top [X%] of [Y total] professionals (Method 1: [result], Method 2: [result])"

## Table Rules
Every comparison table MUST have "Evidence" column showing source of data.

## Federal Citation Rules
When citing federal programs: Include USC/CFR citation
Example: "Small Business Act (15 U.S.C. § 631)"

# PETITIONER INFORMATION (USE ONLY THIS - DO NOT INVENT)
- Name: {author_name}
- Credentials: {author_credentials}
- Domain Expertise: {technical_domain}

# PROJECT INFORMATION (USE ONLY THIS)
- Title: {project_title}
- Description: {project_description}
- Target Audience: {target_audience}

# OUTPUT REQUIREMENTS
- Write in ENGLISH only
- Use professional, technical tone
- Include tables with proper formatting
- No placeholders or generic descriptions
- If specific data not available, note what evidence would be needed
- Minimum page targets: Part 2.5 (10+ pages), Part 7 proven methodologies (6+ pages)

Create expert-level content that would satisfy rigorous USCIS adjudicator review."""
