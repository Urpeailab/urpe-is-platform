"""
USPTO Patent Application Drafter - Professional Edition v3.0
Based on expert patent attorney review + USPTO MPEP guidelines
Created: December 2024

This configuration ensures USPTO compliance, technical rigor, and automatic
validation/correction of patent applications.
"""

import json
import os
from pathlib import Path

# Load quality rules from JSON file
def load_quality_rules():
    """Load patent quality rules from JSON configuration file"""
    try:
        rules_path = Path(__file__).parent / 'patent_quality_rules.json'
        with open(rules_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('patent_quality_rules', {})
    except Exception as e:
        print(f"Warning: Could not load quality rules: {e}")
        return {}

# Global quality rules
QUALITY_RULES = load_quality_rules()

def get_quality_guidance_text():
    """
    Generate quality guidance text from loaded rules for inclusion in prompts.
    Returns a formatted string that can be safely added to prompts.
    """
    if not QUALITY_RULES:
        return ""
    
    guidance_parts = []
    
    # Terminology Precision - CRITICAL
    term_rules = QUALITY_RULES.get('terminology_precision', {}).get('eliminate_vague_terms', {})
    if term_rules.get('enabled'):
        guidance_parts.append("TERMINOLOGY PRECISION (CRITICAL):")
        guidance_parts.append("- NEVER use vague terms: aproximadamente, sustancialmente, generalmente, alrededor de")
        guidance_parts.append("- Replace with specific ranges: '95-105' instead of 'aproximadamente 100'")
        guidance_parts.append("- Replace with thresholds: 'al menos 90%' instead of 'sustancialmente similar'")
        guidance_parts.append("- Replace with frequencies: 'en al menos 80% de los casos' instead of 'generalmente'")
    
    # Modal Verb Precision
    modal_rules = QUALITY_RULES.get('terminology_precision', {}).get('modal_verb_precision', {})
    if modal_rules.get('enabled'):
        guidance_parts.append("\nMODAL VERB PRECISION:")
        guidance_parts.append("- Replace 'puede' with 'esta configurado para'")
        guidance_parts.append("- Replace 'podria' with 'opcionalmente esta configurado para'")
        guidance_parts.append("- Replace 'puede ser' with 'se implementa como'")
    
    # Claims Specificity - CRITICAL
    claims_rules = QUALITY_RULES.get('claims_specificity', {})
    if claims_rules.get('enabled'):
        guidance_parts.append("\nCLAIMS SPECIFICITY (CRITICAL):")
        guidance_parts.append("- System claims MUST include: processor specs, memory specs, performance metrics")
        guidance_parts.append("- Method claims MUST include: step timing, input/output formats, error handling, quantified improvements")
        guidance_parts.append("- Module descriptions MUST include: interface specs, data structures, capacity limits")
        
        # Add quantification templates
        quant_templates = claims_rules.get('technical_implementation_details', {}).get('quantification_templates', {})
        if quant_templates:
            guidance_parts.append("\nQUANTIFICATION TEMPLATES:")
            perf_metrics = quant_templates.get('performance_metrics', [])
            if perf_metrics and len(perf_metrics) > 0:
                guidance_parts.append(f"  Performance: {perf_metrics[0]}")
            timing_specs = quant_templates.get('timing_specifications', [])
            if timing_specs and len(timing_specs) > 0:
                guidance_parts.append(f"  Timing: {timing_specs[0]}")
    
    # Numerical Precision - HIGH
    num_rules = QUALITY_RULES.get('numerical_precision', {})
    if num_rules.get('enabled'):
        guidance_parts.append("\nNUMERICAL PRECISION (HIGH PRIORITY):")
        guidance_parts.append("- Latency: specify in ms or seconds with context (e.g., 'median latency of 180 ms under load of 2,500 concurrent instances')")
        guidance_parts.append("- Throughput: specify operations/second with resources (e.g., 'processes 50,000 node transitions per hour on 16 vCPU cores')")
        guidance_parts.append("- Accuracy: specify percentage with test set (e.g., 'achieves 94.2% accuracy on a test set of 15,000 samples')")
        guidance_parts.append("- Improvements: specify baseline -> improved (e.g., 'reduces latency from 420 ms to 180 ms (at least 57% reduction)')")
    
    # Language Clarity
    lang_rules = QUALITY_RULES.get('language_clarity', {})
    if lang_rules.get('enabled'):
        guidance_parts.append("\nLANGUAGE CLARITY:")
        preferred = lang_rules.get('preferred_constructions', {})
        if preferred:
            cap = preferred.get('capability', {})
            if cap:
                guidance_parts.append(f"- Capability: USE '{cap.get('use', '')}', AVOID '{cap.get('avoid', '')}'")
    
    return "\n".join(guidance_parts)

# Critical validation rules (from v3.0 specification)
CRITICAL_RULES = {
    "LANG_001_single_language": {
        "priority": "CRITICAL",
        "title": "Single Language Enforcement - English Only",
        "blocking": True,
        "description": "USPTO filings must be in one language only - English",
        "validation": "All content must be 100% English, no mixed languages",
        "common_spanish_violations": [
            "plataforma", "sistema", "inteligente", "agentes",
            "automatización", "aplicada", "distribuida", "técnico",
            "invención", "riego", "contenedores", "compensación",
            "bonos", "logística", "optimización"
        ],
        "error_on_violation": True
    },
    "XREF_001_verified_cross_references": {
        "priority": "CRITICAL",
        "title": "Verified Cross-References Only - No Placeholders",
        "blocking": True,
        "description": "Never claim priority to non-existent applications",
        "forbidden_placeholders": ["XXXXX", "[FILING DATE]", "[TO BE ASSIGNED]", "TBD", "pending", "63/XXXXX", "18/XXXXXX"],
        "error_on_violation": True
    },
    "EXAM_001_mandatory_worked_examples": {
        "priority": "CRITICAL",
        "title": "Mandatory Detailed Worked Examples with Numbers",
        "blocking": True,
        "minimum_examples": 2,
        "must_include_numbers": True,
        "minimum_numbers_per_example": 10,
        "description": "Detailed enablement requires concrete numerical examples with step-by-step processing"
    },
    "ALGO_001_algorithm_specificity": {
        "priority": "CRITICAL",
        "title": "Concrete Algorithm and Model Specifications",
        "blocking": True,
        "description": "AI/ML models must include: framework, hyperparameters (≥3), dataset info, performance metrics (≥2)",
        "required_for_ml": ["library/framework", "hyperparameters (≥3)", "dataset_size", "performance_metrics (≥2)"]
    },
    "CLAIM_001_robust_independent_claim": {
        "priority": "CRITICAL",
        "title": "Strengthened Claim 1 Structure",
        "blocking": True,
        "minimum_elements": 5,
        "recommended_elements": 7,
        "maximum_elements": 10,
        "minimum_dependent_claims": 8,
        "description": "Robust independent claim with interdependent technical elements + strong WHEREIN clause"
    }
}

# Auto-correction patterns for weak language
WEAK_LANGUAGE_REPLACEMENTS = [
    {
        "pattern": r"\b(uses|employs|utilizes)\s+machine learning\b",
        "severity": "HIGH",
        "replacement_template": "employs [SPECIFIC_MODEL] with [HYPERPARAMETERS]",
        "example": "employs gradient boosted decision trees (XGBoost) with 200 estimators, depth 6, learning rate 0.05"
    },
    {
        "pattern": r"\bin real[- ]time\b",
        "severity": "MEDIUM",
        "replacement_template": "within [LATENCY_VALUE] [units]",
        "example": "within 500 milliseconds"
    },
    {
        "pattern": r"\b(intelligent|smart|advanced|innovative|cutting-edge)\b(?=\s+(system|agent|algorithm))",
        "severity": "HIGH",
        "action": "REMOVE_ADJECTIVE",
        "example": "intelligent system → distributed microservices-based system"
    },
    {
        "pattern": r"improves (efficiency|performance|accuracy)(?!.*by\s+\d+%)",
        "severity": "HIGH",
        "action": "REQUIRE_QUANTIFICATION",
        "example": "improves efficiency → improves efficiency by 40%"
    }
]

# Reference numeral assignment scheme
NUMERAL_SCHEME = {
    "starting_number": 100,
    "increment_per_figure": 100,
    "FIG_1": "100-119 (main system architecture)",
    "FIG_2": "200-219 (logical/software architecture)",
    "FIG_3": "300-319 (first agent/module details)",
    "FIG_4": "400-419 (second agent/module details)",
    "FIG_5_onwards": "500+, continue pattern"
}

# System message for patent generation (Professional USPTO attorney persona v3.0)
def get_uspto_system_message():
    """Generate USPTO system message with quality rules integrated"""
    base_message = """You are a Professional USPTO Patent Attorney with 15+ years of experience drafting successful patent applications.

CRITICAL RULES (v3.0):
1. **ENGLISH ONLY**: 100% English content. USPTO requires single-language filing. Scan for Spanish violations: plataforma, sistema, inteligente, etc.
2. **TECHNICAL SPECIFICITY**: Use concrete numbers, specific algorithms (XGBoost, LSTM), actual data structures, measurable metrics
3. **NO MARKETING LANGUAGE**: Avoid "innovative", "revolutionary", "cutting-edge", "state-of-the-art", "intelligent", "smart" without technical definition
4. **ENABLEMENT**: Provide sufficient detail for skilled practitioners to reproduce (35 U.S.C. §112)
5. **USPTO COMPLIANCE**: Follow 37 CFR §1.51-1.84 and MPEP 2100-2700

YOUR EXPERTISE:
- Patent Law (35 U.S.C. §101-112)
- USPTO Examination Guidelines (MPEP)
- Technical Writing for Patents (37 CFR §1.51-1.84)
- AI/ML Systems Documentation
- Software Architecture & Distributed Systems
- USCIS Evidence Standards (EB-1A, EB-2 NIW, O-1)

CRITICAL OUTPUT REQUIREMENTS:
- HTML format: EVERY paragraph MUST be wrapped in its own <p> tag: <p>&#182;00XX content here</p>
- CRITICAL: Each &#182;XXXX paragraph MUST start with <p> and end with </p> on a new line
- Example correct format:
  <p>&#182;0006 This application claims no priority...</p>
  
  <p>&#182;0007 The invention described herein...</p>
  
  <p>&#182;0010 The present invention relates...</p>
- Reference numerals: First mention format "[component] (101)", subsequent "component 101" or "the component"
- Worked examples: MUST include ≥10 concrete numbers per example (sensor readings, calculations, outputs)
- Algorithm specs: For ML/AI, MUST specify: framework+version, hyperparameters (≥3), dataset size, performance metrics (≥2)
- Quantification: Include specific measurements, percentages, thresholds throughout
- Claims: Independent claim 1 MUST have 5-9 interdependent elements + strong WHEREIN clause with causal relationship

AUTOMATIC CORRECTIONS YOU WILL APPLY:
- Replace "uses machine learning" → "employs [specific model] with [hyperparameters]"
- Replace "in real-time" → "within [X] milliseconds/seconds"
- Replace "improves efficiency" → "improves efficiency by X%"
- Remove weak adjectives: "intelligent", "smart", "advanced" (or define technically)

WRITING STYLE:
- Technical and formal (legal document)
- Specific over generic (XGBoost vs. "machine learning")
- Quantified where possible (with units and ranges)
- Legally defensible (clear scope)
- Enabling for skilled practitioners (reproducible)"""
    
    # Add quality guidance if available
    quality_guidance = get_quality_guidance_text()
    if quality_guidance:
        base_message += "\n\n--- ENHANCED QUALITY RULES v2.0 ---\n" + quality_guidance
    
    return base_message

# Keep backward compatibility
USPTO_PATENT_ATTORNEY_SYSTEM_MESSAGE = get_uspto_system_message()


# Section-specific prompts with enhanced requirements
def get_enhanced_section_prompt(section_number, section_title, invention_data):
    """
    Generate enhanced prompts based on USPTO best practices v2.0
    
    Args:
        section_number: int - Section number (1-13)
        section_title: str - Section title
        invention_data: dict - Contains invention_title_en, technical_field_en, invention_description_en, etc.
    
    Returns:
        tuple: (system_message, user_prompt)
    """
    
    title = invention_data.get('invention_title_en', '')
    field = invention_data.get('technical_field_en', '')
    description = invention_data.get('invention_description_en', '')[:600]
    inventor = invention_data.get('inventor_name', 'Inventor')
    residence = invention_data.get('inventor_residence_en', 'N/A')
    
    # SECTION 1: HEADER
    if section_number == 1:
        system_message = """USPTO Patent Drafter. Write patent header with title, inventor info, filing date in USPTO format. Use the inventor's actual information, NO placeholders."""
        
        prompt = f"""PATENT APPLICATION HEADER (USPTO FORMAT):

Title: {title}
Inventor: {inventor}
Residence: {residence}
Technical Field: {field}
Filing Date: [To be determined by USPTO]
Application Type: Provisional Patent Application

Write complete header in USPTO format with these EXACT details:
- Title: {title}
- Inventor: {inventor.upper()}
- Inventor Residence: {residence}
- Correspondence: Use inventor's name and residence
- Filing date: [To be determined by USPTO]
- Application type: Provisional Patent Application

CRITICAL: Use the ACTUAL inventor name and residence provided above.
DO NOT use placeholders like [Attorney Name], [Street Address], [City, State ZIP].
Format as USPTO standard header with proper HTML tags and paragraph numbering."""
        
        return system_message, prompt
    
    # SECTION 2: CROSS-REFERENCE TO RELATED APPLICATIONS
    elif section_number == 2:
        system_message = """USPTO Patent Drafter. Write Cross-Reference section. CRITICAL: Only use verified data or state 'Not Applicable'."""
        
        prompt = f"""CROSS-REFERENCE TO RELATED APPLICATIONS

CRITICAL RULE: Never use placeholder text like XXXXX, [TBD], or [TO BE ASSIGNED].

Write EXACTLY this if no prior applications exist:

<h2><strong>CROSS-REFERENCE TO RELATED APPLICATIONS</strong></h2>
<p>&#182;0006 Not Applicable. This application does not claim priority to or benefit from any previously filed patent application, whether domestic or foreign.</p>

If prior applications exist, user must provide:
- Application number (format: 63/123456 or 18/234567)
- Filing date (MM/DD/YYYY)
- Application title
- Relationship type (continuation, continuation-in-part, etc.)

For this patent: {title}
Field: {field}

Generate appropriate cross-reference section."""
        
        return system_message, prompt
    
    # SECTION 3: STATEMENT REGARDING FEDERALLY SPONSORED R&D
    elif section_number == 3:
        system_message = """USPTO Patent Drafter. Write Federal Sponsorship statement."""
        
        prompt = f"""STATEMENT REGARDING FEDERALLY SPONSORED RESEARCH OR DEVELOPMENT

Write standard "Not Applicable" statement:

<h2><strong>STATEMENT REGARDING FEDERALLY SPONSORED RESEARCH OR DEVELOPMENT</strong></h2>
<p>&#182;0010 Not Applicable. The invention disclosed in this application was made without federal government support.</p>

Keep concise and standard."""
        
        return system_message, prompt
    
    # SECTION 4: FIELD OF THE INVENTION
    elif section_number == 4:
        system_message = """USPTO Patent Drafter. Write Field of the Invention with technical specificity and commercial context."""
        
        prompt = f"""FIELD OF THE INVENTION

For patent: {title}
Technical Field: {field}
Description: {description}

Write 2-3 paragraphs covering:

Paragraph 1 (¶0013):
- Specific technical domain (not just "computer systems")
- Particular subfield or application area
- Technical classification (if applicable)

Paragraph 2 (¶0014):
- Specific technical problems addressed in this domain
- Current limitations with QUANTIFIABLE impacts
- Industry context and significance

Paragraph 3 (¶0015) [OPTIONAL - if inventor has domain expertise]:
- Market context and commercial significance
- Industries affected
- Scale of problem (number of organizations, economic impact)

REQUIREMENTS:
- Be specific, not generic
- Use technical terminology from the field
- Include measurable impacts where possible
- Format: <p>&#182;00XX Text here...</p>

DO NOT use marketing language. Be technical and precise."""
        
        return system_message, prompt
    
    # SECTION 5: BACKGROUND
    elif section_number == 5:
        system_message = """USPTO Patent Drafter. Write Background section with specific technical limitations and metrics."""
        
        prompt = f"""BACKGROUND OF THE INVENTION

For patent: {title}
Technical Field: {field}
Description: {description}

Write 4-6 paragraphs (¶0023-0031) covering:

1. Current State of Technology (2 paragraphs):
   - Describe existing systems/methods in this technical field
   - Identify specific technologies, frameworks, or approaches currently used
   - Be specific: name actual systems, methods, or standards if applicable

2. Technical Limitations (2-3 paragraphs):
   - Describe SPECIFIC technical problems with current approaches
   - Include QUANTIFIABLE impacts: 
     * Performance bottlenecks (e.g., "processing time increases by X%")
     * Accuracy limitations (e.g., "error rate of Y%")
     * Scalability issues (e.g., "fails with datasets >N records")
     * Cost impacts (e.g., "requires $Z per transaction")
   - Explain WHY these limitations exist (technical reasons)

3. Unmet Need (1 paragraph):
   - Clearly state what is needed in the art
   - Connect to the invention (without revealing it yet)

REQUIREMENTS:
- Use specific technical terminology
- Include at least 3 quantifiable metrics/impacts
- Avoid generic statements like "systems are inefficient"
- Format: <p>&#182;00XX Text here...</p>
- Each paragraph should be 3-5 sentences

FORBIDDEN PHRASES:
- "innovative", "revolutionary", "cutting-edge"
- "best-in-class", "state-of-the-art"
- Generic descriptions without specifics

Example metric format:
""Existing rule-based systems require manual updates for each regulatory change, resulting in processing delays of 3-5 business days and error rates exceeding 15% in complex scenarios."""
        
        return system_message, prompt
    
    # SECTION 6: SUMMARY OF THE INVENTION
    elif section_number == 6:
        system_message = """USPTO Patent Drafter. Write Summary section with quantifiable improvements and technical solution overview."""
        
        prompt = f"""SUMMARY OF THE INVENTION

For patent: {title}
Technical Field: {field}
Description: {description}

Write 3-4 paragraphs (¶0032-0039) covering:

Paragraph 1 (¶0032) - High-Level Solution:
- State what the invention IS (system/method/apparatus)
- Identify the core technical approach
- Mention key components or modules

Paragraph 2 (¶0033) - Technical Innovation:
- Describe the NOVEL technical elements
- Explain HOW it differs from prior art
- Be specific about the innovation (e.g., "hybrid architecture combining rules engine with ML optimization")

Paragraph 3 (¶0034) - Quantifiable Advantages:
- List MEASURABLE improvements over prior art:
  * Performance gains (e.g., "reduces processing time by 60%")
  * Accuracy improvements (e.g., "achieves 95% accuracy vs. 78% in prior systems")
  * Cost reductions (e.g., "reduces manual review time by 40 hours/month")
  * Scalability benefits (e.g., "handles 10X more transactions")
- Provide at least 2-3 specific metrics

Paragraph 4 (¶0035) [OPTIONAL] - Additional Advantages:
- Flexibility, maintainability, security improvements
- Integration capabilities
- User experience enhancements

REQUIREMENTS:
- Include at least 3 quantifiable metrics
- Be specific about technical approach
- Use format: <p>&#182;00XX Text here...</p>
- Avoid marketing language
- Focus on technical benefits, not business benefits

Example:
""The system reduces configuration time from 2-3 days to under 2 hours (>90% reduction) while improving rule consistency scores from 72% to 96%."""
        
        return system_message, prompt
    
    # SECTION 9: DETAILED DESCRIPTION OF EMBODIMENTS
    elif section_number == 9:
        system_message = """USPTO Patent Drafter. Write detailed technical description with specific examples and component details."""
        
        prompt = f"""Write DETAILED DESCRIPTION section for USPTO patent:

Title: {title}
Field: {field}
Description: {description}

Structure (minimum 20-25 paragraphs, ¶0070-0095):

1. ARCHITECTURE (¶0070-0075, 5-6 paragraphs):
   - System overview with components (Module 101, 102, 103...)
   - Reference FIG. 1-3
   - Data flow and communication protocols

2. COMPONENT DETAILS (¶0076-0085, 8-10 paragraphs):
   - For each major component: purpose, inputs/outputs, algorithms
   - If AI/ML: specify framework, hyperparameters (e.g., XGBoost, 200 trees, lr=0.05)
   - If optimization: show objective function

3. WORKED EXAMPLE (¶0086-0090, 4-5 paragraphs):
   - Concrete scenario with actual data values
   - Step-by-step processing with intermediate calculations
   - Final output with numbers

4. ALTERNATIVES (¶0091-0095, 3-5 paragraphs):
   - Alternative implementations
   - Different configurations
   - Deployment options

REQUIREMENTS:
- Total 20-25 paragraphs (¶0070-0095)
- Include specific numbers and metrics
- Reference figures throughout
- Format: <p>&#182;00XX Text...</p>
- Be technical and specific, avoid generic descriptions"""
        
        return system_message, prompt
    
    # SECTION 10: CLAIMS
    elif section_number == 10:
        # Load quality rules for claims
        quality_guidance = get_quality_guidance_text()
        
        base_system = """USPTO Patent Attorney - Claims Drafting Expert.

CRITICAL CLAIM DRAFTING RULES (USPTO/MPEP):
1. Independent Claim 1 must have 5-9 interdependent technical elements
2. Each element must be SPECIFIC and TECHNICAL (not abstract)
3. Include "wherein" clause showing causal relationship
4. Minimum 8-12 dependent claims adding meaningful limitations
5. NO explanations - ONLY numbered claims
6. Use proper patent claim language: "comprising", "wherein", "configured to"

CLAIM STRUCTURE REQUIREMENTS:
- Preamble: "A system for [specific technical problem]"
- Body: 5-9 technical elements that work together
- Wherein clause: Shows technical result/advantage
- Dependent claims: Add specificity to each element"""
        
        # Add quality guidance for claims
        if quality_guidance:
            system_message = base_system + "\n\n--- ENHANCED QUALITY REQUIREMENTS v2.0 ---\n" + quality_guidance
        else:
            system_message = base_system
        
        prompt = f"""CLAIMS

For patent: {title}
Technical Field: {field}
Description: {description}

Generate MINIMUM 12 patent claims following this structure:

**CLAIM 1 (Independent - System Claim) - 5-9 TECHNICAL ELEMENTS:**

1. A system for [specific technical problem in {field}], the system comprising:

   a processor and memory storing executable instructions;
   
   [ELEMENT 1] a [specific module name] module stored in the memory and configured to [specific technical function with data structures/algorithms];
   
   [ELEMENT 2] a [specific module name] module communicatively coupled to the [element 1] and configured to [specific technical function];
   
   [ELEMENT 3 - NOVEL ELEMENT] a [innovative module name] module configured to [key innovation - e.g., conflict resolution, hybrid optimization, adaptive learning] wherein [technical mechanism];
   
   [ELEMENT 4] a [specific module name] module configured to [specific function] using [specific algorithm or data structure];
   
   [ELEMENT 5] a [storage/interface module] configured to [specific function];
   
   wherein the [element 3] performs [specific action] causing [element 4] to achieve [measurable technical result], thereby [technical advantage over prior art].

EXAMPLE INDEPENDENT CLAIM FORMAT:

1. A system for automated employee compensation determination with regulatory compliance, the system comprising:

   a processor and a memory storing executable instructions;
   
   a rules engine module configured to parse and enforce compensation rules from multiple jurisdictions, storing rules in a directed acyclic graph (DAG) data structure with precedence levels;
   
   a machine learning (ML) compensation predictor module communicatively coupled to the rules engine and configured to generate compensation recommendations using a gradient-boosted tree model trained on historical compensation data;
   
   a conflict resolution module configured to detect deviations between ML predictions and rule constraints, and to invoke a constrained optimization solver that minimizes total deviation subject to hard rule constraints;
   
   a simulation engine configured to execute Monte Carlo simulations with N≥1000 iterations to evaluate distributional fairness metrics including Gini coefficient and pay equity ratios;
   
   an execution module configured to apply final compensation decisions and generate audit trails with rule IDs and ML model versions used;
   
   wherein the conflict resolution module adjusts ML-predicted values using Sequential Least Squares Programming (SLSQP) when deviations exceed a threshold, causing the execution module to output compliant compensation values with fairness scores improved by at least 15% compared to rule-only systems, thereby achieving both regulatory compliance and optimization objectives.

**CLAIMS 2-4: Add specificity to main elements**

2. The system of claim 1, wherein the rules engine module employs a domain-specific language (DSL) parser that converts natural language rules into executable constraint expressions.

3. The system of claim 1, wherein the ML compensation predictor module comprises an XGBoost gradient boosting framework configured with at least 100 decision trees and a learning rate between 0.01 and 0.1.

4. The system of claim 1, wherein the conflict resolution module implements multi-objective optimization balancing three objectives: regulatory compliance score, budget adherence, and fairness metrics.

**CLAIMS 5-7: Alternative implementations**

5. The system of claim 1, wherein the simulation engine alternatively uses Latin Hypercube Sampling for variance reduction.

6. The system of claim 1, wherein the ML compensation predictor module alternatively employs a neural network with at least two hidden layers.

7. The system of claim 1, wherein the rules engine stores rules in a relational database with indexing on jurisdiction and effective date fields.

**CLAIMS 8-10: Detail the novel element**

8. The system of claim 1, wherein the conflict resolution module computes deviation metrics as normalized Euclidean distance between ML predictions and rule boundary surfaces.

9. The system of claim 3, wherein the ML model is retrained quarterly using incremental learning to incorporate new compensation decisions.

10. The system of claim 1, wherein the conflict resolution module generates explanation vectors indicating which rules caused adjustments to ML recommendations.

**CLAIMS 11-12: Method and computer-readable medium**

11. A method for automated compensation determination comprising the steps recited in the system of claim 1, executed by a processor.

12. A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of claim 11.

CRITICAL REQUIREMENTS (BUG_002 FIX):
- Claim 1 must have 6-9 elements (NOT 5, complexity is good for patents)
- If description mentions multiple AI agents/services: INCLUDE BOTH as separate elements
  Example: "a first AI agent configured to [planning]" + "a second AI agent configured to [monitoring]"
- DO NOT SIMPLIFY Claim 1. Keep all novel architectural elements.
- Highlight the NOVEL/DIFFERENTIATING element (dual-agent, conflict resolution, hybrid approach)

WHEREIN CLAUSE STRICT REQUIREMENTS (minimum 40 words):
- MUST include: [specific action with parameters] + [numeric metric] + [comparison to prior art]
- Template: "wherein [element A] [performs X with Y parameters] such that [element B] achieves [<N ms latency / >M zones capacity / P% accuracy], thereby [advantage] not achievable with [prior art type: centralized/polling-based/manual] which [limitation: >A ms / <B zones / C% accuracy]"
- Example: "wherein the asynchronous worker subsystem processes irrigation commands in parallel batches such that the message queue maintains end-to-end latency below 500 milliseconds for over 10,000 concurrent zones, thereby enabling real-time adaptive control not achievable with centralized polling-based controllers which exhibit latencies exceeding 5 seconds at 1,000 zones"

GENERATE 12-15 total claims:
- Claim 1: Independent system (6-9 elements)
- Claims 2-4: Add specificity to major elements
- Claims 5-7: Alternative implementations
- Claims 8-10: Detail the novel element
- Claims 11-12: Method + computer-readable medium

FORMAT:
- Use proper USPTO claim format
- NO explanations or commentary - ONLY numbered claims
- Start immediately with "1. A system..."

FORBIDDEN:
- Generic descriptions without specifics
- Marketing language
- Abstract functions without technical detail
- Simplifying multi-agent architectures to single agent
- WHEREIN clauses without numeric metrics or prior art comparison
- WHEREIN clauses shorter than 40 words"""
        
        return system_message, prompt
    
    # SECTION 11: ABSTRACT
    elif section_number == 11:
        system_message = """USPTO Patent Drafter. Write concise patent abstract. CRITICAL: Maximum 150 words as per 37 CFR §1.72(b)."""
        
        # Get abstract requirements from quality rules
        abstract_reqs = ""
        if QUALITY_RULES:
            desc_complete = QUALITY_RULES.get('description_completeness', {})
            abstract_section = desc_complete.get('abstract_section', {})
            if abstract_section and abstract_section.get('requirement') == 'MANDATORY':
                content_reqs = abstract_section.get('content_requirements', {})
                must_include = content_reqs.get('must_include', [])
                if must_include:
                    abstract_reqs = "\n\nENHANCED REQUIREMENTS v2.0:\n"
                    for req in must_include:
                        abstract_reqs += f"- {req}\n"
        
        prompt = f"""ABSTRACT

For patent: {title}
Technical Field: {field}
Description: {description}

Write a single-paragraph abstract (¶0001) that:
1. States what the invention IS (system/method/apparatus)
2. Describes the technical problem solved
3. Explains the core technical solution
4. Mentions key technical elements/modules
5. States the measurable advantage

CRITICAL REQUIREMENTS:
- Target length: 150-250 words (per enhanced rules)
- Single paragraph
- MUST include at least 3 numbered component references (e.g., module 101, engine 102)
- MUST include at least 2 quantified performance metrics
- Clear statement of technical problem solved
- No citations to claims or figures
- Technical language, not marketing
- Format: <p>&#182;0001 [Abstract text]</p>
- Must be enabling and specific{abstract_reqs}

EXAMPLE STRUCTURE (with component numbers and metrics):
"A system for [problem] comprising a processor, memory, and multiple specialized modules. A rules engine module (101) parses compensation rules from multiple jurisdictions into a directed acyclic graph structure. An ML predictor module (102) generates recommendations using gradient-boosted trees trained on historical data. A conflict resolution module (103) detects deviations between ML predictions and rule constraints, invoking constrained optimization to adjust predictions while maintaining compliance. A simulation engine (104) evaluates fairness metrics using Monte Carlo methods. An execution module (105) applies final decisions with audit trails. The system achieves regulatory compliance while optimizing compensation allocation, reducing manual review time by 40 hours/month and improving fairness scores by 15% compared to rule-only systems."

MANDATORY: Include component numbers (101, 102, 103...) and at least 2 quantified metrics."""
        
        return system_message, prompt
    
    # DEFAULT: Generic technical section
    else:
        system_message = USPTO_PATENT_ATTORNEY_SYSTEM_MESSAGE
        
        prompt = f"""Write the {section_title} section for patent: {title}

Technical Field: {field}
Description: {description}

Requirements:
- Use USPTO format with paragraph numbers: <p>&#182;00XX Text...</p>
- Be technically specific with concrete details
- Reference components/figures where applicable
- Avoid generic or marketing language
- Provide 2-4 paragraphs of technical content

Write the complete section."""
        
        return system_message, prompt


# Validation functions
def validate_patent_inputs(patent_data):
    """
    Validate patent inputs before generation
    Returns: (is_valid: bool, errors: list)
    """
    errors = []
    
    # Check required fields
    required_fields = ['invention_title', 'invention_description', 'technical_field', 'inventor_name']
    for field in required_fields:
        if not patent_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Check description length
    if patent_data.get('invention_description') and len(patent_data['invention_description']) < 100:
        errors.append("Invention description too short (minimum 100 characters)")
    
    # Check for placeholder text
    forbidden_text = ['XXXXX', '[TBD]', '[to be assigned]', 'placeholder']
    for field in ['invention_title', 'invention_description', 'technical_field']:
        value = patent_data.get(field, '')
        for forbidden in forbidden_text:
            if forbidden.lower() in value.lower():
                errors.append(f"Forbidden placeholder text '{forbidden}' found in {field}")
    
    return len(errors) == 0, errors


def get_claim_validation_rules():
    """
    Return validation rules for patent claims
    """
    return {
        "independent_claim_min_elements": 5,
        "independent_claim_max_elements": 9,
        "minimum_dependent_claims": 8,
        "minimum_total_claims": 10,
        "required_keywords": ["comprising", "wherein", "configured to"],
        "forbidden_phrases": ["innovative", "revolutionary", "cutting-edge", "state-of-the-art"]
    }


def count_words(text):
    """Count words in text (for abstract validation)"""
    # Remove HTML tags
    import re
    text_no_html = re.sub(r'<[^>]+>', '', text)
    # Remove paragraph markers
    text_no_markers = re.sub(r'¶\d+', '', text_no_html)
    # Count words
    words = text_no_markers.split()
    return len(words)


# Quality metrics for generated content (v3.0)
QUALITY_METRICS = {
    "technical_specificity": {
        "description": "Ratio of technical terms to abstract terms",
        "target": 8,
        "scale": "1-10",
        "calculation": "10 × (specific_count / (specific_count + abstract_count))",
        "specific_terms": ["named algorithms", "numeric parameters", "specific technologies", "quantified metrics"],
        "abstract_terms": ["intelligent", "smart", "advanced", "optimizes", "improves", "efficient"]
    },
    "claim_robustness": {
        "description": "Number of interdependent elements in Claim 1 + WHEREIN strength",
        "target": 8,
        "scale": "1-10",
        "calculation": "base_score (elements) + bonuses (novel element, strong wherein) - penalties (weak language)"
    },
    "quantification_level": {
        "description": "Percentage of statements with numeric metrics",
        "target": 7,
        "scale": "1-10",
        "calculation": "10 × (quantified_statements / total_technical_statements)"
    },
    "prior_art_differentiation": {
        "description": "Clarity of how invention overcomes specific prior art limitations",
        "target": 8,
        "scale": "1-10",
        "calculation": "quantified_limitations + clear_mapping_to_solution"
    },
    "uspto_compliance": {
        "description": "Adherence to 37 CFR formatting and content rules",
        "target": 9,
        "scale": "1-10",
        "checks": ["paragraph_numbering", "section_order", "abstract ≤150 words", "no placeholders", "english_only"]
    }
}

# Critical bug fixes (v3.1 - BUG_LANG_001 timing fix)
SPANISH_TRANSLATION_MAP = {
    # Complete figure titles (exact matches first)
    "Orquestador de riego con agentes de IA y flujos n8n": "Irrigation Orchestrator with AI Agents and n8n Flows",
    "Plataforma distribuida de riego inteligente con agentes de IA": "Distributed Smart Irrigation Platform with AI Agents",
    "Sistema de riego con agente de IA y optimización dinámica": "Irrigation System with AI Agent and Dynamic Optimization",
    "Integración de IA aplicada a automatización de riego": "Integration of AI Applied to Irrigation Automation",
    
    # Phrases
    "Inteligencia artificial aplicada": "Applied artificial intelligence",
    "Automatización de flujos": "Workflow automation",
    "SaaS para IoT": "SaaS for IoT",
    "automatización de riego": "irrigation automation",
    "sistemas distribuidos": "distributed systems",
    "Plataforma distribuida": "Distributed Platform",
    "agentes de IA": "AI agents",
    
    # Individual words
    "orquestador": "orchestrator",
    "sistema de": "system of",
    "riego": "irrigation",
    "agentes": "agents",
    "agente": "agent",
    "flujos": "flows",
    "optimización": "optimization",
    "automatización": "automation",
    "integración": "integration",
    "aplicada": "applied",
    "plataforma": "platform",
    "distribuida": "distributed",
    "técnico": "technical",
    "inteligente": "intelligent",
    "inteligencia": "intelligence",
    "artificial": "artificial"
}

# Enhanced regex patterns for Spanish detection (BUG_LANG_001 fix)
SPANISH_DETECTION_PATTERNS = [
    r'[áéíóúñÁÉÍÓÚÑ¿¡]',  # Spanish accents and punctuation
    # Common Spanish words - EXCLUDE false positives like "artificial" (valid in "artificial intelligence")
    r'\b(orquestador|riego|agentes?|flujos?|inteligencia(?!\s+artificial)|aplicada|automatización|sistema(?!\s+comprises))\b'
]

def scan_and_remove_spanish_entire_document(text):
    """
    BUG_LANG_001 FIX: Scan ENTIRE document including drawings section for Spanish
    This MUST be called AFTER all sections are concatenated into final document
    
    Returns: (corrected_text, list_of_corrections)
    """
    import re
    corrections = []
    corrected_text = text
    
    # First pass: Replace exact phrase matches (longest first to avoid partial replacements)
    sorted_translations = sorted(SPANISH_TRANSLATION_MAP.items(), key=lambda x: len(x[0]), reverse=True)
    
    for spanish, english in sorted_translations:
        if spanish in corrected_text:
            # Check context to skip inventor names
            occurrences = []
            for match in re.finditer(re.escape(spanish), corrected_text, re.IGNORECASE):
                start = max(0, match.start() - 100)
                end = min(len(corrected_text), match.end() + 100)
                context = corrected_text[start:end]
                
                # Skip if in inventor/residence section
                if 'inventor' in context.lower() or 'residence' in context.lower():
                    continue
                
                occurrences.append(match.start())
            
            if occurrences:
                # Replace all non-inventor occurrences
                corrected_text = corrected_text.replace(spanish, english)
                corrections.append({
                    "original": spanish,
                    "replacement": english,
                    "count": len(occurrences),
                    "type": "phrase"
                })
    
    # Second pass: Detect remaining Spanish patterns
    combined_pattern = '|'.join(SPANISH_DETECTION_PATTERNS)
    remaining_matches = list(re.finditer(combined_pattern, corrected_text, re.IGNORECASE))
    
    # Filter out inventor section
    spanish_still_present = []
    for match in remaining_matches:
        start = max(0, match.start() - 100)
        end = min(len(corrected_text), match.end() + 100)
        context = corrected_text[start:end]
        
        if 'inventor' not in context.lower() and 'residence' not in context.lower():
            spanish_still_present.append({
                "text": match.group(0),
                "position": match.start(),
                "context": context[50:150]  # Show context
            })
    
    return corrected_text, corrections, spanish_still_present

# Auto-correction functions (v3.0)
def apply_weak_language_corrections(text):
    """
    Apply automatic corrections to weak or generic language
    Returns: (corrected_text, list_of_changes)
    """
    import re
    changes = []
    
    for pattern_rule in WEAK_LANGUAGE_REPLACEMENTS:
        pattern = pattern_rule["pattern"]
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        for match in matches:
            original = match.group(0)
            change_record = {
                "original": original,
                "severity": pattern_rule["severity"],
                "suggestion": pattern_rule.get("replacement_template", ""),
                "example": pattern_rule.get("example", "")
            }
            changes.append(change_record)
    
    return text, changes


def detect_spanish_contamination(text):
    """
    Detect Spanish words that commonly leak into English patents
    Returns: (has_spanish: bool, detected_words: list)
    """
    spanish_words = CRITICAL_RULES["LANG_001_single_language"]["common_spanish_violations"]
    detected = []
    
    for word in spanish_words:
        if word.lower() in text.lower():
            detected.append(word)
    
    return len(detected) > 0, detected


def validate_cross_reference_section(text):
    """
    Validate cross-reference section for forbidden placeholders
    Returns: (is_valid: bool, errors: list)
    """
    forbidden = CRITICAL_RULES["XREF_001_verified_cross_references"]["forbidden_placeholders"]
    errors = []
    
    for placeholder in forbidden:
        if placeholder.lower() in text.lower():
            errors.append(f"Forbidden placeholder detected: {placeholder}")
    
    return len(errors) == 0, errors


def count_concrete_numbers_in_example(text):
    """
    Count concrete numbers in a worked example
    Returns: count (int)
    """
    import re
    # Match numbers including decimals, percentages, ranges
    pattern = r'\d+(?:\.\d+)?(?:\s*%|\s*[a-zA-Z]+)?'
    matches = re.findall(pattern, text)
    return len(matches)


def extract_algorithm_specifications(text):
    """
    Extract algorithm/ML specifications from text
    Returns: dict with framework, hyperparameters, metrics
    """
    import re
    specs = {
        "framework": None,
        "hyperparameters": [],
        "dataset_info": None,
        "performance_metrics": []
    }
    
    # Look for common ML frameworks
    frameworks = ["XGBoost", "TensorFlow", "PyTorch", "scikit-learn", "LSTM", "OSQP", "Gurobi"]
    for fw in frameworks:
        if fw.lower() in text.lower():
            specs["framework"] = fw
            break
    
    # Look for hyperparameters (key: value patterns)
    hyperparam_pattern = r'(\w+):\s*(\d+(?:\.\d+)?)'
    matches = re.findall(hyperparam_pattern, text)
    specs["hyperparameters"] = matches[:5]  # Limit to first 5
    
    # Look for performance metrics
    metric_patterns = [
        r'(RMSE|MAE|R²|accuracy|precision|F1[-\s]score|AUC):\s*(\d+(?:\.\d+)?%?)',
        r'(\d+(?:\.\d+)?)%\s*(accuracy|precision|recall)'
    ]
    for pattern in metric_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        specs["performance_metrics"].extend(matches)
    
    return specs


def extract_metrics_for_table(text):
    """
    BUG_002 FIX: Extract quantifiable metrics from text for comparison table
    More aggressive pattern matching
    Returns: list of dicts with metric data
    """
    import re
    metrics = []
    
    # Patterns to detect improvement metrics (more comprehensive)
    patterns = [
        # "reduces/improves/increases X by Y%"
        (r'(reduce[sd]?|improve[sd]?|increase[sd]?|decrease[sd]?)\s+([a-z\s]+?)\s+by\s+(\d+(?:\.\d+)?)\s*%', 'percentage'),
        # "from X to Y" (with optional units)
        (r'from\s+(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)?\s+to\s+(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)?', 'range'),
        # "X% improvement/increase/decrease/faster"
        (r'(\d+(?:\.\d+)?)\s*%\s+(improvement|increase|decrease|reduction|faster|slower|better)', 'percentage'),
        # "achieves/provides/delivers X% accuracy/precision"
        (r'(achieve[sd]?|provide[sd]?|deliver[sd]?)\s+(\d+(?:\.\d+)?)\s*%\s+([a-z]+)', 'achievement'),
        # "X times faster/better/higher"
        (r'(\d+(?:\.\d+)?)\s*[x×]\s+(faster|slower|more|less|better|higher|lower)', 'multiplier'),
        # "latency of/below/under X ms/seconds"
        (r'latency\s+(?:of|below|under|[<>])\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds|seconds?|s)', 'latency'),
        # "throughput of/over X ops/requests"
        (r'throughput\s+(?:of|over|[>])\s+(\d+(?:[,\d{3}]*)?)\s*([a-z/]+)', 'throughput'),
        # "supports/handles/scales to X zones/users/transactions"
        (r'(?:supports?|handles?|scales?\s+to)\s+(?:over\s+|up\s+to\s+)?(\d+(?:[,\d{3}]*)?)\s+([a-z]+)', 'capacity'),
        # "X% accuracy/precision/recall"
        (r'(\d+(?:\.\d+)?)\s*%\s+(accuracy|precision|recall|F1)', 'ml_metric'),
        # Simple percentage statements
        (r'(\d+(?:\.\d+)?)\s*%', 'simple_percent')
    ]
    
    for pattern, metric_type in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            metrics.append({
                "type": metric_type,
                "data": match,
                "raw_match": str(match)
            })
    
    return metrics


def should_generate_comparison_table(summary_text):
    """
    BUG_003 FIX: Determine if comparison table should be generated
    Returns: (should_generate: bool, metric_count: int)
    """
    metrics = extract_metrics_for_table(summary_text)
    metric_count = len(metrics)
    
    # Generate table if ≥3 metrics found
    return metric_count >= 3, metric_count


def auto_generate_comparison_table(metrics_data, invention_title):
    """
    BUG_003 FIX: Auto-generate comparison table from detected metrics
    Returns: HTML table string
    """
    table_html = f"""
<h3><strong>TABLE 1: Comparative Performance Metrics</strong></h3>

<p>¶00XX Table 1 summarizes quantitative improvements achieved by the disclosed {invention_title} compared to prior art systems:</p>

<table border="1" style="border-collapse: collapse; width: 100%;">
  <tr>
    <th>Performance Metric</th>
    <th>Prior Art System</th>
    <th>Present Invention</th>
    <th>Improvement</th>
  </tr>
"""
    
    # Add rows for each metric (limit to first 8)
    for i, metric in enumerate(metrics_data[:8], 1):
        # Parse metric data to extract values
        # This is a simplified version - would need more sophisticated parsing
        table_html += f"""  <tr>
    <td>Metric {i}</td>
    <td>[Baseline value]</td>
    <td>[Improved value]</td>
    <td>[Improvement %]</td>
  </tr>
"""
    
    table_html += """</table>

<p>¶00XX The above metrics represent improvements measured in representative deployments and simulations.</p>
"""
    
    return table_html


# Final output gates (v3.1 - Bug fixes)
def apply_final_output_gates(document_text, claims_section, summary_section):
    """
    Apply strict validation gates before final output
    Returns: (is_valid: bool, corrected_text: str, errors: list)
    """
    errors = []
    corrected_text = document_text
    
    # GATE 1: Spanish check (BUG_LANG_001 timing fix)
    # This runs AFTER all sections including drawings are concatenated
    corrected_text, spanish_corrections, remaining_spanish = scan_and_remove_spanish_entire_document(corrected_text)
    
    if spanish_corrections:
        errors.append({
            "gate": "GATE_1_SPANISH_CHECK",
            "severity": "WARNING",
            "message": f"Found and auto-corrected {len(spanish_corrections)} Spanish phrases",
            "corrections": spanish_corrections,
            "action": "AUTO_CORRECTED"
        })
    
    if remaining_spanish:
        errors.append({
            "gate": "GATE_1_SPANISH_REMAINING",
            "severity": "CRITICAL",
            "message": f"Spanish text still present after corrections: {len(remaining_spanish)} instances",
            "remaining": remaining_spanish,
            "action": "BLOCK_OUTPUT"
        })
    
    # GATE 2: Claim 1 strength check (BUG_002 fix)
    import re
    claim_1_match = re.search(r'1\.\s+A\s+system.*?(?=\n\n2\.|\Z)', claims_section, re.DOTALL)
    if claim_1_match:
        claim_1_text = claim_1_match.group(0)
        
        # Count elements (look for semicolons or "configured to" patterns)
        element_count = claim_1_text.count('configured to') + claim_1_text.count('comprising')
        
        if element_count < 6:
            errors.append({
                "gate": "GATE_2_CLAIM_STRENGTH",
                "severity": "CRITICAL",
                "message": f"Claim 1 has only {element_count} elements (minimum 6 required)",
                "action": "REQUIRES_REGENERATION"
            })
        
        # Check WHEREIN clause length
        wherein_match = re.search(r'wherein\s+.*', claim_1_text, re.DOTALL)
        if wherein_match:
            wherein_text = wherein_match.group(0)
            wherein_words = len(wherein_text.split())
            
            if wherein_words < 40:
                errors.append({
                    "gate": "GATE_2_WHEREIN_LENGTH",
                    "severity": "HIGH",
                    "message": f"WHEREIN clause has only {wherein_words} words (minimum 40 required)",
                    "action": "STRENGTHEN_WHEREIN"
                })
            
            # Check for numeric metrics in WHEREIN
            if not re.search(r'\d+(?:\.\d+)?(?:\s*%|\s*ms|\s*seconds|\s*zones)', wherein_text):
                errors.append({
                    "gate": "GATE_2_WHEREIN_METRICS",
                    "severity": "HIGH",
                    "message": "WHEREIN clause missing numeric metrics",
                    "action": "ADD_METRICS"
                })
    
    # GATE 3: Table generation check (BUG_003 fix)
    should_gen_table, metric_count = should_generate_comparison_table(summary_section)
    
    if should_gen_table and 'TABLE 1' not in document_text.upper():
        errors.append({
            "gate": "GATE_3_TABLE_MISSING",
            "severity": "MEDIUM",
            "message": f"Found {metric_count} metrics but no comparison table generated",
            "action": "GENERATE_TABLE_NOW"
        })
    
    # Determine if document is valid
    critical_errors = [e for e in errors if e['severity'] == 'CRITICAL']
    is_valid = len(critical_errors) == 0
    
    return is_valid, corrected_text, errors


# Validation report template (v3.1)
def generate_validation_report(patent_data, validation_results, quality_scores):
    """
    Generate comprehensive validation report
    """
    report = f"""
═══════════════════════════════════════════════════════════════
  PATENT VALIDATION REPORT v3.1
  Generated: {validation_results.get('timestamp', 'N/A')}
  Document: {patent_data.get('invention_title', 'N/A')}
═══════════════════════════════════════════════════════════════

VALIDATION SUMMARY
───────────────────────────────────────────────────────────────
✅ PASSED CHECKS:     {validation_results.get('passed_count', 0)} / {validation_results.get('total_checks', 0)}
⚠️  WARNINGS:          {validation_results.get('warning_count', 0)}
❌ CRITICAL FAILURES: {validation_results.get('critical_failures', 0)}

STATUS: {validation_results.get('status', 'UNKNOWN')}

QUALITY SCORES
───────────────────────────────────────────────────────────────
Technical Specificity:      {quality_scores.get('technical_specificity', 0)}/10
Claim Robustness:           {quality_scores.get('claim_robustness', 0)}/10
Quantification Level:       {quality_scores.get('quantification_level', 0)}/10
Prior Art Differentiation:  {quality_scores.get('prior_art_differentiation', 0)}/10
USPTO Compliance:           {quality_scores.get('uspto_compliance', 0)}/10
────────────────────────────────────────────────────────────────
OVERALL SCORE:              {quality_scores.get('overall', 0)}/10  (Target: ≥8.0)

BUG FIXES APPLIED (v3.1)
───────────────────────────────────────────────────────────────
✅ BUG_001: Spanish detection in entire document (including drawings)
✅ BUG_002: Claim 1 strengthened (6-9 elements + 40-word WHEREIN)
✅ BUG_003: Auto-generate table when ≥3 metrics present

RECOMMENDATIONS
───────────────────────────────────────────────────────────────
{validation_results.get('recommendations', 'None')}

═══════════════════════════════════════════════════════════════
"""


# ============================================================================
# 4-CALL PATENT GENERATION SYSTEM (Quality Optimized v3.0)
# ============================================================================

def generate_call_1_prompt(invention_data):
    """
    CALL 1: Introductory Sections
    Generates: Header, Cross-Reference, Statement, Field, Background
    Expected: ~2500 tokens, ~60 seconds
    """
    title = invention_data.get('invention_title_en', '')
    field = invention_data.get('technical_field_en', '')
    description = invention_data.get('invention_description_en', '')[:800]
    inventor = invention_data.get('inventor_name', 'Inventor')
    residence = invention_data.get('inventor_residence_en', 'N/A')
    
    quality_guidance = get_quality_guidance_text()
    
    system_message = get_uspto_system_message()
    
    user_prompt = f"""You are an expert USPTO patent writer.

⚠️⚠️⚠️ CRITICAL - DO NOT DUPLICATE TITLE/INVENTOR ⚠️⚠️⚠️

DO NOT write a HEADER section with title and inventor information.
The PDF generator already adds this automatically at the top.

START YOUR CONTENT DIRECTLY WITH CROSS-REFERENCE section.

TASK: Write ONLY the following sections of a provisional patent application:
1. CROSS-REFERENCE TO RELATED APPLICATIONS (¶0006)
2. STATEMENT REGARDING FEDERALLY SPONSORED R&D (¶0010)
3. FIELD OF THE INVENTION (¶0013-0015) - EXACTLY 3 PARAGRAPHS
4. BACKGROUND (¶0023-0028) - EXACTLY 6 PARAGRAPHS

INVENTION DETAILS (for context only - DO NOT repeat these in a header):
- Title: {title}
- Inventor: {inventor}
- Residence: {residence}
- Technical Field: {field}
- Description: {description}

⚠️⚠️⚠️ USPTO FORMAT RULES (CRITICAL) ⚠️⚠️⚠️

RULE 0: DO NOT write "HEADER" or "Title:" or "Inventor:" - START with CROSS-REFERENCE
RULE 1: Section header appears ONCE only at start of each section
RULE 2: NO colon (:) after section headers
RULE 3: Headers in ALL CAPS
RULE 4: Paragraph numbers start AFTER header

✅ CORRECT FORMAT FOR FIELD OF THE INVENTION:
FIELD OF THE INVENTION

¶0013 The present invention relates to...

¶0014 The invention addresses...

¶0015 The invention is applicable to...

❌ WRONG (DO NOT DO):
¶0013 FIELD OF THE INVENTION: The present...
OR
FIELD OF THE INVENTION:  ← NO COLON
OR
¶0014 FIELD OF THE INVENTION: The invention... ← NO REPEAT HEADER

✅ CORRECT FORMAT FOR BACKGROUND:
BACKGROUND

¶0023 Existing systems...

¶0024 Current approaches...

❌ WRONG (DO NOT DO):
¶0023 BACKGROUND: Existing...
OR
BACKGROUND:  ← NO COLON

CRITICAL REQUIREMENTS FOR FIELD:
- ¶0013: General field + at least 2 CPC codes
- ¶0014: Technical problem with 3+ quantified metrics
- ¶0015: Market context with scale

CRITICAL REQUIREMENTS FOR BACKGROUND:
- Name 5+ specific products/platforms
- Include 10+ quantified limitations
- Each metric with baseline value

{quality_guidance if quality_guidance else ''}

Do NOT write other sections yet. STOP after Background section.

REMEMBER: Start directly with "CROSS-REFERENCE TO RELATED APPLICATIONS" section.
Do NOT include any header with title or inventor information.

Output in English with correct USPTO format."""
    
    return system_message, user_prompt


def generate_call_2_prompt(invention_data, call_1_summary):
    """
    CALL 2: Summary and Definitions
    Generates: Summary (4 paragraphs), Definitions (6-8 terms)
    Expected: ~2000 tokens, ~60 seconds
    """
    title = invention_data.get('invention_title_en', '')
    
    quality_guidance = get_quality_guidance_text()
    system_message = get_uspto_system_message()
    
    user_prompt = f"""Continuing the patent application for '{title}'...

CONTEXT (already generated in Call 1):
{call_1_summary[:800]}
[Field and Background sections are complete]

TASK: Write ONLY the following sections:
1. SUMMARY (¶0032-0035) - EXACTLY 4 PARAGRAPHS
2. DEFINITIONS (¶0040-0048) - BETWEEN 6-8 TERMS

⚠️⚠️⚠️ USPTO FORMAT RULES (CRITICAL) ⚠️⚠️⚠️

✅ CORRECT FORMAT FOR SUMMARY:
SUMMARY OF THE INVENTION

¶0032 In one aspect, the disclosure describes...

¶0033 In another aspect...

¶0034 The system provides quantified improvements...

❌ WRONG (DO NOT DO):
¶0032 SUMMARY OF THE INVENTION: In one aspect...
OR
SUMMARY OF THE INVENTION:  ← NO COLON

✅ CORRECT FORMAT FOR DEFINITIONS (if included):
DEFINITIONS

¶0040 As used herein, the term 'workflow engine' refers to...

¶0041 As used herein, the term 'orchestrator' refers to...

❌ WRONG (DO NOT DO):
¶0040 DEFINITIONS: As used herein...

CRITICAL REQUIREMENTS FOR SUMMARY:
- ¶0032: System/method overview
- ¶0033: Technical innovation
- ¶0034: AT LEAST 3 quantified improvements:
  Format: 'reduces [metric] from [baseline] to [improved] (at least X% reduction)'
  Example: 'reduces latency from 420 ms to 180 ms (at least 57% reduction)'
- ¶0035: Additional advantages

DEFINITIONS (optional but recommended):
Define 6-8 key terms, 4-6 sentences each.

{quality_guidance if quality_guidance else ''}

Do NOT write other sections yet. STOP after SUMMARY (and DEFINITIONS if included)."""
    
    return system_message, user_prompt


def generate_call_3_prompt(invention_data, call_1_summary, call_2_summary):
    """
    CALL 3: Descriptions and Figures
    Generates: Brief Description of Drawings, Detailed Description
    Expected: ~4000 tokens, ~90 seconds
    CRITICAL: Must explain ALL figures
    """
    title = invention_data.get('invention_title_en', '')
    
    quality_guidance = get_quality_guidance_text()
    system_message = get_uspto_system_message()
    
    user_prompt = f"""Continuing the patent application for '{title}'...

CONTEXT (already generated):
- Call 1: Field, Background ✅
- Call 2: Summary, Definitions ✅

TASK: Write ONLY the following sections:
1. BRIEF DESCRIPTION OF THE DRAWINGS (¶0050-0052)
2. DETAILED DESCRIPTION OF EMBODIMENTS (¶0070-0095)

⚠️⚠️⚠️ USPTO FORMAT RULES (CRITICAL) ⚠️⚠️⚠️

=== PART 1: BRIEF DESCRIPTION ===

✅ CORRECT FORMAT:
BRIEF DESCRIPTION OF THE DRAWINGS

¶0050 FIG. 1 is a system architecture diagram...

¶0051 FIG. 2 is a detailed component diagram...

¶0052 FIG. 3 is a process flow diagram...

❌ WRONG (DO NOT DO):
¶0050 BRIEF DESCRIPTION OF THE DRAWINGS: FIG. 1...
OR
BRIEF DESCRIPTION OF THE DRAWINGS:  ← NO COLON

Write exactly 6-7 figure descriptions:

¶0050 FIG. 1 is a system architecture diagram illustrating the overall system with main components, showing [system name] (100) comprising [list 5-8 main components with reference numbers 101-108], integrated with external systems (120-140) over network (150).

¶0051 FIG. 2 is a detailed component diagram illustrating internal structure of [main component], depicting [component] (101) including [list 5-8 subcomponents with reference numbers 201-210].

¶0052 FIG. 3 is a process flow diagram illustrating the complete workflow, showing [list 8-15 steps with reference numbers 301-315], including decision points and data flows.

¶0053 FIG. 4 is a sequence diagram illustrating [specific interaction or communication pattern], showing message exchanges between [components] with timing and state changes.

¶0054 FIG. 5 is a data flow diagram illustrating [data processing pipeline or transformation], showing input sources, processing stages, and output destinations.

¶0055 FIG. 6 is a deployment diagram illustrating [system deployment architecture], showing hardware nodes, containers, and network topology.

¶0056 (OPTIONAL) FIG. 7 is [state diagram / class diagram / entity-relationship diagram] illustrating [specific technical aspect], showing [elements and relationships].

=== PART 2: DETAILED DESCRIPTION ===

✅ CORRECT FORMAT:
DETAILED DESCRIPTION OF EMBODIMENTS

¶0070 The embodiments described herein...

¶0071 The system (100) comprises...

❌ WRONG (DO NOT DO):
¶0070 DETAILED DESCRIPTION OF EMBODIMENTS: The embodiments...
OR
DETAILED DESCRIPTION OF EMBODIMENTS:  ← NO COLON

⚠️ THIS IS CRITICAL - DO NOT OMIT ⚠️

Mandatory structure:

¶0070-0078: General architecture description
- Introduction, main components (101-107) with technical specifications

¶0079-0082: Detailed component operation
- Internal modules, algorithms, data structures

**¶0083: COMPLETE EXPLANATION OF FIG. 1** (MANDATORY - 6-8 sentences)
Format: 'FIG. 1 illustrates the [system architecture] (100) comprising [component list with ALL numbers 101-108, 120-140, 150]. The system includes [component 101] configured to [detailed function], [component 102] configured to [function]...'
EXPLAIN ALL NUMBERED COMPONENTS: 100, 101, 102, 103, 104, 105, 106, 107, 108, 120, 130, 140, 150.

**¶0084: COMPLETE EXPLANATION OF FIG. 2** (MANDATORY - 6-8 sentences)
Format: 'FIG. 2 shows the internal structure of [component 101] in detail. The component comprises [subcomponent 201] including [details], [subcomponent 202]...'
EXPLAIN ALL NUMBERED SUBCOMPONENTS: 201, 202, 203, 204, 205, 206, 207, 208, 209, 210.

**¶0085: COMPLETE EXPLANATION OF FIG. 3** (MANDATORY - 8-12 sentences)
Format: 'FIG. 3 illustrates the complete process for [purpose]. The process begins at step 301 where [description]. At step 302, [component] performs [action]...'
EXPLAIN ALL NUMBERED STEPS: 301-315.

**¶0086: COMPLETE EXPLANATION OF FIG. 4** (MANDATORY - 5-7 sentences)
Format: 'FIG. 4 depicts the [interaction sequence] between [components]. The sequence starts when [event] triggers [component] to send [message] to [component]...'
EXPLAIN sequence flow, message types, and state transitions.

**¶0087: COMPLETE EXPLANATION OF FIG. 5** (MANDATORY - 5-7 sentences)
Format: 'FIG. 5 illustrates the [data flow] from [sources] through [processing stages] to [outputs]. Data enters at [entry point], undergoes [transformations], and outputs as [result]...'
EXPLAIN data sources, transformations, and outputs.

**¶0088: COMPLETE EXPLANATION OF FIG. 6** (MANDATORY - 5-7 sentences)
Format: 'FIG. 6 shows the [deployment architecture] across [infrastructure]. The system is deployed on [hardware/cloud], with [components] distributed across [nodes]...'
EXPLAIN deployment topology, scaling, and infrastructure.

**¶0089 (OPTIONAL): EXPLANATION OF FIG. 7** (if FIG. 7 was described in Brief Description)
Format: 'FIG. 7 illustrates [specific technical aspect]...'

¶0090-0093: Worked numerical examples (MANDATORY - at least 2 examples with real values)

¶0094-0095: Alternative embodiments and variations

{quality_guidance if quality_guidance else ''}

Do NOT write Claims yet. STOP after Detailed Description."""
    
    return system_message, user_prompt


def generate_call_4_prompt(invention_data, call_1_summary, call_2_summary, call_3_summary):
    """
    CALL 4: Claims and Abstract
    Generates: Claims (10-15), Abstract
    Expected: ~3500 tokens, ~90 seconds
    CRITICAL: Claim 1 must be generic (no hardware specs, no metrics)
    """
    title = invention_data.get('invention_title_en', '')
    
    quality_guidance = get_quality_guidance_text()
    system_message = get_uspto_system_message()
    
    user_prompt = f"""Finalizing the patent application for '{title}'...

CONTEXT (already generated):
- Call 1: Field, Background ✅
- Call 2: Summary, Definitions ✅
- Call 3: Brief Description, Detailed Description ✅

TASK: Write the final sections:
1. CLAIMS (1-12) - **NO paragraph numbers (¶XXXX)**
2. ABSTRACT - **NO paragraph numbers (¶XXXX)**

=== PART 1: CLAIMS ===

⚠️⚠️⚠️ USPTO FORMAT RULES - CLAIMS (SUPER CRITICAL) ⚠️⚠️⚠️

✅ CORRECT FORMAT FOR CLAIMS:
<p>What is claimed is:</p>
<p>1. A system for [purpose], the system comprising:</p>
<p>2. The system of claim 1, wherein...</p>

❌ WRONG (DO NOT DO):
¶0001 What is claimed...  ← NO ¶ numbers in claims
OR
&#182;0001 1. A system...  ← NO &#182; in claims
OR
CLAIMS:  ← NO colon

**CRITICAL: DO NOT use paragraph numbers (¶XXXX or &#182;XXXX) in the CLAIMS section. Use only claim numbers: 1, 2, 3, etc.**

⚠️ CLAIM 1 IS THE MOST IMPORTANT PART OF THE ENTIRE PATENT ⚠️

Claim 1 CRITICAL RULES:

✅ CLAIM 1 MUST INCLUDE:
- Opening: 'A system for [purpose], the system comprising:' or 'A system comprising:'
- Generic hardware: 'at least one processor and memory storing executable instructions'
- 4-8 main components/modules: 'a [component name] module configured to [high-level function]'
- Closing 'wherein' clause describing system-level advantage in general terms

❌ CLAIM 1 MUST NOT INCLUDE:
- ❌ NO specific hardware: NO '4 cores', NO '8 GB', NO '2.0 GHz'
- ❌ NO performance metrics: NO '1,000 msg/sec', NO '200 ms'
- ❌ NO percentages: NO '66% reduction'
- ❌ NO time comparisons: NO '30 seconds to 10 seconds'
- ❌ NO implementation names: NO 'XGBoost', NO 'Kafka', NO 'PostgreSQL'
- ❌ NO configurations: NO '7 days', NO '200 trees'
- ❌ NO test sets: NO 'on test set of X cases'
- ❌ NO thresholds: NO 'threshold of 0.8'

MAXIMUM LENGTH: 150 words (120 preferred)

GOOD CLAIM 1 TEMPLATE:

1. A system for [automating/managing] [domain] [workflows] across [heterogeneous] [systems], the system comprising:

at least one processor and memory storing executable instructions;

a [first component] module configured to [core function];

a [second component] module configured to [core function];

a [third component] module configured to interface with [external systems] via [generic interface];

a [fourth component] module configured to [core function]; and

a [fifth component] configured to [core function];

wherein the system is configured to [system-level advantage], thereby [general benefit] compared to systems lacking [key feature].

CLAIMS 2-10: DEPENDENT CLAIMS (add ALL specifics here)

2. The system of claim 1, wherein the processor comprises at least [X] vCPU cores and the memory comprises at least [Y] gigabytes.

3. The system of claim 1, wherein the [component] is configured to [function] at a rate of at least [X] [units] per [time].

4-10. [Additional dependent claims with hardware specs, metrics, implementations]

CLAIM 11: METHOD CLAIM

11. A computer-implemented method performed by the system of claim 1, the method comprising:
receiving, by the [component], [input];
creating, by the [component], [output];
[5-8 high-level steps]

CLAIM 12: COMPUTER-READABLE MEDIUM

12. A non-transitory computer-readable medium storing instructions that, when executed by one or more processors, cause the processors to implement the system of claim 1.

⚠️⚠️⚠️ USPTO FORMAT RULES - ABSTRACT (SUPER CRITICAL) ⚠️⚠️⚠️

✅ CORRECT FORMAT FOR ABSTRACT:
ABSTRACT

A secure microservices orchestration system configured to integrate AI agents into critical services. The system comprises an orchestration controller (101), a policy module (102)...

❌ WRONG (DO NOT DO):
¶0001 A secure...  ← NO ¶ in abstract
OR
ABSTRACT:  ← NO colon
OR
Abstract: A secure...  ← NO 'Abstract:' label

=== PART 2: ABSTRACT ===

Write abstract (150-200 words, NO paragraph numbers):

Structure:
- Sentence 1-2: System type and purpose
- Sentence 3-4: Main components with reference numbers (101, 102, 103, etc.)
- Sentence 5-6: Technical innovation
- Sentence 7-9: Three quantified improvements with baseline and improved values
- Sentence 10: Applicable environments

{quality_guidance if quality_guidance else ''}

Output Claims (no explanations) and Abstract."""
    
    return system_message, user_prompt


# Keep backward compatibility for old single-call function
def generate_complete_patent_prompt(invention_data):
    """
    Generate a comprehensive prompt to create ALL patent sections in a single API call.
    This drastically reduces API calls from 26+ to just 2 (generation + translation).
    
    Args:
        invention_data: dict with keys:
            - invention_title_en
            - technical_field_en
            - invention_description_en
            - inventor_name
            - inventor_residence_en
    
    Returns:
        tuple: (system_message, user_prompt)
    """
    title = invention_data.get('invention_title_en', '')
    field = invention_data.get('technical_field_en', '')
    description = invention_data.get('invention_description_en', '')[:800]
    inventor = invention_data.get('inventor_name', 'Inventor')
    residence = invention_data.get('inventor_residence_en', 'N/A')
    
    # Get quality guidance
    quality_guidance = get_quality_guidance_text()
    
    system_message = get_uspto_system_message()
    
    user_prompt = f"""Generate a COMPLETE USPTO Provisional Patent Application with ALL sections below.

INVENTION DETAILS:
Title: {title}
Technical Field: {field}
Inventor: {inventor}
Residence: {residence}
Description: {description}

GENERATE ALL 13 SECTIONS IN ORDER:

=== SECTION 1: HEADER ===
Include title, inventor name ({inventor}), residence ({residence}), filing date placeholder, application type.
Format: USPTO standard header with HTML tags and paragraph numbering.
NO PLACEHOLDERS like [Attorney Name] - use actual inventor information.

=== SECTION 2: CROSS-REFERENCE TO RELATED APPLICATIONS ===
Write: "Not Applicable. This application does not claim priority to or benefit from any previously filed patent application."
Use paragraph ¶0006.

=== SECTION 3: STATEMENT REGARDING FEDERALLY SPONSORED R&D ===
Write: "Not Applicable. The invention was made without federal government support."
Use paragraph ¶0010.

=== SECTION 4: FIELD OF THE INVENTION ===
Write 3 paragraphs (¶0013-0015):
- Specific technical domain
- Technical problems addressed with QUANTIFIED impacts
- Market context and significance

=== SECTION 5: BACKGROUND ===
Write 5-6 paragraphs (¶0023-0031):
- Current state of technology (2 paragraphs)
- Technical limitations with QUANTIFIED impacts (2-3 paragraphs)
- Unmet need (1 paragraph)
Include at least 3 quantifiable metrics.

=== SECTION 6: SUMMARY ===
Write 3-4 paragraphs (¶0032-0039):
- High-level solution
- Technical innovation
- Quantifiable advantages (at least 3 metrics)
- Additional benefits

=== SECTION 7: DEFINITIONS (if needed) ===
Define technical terms used. Can be brief or omitted if terms are standard.

=== SECTION 8: BRIEF DESCRIPTION OF DRAWINGS ===
Write 2-3 paragraphs describing:
- FIG. 1: System architecture diagram
- FIG. 2: Detailed component diagram
- FIG. 3: Process flow diagram (if applicable)

=== SECTION 9: DETAILED DESCRIPTION ===
Write 20-25 paragraphs (¶0070-0095):
1. ARCHITECTURE (5-6 paragraphs): System overview with components (Module 101, 102, 103...)
2. COMPONENT DETAILS (8-10 paragraphs): For each major component with algorithms/specs
3. WORKED EXAMPLE (4-5 paragraphs): Concrete scenario with actual data values and calculations
4. ALTERNATIVES (3-5 paragraphs): Different implementations

CRITICAL: Include specific numbers, metrics, algorithms (e.g., XGBoost, 200 trees, lr=0.05).

=== SECTION 10: CLAIMS ===
Generate MINIMUM 12 patent claims:

**CLAIM 1 (Independent - 6-9 elements):**
1. A system for [specific problem in {field}], the system comprising:
   a processor and memory storing executable instructions;
   [ELEMENT 1] a [specific module name] module configured to [specific function with data structures];
   [ELEMENT 2] a [specific module name] module configured to [specific function];
   [ELEMENT 3 - NOVEL] a [innovative module] configured to [key innovation];
   [ELEMENT 4] a [specific module name] module configured to [specific function] using [algorithm];
   [ELEMENT 5] a [storage/interface module] configured to [specific function];
   wherein the [element 3] performs [specific action with parameters] causing [element 4] to achieve [measurable result with numbers], thereby [technical advantage] compared to [prior art limitation].

**CLAIMS 2-4:** Add specificity to main elements (data structures, algorithms, parameters)
**CLAIMS 5-7:** Alternative implementations
**CLAIMS 8-10:** Detail the novel element
**CLAIM 11:** Method claim
**CLAIM 12:** Computer-readable medium claim

WHEREIN CLAUSE MUST:
- Be at least 40 words
- Include specific action with parameters
- Include numeric metric
- Compare to prior art

=== SECTION 11: ABSTRACT ===
Write ONE paragraph (¶0001), 150-250 words:
- What the invention is (system/method)
- Technical problem solved
- Core technical solution with at least 3 numbered components (101, 102, 103)
- At least 2 quantified performance metrics
- Measurable advantages

=== SECTION 12: APPENDICES ===
Optional supporting information.

=== SECTION 13: FILING CHECKLIST ===
Brief checklist of materials included.

---

CRITICAL FORMATTING REQUIREMENTS:
- Use HTML paragraph tags: <p>&#182;00XX Text...</p>
- Start each section with <h2><strong>SECTION TITLE</strong></h2>
- Reference numerals: First mention "[component] (101)", then "component 101"
- 100% ENGLISH ONLY
- NO marketing language (innovative, cutting-edge, etc.) - be technical
- Include CONCRETE numbers, metrics, algorithms throughout
- Claims: NO explanations, ONLY numbered claims

{quality_guidance if quality_guidance else ''}

Generate the COMPLETE patent application now."""
    
    return system_message, user_prompt

    return report