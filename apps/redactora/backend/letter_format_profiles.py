"""
Letter Format Profiles — 8 distinct writing voices and visual formats.
Each profile defines:
  - prompt_instructions: text injected into the generation prompt to vary WRITING STYLE
  - pdf_settings: parameters used by the PDF renderer
"""
import random

PROFILES = {
    "classic_legal": {
        "id": "classic_legal",
        "name": "Clásico Legal",
        "pdf": {
            "font_body": "Times-Roman",
            "font_bold": "Times-Bold",
            "font_italic": "Times-Italic",
            "font_size_body": 12,
            "font_size_section": 12,
            "left_margin": 90,
            "right_margin": 90,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 20,
            "space_after_para": 10,
            "space_before_section": 18,
            "section_style": "ALL_CAPS_UNDERLINE",
            "header_align": "CENTER",
            "has_re_line": True,
            "signature_style": "formal_block",
        },
        "prompt_instructions": """
WRITING VOICE — Classical Legal Advocate:
- Tone: solemn, authoritative, formal. Write as a seasoned legal scholar speaking on the record.
- Open with: "RE: [Candidate Name] — EB-2 National Interest Waiver Petition"
- First paragraph must establish the expert's standing, NOT the candidate's qualities.
  Example opening: "I submit this opinion in my capacity as [title] at [institution], having spent over [X] years investigating [field]. It is my considered judgment that..."
- Section titles in ALL CAPS (e.g., "I. PROFESSIONAL STANDING OF THE EVALUATOR")
- Use Latin maxims or legal phrases sparingly to reinforce authority when appropriate.
- Paragraphs must be dense (6-8 sentences), no bullet points.
- Never use informal contractions or colloquialisms.
- Include a perjury certification: "I certify under penalty of perjury under 28 U.S.C. § 1746 that the foregoing is true and correct to the best of my knowledge."
- Signature block: full professional credentials under the signature line, formatted as a formal deposition block.
"""
    },

    "modern_professional": {
        "id": "modern_professional",
        "name": "Moderno Profesional",
        "pdf": {
            "font_body": "Helvetica",
            "font_bold": "Helvetica-Bold",
            "font_italic": "Helvetica-Oblique",
            "font_size_body": 11,
            "font_size_section": 12,
            "left_margin": 72,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 17,
            "space_after_para": 8,
            "space_before_section": 14,
            "section_style": "BOLD_RULE",
            "header_align": "LEFT",
            "has_re_line": False,
            "signature_style": "modern_minimal",
        },
        "prompt_instructions": """
WRITING VOICE — Modern Industry Expert:
- Tone: confident, direct, results-oriented. Write as a senior practitioner in the private sector.
- No RE: line. Open immediately with the purpose — what you are here to say and why it matters NOW.
  Example opening: "It is without reservation that I recommend [Candidate Name] for an EB-2 National Interest Waiver. In my [X] years leading [field] initiatives at [organization], I have encountered few professionals whose work has the scope and practical impact that [Candidate]'s does."
- Use a mix of paragraphs and selective bullet points (max 3 bullets per section) for key facts.
- Section titles are descriptive and action-oriented (e.g., "Why This Work Is Transforming [Field] in the United States")
- Paragraphs are focused (3-5 sentences) — no padding.
- Vary sentence length deliberately: short punchy statements followed by substantive elaboration.
- Close with a forward-looking statement about what the U.S. stands to gain — not just a summary.
- Signature: name, title, email — minimal and clean.
"""
    },

    "academic_institutional": {
        "id": "academic_institutional",
        "name": "Académico Institucional",
        "pdf": {
            "font_body": "Times-Roman",
            "font_bold": "Times-Bold",
            "font_italic": "Times-Italic",
            "font_size_body": 12,
            "font_size_section": 13,
            "left_margin": 90,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 22,
            "space_after_para": 12,
            "space_before_section": 20,
            "section_style": "ROMAN_NUMERAL",
            "header_align": "SPLIT",
            "has_re_line": False,
            "signature_style": "academic_block",
        },
        "prompt_instructions": """
WRITING VOICE — Academic Peer Reviewer:
- Tone: analytical, measured, evidence-driven. Write as a tenured professor or research director submitting a peer review.
- Structure sections with Roman numerals: I. Evaluator's Background and Expertise, II. Methodological Basis for This Assessment, III. Scholarly Significance of the Proposed Endeavor, etc.
- Open by establishing the evaluator's specific area of expertise and how it qualifies them to assess this particular work — not a generic introduction.
  Example: "My research on [specific topic] over the past [X] years at [institution] provides me with the methodological grounding to assess the claims and contributions represented in [Candidate Name]'s work."
- Use academic hedging where appropriate ("The evidence strongly suggests...", "It is my assessment that...") but conclude sections with definitive judgment.
- Each section follows: thesis statement → supporting evidence → scholarly implication for the field.
- No bullet points — flowing academic prose with clear logical connectors (Furthermore, Notably, In contrast, etc.).
- Reference the candidate's documented contributions with precision — specific papers, methodologies, or outcomes.
- Close in the tradition of peer review: a clear, reasoned recommendation supported by the weight of evidence presented.
"""
    },

    "executive_brief": {
        "id": "executive_brief",
        "name": "Ejecutivo Conciso",
        "pdf": {
            "font_body": "Helvetica",
            "font_bold": "Helvetica-Bold",
            "font_italic": "Helvetica-Oblique",
            "font_size_body": 11,
            "font_size_section": 11,
            "left_margin": 72,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 16,
            "space_after_para": 6,
            "space_before_section": 12,
            "section_style": "BOLD_LEFT_ACCENT",
            "header_align": "LEFT",
            "has_re_line": False,
            "signature_style": "executive_clean",
        },
        "prompt_instructions": """
WRITING VOICE — Executive Decision-Maker:
- Tone: incisive, strategic, time-aware. Write as a C-suite executive or senior director — someone used to making high-stakes assessments quickly.
- Lead every section with a one-sentence verdict, then support it. Never build toward the conclusion — state it first.
  Example opening: "I am writing to provide my unqualified support for the EB-2 NIW petition of [Candidate Name]. The case is straightforward: [Candidate]'s work addresses a documented gap in [field] that directly impacts the U.S. economy, and no credentialed substitute exists."
- Sections begin with a bold declarative headline-style header (e.g., "The U.S. Cannot Afford to Delay This Work")
- Write with urgency and specificity. Use numbers. Use timeframes. Use comparative benchmarks.
- No filler sentences. If a sentence does not add a new fact or argument, cut it.
- Use a single bullet list of 3-4 items per section at most — only for impact statements or key qualifications.
- Close with a single, direct sentence recommendation that requires no interpretation.
"""
    },

    "official_government": {
        "id": "official_government",
        "name": "Oficial Gubernamental",
        "pdf": {
            "font_body": "Times-Roman",
            "font_bold": "Times-Bold",
            "font_italic": "Times-Italic",
            "font_size_body": 12,
            "font_size_section": 12,
            "left_margin": 72,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 20,
            "space_after_para": 10,
            "space_before_section": 16,
            "section_style": "NUMBERED_BOLD",
            "header_align": "LEFT",
            "has_re_line": True,
            "signature_style": "formal_block",
        },
        "prompt_instructions": """
WRITING VOICE — Government / Policy Official:
- Tone: policy-minded, public-interest focused, procedurally precise. Write as a government official, former agency director, or senior policy advisor.
- Full-block format. RE: line mandatory: "RE: Expert Opinion in Support of EB-2 NIW Petition — [Candidate Name]"
- Open by anchoring the assessment in a POLICY FRAMEWORK — reference specific federal legislation, executive orders, or official national strategy documents that the candidate's work addresses.
  Example: "As the former [title] with [agency/institution], I have monitored the implementation of [policy/program] since its enactment. [Candidate Name]'s proposed endeavor directly addresses the implementation gap identified in [specific report/statute]."
- Number sections sequentially and formally: 1. Qualifications of This Reviewer, 2. Policy Context and National Need, etc.
- Use passive constructions and institutional "we" where consistent with policy writing voice.
- Include explicit references to the USCIS standard for national interest ("serves the national interest to a substantially greater degree than would an available U.S. worker possessing exceptional ability").
- Close with an availability statement and full formal contact block.
"""
    },

    "narrative_storyteller": {
        "id": "narrative_storyteller",
        "name": "Narrativo Testimonial",
        "pdf": {
            "font_body": "Times-Roman",
            "font_bold": "Times-Bold",
            "font_italic": "Times-Italic",
            "font_size_body": 12,
            "font_size_section": 13,
            "left_margin": 90,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 22,
            "space_after_para": 12,
            "space_before_section": 18,
            "section_style": "ITALIC_HEADER",
            "header_align": "LEFT",
            "has_re_line": False,
            "signature_style": "personal_close",
        },
        "prompt_instructions": """
WRITING VOICE — Narrative Testimonial Expert:
- Tone: vivid, evidence-anchored, deeply personal in the evaluator's voice. Write as someone who encountered the candidate's WORK (not the person) and was genuinely impressed by its real-world consequences.
- Open with a compelling scene or anecdote that brings the national problem to life — then introduce the candidate's work as the solution.
  Example: "When I first reviewed the technical documentation submitted with this petition, what struck me was not the methodology's elegance — it was its implications. The United States has [X million] people facing [specific problem]. I have studied this field for [X] years and I can state with confidence that [Candidate Name] has developed something genuinely rare."
- Section titles are evocative and conversational (e.g., "What the Numbers Actually Mean", "Why I Changed My Assessment After Reviewing the Data")
- Write in first person with emotional intelligence — the expert is moved by the magnitude of the problem and the elegance of the solution.
- Use rhetorical questions sparingly to engage the reader and anticipate objections.
- Transitions between sections should feel organic, not mechanical.
- Close with a personal, committed endorsement — the expert is willing to stake their professional reputation on this assessment.
"""
    },

    "technical_specialist": {
        "id": "technical_specialist",
        "name": "Especialista Técnico",
        "pdf": {
            "font_body": "Helvetica",
            "font_bold": "Helvetica-Bold",
            "font_italic": "Helvetica-Oblique",
            "font_size_body": 11,
            "font_size_section": 12,
            "left_margin": 72,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 17,
            "space_after_para": 8,
            "space_before_section": 14,
            "section_style": "BOLD_RULE",
            "header_align": "LEFT",
            "has_re_line": False,
            "signature_style": "technical_block",
        },
        "prompt_instructions": """
WRITING VOICE — Deep Technical Expert:
- Tone: precise, domain-specific, quantitative. Write as the foremost technical authority in the candidate's niche — someone who speaks in the language of practitioners, not generalists.
- Open by immediately establishing the TECHNICAL GAP that the candidate addresses — name the specific unsolved problem in the field before introducing the candidate.
  Example: "The field of [specific domain] has long grappled with [precise technical challenge]. Despite advances in [related area], no scalable, validated methodology has addressed [specific gap] — until the work documented in this petition."
- Section titles are technically precise (e.g., "Methodological Innovation: Why Existing Frameworks Fall Short")
- Use domain-specific terminology confidently and correctly — do NOT over-explain to a lay audience.
- Quantify everything: improvement percentages, scale of impact, comparison to prior-art baselines.
- Use numbered lists for technical enumeration (components of a methodology, phases of a process, evidence hierarchy).
- Contrast the candidate's approach with existing alternatives — explain WHY theirs is superior on technical merits.
- Close with a technical verdict that a USCIS adjudicator can cite directly.
"""
    },

    "humanitarian_advocate": {
        "id": "humanitarian_advocate",
        "name": "Defensor Humanitario",
        "pdf": {
            "font_body": "Times-Roman",
            "font_bold": "Times-Bold",
            "font_italic": "Times-Italic",
            "font_size_body": 12,
            "font_size_section": 13,
            "left_margin": 90,
            "right_margin": 72,
            "top_margin": 72,
            "bottom_margin": 72,
            "leading": 21,
            "space_after_para": 11,
            "space_before_section": 18,
            "section_style": "ROMAN_NUMERAL",
            "header_align": "LEFT",
            "has_re_line": False,
            "signature_style": "academic_block",
        },
        "prompt_instructions": """
WRITING VOICE — Humanitarian / Social Impact Advocate:
- Tone: morally grounded, urgency-driven, community-centered. Write as a public health director, NGO leader, or social equity expert who understands the human cost of the national problem.
- Center the letter on the PEOPLE affected — always anchor statistics in lived human experience before pivoting to technical analysis.
  Example opening: "Behind every statistic about [problem area] is a person — a worker, a parent, a community member — whose opportunities are constrained by a structural gap that [Candidate Name]'s work is uniquely designed to close."
- Use a three-part section structure: (1) The Human Reality of the Problem, (2) Why Existing Interventions Have Failed the Most Vulnerable, (3) Why This Candidate's Solution Reaches the Populations That Matter
- Reference specific at-risk populations, underserved regions, or marginalized communities where relevant.
- Balance emotional resonance with concrete evidence — every moral claim must be backed by data.
- Use language of equity, access, and structural change without being polemical.
- Paragraphs build from the individual to the systemic — personal → community → national scale.
- Close with an appeal to the adjudicator's role in shaping national outcomes: "The approval of this petition is not merely an immigration decision — it is an investment in the communities that have waited longest for solutions like this one."
"""
    },
}

PROFILE_IDS = list(PROFILES.keys())


def pick_random_profile() -> dict:
    """Randomly select a format profile."""
    return PROFILES[random.choice(PROFILE_IDS)]


def get_profile(profile_id: str) -> dict:
    """Get a specific profile by ID, or random if not found."""
    return PROFILES.get(profile_id, pick_random_profile())
