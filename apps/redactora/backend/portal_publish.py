"""
portal_publish — vista pública de cliente para documentos NIW.

Genera el HTML "editorial elite" que el cliente ve a través de un link público
(/p/{slug}?token=...). Adaptado del generador original (niw_gen_publish.py de
dirección) para:

  - Leer las secciones directamente del NIW en la BD (no de un DOCX/Google Doc).
  - Servirse desde el mismo backend FastAPI (rutas relativas, sin Vercel ni
    PORTAL_API_URL externo).
  - Reflejar la máquina de estados de rondas: el botón "Comentar" / "Solicitar
    cambios" se deshabilita cuando ya no se admiten más comentarios (ronda 2
    cerrada o documento aprobado).

La lógica de rondas, los endpoints públicos y el agente de corrección viven
en server.py (Fases 2-3). Este módulo solo arma la estructura y el HTML.
"""

from __future__ import annotations

import hashlib
import html
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional


# ============================================================
# Identidad de publicación: slug + token
# ============================================================

def make_slug(client_name: str) -> str:
    """Slug legible + sufijo aleatorio corto para unicidad."""
    base = re.sub(r'[^a-z0-9]+', '-', (client_name or 'cliente').lower()).strip('-')[:32]
    base = base or 'cliente'
    return f"{base}-{secrets.token_hex(3)}"


def make_token() -> str:
    """Token secreto para autorizar el acceso a la publicación."""
    return secrets.token_urlsafe(24)


def make_fingerprint(client_email: str, version) -> str:
    seed = f'{client_email}-{version}-{datetime.now(timezone.utc).strftime("%Y%m%d")}'
    return hashlib.sha256(seed.encode()).hexdigest()[:8].upper()


# ============================================================
# NIW → estructura de secciones para render
# ============================================================

def section_slug(title: str, number) -> str:
    """Slug determinístico para una sección del NIW.

    Es contrato compartido: el visor lo emite en el HTML como `section_id`,
    el cliente lo manda de vuelta en `POST /api/portal/{slug}/comment`,
    y el agente de corrección (Fase 3) lo usa para localizar la sección
    correspondiente en `niw.sections`. Si cambias este algoritmo se rompen
    los comentarios ya guardados con el slug antiguo.
    """
    s = re.sub(r'[^a-z0-9]+', '-', (title or '').lower()).strip('-')[:50]
    return s or f'seccion-{number}'


# Alias retro-compatible: código previo del propio módulo usa _section_slug.
_section_slug = section_slug


def _content_to_paragraphs(content: str) -> List[str]:
    """
    Convierte el contenido de una sección NIW (HTML o texto plano) en una lista
    de párrafos de texto plano listos para escapar y envolver en <p>.
    """
    if not content:
        return []
    text = content
    # Si trae HTML, quita tags de bloque por saltos y limpia el resto.
    if '<' in text and '>' in text:
        text = re.sub(r'(?i)</(p|div|h[1-6]|li)>', '\n\n', text)
        text = re.sub(r'(?i)<br\s*/?>', '\n', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = html.unescape(text)
    # Divide en párrafos por líneas en blanco.
    parts = re.split(r'\n\s*\n', text)
    out = []
    for p in parts:
        p = p.strip()
        if p:
            out.append(p)
    return out


def niw_to_sections(niw_doc: dict, lang: str) -> List[dict]:
    """
    Construye [{id, title, body_paragraphs}] desde las secciones del NIW para
    el idioma pedido. Cae a 'content' si no hay content_en/content_es.
    """
    sections = niw_doc.get('sections') or []
    out = []
    for s in sorted(sections, key=lambda x: x.get('number', 0)):
        if lang == 'es':
            content = s.get('content_es') or s.get('content') or s.get('content_en') or ''
        else:
            content = s.get('content_en') or s.get('content') or s.get('content_es') or ''
        title = (s.get('title') or f"Sección {s.get('number', '')}").strip()
        out.append({
            'id': _section_slug(title, s.get('number', 0)),
            'number': s.get('number', 0),
            'title': title,
            'body_paragraphs': _content_to_paragraphs(content),
        })
    return out


# ============================================================
# Agrupación temática del TOC (Miller's law: 4-5 grupos)
# ============================================================

ROMAN_RE = re.compile(r'^(I{1,3}|IV|V|VI{0,3}|IX|X|XI{1,3}|XIV|XV|XVI{1,3})\.?\s*', re.IGNORECASE)

SECTION_GROUPS = [
    ('Resumen ejecutivo', '01', ['I', 'II']),
    ('Diagnóstico y contexto', '02', ['III', 'IV', 'V']),
    ('Solución propuesta', '03', ['VI', 'VII', 'VIII', 'IX', 'X']),
    ('Resultados y operación', '04', ['XI', 'XII', 'XIII', 'XIV']),
    ('Evidencia y anexos', '05', ['XV', 'XVI', 'XVII']),
]


def _categorize(title: str):
    m = ROMAN_RE.match((title or '').strip())
    if not m:
        return ('Documento', '00')
    roman = m.group(1).upper().rstrip('.').strip()
    for name, icon, romans in SECTION_GROUPS:
        if roman in romans:
            return (name, icon)
    return ('Documento', '00')


# ============================================================
# RENDER HTML
# ============================================================

def render_portal_html(
    *,
    sections_en: List[dict],
    sections_es: List[dict],
    client_name: str,
    client_email: str,
    case_id: str,
    version,
    attorney: str,
    fingerprint: str,
    slug: str,
    token: str,
    can_comment: bool,
    status_label: str,
    round_banner: str = "",
) -> str:
    """
    HTML editorial premium para la vista de cliente. `can_comment` controla si
    los botones de comentar/solicitar cambios están activos. `round_banner` es
    un aviso opcional (p. ej. "Ronda 1 aplicada — revisa los cambios").
    """
    today = datetime.now(timezone.utc).strftime('%B %d, %Y')

    # IDs únicos entre idiomas
    seen = {}
    for sec in sections_en + sections_es:
        base = sec['id']
        if base in seen:
            seen[base] += 1
            sec['id'] = f"{base}-{seen[base]}"
        else:
            seen[base] = 0

    def render_body(paras):
        if not paras:
            return '<p class="empty">Esta sección está en revisión.</p>'
        return '\n      '.join(f'<p>{html.escape(p)}</p>' for p in paras)

    def render_sections(sections, lang):
        parts = []
        for idx, sec in enumerate(sections):
            sid = sec['id']
            title = html.escape(sec['title'])
            body = render_body(sec['body_paragraphs'])
            collapsed = '' if idx < 2 else ' collapsed'
            toggle = '−' if idx < 2 else '+'
            # botón comentar: deshabilitado si la ronda está cerrada
            comment_disabled = '' if can_comment else ' disabled'
            comment_onclick = (
                f"openSectionComment('{sid}', '{lang}', '{title.replace(chr(39), chr(92)+chr(39))}')"
                if can_comment else ""
            )
            parts.append(f'''
  <section class="doc-section{collapsed}" id="sec-{lang}-{sid}" data-section-id="{sid}" data-lang="{lang}">
    <header class="section-header">
      <h2 class="section-title" onclick="toggleSection('sec-{lang}-{sid}')">
        <span class="section-num">{idx+1:02d}</span>
        <span class="section-text">{title}</span>
        <span class="section-toggle" aria-hidden="true">{toggle}</span>
      </h2>
      <button class="comment-btn"{comment_disabled} onclick="{comment_onclick}" aria-label="Comentar esta sección">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <span class="comment-btn-label">Comentar</span>
      </button>
    </header>
    <div class="section-body">
      {body}
    </div>
  </section>''')
        return '\n'.join(parts)

    def build_toc(sections, lang):
        groups = {}
        for i, s in enumerate(sections):
            name, icon = _categorize(s['title'])
            groups.setdefault(name, {'icon': icon, 'items': []})
            groups[name]['items'].append((i, s))
        ordered = [n for n, _, _ in SECTION_GROUPS] + ['Documento']
        parts = []
        for name in ordered:
            if name not in groups:
                continue
            data = groups[name]
            items = '\n'.join(
                f'        <li><a href="#sec-{lang}-{s["id"]}" class="toc-link" data-target="sec-{lang}-{s["id"]}">'
                f'<span class="toc-num">{i+1:02d}</span><span class="toc-title-text">{html.escape(s["title"])}</span></a></li>'
                for i, s in data['items']
            )
            parts.append(f'''      <li class="toc-group">
        <div class="toc-group-header"><span class="toc-group-icon">{data["icon"]}</span><span class="toc-group-name">{html.escape(name)}</span></div>
        <ul class="toc-group-items">
{items}
        </ul>
      </li>''')
        return '\n'.join(parts)

    toc_en = build_toc(sections_en, 'en')
    toc_es = build_toc(sections_es, 'es') if sections_es else ''
    sections_html_en = render_sections(sections_en, 'en')
    sections_html_es = render_sections(sections_es, 'es') if sections_es else ''

    lang_switcher = ''
    es_block = ''
    if sections_es:
        lang_switcher = '''
        <div class="lang-switcher">
          <button id="btn-lang-en" class="lang-btn active" onclick="setLang('en')">English</button>
          <button id="btn-lang-es" class="lang-btn" onclick="setLang('es')">Español</button>
        </div>'''
        es_block = f'<div id="lang-content-es" class="lang-content" style="display:none;">{sections_html_es}</div>'

    case_line = ''
    if case_id:
        case_line = f'<span class="meta-item"><span class="meta-label">Caso</span><span class="meta-value">{html.escape(case_id)}</span></span>'

    banner_html = ''
    if round_banner:
        banner_html = f'<div class="round-banner">{html.escape(round_banner)}</div>'

    # Botón "Solicitar cambios" deshabilitado si no se admiten comentarios
    req_changes_attr = '' if can_comment else ' disabled'
    req_changes_onclick = "openGlobalMod()" if can_comment else ""

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>URPE IS · {html.escape(client_name)} · EB-2 NIW · v{version}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --navy-900:#0a1f3d; --navy-800:#0b2855; --navy-700:#143a73; --navy-100:#d8e2f4; --navy-50:#eef3ff;
  --gold-600:#b89455; --gold-500:#d4a960; --gold-400:#e7c87a; --gold-50:#fff8e6;
  --ink:#1a2540; --ink-soft:#2b3a5c; --ink-mute:#6b7a99;
  --paper:#fafbfd; --paper-warm:#f7f5ef; --rule:#d8e2f4;
  --shadow-sm:0 1px 2px rgba(15,30,70,.06); --shadow-md:0 4px 16px rgba(15,30,70,.08); --shadow-lg:0 12px 40px rgba(15,30,70,.12);
}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:90px}}
body{{margin:0;background:var(--paper);color:var(--ink);font-family:'EB Garamond','Times New Roman',Georgia,serif;font-size:17px;line-height:1.7;-webkit-font-smoothing:antialiased}}
.scroll-progress{{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--gold-500),var(--gold-400));z-index:999;width:0%;transition:width .1s ease-out}}
.topbar{{position:sticky;top:0;z-index:100;background:var(--navy-900);color:#fff;border-bottom:3px solid var(--gold-500);box-shadow:var(--shadow-md)}}
.topbar-inner{{max-width:1280px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;font-family:'Inter',sans-serif}}
.brand{{display:flex;align-items:center;gap:14px;text-decoration:none;color:#fff}}
.brand-mark{{width:38px;height:38px;background:linear-gradient(135deg,var(--gold-500),var(--gold-400));border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--navy-900);font-weight:800;font-size:14px}}
.brand-name{{font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}}
.brand-sub{{font-size:11px;color:var(--navy-100);letter-spacing:.5px}}
.topbar-meta{{font-size:12px;color:var(--navy-100);font-family:'Inter',sans-serif}}
.topbar-meta strong{{color:#fff;font-weight:600}}
.hero{{background:linear-gradient(180deg,#fff 0%,var(--paper-warm) 100%);border-bottom:1px solid var(--rule)}}
.hero-inner{{max-width:1280px;margin:0 auto;padding:48px 24px 36px}}
.eyebrow{{font-family:'Inter',sans-serif;font-size:12px;font-weight:700;letter-spacing:2.5px;color:var(--gold-600);text-transform:uppercase;margin-bottom:12px}}
.hero-title{{font-family:'EB Garamond',serif;font-size:44px;line-height:1.15;font-weight:600;color:var(--navy-900);margin:0 0 8px;letter-spacing:-.5px}}
.hero-sub{{font-size:19px;color:var(--ink-soft);font-style:italic;margin:0 0 24px}}
.hero-meta{{display:flex;flex-wrap:wrap;gap:24px;border-top:1px solid var(--rule);padding-top:20px;margin-top:24px;font-family:'Inter',sans-serif}}
.meta-item{{display:flex;flex-direction:column;gap:2px}}
.meta-label{{font-size:11px;font-weight:600;letter-spacing:1px;color:var(--ink-mute);text-transform:uppercase}}
.meta-value{{font-size:14px;color:var(--ink);font-weight:500}}
.status-badge{{display:inline-block;padding:4px 10px;background:var(--gold-50);color:var(--gold-600);font-size:11px;font-weight:700;text-transform:uppercase;border-radius:999px;border:1px solid var(--gold-400)}}
.round-banner{{max-width:1280px;margin:16px auto 0;padding:12px 20px;background:var(--navy-50);border:1px solid var(--navy-100);border-left:4px solid var(--gold-500);border-radius:8px;font-family:'Inter',sans-serif;font-size:14px;color:var(--navy-800)}}
.layout{{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:280px 1fr;gap:48px;padding:32px 24px}}
.sidebar{{position:sticky;top:80px;height:calc(100vh - 100px);overflow-y:auto;border-right:1px solid var(--rule);padding-right:16px;font-family:'Inter',sans-serif}}
.toc-title{{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--ink-mute);text-transform:uppercase;margin:0 0 16px}}
.toc-list{{list-style:none;padding:0;margin:0}}
.toc-group{{margin-bottom:18px}}
.toc-group-header{{display:flex;align-items:center;gap:8px;padding:8px 4px 6px;border-bottom:1px solid var(--rule);margin-bottom:6px}}
.toc-group-icon{{font-size:10px;font-weight:700;color:var(--gold-600);background:var(--gold-50);padding:3px 7px;border-radius:4px;border:1px solid var(--gold-400);font-variant-numeric:tabular-nums}}
.toc-group-name{{font-size:11px;font-weight:700;letter-spacing:1px;color:var(--navy-800);text-transform:uppercase}}
.toc-group-items{{list-style:none;padding:0;margin:0 0 0 4px}}
.toc-group-items li{{margin-bottom:1px}}
.toc-link{{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;min-height:36px;border-radius:6px;color:var(--ink-soft);text-decoration:none;font-size:13px;line-height:1.45;border-left:2px solid transparent;transition:background .15s,color .15s}}
.toc-link:hover{{background:var(--navy-50);color:var(--navy-800)}}
.toc-link.active{{background:var(--navy-50);color:var(--navy-800);font-weight:600;border-left-color:var(--gold-500)}}
.toc-title-text{{flex:1}}
.toc-num{{font-size:11px;color:var(--gold-600);font-weight:700;font-variant-numeric:tabular-nums;min-width:22px;padding-top:1px}}
.lang-switcher{{display:flex;gap:4px;padding:4px;background:var(--navy-50);border-radius:8px;margin-bottom:20px}}
.lang-btn{{flex:1;padding:8px 12px;background:transparent;border:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--ink-mute);border-radius:6px;font-family:'Inter',sans-serif;transition:all .15s}}
.lang-btn.active{{background:#fff;color:var(--navy-800);box-shadow:var(--shadow-sm)}}
.main{{min-width:0}}
.doc-section{{margin-bottom:28px;background:#fff;border:1px solid var(--rule);border-radius:10px;overflow:hidden;box-shadow:var(--shadow-sm);transition:box-shadow .2s}}
.doc-section:hover{{box-shadow:var(--shadow-md)}}
.section-header{{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 28px;background:linear-gradient(180deg,#fff 0%,#fafbfd 100%);border-bottom:1px solid var(--rule)}}
.section-title{{display:flex;align-items:baseline;gap:14px;margin:0;cursor:pointer;font-family:'EB Garamond',serif;font-size:22px;font-weight:600;color:var(--navy-900);flex:1;letter-spacing:-.2px}}
.section-num{{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;color:var(--gold-600);background:var(--gold-50);padding:4px 8px;border-radius:4px;border:1px solid var(--gold-400)}}
.section-text{{flex:1}}
.section-toggle{{font-family:'Inter',sans-serif;font-size:18px;color:var(--ink-mute);width:28px;text-align:center;font-weight:300}}
.comment-btn{{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;min-height:40px;min-width:110px;background:#fff;color:var(--navy-800);border:1.5px solid var(--rule);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;justify-content:center}}
.comment-btn:hover{{background:var(--navy-50);border-color:var(--navy-700);color:var(--navy-900);transform:translateY(-1px)}}
.comment-btn:disabled{{opacity:.4;cursor:not-allowed;transform:none}}
@media (max-width:600px){{.comment-btn-label{{display:none}}.comment-btn{{min-width:44px;padding:10px}}}}
.section-body{{padding:28px 36px 32px;font-family:'EB Garamond',serif;font-size:17px;line-height:1.75;color:var(--ink)}}
.section-body p{{margin:0 0 14px;text-align:justify;hyphens:auto}}
.section-body p:last-child{{margin-bottom:0}}
.section-body .empty{{color:var(--ink-mute);font-style:italic;text-align:center}}
.doc-section.collapsed .section-body{{display:none}}
.doc-section.collapsed .section-toggle{{transform:rotate(45deg);display:inline-block}}
.actionbar{{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.98);backdrop-filter:blur(10px);border-top:1px solid var(--rule);box-shadow:0 -4px 24px rgba(15,30,70,.08);z-index:50;padding:14px 24px;font-family:'Inter',sans-serif}}
.actionbar-inner{{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}}
.actionbar-left{{display:flex;align-items:center;gap:16px;font-size:13px;color:var(--ink-mute)}}
.actionbar-left strong{{color:var(--navy-800);font-weight:600}}
.actionbar-right{{display:flex;gap:10px}}
.btn{{display:inline-flex;align-items:center;gap:10px;padding:14px 24px;min-height:48px;border-radius:10px;border:1.5px solid transparent;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}}
.btn-primary{{background:var(--gold-500);color:var(--navy-900);box-shadow:0 2px 8px rgba(184,148,85,.3);font-weight:700}}
.btn-primary:hover{{background:var(--gold-600);color:#fff;transform:translateY(-1px)}}
.btn-secondary{{background:#fff;color:var(--navy-800);border-color:var(--navy-700)}}
.btn-secondary:hover{{background:var(--navy-50);border-color:var(--navy-900);color:var(--navy-900)}}
.btn-tertiary{{background:transparent;color:var(--ink-soft);border-color:var(--rule)}}
.btn-tertiary:hover{{background:#fafbfd;color:var(--navy-800)}}
.btn:disabled{{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}}
.modal-overlay{{position:fixed;inset:0;background:rgba(10,31,61,.6);display:none;align-items:center;justify-content:center;z-index:200;padding:20px;backdrop-filter:blur(4px)}}
.modal-overlay.open{{display:flex}}
.modal{{background:#fff;border-radius:12px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);font-family:'Inter',sans-serif}}
.modal-header{{padding:24px 28px 16px;border-bottom:1px solid var(--rule)}}
.modal-title{{margin:0;font-size:20px;font-weight:600;color:var(--navy-900);font-family:'EB Garamond',serif}}
.modal-sub{{margin:6px 0 0;font-size:13px;color:var(--ink-mute)}}
.modal-body{{padding:22px 28px}}
.modal-body textarea{{width:100%;min-height:160px;padding:14px;border:1px solid var(--rule);border-radius:8px;font-family:'Inter',sans-serif;font-size:14px;color:var(--ink);background:#fafbfd;resize:vertical;line-height:1.6}}
.modal-body textarea:focus{{outline:none;border-color:var(--navy-700);background:#fff}}
.modal-helper{{margin-top:10px;font-size:12px;color:var(--ink-mute);line-height:1.5}}
.modal-footer{{padding:16px 28px 24px;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--rule);background:#fafbfd;border-radius:0 0 12px 12px}}
.status-msg{{margin:14px 0 0;padding:10px 14px;border-radius:6px;font-size:13px;display:none}}
.status-msg.success{{background:#e6f4ea;color:#1e4d2b;border:1px solid #a8d4b6;display:block}}
.status-msg.error{{background:#fce8e6;color:#8c2620;border:1px solid #e6a5a1;display:block}}
.watermark{{position:fixed;bottom:80px;right:24px;font-family:'Inter',sans-serif;font-size:9px;color:var(--ink-mute);background:rgba(255,255,255,.7);padding:3px 7px;border-radius:4px;border:1px solid var(--rule);pointer-events:none;z-index:40;user-select:none;letter-spacing:1px}}
@media (max-width:900px){{.watermark{{bottom:140px}}}}
@media print{{.topbar,.sidebar,.actionbar,.comment-btn,.watermark,.scroll-progress{{display:none!important}}.layout{{grid-template-columns:1fr;padding:0}}.doc-section{{break-inside:avoid;box-shadow:none;border:none}}body{{font-size:12pt}}}}
@media (max-width:900px){{.layout{{grid-template-columns:1fr;padding:16px;gap:0}}.sidebar{{position:relative;top:0;height:auto;max-height:0;overflow:hidden;border-right:none;border-bottom:1px solid var(--rule);padding:0;transition:max-height .3s}}.sidebar.open{{max-height:60vh;padding:16px 0 24px}}.hero-title{{font-size:28px}}.section-header{{padding:16px 18px;flex-wrap:wrap}}.section-title{{font-size:18px}}.section-body{{padding:18px 20px 24px;font-size:16px}}.actionbar-inner{{flex-direction:column;gap:10px;align-items:stretch}}.actionbar-right{{justify-content:stretch}}.actionbar-right .btn{{flex:1;justify-content:center;padding:12px}}body{{padding-bottom:160px}}.topbar-meta{{display:none}}}}
@media (min-width:901px){{body{{padding-bottom:80px}}}}
.toc-toggle{{display:none}}
@media (max-width:900px){{.toc-toggle{{display:block;margin:0 16px;padding:10px 14px;background:var(--navy-50);color:var(--navy-800);border:1px solid var(--rule);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;width:calc(100% - 32px);text-align:left}}}}
</style>
</head>
<body>
<div class="scroll-progress" id="scrollProgress"></div>
<nav class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-mark">UIS</div>
      <div><div class="brand-name">URPE Integral Services</div><div class="brand-sub">Immigration Law · Atlanta, GA</div></div>
    </div>
    <div class="topbar-meta">Borrador · Versión <strong>{version}</strong> · {today}</div>
  </div>
</nav>
<section class="hero">
  <div class="hero-inner">
    <div class="eyebrow">EB-2 National Interest Waiver · Petition Draft</div>
    <h1 class="hero-title">{html.escape(client_name)}</h1>
    <p class="hero-sub">Documento listo para tu revisión y comentarios.</p>
    <div class="hero-meta">
      {case_line}
      <span class="meta-item"><span class="meta-label">Owner</span><span class="meta-value">{html.escape(attorney)}</span></span>
      <span class="meta-item"><span class="meta-label">Entregado</span><span class="meta-value">{today}</span></span>
      <span class="meta-item"><span class="meta-label">Estado</span><span class="meta-value"><span class="status-badge">{html.escape(status_label)}</span></span></span>
    </div>
  </div>
  {banner_html}
</section>
<button class="toc-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰ Tabla de contenido</button>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    {lang_switcher}
    <div class="toc-title">Contenido</div>
    <ul class="toc-list" id="toc-en">
{toc_en}
    </ul>
    {('<ul class="toc-list" id="toc-es" style="display:none;">' + toc_es + '</ul>') if toc_es else ''}
  </aside>
  <main class="main">
    <div id="lang-content-en" class="lang-content">
      {sections_html_en}
    </div>
    {es_block}
  </main>
</div>
<div class="actionbar">
  <div class="actionbar-inner">
    <div class="actionbar-left"><span><strong>{html.escape(client_name)}</strong> · {html.escape(client_email)} · v{version}</span></div>
    <div class="actionbar-right">
      <button class="btn btn-tertiary" onclick="downloadPdf()" aria-label="Descargar PDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar PDF
      </button>
      <button class="btn btn-secondary" id="btn-request-changes"{req_changes_attr} onclick="{req_changes_onclick}" aria-label="Solicitar cambios">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Solicitar cambios
      </button>
      <button class="btn btn-primary" onclick="approveDraft()" aria-label="Aprobar borrador">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Aprobar borrador
      </button>
    </div>
  </div>
</div>
<div class="watermark" title="Confidencial · {html.escape(client_email)}">{fingerprint}</div>

<div class="modal-overlay" id="modal-section">
  <div class="modal">
    <div class="modal-header"><h3 class="modal-title">Comentar sección</h3><p class="modal-sub" id="modal-section-title"></p></div>
    <div class="modal-body">
      <textarea id="modal-section-text" placeholder="Describe qué quieres cambiar, agregar o eliminar en esta sección. Sé específico."></textarea>
      <p class="modal-helper">Tu comentario llega a {html.escape(attorney)}. Las correcciones se aplican automáticamente; vuelve a abrir este link en ~1 hora para ver los cambios.</p>
      <div id="modal-section-status" class="status-msg"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-section')">Cancelar</button>
      <button class="btn btn-primary" id="btn-submit-section" onclick="submitSectionComment()">Enviar comentario</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-global">
  <div class="modal">
    <div class="modal-header"><h3 class="modal-title">Solicitar cambios al documento</h3><p class="modal-sub">Describe todos los cambios que quieres en el borrador.</p></div>
    <div class="modal-body">
      <textarea id="modal-global-text" placeholder="Ejemplo: en el resumen ejecutivo mencionar la patente; en la sección VII agregar Tennessee al alcance..."></textarea>
      <p class="modal-helper">El equipo aplica las correcciones automáticamente. Vuelve a abrir este link en ~1 hora para ver la nueva versión.</p>
      <div id="modal-global-status" class="status-msg"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-global')">Cancelar</button>
      <button class="btn btn-primary" id="btn-submit-global" onclick="submitGlobalMod()">Enviar solicitud</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-approve">
  <div class="modal">
    <div class="modal-header"><h3 class="modal-title">Aprobar borrador final</h3><p class="modal-sub">¿Confirmas que esta versión está lista?</p></div>
    <div class="modal-body">
      <p style="margin:0 0 10px;color:var(--ink);font-family:'Inter',sans-serif;font-size:14px;">Al aprobar:</p>
      <ul style="font-family:'Inter',sans-serif;font-size:13px;color:var(--ink-soft);line-height:1.7;">
        <li>El equipo URPE IS procede a generar el PDF final para USCIS.</li>
        <li>Se cierra la fase de comentarios.</li>
      </ul>
      <div id="modal-approve-status" class="status-msg"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-tertiary" onclick="closeModal('modal-approve')">No, esperar</button>
      <button class="btn btn-primary" id="btn-confirm-approve" onclick="confirmApprove()">Sí, aprobar</button>
    </div>
  </div>
</div>
<script>
window.PORTAL_SLUG = {slug!r};
window.PORTAL_TOKEN = {token!r};
window.PORTAL_BASE = window.location.origin;
let currentSectionId = null, currentSectionLang = null;
function setLang(l){{
  document.getElementById('lang-content-en').style.display = l==='en'?'block':'none';
  var es=document.getElementById('lang-content-es'); if(es) es.style.display=l==='es'?'block':'none';
  var te=document.getElementById('toc-en'), ts=document.getElementById('toc-es');
  if(te) te.style.display=l==='en'?'block':'none'; if(ts) ts.style.display=l==='es'?'block':'none';
  document.getElementById('btn-lang-en').classList.toggle('active',l==='en');
  var eb=document.getElementById('btn-lang-es'); if(eb) eb.classList.toggle('active',l==='es');
}}
function toggleSection(el){{ if(typeof el==='string') el=document.getElementById(el); if(el) el.classList.toggle('collapsed'); }}
function openModal(id){{ document.getElementById(id).classList.add('open'); }}
function closeModal(id){{ document.getElementById(id).classList.remove('open'); ['modal-section-status','modal-global-status','modal-approve-status'].forEach(function(s){{var e=document.getElementById(s); if(e){{e.className='status-msg'; e.textContent='';}}}}); }}
function openSectionComment(sid,lang,title){{ currentSectionId=sid; currentSectionLang=lang; document.getElementById('modal-section-title').textContent=title; document.getElementById('modal-section-text').value=''; var b=document.getElementById('btn-submit-section'); b.disabled=false; b.textContent='Enviar comentario'; openModal('modal-section'); setTimeout(function(){{document.getElementById('modal-section-text').focus();}},100); }}
function openGlobalMod(){{ document.getElementById('modal-global-text').value=''; var b=document.getElementById('btn-submit-global'); b.disabled=false; b.textContent='Enviar solicitud'; openModal('modal-global'); setTimeout(function(){{document.getElementById('modal-global-text').focus();}},100); }}
function approveDraft(){{ openModal('modal-approve'); }}
function api(path){{ return window.PORTAL_BASE + '/api/portal/' + window.PORTAL_SLUG + path + '?token=' + encodeURIComponent(window.PORTAL_TOKEN); }}
async function submitSectionComment(){{
  var text=document.getElementById('modal-section-text').value.trim();
  var btn=document.getElementById('btn-submit-section'), msg=document.getElementById('modal-section-status');
  if(text.length<5){{ msg.className='status-msg error'; msg.textContent='Escribe al menos 5 caracteres.'; return; }}
  btn.disabled=true; btn.textContent='Enviando...';
  try{{
    var r=await fetch(api('/comment'),{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{kind:'section',section_id:currentSectionId,lang:currentSectionLang,comment:text}})}});
    var d=await r.json();
    if(r.ok){{ msg.className='status-msg success'; msg.textContent='Comentario recibido. Las correcciones se aplican automáticamente; vuelve a abrir este link en ~1 hora.'; btn.textContent='Enviado'; setTimeout(function(){{closeModal('modal-section');}},2800); }}
    else{{ msg.className='status-msg error'; msg.textContent='Error: '+(d.detail||d.error||'Reintenta.'); btn.disabled=false; btn.textContent='Enviar comentario'; }}
  }}catch(e){{ msg.className='status-msg error'; msg.textContent='Error de conexión. Reintenta.'; btn.disabled=false; btn.textContent='Enviar comentario'; }}
}}
async function submitGlobalMod(){{
  var text=document.getElementById('modal-global-text').value.trim();
  var btn=document.getElementById('btn-submit-global'), msg=document.getElementById('modal-global-status');
  if(text.length<10){{ msg.className='status-msg error'; msg.textContent='Escribe al menos 10 caracteres.'; return; }}
  btn.disabled=true; btn.textContent='Enviando...';
  try{{
    var r=await fetch(api('/comment'),{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{kind:'global',comment:text}})}});
    var d=await r.json();
    if(r.ok){{ msg.className='status-msg success'; msg.textContent='Solicitud recibida. Vuelve a abrir este link en ~1 hora para ver la nueva versión.'; btn.textContent='Enviado'; setTimeout(function(){{closeModal('modal-global');}},2800); }}
    else{{ msg.className='status-msg error'; msg.textContent='Error: '+(d.detail||d.error||'Reintenta.'); btn.disabled=false; btn.textContent='Enviar solicitud'; }}
  }}catch(e){{ msg.className='status-msg error'; msg.textContent='Error de conexión.'; btn.disabled=false; btn.textContent='Enviar solicitud'; }}
}}
async function confirmApprove(){{
  var btn=document.getElementById('btn-confirm-approve'), msg=document.getElementById('modal-approve-status');
  btn.disabled=true; btn.textContent='Confirmando...';
  try{{
    var r=await fetch(api('/approve'),{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{}})}});
    var d=await r.json();
    if(r.ok){{ msg.className='status-msg success'; msg.textContent='Borrador aprobado. El equipo URPE IS procede con la siguiente fase. ¡Gracias!'; btn.textContent='Aprobado'; setTimeout(function(){{closeModal('modal-approve'); location.reload();}},3000); }}
    else{{ msg.className='status-msg error'; msg.textContent='Error: '+(d.detail||d.error||'Reintenta.'); btn.disabled=false; btn.textContent='Sí, aprobar'; }}
  }}catch(e){{ msg.className='status-msg error'; msg.textContent='Error de conexión.'; btn.disabled=false; btn.textContent='Sí, aprobar'; }}
}}
function downloadPdf(){{ window.open(api('/download.pdf'),'_blank'); }}
window.addEventListener('scroll',function(){{ var h=document.documentElement; var p=(h.scrollTop/(h.scrollHeight-h.clientHeight))*100; document.getElementById('scrollProgress').style.width=p+'%'; }});
var tocLinks=document.querySelectorAll('.toc-link');
var obs=new IntersectionObserver(function(es){{ es.forEach(function(e){{ if(e.isIntersecting){{ var id=e.target.id; tocLinks.forEach(function(a){{a.classList.toggle('active',a.dataset.target===id);}}); }} }}); }},{{rootMargin:'-30% 0px -60% 0px'}});
document.querySelectorAll('.doc-section').forEach(function(s){{obs.observe(s);}});
document.querySelectorAll('.modal-overlay').forEach(function(o){{ o.addEventListener('click',function(e){{ if(e.target===o) closeModal(o.id); }}); }});
document.addEventListener('keydown',function(e){{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(function(o){{closeModal(o.id);}}); }});
</script>
</body>
</html>
'''


__all__ = [
    "make_slug", "make_token", "make_fingerprint",
    "section_slug",
    "niw_to_sections", "render_portal_html",
]
