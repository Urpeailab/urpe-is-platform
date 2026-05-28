"""
Letter Format Profiles — distinct writing voices and visual formats.

Each profile defines:
  - prompt_instructions: text injected into the generation prompt to vary WRITING STYLE
  - pdf_settings: parameters used by the PDF renderer
  - font_intent: resolved to a real font family by font_registry at render time

Additional pools (sign-offs, header variants, salt phrases) are exposed at
module level so the generation/rendering code can pick from them randomly to
make every letter look like it was authored and laid out by a different person.
"""
from __future__ import annotations

import random
from typing import Dict, List, Optional

from font_registry import get_font_family


# ---------------------------------------------------------------------------
# Sign-off pool (closing line above the signature). Mapped to profile mood —
# each profile lists which sign-offs feel natural for its voice; the generator
# picks one at random within the compatible set.
# ---------------------------------------------------------------------------

SIGN_OFFS = {
    "formal": [
        "Sincerely,",
        "Respectfully submitted,",
        "Most respectfully,",
        "Faithfully yours,",
        "With sincere regards,",
        "Yours truly,",
    ],
    "professional": [
        "Sincerely,",
        "Best regards,",
        "Kind regards,",
        "With kind regards,",
        "Warm regards,",
        "Cordially,",
    ],
    "academic": [
        "Sincerely,",
        "Respectfully,",
        "With collegial regards,",
        "Yours faithfully,",
        "With sincere respect,",
    ],
    "warm": [
        "Sincerely,",
        "Warmly,",
        "With warm regards,",
        "With sincere appreciation,",
        "With great respect,",
    ],
    "executive": [
        "Best regards,",
        "Sincerely,",
        "Cordially,",
        "Regards,",
    ],
}


# ---------------------------------------------------------------------------
# Header / letterhead layout variants. The renderer picks one at random when
# composing the top of the page so two letters from the same signer don't
# look identical.
# ---------------------------------------------------------------------------

HEADER_VARIANTS = [
    "letterhead_centered",   # name & org centered at top, address line, then date
    "letterhead_left",       # everything left-aligned
    "minimal_date_right",    # only the date in top-right corner
    "memo_block",            # FROM/TO/DATE/RE block
    "with_rule",             # name centered, horizontal rule, date right
]


# ---------------------------------------------------------------------------
# Date format variants
# ---------------------------------------------------------------------------

DATE_FORMATS = [
    "%B %d, %Y",        # May 26, 2026
    "%d %B %Y",         # 26 May 2026
    "%B %-d, %Y" if hasattr(__import__("datetime").date(2020, 1, 1), "strftime") else "%B %d, %Y",
    "%m/%d/%Y",         # 5/26/2026
]


# ---------------------------------------------------------------------------
# "Style salt" — short, semantically-neutral phrases mixed into the prompt to
# force the LLM out of its cached groove. Two consecutive calls with the
# same input but different salts produce visibly different prose.
# ---------------------------------------------------------------------------

STYLE_SALTS = [
    "Use writing-style variant #{n}.",
    "Adopt prose pattern {n}.",
    "Render this in author-voice {n}.",
    "Apply phrasing register {n}.",
    "Generate with stylistic signature {n}.",
]


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

PROFILES: Dict[str, dict] = {
    "classic_legal": {
        "id": "classic_legal",
        "name": "Clásico Legal",
        "font_intent": "classic_serif",
        "sign_off_mood": "formal",
        "pdf": {
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
- Natural prose: contractions are acceptable in narrative passages ("I've", "doesn't") but never inside formal legal conclusions.
- Include a perjury certification: "I certify under penalty of perjury under 28 U.S.C. § 1746 that the foregoing is true and correct to the best of my knowledge."
- Signature block: full professional credentials under the signature line, formatted as a formal deposition block.
"""
    },

    "modern_professional": {
        "id": "modern_professional",
        "name": "Moderno Profesional",
        "font_intent": "modern_sans",
        "sign_off_mood": "professional",
        "pdf": {
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
  Example opening: "It is without reservation that I recommend [Candidate Name] for an EB-2 National Interest Waiver. In my [X] years leading [field] initiatives at [organization], I've encountered few professionals whose work has the scope and practical impact that [Candidate]'s does."
- Use a mix of paragraphs and selective bullet points (max 3 bullets per section) for key facts.
- Section titles are descriptive and action-oriented (e.g., "Why This Work Is Transforming [Field] in the United States").
- Paragraphs are focused (3-5 sentences) — no padding.
- Vary sentence length deliberately: short punchy statements followed by substantive elaboration.
- Natural contractions are encouraged ("I've", "we're", "doesn't") — write like a senior professional speaking, not like a textbook.
- Close with a forward-looking statement about what the U.S. stands to gain — not just a summary.
- Signature: name, title, email — minimal and clean.
"""
    },

    "academic_institutional": {
        "id": "academic_institutional",
        "name": "Académico Institucional",
        "font_intent": "elegant_serif",
        "sign_off_mood": "academic",
        "pdf": {
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
- Light contractions are acceptable in transitional sentences but the dominant register stays scholarly.
- Close in the tradition of peer review: a clear, reasoned recommendation supported by the weight of evidence presented.
"""
    },

    "executive_brief": {
        "id": "executive_brief",
        "name": "Ejecutivo Conciso",
        "font_intent": "humanist_sans",
        "sign_off_mood": "executive",
        "pdf": {
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
  Example opening: "I'm writing to provide my unqualified support for the EB-2 NIW petition of [Candidate Name]. The case is straightforward: [Candidate]'s work addresses a documented gap in [field] that directly impacts the U.S. economy, and no credentialed substitute exists."
- Sections begin with a bold declarative headline-style header (e.g., "The U.S. Cannot Afford to Delay This Work").
- Write with urgency and specificity. Use numbers. Use timeframes. Use comparative benchmarks.
- Contractions throughout — this is how senior executives actually write internal memos.
- No filler sentences. If a sentence does not add a new fact or argument, cut it.
- Use a single bullet list of 3-4 items per section at most — only for impact statements or key qualifications.
- Close with a single, direct sentence recommendation that requires no interpretation.
"""
    },

    "official_government": {
        "id": "official_government",
        "name": "Oficial Gubernamental",
        "font_intent": "classic_serif",
        "sign_off_mood": "formal",
        "pdf": {
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
- Avoid contractions in this voice — it stays formal throughout.
- Include explicit references to the USCIS standard for national interest ("serves the national interest to a substantially greater degree than would an available U.S. worker possessing exceptional ability").
- Close with an availability statement and full formal contact block.
"""
    },

    "narrative_storyteller": {
        "id": "narrative_storyteller",
        "name": "Narrativo Testimonial",
        "font_intent": "humanist_serif",
        "sign_off_mood": "warm",
        "pdf": {
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
  Example: "When I first reviewed the technical documentation submitted with this petition, what struck me wasn't the methodology's elegance — it was its implications. The United States has [X million] people facing [specific problem]. I've studied this field for [X] years and I can state with confidence that [Candidate Name] has developed something genuinely rare."
- Section titles are evocative and conversational (e.g., "What the Numbers Actually Mean", "Why I Changed My Assessment After Reviewing the Data").
- Write in first person with emotional intelligence — the expert is moved by the magnitude of the problem and the elegance of the solution.
- Natural contractions and conversational rhythm are essential to the voice — write like a thoughtful person speaking from experience.
- Use rhetorical questions sparingly to engage the reader and anticipate objections.
- Transitions between sections should feel organic, not mechanical.
- Close with a personal, committed endorsement — the expert is willing to stake their professional reputation on this assessment.
"""
    },

    "technical_specialist": {
        "id": "technical_specialist",
        "name": "Especialista Técnico",
        "font_intent": "modern_sans",
        "sign_off_mood": "professional",
        "pdf": {
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
- Section titles are technically precise (e.g., "Methodological Innovation: Why Existing Frameworks Fall Short").
- Use domain-specific terminology confidently and correctly — do NOT over-explain to a lay audience.
- Quantify everything: improvement percentages, scale of impact, comparison to prior-art baselines.
- Use numbered lists for technical enumeration (components of a methodology, phases of a process, evidence hierarchy).
- Limited contractions, mostly in narrative connective tissue — analytical sections stay formal.
- Contrast the candidate's approach with existing alternatives — explain WHY theirs is superior on technical merits.
- Close with a technical verdict that a USCIS adjudicator can cite directly.
"""
    },

    "humanitarian_advocate": {
        "id": "humanitarian_advocate",
        "name": "Defensor Humanitario",
        "font_intent": "elegant_serif",
        "sign_off_mood": "warm",
        "pdf": {
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
- Use a three-part section structure: (1) The Human Reality of the Problem, (2) Why Existing Interventions Have Failed the Most Vulnerable, (3) Why This Candidate's Solution Reaches the Populations That Matter.
- Reference specific at-risk populations, underserved regions, or marginalized communities where relevant.
- Balance emotional resonance with concrete evidence — every moral claim must be backed by data.
- Conversational contractions humanize the voice — "we've", "haven't", "it's" — without weakening the argument.
- Use language of equity, access, and structural change without being polemical.
- Paragraphs build from the individual to the systemic — personal → community → national scale.
- Close with an appeal to the adjudicator's role in shaping national outcomes: "The approval of this petition isn't merely an immigration decision — it is an investment in the communities that have waited longest for solutions like this one."
"""
    },
}

PROFILE_IDS: List[str] = list(PROFILES.keys())


# ---------------------------------------------------------------------------
# Profile selection
# ---------------------------------------------------------------------------

# Suggested profile per signer-credential keyword cluster. Used by the 60/40
# weighted picker: 60% of the time we pick the suggested profile, 40% of the
# time we pick at random across ALL profiles so two letters from the same
# signer don't look identical.
_CREDENTIAL_KEYWORDS = [
    (("government", "agency", "policy", "regulator", "ministry", "secretary"), "official_government"),
    (("professor", "research", "academic", "phd", "scholar", "tenure", "university"), "academic_institutional"),
    (("medical", "physician", "health", "clinical", "hospital", "doctor", "md"), "humanitarian_advocate"),
    (("attorney", "lawyer", "counsel", "esq", "legal"), "classic_legal"),
    (("ngo", "nonprofit", "foundation", "humanitarian", "social"), "humanitarian_advocate"),
    (("engineer", "technical", "developer", "architect", "scientist", "stem"), "technical_specialist"),
    (("ceo", "cto", "cfo", "coo", "vp ", "chief ", "president", "founder", "executive"), "executive_brief"),
]


def _suggest_profile_for_signer(signer_blob: str) -> str:
    """Return the suggested profile id given a free-text blob of signer info
    (title + organization + credentials). Defaults to narrative_storyteller."""
    s = (signer_blob or "").lower()
    for keywords, profile_id in _CREDENTIAL_KEYWORDS:
        if any(k in s for k in keywords):
            return profile_id
    return "narrative_storyteller"


def pick_profile_for_signer(signer_blob: str = "", *,
                            random_ratio: float = 0.4,
                            seed: Optional[int] = None) -> dict:
    """
    Weighted profile picker. With probability (1 - random_ratio) returns the
    profile suggested by the signer's credentials; with probability
    random_ratio returns any profile at random. This ensures variety even
    when the same signer is used twice.

    Pass `seed` for reproducible tests.
    """
    rng = random.Random(seed) if seed is not None else random
    if rng.random() < random_ratio:
        return PROFILES[rng.choice(PROFILE_IDS)]
    return PROFILES[_suggest_profile_for_signer(signer_blob)]


def pick_random_profile() -> dict:
    """Pick a fully random profile, ignoring signer info. Useful for the
    self-petition (first-person) flow where there is no third-party signer."""
    return PROFILES[random.choice(PROFILE_IDS)]


def get_profile(profile_id: str) -> dict:
    """Look up a specific profile by id, falling back to random if unknown."""
    return PROFILES.get(profile_id, pick_random_profile())


# ---------------------------------------------------------------------------
# Helpers for the generation / rendering code
# ---------------------------------------------------------------------------

def resolve_fonts(profile: dict) -> Dict[str, str]:
    """
    Resolve the profile's `font_intent` to actual font family member names
    via font_registry. Returns dict with keys 'regular', 'bold', 'italic'.

    Falls back to the legacy `font_body`/`font_bold`/`font_italic` keys if
    no `font_intent` is set (kept for backward compatibility with any
    pre-existing custom profiles).
    """
    intent = profile.get("font_intent")
    if intent:
        return get_font_family(intent)
    # Legacy fallback
    pdf = profile.get("pdf", {})
    return {
        "regular": pdf.get("font_body", "Times-Roman"),
        "bold": pdf.get("font_bold", "Times-Bold"),
        "italic": pdf.get("font_italic", "Times-Italic"),
    }


def pick_sign_off(profile: dict, seed: Optional[int] = None) -> str:
    """Return a sign-off line compatible with the profile's mood."""
    rng = random.Random(seed) if seed is not None else random
    mood = profile.get("sign_off_mood", "formal")
    options = SIGN_OFFS.get(mood, SIGN_OFFS["formal"])
    return rng.choice(options)


def pick_header_variant(seed: Optional[int] = None) -> str:
    """Return one of HEADER_VARIANTS at random."""
    rng = random.Random(seed) if seed is not None else random
    return rng.choice(HEADER_VARIANTS)


def pick_date_format(seed: Optional[int] = None) -> str:
    """Return a strftime format string."""
    rng = random.Random(seed) if seed is not None else random
    return rng.choice(DATE_FORMATS)


def make_style_salt(seed: Optional[int] = None) -> str:
    """
    Build a short 'style salt' phrase to inject near the top of a generation
    prompt. The phrase carries no semantic meaning but breaks LLM caching
    so identical inputs produce visibly different prose.
    """
    rng = random.Random(seed) if seed is not None else random
    template = rng.choice(STYLE_SALTS)
    return template.format(n=rng.randint(10, 99))


def pick_temperature(seed: Optional[int] = None,
                     low: float = 0.55, high: float = 0.80) -> float:
    """
    Return a temperature in [low, high]. Replaces the previous fixed 0.35
    so two runs of the same input visibly diverge.
    """
    rng = random.Random(seed) if seed is not None else random
    return round(rng.uniform(low, high), 2)


__all__ = [
    "PROFILES", "PROFILE_IDS",
    "SIGN_OFFS", "HEADER_VARIANTS", "DATE_FORMATS", "STYLE_SALTS",
    "pick_profile_for_signer", "pick_random_profile", "get_profile",
    "resolve_fonts", "pick_sign_off", "pick_header_variant",
    "pick_date_format", "make_style_salt", "pick_temperature",
]
