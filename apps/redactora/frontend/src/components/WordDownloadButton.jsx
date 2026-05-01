import React, { useState } from 'react';
import { Button } from './ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

/**
 * Generic "Descargar Word EN" button.
 *
 * Shows next to the existing "Descargar PDF" buttons in every document
 * editor view. Hits the corresponding `/download-docx` endpoint, which
 * always returns the English version (per current product decision —
 * Spanish .docx variant can be added later).
 *
 * Why .docx?
 *   Users have asked for a Word version because uploading a PDF to
 *   Google Drive and converting to Google Docs destroys formatting.
 *   A native .docx, on the other hand, imports cleanly into Google
 *   Docs preserving headings, tables, lists, bold/italic.
 *
 * Props:
 *   - url: full URL to the /download-docx endpoint (caller adds the
 *     `?language=en` query param if needed; we add it for them when
 *     missing).
 *   - filename: optional override for the local filename (defaults to
 *     whatever the server's Content-Disposition header says).
 *   - label: optional override for the button label (defaults to
 *     "Descargar Word EN").
 *   - testId: optional data-testid; defaults to "download-docx-btn".
 *   - className: extra classes to append to the button.
 *   - children: optional alternate label content (e.g. a custom icon
 *     layout). When present, replaces both the default icon and label.
 */
export function WordDownloadButton({
  url,
  filename,
  label,
  testId = 'download-docx-btn',
  className = '',
  variant = 'outline',
  size = 'default',
  children,
}) {
  const [downloading, setDownloading] = useState(false);

  const handle = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!url || downloading) return;
    setDownloading(true);
    try {
      // Ensure the URL targets EN unless the caller already specified.
      const finalUrl = /[?&]language=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}language=en`;
      const token = localStorage.getItem('token');
      const response = await axios.get(finalUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = new Blob(
        [response.data],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      );

      // Pick filename from Content-Disposition or fall back to prop / default.
      let resolvedName = filename;
      if (!resolvedName) {
        const cd = response.headers['content-disposition'] || '';
        const m = /filename="?([^";]+)"?/i.exec(cd);
        resolvedName = m ? m[1] : 'document_EN.docx';
      }
      if (!/\.docx$/i.test(resolvedName)) resolvedName = `${resolvedName}.docx`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', resolvedName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success('Word descargado');
    } catch (err) {
      console.error('Word download failed:', err);
      const detail = err?.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data).slice(0, 200))
        : (err?.message || '');
      toast.error(`No se pudo descargar el Word${detail ? `: ${detail}` : ''}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      onClick={handle}
      disabled={downloading || !url}
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
      data-testid={testId}
      title="Descarga el documento en formato Word (.docx). Sube a Google Drive y abre con Google Docs sin perder el formato."
    >
      {children ? (
        children
      ) : downloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {label || 'Generando Word…'}
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          {label || 'Descargar Word EN'}
        </>
      )}
    </Button>
  );
}

export default WordDownloadButton;
