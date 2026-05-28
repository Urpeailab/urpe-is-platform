import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Key, Copy, Settings } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const REDAC_MODE = (process.env.REACT_APP_REDACCION_MODE || '').toLowerCase();
const IS_PRODUCTION = REDAC_MODE
  ? REDAC_MODE === 'production'
  : process.env.NODE_ENV === 'production';
const PROD_URL = process.env.REACT_APP_REDACCION_URL || 'https://redaccion.urpeintegralservices.co';
const LOCAL_URL = process.env.REACT_APP_REDACCION_URL_LOCAL || 'http://localhost:8002';

// Cache the iframe URL/token so we don't regenerate on every navigation.
// Panel JWTs last 24h; refresh at 20h to leave a safety margin.
const CACHE_KEY = 'redactora_iframe_cache_v1';
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000;

// Derive a stable fingerprint from the admin JWT (id/email/sub) so the cache
// is scoped to the CURRENT panel user. Without this, when admin A logs out
// and admin B logs in, B would reuse A's cached iframe URL (and therefore
// A's identity inside Redactora). Decodes only the payload (no signature
// verification — only used as a "did the user change?" marker).
const adminFingerprint = (adminToken) => {
  if (!adminToken) return '';
  try {
    const b64 = adminToken.split('.')[1] || '';
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    return String(payload.id || payload.sub || payload.email || payload.staff_id || '');
  } catch (_) {
    return '';
  }
};

const loadCache = (fp) => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache?.url || !cache?.stamp) return null;
    if (Date.now() - cache.stamp >= TOKEN_TTL_MS) return null;
    // Cache belongs to a different panel user → ignore it so we generate a
    // fresh token for the current user.
    if (fp && cache.fp && cache.fp !== fp) return null;
    return cache;
  } catch (_) {
    return null;
  }
};

const saveCache = (url, devUrl, fp) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ url, devUrl, fp: fp || '', stamp: Date.now() }));
  } catch (_) {}
};

/**
 * Mounted once at AdminLayout level so the Redactora iframe survives
 * route changes. Hidden via visibility/pointer-events when the user is
 * not on /admin/proposal. State inside Redactora (clients, in-flight
 * letter generation, chats) is preserved across navigation.
 */
export const PersistentRedactoraIframe = ({ visible }) => {
  const adminToken = localStorage.getItem('admin_token');
  const adminFp = adminFingerprint(adminToken);

  const [iframeUrl, setIframeUrl] = useState(() => loadCache(adminFp)?.url || '');
  const [devUrl, setDevUrl] = useState(() => {
    const cached = loadCache(adminFp);
    if (cached?.devUrl) return cached.devUrl;
    return localStorage.getItem('redac_dev_url') || LOCAL_URL;
  });
  const [loading, setLoading] = useState(!loadCache(adminFp));
  const [generating, setGenerating] = useState(false);

  const requestNewToken = useCallback(async (baseUrl) => {
    const { data } = await axios.post(
      `${API}/api/admin/generate-api-token`,
      { label: 'Redacciones AI', expiresInDays: 1 },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const url = `${baseUrl}?token=${data.token}`;
    setIframeUrl(url);
    saveCache(url, baseUrl, adminFp);
    return url;
  }, [adminToken, adminFp]);

  // If the panel user changes mid-session (different admin logs in without a
  // hard remount), the cached iframe URL no longer belongs to the current
  // user — drop it so the effect below regenerates a fresh token. Compares
  // against the cached fingerprint instead of forcing a regen on every mount.
  useEffect(() => {
    if (!iframeUrl) return;
    const cached = loadCache(adminFp);
    if (!cached) {
      setIframeUrl('');
      setLoading(true);
    }
  }, [adminFp, iframeUrl]);

  // Initial token generation — only fires if cache is missing/expired
  useEffect(() => {
    if (!adminToken) {
      setLoading(false);
      return;
    }
    if (iframeUrl) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = IS_PRODUCTION
          ? PROD_URL
          : (localStorage.getItem('redac_dev_url') || LOCAL_URL);
        await requestNewToken(base);
      } catch (e) {
        if (!cancelled) {
          console.error('PersistentRedactoraIframe: token generation failed', e);
          toast.error('Error al generar token de Redacciones AI');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminToken, iframeUrl, requestNewToken]);

  const regenerateToken = async () => {
    setGenerating(true);
    try {
      const base = IS_PRODUCTION ? PROD_URL : devUrl;
      await requestNewToken(base);
      toast.success('Token regenerado');
    } catch {
      toast.error('Error regenerando token');
    } finally {
      setGenerating(false);
    }
  };

  const loadDevUrl = () => {
    const base = devUrl || PROD_URL;
    localStorage.setItem('redac_dev_url', base);
    requestNewToken(base)
      .then(() => toast.success('URL cargada'))
      .catch(() => toast.error('Error cargando URL'));
  };

  // Wrapper covers the parent (which must be position: relative). When not
  // visible we hide+disable pointer events but keep the iframe mounted so
  // Redactora's internal state survives.
  const wrapperStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    visibility: visible ? 'visible' : 'hidden',
    pointerEvents: visible ? 'auto' : 'none',
    overflow: 'hidden',
  };

  if (!adminToken) return null;

  if (loading) {
    return (
      <div style={wrapperStyle} className="flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-600" />
          <p className="text-sm" style={{ color: '#6B7280' }}>Conectando con Redacciones AI...</p>
        </div>
      </div>
    );
  }

  if (!iframeUrl) {
    return (
      <div style={wrapperStyle} className="flex items-center justify-center bg-white">
        <p className="text-sm text-gray-500">No se pudo cargar Redacciones AI.</p>
      </div>
    );
  }

  if (IS_PRODUCTION) {
    return (
      <div style={wrapperStyle}>
        <iframe
          src={iframeUrl}
          className="w-full border-0"
          style={{ height: '100%' }}
          allow="clipboard-write"
          title="Redacciones AI"
        />
      </div>
    );
  }

  // Dev mode: config bar + iframe
  return (
    <div style={wrapperStyle} className="bg-white">
      <div className="p-4 space-y-3 h-full flex flex-col">
        <style>{`
          .redac-config input { color: #111827 !important; -webkit-text-fill-color: #111827 !important; background: #fff !important; }
          .redac-config input::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
        `}</style>

        <div className="redac-config bg-amber-50 border border-amber-200 rounded-lg p-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">DEVELOP — Redacciones AI</span>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-amber-700 mb-1 block">URL base</label>
              <Input value={devUrl} onChange={e => setDevUrl(e.target.value)} placeholder={PROD_URL} className="text-xs h-8" />
            </div>
            <Button size="sm" onClick={regenerateToken} disabled={generating}
              className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3 mr-1" />}
              Generar
            </Button>
            <Button size="sm" onClick={loadDevUrl} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs">
              Cargar
            </Button>
          </div>
          {iframeUrl && (
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs bg-white border border-amber-200 rounded px-2 py-1 flex-1 overflow-x-auto whitespace-nowrap" style={{ color: '#92400E' }}>
                {iframeUrl}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(iframeUrl); toast.success('URL copiada'); }}
                className="p-1 hover:bg-amber-100 rounded">
                <Copy className="h-3.5 w-3.5 text-amber-600" />
              </button>
            </div>
          )}
        </div>

        <iframe
          src={iframeUrl}
          className="w-full border-0 rounded-lg flex-1"
          allow="clipboard-write"
          title="Redacciones AI"
        />
      </div>
    </div>
  );
};

export default PersistentRedactoraIframe;
