import React, { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * FindReplaceBlocks
 *
 * Detects "BUSCAR / REEMPLAZAR" patches inside an assistant chat message
 * (or its English equivalent "FIND / REPLACE") and renders an extra
 * action panel below the message body with a one-click copy button for
 * each side of every patch.
 *
 * The system prompt for Mónica explicitly asks the model to format
 * surgical document corrections as:
 *
 *     **BUSCAR:**
 *     ```
 *     <text>
 *     ```
 *
 *     **REEMPLAZAR:**
 *     ```
 *     <text>
 *     ```
 *
 * We parse that pattern (case-insensitive, accent-insensitive) and emit
 * a card per patch. The original Markdown rendering is unaffected — we
 * only add an extra UX layer below it.
 */
export function FindReplaceBlocks({ content }) {
  const patches = useMemo(() => extractPatches(content || ''), [content]);

  if (!patches.length) return null;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado al portapapeles`);
    } catch (e) {
      toast.error('No se pudo copiar (¿navegador sin permiso?)');
    }
  };

  return (
    <div
      data-testid="find-replace-panel"
      style={{
        marginTop: '14px',
        borderTop: '1px dashed #c7d2fe',
        paddingTop: '12px',
      }}
    >
      <div
        style={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#4338ca',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '10px',
        }}
      >
        🔧 Patches detectados — click para copiar
      </div>
      {patches.map((p, i) => (
        <div
          key={i}
          style={{
            marginBottom: '12px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px 12px',
          }}
          data-testid={`find-replace-block-${i}`}
        >
          {patches.length > 1 && (
            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', color: '#111827' }}>
              Patch #{i + 1}
            </div>
          )}
          <PatchSide
            label="BUSCAR"
            colorBg="#fef2f2"
            colorBorder="#fecaca"
            colorText="#991b1b"
            text={p.find}
            onCopy={() => copy(p.find, 'Texto a BUSCAR')}
            testId={`find-copy-${i}`}
          />
          <PatchSide
            label="REEMPLAZAR"
            colorBg="#ecfdf5"
            colorBorder="#bbf7d0"
            colorText="#065f46"
            text={p.replace}
            onCopy={() => copy(p.replace, 'Texto de REEMPLAZAR')}
            testId={`replace-copy-${i}`}
          />
          <button
            onClick={async () => {
              await copy(`BUSCAR:\n${p.find}\n\nREEMPLAZAR:\n${p.replace}`, 'Patch completo');
            }}
            data-testid={`patch-copy-both-${i}`}
            style={{
              marginTop: '6px',
              fontSize: '0.78rem',
              color: '#4338ca',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 600,
            }}
          >
            Copiar BUSCAR + REEMPLAZAR juntos →
          </button>
        </div>
      ))}
      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>
        Tip: en Word usa Ctrl+H, pega cada bloque en el campo correspondiente.
        En Google Docs usa Ctrl+Shift+H. Verifica el contexto antes de
        "Reemplazar todo" si el texto a buscar es corto.
      </div>
    </div>
  );
}

function PatchSide({ label, text, colorBg, colorBorder, colorText, onCopy, testId }) {
  const [copied, setCopied] = React.useState(false);
  const handle = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: colorText, letterSpacing: '0.04em' }}>
          {label}
        </span>
        <button
          onClick={handle}
          data-testid={testId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            border: '1px solid ' + colorBorder,
            color: colorText,
            borderRadius: '6px',
            fontSize: '0.7rem',
            padding: '3px 8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {copied ? (
            <>
              <Check size={12} /> ¡Copiado!
            </>
          ) : (
            <>
              <Copy size={12} /> Copiar
            </>
          )}
        </button>
      </div>
      <pre
        style={{
          background: colorBg,
          border: '1px solid ' + colorBorder,
          borderRadius: '6px',
          padding: '8px 10px',
          margin: 0,
          fontSize: '0.82rem',
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '260px',
          overflowY: 'auto',
        }}
      >
        {text}
      </pre>
    </div>
  );
}

// ─── parser ────────────────────────────────────────────────────────────────
// Robust against:
//   - "BUSCAR:" / "FIND:" labels (with or without **markdown bold**)
//   - Optional accents ("buscar" or "BUSCAR")
//   - Code-fenced text  ```...```  OR  indented blocks  OR  plain text
//   - Multiple patches in a row (numbered "1. BUSCAR ... 2. BUSCAR ...")
function extractPatches(text) {
  if (!text || typeof text !== 'string') return [];

  const labels = '(?:buscar|find|encontrar|search)';
  const replaceLabels = '(?:reemplazar|reemplazo|replace|cambiar|sustituir)';

  // We look for: <findLabel>: <body1> <replaceLabel>: <body2>
  // Body is captured between the labels. Code fences ``` are stripped post-hoc.
  const pattern = new RegExp(
    String.raw`(?:^|\n)\s*\**\s*${labels}\s*:?\s*\**\s*\n?` +
      String.raw`([\s\S]*?)` +
      String.raw`\n\s*\**\s*${replaceLabels}\s*:?\s*\**\s*\n?` +
      String.raw`([\s\S]*?)` +
      // Stop body2 at: another BUSCAR (next patch), end-of-message, or two
      // newlines followed by a non-fence/non-quote line.
      String.raw`(?=\n\s*\**\s*${labels}\s*:|\n\s*\d+\.\s*\**\s*${labels}|\n{2,}\S|$)`,
    'gi',
  );

  const stripFences = (s) => {
    let t = (s || '').trim();
    // Remove an outer code fence
    t = t.replace(/^```[a-zA-Z0-9]*\s*\n/, '').replace(/\n```\s*$/, '');
    // Or a single-line fence
    t = t.replace(/^```/, '').replace(/```$/, '');
    return t.trim();
  };

  const out = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const find = stripFences(m[1]);
    const replace = stripFences(m[2]);
    if (find && replace) out.push({ find, replace });
  }
  return out;
}

export default FindReplaceBlocks;
