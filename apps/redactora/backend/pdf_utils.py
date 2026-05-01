"""
Shared PDF utilities for all document routers.
"""
import re


def pdf_safe(text: str) -> str:
    """
    Replace Unicode characters that Helvetica/Times-Roman cannot render in ReportLab.
    Any unsupported glyph shows as a filled black square (■) in the PDF.
    Call this on EVERY string before passing it to a ReportLab Paragraph().
    """
    if not text:
        return text
    # Dashes / hyphens
    text = text.replace('\u2014', '-')   # em-dash  —
    text = text.replace('\u2013', '-')   # en-dash  –
    text = text.replace('\u2012', '-')   # figure dash
    text = text.replace('\u2011', '-')   # non-breaking hyphen
    text = text.replace('\u2010', '-')   # hyphen
    text = text.replace('\u2212', '-')   # minus sign
    text = text.replace('\u00ad', '-')   # soft hyphen
    text = text.replace('–', '-')
    text = text.replace('—', '-')
    text = text.replace('−', '-')
    text = text.replace('‐', '-')
    text = text.replace('‑', '-')
    # Smart / curly quotes → straight
    text = text.replace('\u2018', "'")
    text = text.replace('\u2019', "'")
    text = text.replace('\u201a', "'")
    text = text.replace('\u201b', "'")
    text = text.replace('\u201c', '"')
    text = text.replace('\u201d', '"')
    text = text.replace('\u201e', '"')
    text = text.replace('\u201f', '"')
    text = text.replace('\u00ab', '"')
    text = text.replace('\u00bb', '"')
    text = text.replace('\u2039', "'")
    text = text.replace('\u203a', "'")
    # Ellipsis
    text = text.replace('\u2026', '...')
    text = text.replace('…', '...')
    # Bullets / black squares → safe equivalents
    text = text.replace('\u2022', '*')
    text = text.replace('\u25cf', '*')
    text = text.replace('\u25a0', '')    # ■ black square → remove
    text = text.replace('\u25a1', '')    # □ white square → remove
    text = text.replace('\u25aa', '*')
    text = text.replace('\u25ab', '*')
    text = text.replace('\u25fe', '*')
    text = text.replace('\u25fd', '*')
    text = text.replace('■', '')
    text = text.replace('▪', '*')
    text = text.replace('▫', '*')
    # Checkmarks / crosses
    text = text.replace('\u2713', '[OK]')
    text = text.replace('\u2714', '[OK]')
    text = text.replace('\u2715', '[X]')
    text = text.replace('\u2717', '[X]')
    text = text.replace('\u2718', '[X]')
    # Spaces
    text = text.replace('\u00a0', ' ')   # non-breaking space
    text = text.replace('\u202f', ' ')   # narrow no-break space
    text = text.replace('\u2009', ' ')   # thin space
    text = text.replace('\u200b', '')    # zero-width space
    text = text.replace('\u200c', '')    # zero-width non-joiner
    text = text.replace('\u200d', '')    # zero-width joiner
    text = text.replace('\ufeff', '')    # BOM
    # Misc symbols
    text = text.replace('\u00b7', '-')   # · middle dot
    text = text.replace('\ufffd', '')    # replacement character
    text = text.replace('\u2665', '')    # ♥
    text = text.replace('\u2666', '')    # ♦
    # Arrows
    text = text.replace('\u2192', '->')
    text = text.replace('\u2190', '<-')
    text = text.replace('\u2191', '^')
    text = text.replace('\u2193', 'v')
    # Superscripts
    text = text.replace('\u00b2', '2')
    text = text.replace('\u00b3', '3')
    text = text.replace('\u00b9', '1')
    text = text.replace('\u2070', '0')
    # Unicode subscripts (U+2080–U+209C) — Helvetica/Times lack these glyphs,
    # so `CO₂` renders as `CO■`. Replace with ASCII digits/letters to avoid
    # the black-square fallback. Applies to chemistry (CO2, H2O), math (A1, x_i),
    # economics (β_0), etc. Minor aesthetic loss vs. an unreadable ■ placeholder.
    _subs_map = {
        '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
        '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
        '\u208a': '+', '\u208b': '-', '\u208c': '=', '\u208d': '(', '\u208e': ')',
        '\u2090': 'a', '\u2091': 'e', '\u2092': 'o', '\u2093': 'x', '\u2095': 'h',
        '\u2096': 'k', '\u2097': 'l', '\u2098': 'm', '\u2099': 'n', '\u209a': 'p',
        '\u209b': 's', '\u209c': 't',
    }
    for _k, _v in _subs_map.items():
        text = text.replace(_k, _v)
    # Additional superscripts (U+2074–U+207F) beyond ¹²³⁰
    _sups_map = {
        '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8',
        '\u2079': '9', '\u207a': '+', '\u207b': '-', '\u207c': '=',
        '\u207d': '(', '\u207e': ')', '\u207f': 'n',
    }
    for _k, _v in _sups_map.items():
        text = text.replace(_k, _v)
    # Block/symbol/emoji ranges
    text = re.sub(r'[\u2580-\u259f]', '', text)   # block elements
    text = re.sub(r'[\u2600-\u26ff]', '', text)   # misc symbols
    text = re.sub(r'[\u2700-\u27bf]', '', text)   # dingbats
    text = re.sub(r'[\ue000-\uf8ff]', '', text)   # private use area
    text = re.sub(r'[\U0001f300-\U0001f9ff]', '', text)  # emoticons
    text = re.sub(r'[\U0001fa00-\U0001faff]', '', text)  # extended symbols
    text = re.sub(r'[\u2300-\u23ff]', '', text)   # misc technical
    text = re.sub(r'[\u2190-\u21ff]', '', text)   # arrows range
    return text


def clean_latex(text: str) -> str:
    """
    Convert LaTeX math notation to readable ASCII text for PDF rendering.
    Called on plain-text content before it reaches ReportLab.
    """
    if not text:
        return text
    # \frac{numerator}{denominator} → (num / den)  — iterate for nested fracs
    for _ in range(8):
        text = re.sub(r'\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}', r'(\1 / \2)', text)
    # \sqrt{x} → sqrt(x)
    text = re.sub(r'\\sqrt\s*\{([^{}]*)\}', r'sqrt(\1)', text)
    # \text{word}, \textbf{word}, \textit{word} → word
    text = re.sub(r'\\text(?:bf|it|rm|sf|tt)?\s*\{([^{}]*)\}', r'\1', text)
    # subscripts: A_{max} → A_max
    text = re.sub(r'_\{([^{}]{1,30})\}', lambda m: '_' + m.group(1).replace(',', '').replace(' ', ''), text)
    # superscripts: e^{-kt} → e^(-kt)
    text = re.sub(r'\^\{([^{}]{1,30})\}', lambda m: '^(' + m.group(1) + ')', text)
    # remaining braces
    text = text.replace('{,}', ',').replace('{', '').replace('}', '')
    # Greek letters
    greek = {
        r'\alpha': 'alpha', r'\beta': 'beta', r'\gamma': 'gamma',
        r'\delta': 'delta', r'\epsilon': 'epsilon', r'\varepsilon': 'epsilon',
        r'\zeta': 'zeta', r'\eta': 'eta', r'\theta': 'theta',
        r'\lambda': 'lambda', r'\mu': 'mu', r'\nu': 'nu',
        r'\pi': 'pi', r'\rho': 'rho', r'\sigma': 'sigma',
        r'\tau': 'tau', r'\phi': 'phi', r'\chi': 'chi',
        r'\psi': 'psi', r'\omega': 'omega',
        r'\Gamma': 'Gamma', r'\Delta': 'Delta', r'\Theta': 'Theta',
        r'\Lambda': 'Lambda', r'\Pi': 'Pi', r'\Sigma': 'Sigma',
        r'\Phi': 'Phi', r'\Psi': 'Psi', r'\Omega': 'Omega',
    }
    for latex_cmd, plain in greek.items():
        text = text.replace(latex_cmd, plain)
    # Math operators / symbols
    replacements = [
        (r'\approx', '~='), (r'\times', 'x'), (r'\cdot', '*'),
        (r'\div', '/'), (r'\pm', '+/-'), (r'\mp', '-/+'),
        (r'\leq', '<='), (r'\geq', '>='), (r'\neq', '!='),
        (r'\ll', '<<'), (r'\gg', '>>'),
        (r'\Rightarrow', '=>'), (r'\rightarrow', '->'),
        (r'\Leftarrow', '<='), (r'\leftarrow', '<-'),
        (r'\leftrightarrow', '<->'), (r'\Leftrightarrow', '<=>'),
        (r'\infty', 'inf'), (r'\partial', 'd'),
        (r'\sum', 'SUM'), (r'\prod', 'PROD'), (r'\int', 'INT'),
        (r'\ln', 'ln'), (r'\log', 'log'), (r'\exp', 'exp'),
        (r'\max', 'max'), (r'\min', 'min'), (r'\lim', 'lim'),
        (r'\left', ''), (r'\right', ''), (r'\big', ''), (r'\Big', ''),
        (r'\mid', '|'), (r'\|', '||'),
        (r'\dots', '...'), (r'\ldots', '...'), (r'\cdots', '...'),
        (r'\quad', '  '), (r'\qquad', '    '),
        (r'\,', ' '), (r'\;', ' '), (r'\:', ' '), (r'\ ', ' '), (r'\!', ''),
    ]
    for latex_cmd, plain in replacements:
        text = text.replace(latex_cmd, plain)
    # Remove remaining backslash-commands: \word → word
    text = re.sub(r'\\([A-Za-z]+)', r'\1', text)
    # Clean double spaces
    text = re.sub(r'  +', ' ', text).strip()
    return text


def preprocess_markdown_latex(raw: str) -> str:
    """
    Pre-process a markdown/plain-text content string to:
    - Strip internal AI tags: [SM], [NI], [PR], [SBCS], [RR], [MM] etc.
    - Collapse multi-line \\[...\\] display equations into a single readable line
    - Convert inline \\(...\\) and $...$ math to clean text
    This should be applied BEFORE converting markdown to HTML.
    """
    # Strip internal prompt/section tags
    raw = re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)(?:\]\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI))*\]', '', raw)
    raw = re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)\]', '', raw)

    # Handle \\[ ... \\] (escaped backslashes from some LLMs storing \\[)
    raw = re.sub(r'\\\\\[\s*(.*?)\s*\\\\\]', lambda m: f'\n\n> **Equation:** {clean_latex(re.sub(chr(92)*2, chr(92), m.group(1).strip()))}\n\n', raw, flags=re.DOTALL)

    # Collapse multi-line \[...\] display blocks → one line, indented with >
    def collapse_display_eq(m):
        inner = m.group(1).strip()
        inner = re.sub(r'\s+', ' ', inner)
        return f'\n\n> **Equation:** {clean_latex(inner)}\n\n'
    raw = re.sub(r'\\\[\s*(.*?)\s*\\\]', collapse_display_eq, raw, flags=re.DOTALL)

    # Handle lone \[ ... \] where \[ and \] appear on their own lines
    # (sometimes blank lines exist between delimiter and content)
    raw = re.sub(r'^\\\[\s*$', 'LATEX_OPEN', raw, flags=re.MULTILINE)
    raw = re.sub(r'^\\\]\s*$', 'LATEX_CLOSE', raw, flags=re.MULTILINE)
    def collapse_open_close(m):
        inner = m.group(1).strip()
        inner = re.sub(r'\s+', ' ', inner)
        return f'\n\n> **Equation:** {clean_latex(inner)}\n\n'
    raw = re.sub(r'LATEX_OPEN\s*(.*?)\s*LATEX_CLOSE', collapse_open_close, raw, flags=re.DOTALL)
    # Cleanup any remaining lone markers
    raw = raw.replace('LATEX_OPEN', '').replace('LATEX_CLOSE', '')

    # Inline \(...\) → clean text
    raw = re.sub(r'\\\(\s*(.*?)\s*\\\)', lambda m: clean_latex(m.group(1)), raw)

    # Display $$...$$ → blockquote
    raw = re.sub(
        r'\$\$\s*(.*?)\s*\$\$',
        lambda m: f'\n\n> **Equation:** {clean_latex(m.group(1))}\n\n',
        raw, flags=re.DOTALL
    )
    # Inline $...$ → clean text
    raw = re.sub(r'\$([^$\n]{1,200}?)\$', lambda m: clean_latex(m.group(1)), raw)

    # ── Collapse blank lines INSIDE markdown-table blocks ──────────────────
    # Many LLMs emit tables like:
    #   | col1 | col2 |
    #
    #   |------|------|
    #
    #   | val1 | val2 |
    # Markdown's `tables` extension requires NO blank lines inside the table;
    # otherwise it renders pipes as plain text. We remove blank lines that sit
    # between two pipe-starting rows so the table parses correctly.
    lines = raw.split('\n')
    out = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        is_pipe_row = cur.lstrip().startswith('|') and cur.rstrip().endswith('|')
        if is_pipe_row:
            out.append(cur)
            j = i + 1
            # Skip blank lines followed by another pipe row; collapse them.
            while j < len(lines) and lines[j].strip() == '':
                # Peek ahead: if the next non-blank line is a pipe row, drop blanks
                k = j
                while k < len(lines) and lines[k].strip() == '':
                    k += 1
                if k < len(lines) and lines[k].lstrip().startswith('|'):
                    j = k
                    break
                else:
                    # Not a continuation, keep the blank and exit
                    break
            i = j
            continue
        out.append(cur)
        i += 1
    raw = '\n'.join(out)

    return raw


def preprocess_html_latex(html: str) -> str:
    """
    Clean LaTeX notation that remains inside HTML content.
    Handles \\[...\\], \\(...\\), and $...$ that survived markdown→HTML conversion,
    including the case where \\[ and \\] ended up in separate <p> tags.
    Also strips internal AI tags.
    """
    # Strip AI tags
    html = re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)(?:\]\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI))*\]', '', html)
    html = re.sub(r'\[(?:SM|NI|PR|SBCS|RR|MM|EB|EC|EI)\]', '', html)

    # ── KEY FIX: un-wrap \[ and \] that got trapped inside HTML block tags ──
    # After markdown conversion, \[ on its own line becomes <p>\[</p>
    # We strip the surrounding HTML tags so our regex can find the pair.
    html = re.sub(r'<(?:p|li|div|span)[^>]*>\s*\\\[\s*</(?:p|li|div|span)>', r'\\[', html)
    html = re.sub(r'<(?:p|li|div|span)[^>]*>\s*\\\]\s*</(?:p|li|div|span)>', r'\\]', html)
    # Also handle \\[ (double backslash variant)
    html = re.sub(r'<(?:p|li|div|span)[^>]*>\s*\\\\\[\s*</(?:p|li|div|span)>', r'\\[', html)
    html = re.sub(r'<(?:p|li|div|span)[^>]*>\s*\\\\\]\s*</(?:p|li|div|span)>', r'\\]', html)

    # Now apply standard \[...\] detection across (possibly HTML-tagged) content
    def replace_display(m):
        inner = m.group(1)
        # Strip any HTML tags that crept in between \[ and \]
        inner = re.sub(r'<[^>]+>', ' ', inner)
        inner = re.sub(r'\s+', ' ', inner).strip()
        return f'<blockquote><em>Equation: {clean_latex(inner)}</em></blockquote>'
    html = re.sub(r'\\\[\s*(.*?)\s*\\\]', replace_display, html, flags=re.DOTALL)

    # Inline \(...\) → clean text
    html = re.sub(r'\\\(\s*(.*?)\s*\\\)', lambda m: clean_latex(m.group(1)), html)

    # Display $$ ... $$ → blockquote
    html = re.sub(
        r'\$\$\s*(.*?)\s*\$\$',
        lambda m: f'<blockquote><em>Equation: {clean_latex(m.group(1))}</em></blockquote>',
        html, flags=re.DOTALL
    )
    # Inline $...$
    html = re.sub(r'\$([^$\n<]{1,200}?)\$', lambda m: clean_latex(m.group(1)), html)

    # ── Catch-all: any remaining LaTeX commands in plain text ──────────────
    # If after all the above there are still \text{}, \frac{}, etc. in the HTML
    # text nodes, apply clean_latex to lines that contain backslash commands.
    def clean_remaining_latex_in_line(m):
        txt = m.group(0)
        if '\\' in txt and re.search(r'\\[a-zA-Z]', txt):
            return clean_latex(txt)
        return txt
    # Apply to text outside tags
    html = re.sub(r'(?<=>)[^<]+(?=<)', clean_remaining_latex_in_line, html)
    # Also apply to text at start/end (outside all tags)
    parts = re.split(r'(<[^>]+>)', html)
    cleaned_parts = []
    for part in parts:
        if part.startswith('<'):
            cleaned_parts.append(part)
        elif '\\' in part and re.search(r'\\[a-zA-Z\[]', part):
            cleaned_parts.append(clean_latex(part))
        else:
            cleaned_parts.append(part)
    html = ''.join(cleaned_parts)

    return html

    """
    Replace Unicode characters that Helvetica/Times-Roman cannot render in ReportLab.
    Any unsupported glyph shows as a filled black square (■) in the PDF.
    Call this on EVERY string before passing it to a ReportLab Paragraph().
    """
    if not text:
        return text
    # Dashes / hyphens
    text = text.replace('\u2014', '-')   # em-dash  —
    text = text.replace('\u2013', '-')   # en-dash  –
    text = text.replace('\u2012', '-')   # figure dash
    text = text.replace('\u2011', '-')   # non-breaking hyphen
    text = text.replace('\u2010', '-')   # hyphen
    text = text.replace('\u2212', '-')   # minus sign
    text = text.replace('\u00ad', '-')   # soft hyphen
    text = text.replace('–', '-')
    text = text.replace('—', '-')
    text = text.replace('−', '-')
    text = text.replace('‐', '-')
    text = text.replace('‑', '-')
    # Smart / curly quotes → straight
    text = text.replace('\u2018', "'")
    text = text.replace('\u2019', "'")
    text = text.replace('\u201a', "'")
    text = text.replace('\u201b', "'")
    text = text.replace('\u201c', '"')
    text = text.replace('\u201d', '"')
    text = text.replace('\u201e', '"')
    text = text.replace('\u201f', '"')
    text = text.replace('\u00ab', '"')
    text = text.replace('\u00bb', '"')
    text = text.replace('\u2039', "'")
    text = text.replace('\u203a', "'")
    # Ellipsis
    text = text.replace('\u2026', '...')
    text = text.replace('…', '...')
    # Bullets / black squares → safe equivalents
    text = text.replace('\u2022', '*')
    text = text.replace('\u25cf', '*')
    text = text.replace('\u25a0', '')    # ■ black square → remove
    text = text.replace('\u25a1', '')    # □ white square → remove
    text = text.replace('\u25aa', '*')
    text = text.replace('\u25ab', '*')
    text = text.replace('\u25fe', '*')
    text = text.replace('\u25fd', '*')
    text = text.replace('■', '')
    text = text.replace('▪', '*')
    text = text.replace('▫', '*')
    # Checkmarks / crosses
    text = text.replace('\u2713', '[OK]')
    text = text.replace('\u2714', '[OK]')
    text = text.replace('\u2715', '[X]')
    text = text.replace('\u2717', '[X]')
    text = text.replace('\u2718', '[X]')
    # Spaces
    text = text.replace('\u00a0', ' ')   # non-breaking space
    text = text.replace('\u202f', ' ')   # narrow no-break space
    text = text.replace('\u2009', ' ')   # thin space
    text = text.replace('\u200b', '')    # zero-width space
    text = text.replace('\u200c', '')    # zero-width non-joiner
    text = text.replace('\u200d', '')    # zero-width joiner
    text = text.replace('\ufeff', '')    # BOM
    # Misc symbols
    text = text.replace('\u00b7', '-')   # · middle dot
    text = text.replace('\ufffd', '')    # replacement character
    text = text.replace('\u2665', '')    # ♥
    text = text.replace('\u2666', '')    # ♦
    # Arrows
    text = text.replace('\u2192', '->')
    text = text.replace('\u2190', '<-')
    text = text.replace('\u2191', '^')
    text = text.replace('\u2193', 'v')
    # Superscripts
    text = text.replace('\u00b2', '2')
    text = text.replace('\u00b3', '3')
    text = text.replace('\u00b9', '1')
    text = text.replace('\u2070', '0')
    # Block/symbol/emoji ranges
    text = re.sub(r'[\u2580-\u259f]', '', text)   # block elements
    text = re.sub(r'[\u2600-\u26ff]', '', text)   # misc symbols
    text = re.sub(r'[\u2700-\u27bf]', '', text)   # dingbats
    text = re.sub(r'[\ue000-\uf8ff]', '', text)   # private use area
    text = re.sub(r'[\U0001f300-\U0001f9ff]', '', text)  # emoticons
    text = re.sub(r'[\U0001fa00-\U0001faff]', '', text)  # extended symbols
    text = re.sub(r'[\u2300-\u23ff]', '', text)   # misc technical
    text = re.sub(r'[\u2190-\u21ff]', '', text)   # arrows range
    return text
