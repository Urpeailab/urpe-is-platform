"""
USCIS-Optimized Book Generation Prompts
Stronger, more professional prompts for immigration case books
"""

def get_cv_extraction_prompt(cv_text: str, book_title: str, book_orientation: str) -> str:
    """Extract key information from CV for USCIS book generation"""
    return f"""You are a CV analyzer for USCIS immigration cases. Extract key information from the provided CV/resume to use in book generation.

**CV/Resume Content:**
{cv_text}

**Book Title:** {book_title}
**Book Orientation:** {book_orientation}

---

## EXTRACTION REQUIREMENTS

Analyze the CV and extract the following in JSON format:

1. **author_name**: Full name of the person

2. **years_experience**: Calculate total years of professional experience in their main field

3. **specialization**: Identify their primary area of expertise (be specific, not generic)
   - Look for: job titles, skills, industry focus
   - Format as: "[Specific Skill/Domain] for [Target Market/Industry]"
   - Example: "Customer Service Excellence for LATAM Markets" NOT just "Customer Service"

4. **cv_summary**: Write a 2-3 paragraph professional summary highlighting:
   - Career progression
   - Key roles and responsibilities
   - Industries/sectors worked in
   - Notable skills and expertise areas

5. **achievements**: Extract 5-7 quantifiable achievements
   - Must include numbers/percentages when possible
   - Format: "Action + Result + Context"
   - Example: "Increased customer retention by 35% across 500+ accounts in LATAM region"

6. **companies**: List 3-5 most notable companies/organizations worked for
   - Prioritize: well-known brands, large companies, international orgs
   - Include company name only (no dates or positions)

7. **education**: List all degrees, diplomas, or formal education
   - Format: "Degree in Field, Institution"
   - Include relevant coursework if no formal degree

8. **certifications**: List all professional certifications, licenses, or specialized training
   - Include issuing organization
   - Prioritize industry-recognized certifications

9. **publications_speaking**: Extract any:
   - Publications (articles, papers, books)
   - Speaking engagements (conferences, webinars, workshops)
   - Teaching or training roles
   - Industry contributions (blog posts, thought leadership)

10. **target_audience_suggestion**: Based on the CV and book orientation, suggest the ideal target audience for this book

11. **unique_value_proposition**: What makes this author uniquely qualified to write about {book_orientation}?

---

## OUTPUT FORMAT

Provide the extraction in clean JSON:

```json
{{
  "author_name": "",
  "years_experience": 0,
  "specialization": "",
  "cv_summary": "",
  "achievements": [],
  "companies": [],
  "education": [],
  "certifications": [],
  "publications_speaking": [],
  "target_audience_suggestion": "",
  "unique_value_proposition": ""
}}
```

**IMPORTANT:**
- Be specific, not generic
- Quantify everything possible
- Focus on elements that demonstrate expertise for USCIS
- If information is missing, note it as "Not found in CV"
- Prioritize quality over quantity

Extract now."""


def get_uscis_chapter_prompt(
    chapter_number: int,
    num_chapters: int,
    author_name: str,
    cv_data: dict,
    book_title: str,
    genre: str,
    synopsis: str,
    writing_style: str,
    previous_chapters_content: str = "",
    target_audience: str = ""
) -> str:
    """Generate USCIS-optimized chapter generation prompt"""
    
    # Extract CV data
    years_experience = cv_data.get('years_experience', 'several')
    specialization = cv_data.get('specialization', 'their field')
    cv_summary = cv_data.get('cv_summary', 'experienced professional')
    achievements = cv_data.get('achievements', [])
    companies = cv_data.get('companies', [])
    education = cv_data.get('education', [])
    certifications = cv_data.get('certifications', [])
    publications_speaking = cv_data.get('publications_speaking', [])
    
    # Format lists as strings
    achievements_str = '\n- '.join([''] + achievements) if achievements else '- Not provided'
    companies_str = '\n- '.join([''] + companies) if companies else '- Not provided'
    education_str = '\n- '.join([''] + education) if education else '- Not provided'
    certifications_str = '\n- '.join([''] + certifications) if certifications else '- Not provided'
    publications_str = '\n- '.join([''] + publications_speaking) if publications_speaking else '- Not provided'
    
    # Determine chapter context
    chapter_context = ""
    if chapter_number == 1:
        chapter_context = "**This is the first chapter. Establish strong foundation and author credibility.**"
    else:
        chapter_context = f"""**PREVIOUSLY APPROVED CHAPTERS:**
{previous_chapters_content}

**Build upon these chapters. Do NOT repeat their content.**"""
    
    return f"""You are an expert book writer specializing in creating professional books for USCIS immigration cases. Your task is to write Chapter {chapter_number} of {num_chapters} for a book that demonstrates the author's extraordinary ability and expertise.

---

## 📋 AUTHOR INFORMATION (Extracted from CV)

**Author Name:** {author_name}

**Professional Background:**
{cv_summary}

**Key Credentials Identified:**
- Years of Experience: {years_experience}
- Specialization: {specialization}
- Notable Achievements:{achievements_str}
- Companies/Clients:{companies_str}
- Education:{education_str}
- Certifications:{certifications_str}
- Publications/Speaking:{publications_str}

---

## 📚 BOOK INFORMATION

**Title:** {book_title}

**Genre/Category:** {genre}

**Synopsis:** {synopsis}

**Target Audience:** {target_audience if target_audience else "Professionals in " + specialization}

**Number of Chapters:** {num_chapters}

**Writing Style:** {writing_style} (USCIS-optimized)

---

## 📖 CHAPTER CONTEXT

{chapter_context}

---

## 🎯 CRITICAL REQUIREMENTS FOR USCIS

### 1. DEMONSTRATE AUTHOR'S EXPERTISE
- Reference author's {years_experience} years of experience
- Mention specific achievements naturally
- Use first-person voice to share professional insights
- Show deep knowledge of {specialization}

### 2. INCLUDE DATA & EVIDENCE (MANDATORY)
**You MUST include at least 2-3 of the following per chapter:**
- Industry statistics relevant to the book topic
- Research findings or studies
- Case studies or examples from author's experience
- Quantifiable results from author's work
- Market data or trends

**Suggested data sources to reference:**
- Industry reports (relevant to {specialization})
- Academic research
- Professional organization data
- Author's own research/experience with specific numbers

### 3. PRESENT ORIGINAL FRAMEWORKS/METHODOLOGIES
Based on the author's background in {specialization}, create and name:
- At least 1 original framework, system, or methodology per chapter
- Give it a professional name (e.g., "The [Author's] [Concept] Framework")
- Explain how it was developed
- Show measurable outcomes of its application

### 4. ESTABLISH CREDIBILITY THROUGH CV ELEMENTS
Naturally weave in references to author's credentials when relevant.

**Example integration:**
"In my work with [company from CV], I observed that..."
"This approach, which I presented at [event from CV], has shown..."
"My experience in [field] revealed that..."

---

## 📏 LENGTH & STRUCTURE REQUIREMENTS

**CHAPTER LENGTH: 8,000 - 15,000 characters**
- Minimum: 8,000 characters (for substantive content)
- Optimal: 10,000-12,000 characters
- Maximum: 15,000 characters

**STRUCTURE:**
1. **Opening Hook** (500-800 chars)
   - Engaging scenario or question relevant to target audience
   - Establish chapter's relevance

2. **Author's Professional Insight** (1,500-2,500 chars)
   - First-person analysis from author's experience
   - Reference specific elements from background
   - Establish authority on the topic

3. **Data & Research** (1,000-2,000 chars)
   - Present 2-3 statistics or research findings **from publicly verifiable sources only** (BLS, Gartner, McKinsey, IDC, Deloitte, government agencies, etc.)
   - Name the source and year (e.g., "Gartner, 2024")
   - **NEVER** invent "In my analysis of N cases…" with a fabricated N — use real industry data or qualitative author observations
   - Connect data to the author's qualitative observations (not to fabricated metrics)

4. **Original Framework/Methodology** (2,000-3,000 chars)
   - Present a methodology the author has developed or championed based on their actual experience in {specialization}
   - Name it professionally (e.g., "The Customer-Centric Operations Model")
   - Explain the **principles** and the **signals of success** the author looks for — NOT fabricated quantitative results from unnamed engagements
   - If the CV lists a real case with measurable results, you MAY cite THAT; otherwise keep it qualitative

5. **Practical Application** (2,000-3,000 chars)
   - Use **real-world scenarios from the author's industry**, written in third person or as general patterns ("In multinational BPO operations, teams often encounter…")
   - If the CV has specific companies/clients in `Companies/Clients`, you MAY reference those BY EXACT NAME. Otherwise, **no invented company names, no fabricated case studies**.
   - Focus on actionable insights the author would share based on patterns observed across their career

6. **Deep Analysis** (1,500-2,500 chars)
   - Go beyond surface-level advice
   - Show critical thinking and expertise
   - Address common misconceptions or challenges

7. **Natural Transition** (300-500 chars)
   - Lead organically to next chapter
   - **NO conclusions, summaries, or "in conclusion" phrases**

---

## ✅ CONTENT QUALITY CHECKLIST

Each chapter MUST include:

- [ ] **Author's voice in first person** (minimum 3-4 instances)
  - "In my {years_experience} years..."
  - "Working with [company/client], I discovered..."
  - "My research showed..."

- [ ] **Minimum 2-3 data points** with context
  - Industry statistics
  - Research findings
  - Author's own quantifiable results

- [ ] **At least 1 original framework/methodology**
  - Professional name
  - Development story
  - Measurable results

- [ ] **References to credentials** (2-3 per chapter)
  - Experience and achievements
  - Work with notable companies/clients
  - Relevant education or certifications

- [ ] **Professional yet accessible tone**
  - Industry terminology used correctly
  - Complex concepts explained clearly
  - Maintains credibility throughout

- [ ] **No generic advice**
  - Everything backed by experience or data
  - Specific, not vague
  - Demonstrates deep expertise

---

## 🚫 STRICTLY FORBIDDEN

### 🛑 ABSOLUTE ZERO-HALLUCINATION RULE (CRITICAL — READ FIRST)
You are writing a book that will be submitted to USCIS. **Every specific fact about the author MUST come from the CV data provided above.** Violating this rule will invalidate the entire book for the immigration case.

**NEVER invent:**
- Companies, clients, or employers not listed in `Companies/Clients` above
- Projects, case studies, or engagements not listed in `Notable Achievements`
- Degrees, schools, or years not listed in `Education`
- Certifications not listed in `Certifications`
- Publications, talks, or media appearances not listed in `Publications/Speaking`
- Exact metrics ("I improved retention by 47%", "led a team of 23") unless that exact number appears in the CV
- Client testimonials or named case studies from unnamed sources
- Specific dates, contract values, or revenue figures not in the CV

**If you lack a specific example to illustrate a point:**
- ✅ Use a **generic industry scenario** written in third person: "In organizations facing this challenge, a common pattern is…"
- ✅ Cite **publicly available data** (BLS, Gartner, McKinsey, industry reports) with the source name.
- ✅ Keep the author's first-person voice but about **general observations** from their years of experience in the field, not specific engagements.
- ❌ Do NOT invent "Company X where I led Y project with Z% results" — this is fabricated evidence.

**When you DO reference the author's specific work:**
- Quote company names EXACTLY as they appear in `Companies/Clients` list — same spelling, same capitalization.
- Quote achievements EXACTLY as in `Notable Achievements` — do not embellish numbers.
- If the CV says "5+ years at Fortune 500 clients", do NOT upgrade to "over a decade at top-tier multinationals".

**USCIS standard of proof**: every fact stated about the author must be independently verifiable from the CV or publicly available sources. Any invented fact → entire book rejected.

---

### Other forbidden patterns:

1. **Generic statements without backing:**
   ❌ "Many people struggle with this"
   ✅ "In my {years_experience} years working in {specialization}, a recurring pattern is…" (grounded in author's actual experience)
   ✅ "Industry research from [public source] shows [X]% struggle with this"

2. **Unsubstantiated numeric claims:**
   ❌ "This approach has shown 47% success rate across 120 implementations" (if not in CV)
   ✅ "In my professional experience, this approach has consistently outperformed alternatives" (qualitative, no fake numbers)
   ✅ "Published research from [named source, year] reports [X]% effectiveness"

3. **Conclusions or summaries at chapter end:**
   ❌ "In conclusion, we've learned that..."
   ✅ End with substantive content that naturally leads to next topic

4. **Repetition of previous chapters:**
   - Build upon, don't repeat
   - Reference previous concepts briefly, then expand

5. **Overly academic or overly casual tone:**
   - Balance expertise with accessibility
   - Professional but engaging

---

## 🎨 HTML FORMATTING REQUIREMENTS

Use semantic HTML for professional presentation:

```html
<h2>Chapter {chapter_number}: [Professional, Engaging Title]</h2>

<p>[Opening hook paragraph]</p>

<h3>[First Major Section Title]</h3>

<p>[Content with author's insights...]</p>

<blockquote>
<strong>Key Insight:</strong> [Important statistic or finding]
</blockquote>

<p>[Analysis and explanation...]</p>

<h4>The [Framework Name]</h4>

<p>[Framework introduction...]</p>

<ul>
  <li><strong>Component 1:</strong> [Description]</li>
  <li><strong>Component 2:</strong> [Description]</li>
  <li><strong>Component 3:</strong> [Description]</li>
</ul>

<p>[Framework application and results...]</p>

<h3>[Second Major Section Title]</h3>

<p>[Continue with data, analysis, practical application...]</p>

<p>[Natural transition to next chapter - NO conclusion]</p>
```

**HTML Elements to Use:**
- `<h2>` - Chapter title only
- `<h3>` - Major sections (2-3 per chapter)
- `<h4>` - Subsections and framework names
- `<p>` - All paragraph content
- `<blockquote>` - Key statistics, quotes, or insights
- `<strong>` - Important terms and emphasis
- `<em>` - Subtle emphasis
- `<ul>` and `<li>` - Lists for frameworks, steps, components

---

## 💡 CHAPTER-SPECIFIC GUIDANCE

### If this is Chapter 1:
- Establish author's credibility immediately
- Reference most impressive credentials
- Set the stage for the book
- Create strong hook for target audience
- Introduce 1-2 key frameworks

### If this is a Middle Chapter:
- Build on concepts from previous chapters
- Introduce new framework/methodology
- Provide deeper analysis
- Include more data and case studies

### If this is the Final Chapter:
- Synthesize key frameworks from book
- Provide forward-looking insights
- Call to action
- **Still NO formal conclusion** - end with forward momentum

---

## 🎯 USCIS-SPECIFIC REQUIREMENTS

Remember: This book is evidence for a USCIS immigration petition.

**Every chapter must demonstrate:**

1. **Extraordinary Ability**
   - Deep expertise in {specialization}
   - Unique insights not commonly known
   - Advanced understanding

2. **Original Contribution**
   - Frameworks/methodologies developed by author
   - Novel approaches to problems
   - Thought leadership

3. **Significant Impact**
   - Quantifiable results from author's work
   - Professional achievements
   - Work with notable organizations

4. **Professional Recognition**
   - Credentials and certifications
   - Industry standing
   - Publications or speaking engagements

---

## 🎨 OUTPUT FORMAT

Provide ONLY the chapter content in clean HTML. Do not include explanations, notes, or meta-commentary. Start directly with the `<h2>` chapter title.

**Character count target: 10,000-12,000 characters (optimal for USCIS)**

---

## 🚀 BEGIN WRITING

Now write Chapter {chapter_number} following ALL requirements above.

Write the complete chapter now."""


def get_uscis_system_message(genre: str, specialization: str) -> str:
    """Get system message for USCIS-optimized generation"""
    return f"""You are an expert book writer specializing in creating professional books for USCIS immigration cases in the {genre} genre.

Your writing demonstrates:
- Deep expertise in {specialization}
- Evidence-based arguments using ONLY publicly verifiable sources (BLS, Gartner, McKinsey, IDC, government agencies) — NEVER fabricated numbers
- Qualitative frameworks grounded in the author's actual CV experience
- First-person professional insights that reference ONLY facts present in the provided CV data
- Professional yet accessible tone
- USCIS-appropriate credibility and authority

🛑 ABSOLUTE ZERO-HALLUCINATION RULE:
Every specific fact about the author (companies worked at, projects led, degrees held, years of tenure, metrics achieved, publications, certifications, team sizes, contract values) MUST come verbatim from the CV data provided. NEVER invent a company name, never invent a project name, never invent a percentage or metric. When the CV lacks a specific datapoint, use generic industry language grounded in public sources instead.

You ALWAYS follow character count requirements and NEVER include conclusions or summaries at chapter endings."""
