import React, { useState, useEffect } from 'react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Key, Loader2, Copy, Settings } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PROD_URL = process.env.REACT_APP_REDACCION_URL || 'https://redaccion.urpeintegralservices.co';
const LOCAL_URL = process.env.REACT_APP_REDACCION_URL_LOCAL || 'http://localhost:8002';

const ProposalPage = () => {
  const [iframeUrl, setIframeUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Dev-only state
  const [devUrl, setDevUrl] = useState('');
  const [devToken, setDevToken] = useState('');
  const [generating, setGenerating] = useState(false);

  const token = localStorage.getItem('admin_token');

  // On mount: auto-generate token and load iframe
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Generate a fresh token
        const { data } = await axios.post(`${API}/api/admin/generate-api-token`, {
          label: 'Redacciones AI',
          expiresInDays: 1,
        }, { headers: { Authorization: `Bearer ${token}` } });

        const apiToken = data.token;
        const baseUrl = IS_PRODUCTION
          ? PROD_URL
          : (localStorage.getItem('redac_dev_url') || LOCAL_URL);
        const url = `${baseUrl}?token=${apiToken}`;
        setIframeUrl(url);
        setDevToken(apiToken);
        setDevUrl(baseUrl);
      } catch (e) {
        console.error('Token generation error:', e);
        toast.error('Error al generar token');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const loadDevUrl = () => {
    const base = devUrl || PROD_URL;
    localStorage.setItem('redac_dev_url', base);
    const url = `${base}?token=${devToken}`;
    setIframeUrl(url);
    toast.success('URL cargada');
  };

  const regenerateToken = async () => {
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/generate-api-token`, {
        label: 'Redacciones AI',
        expiresInDays: 1,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDevToken(data.token);
      const base = devUrl || PROD_URL;
      setIframeUrl(`${base}?token=${data.token}`);
      toast.success('Token regenerado');
    } catch { toast.error('Error'); }
    finally { setGenerating(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-600" />
          <p className="text-sm" style={{ color: '#6B7280' }}>Conectando con Redacciones AI...</p>
        </div>
      </div>
    );
  }

  // Production: just the iframe, zero chrome
  if (IS_PRODUCTION) {
    return (
      <iframe
        key={iframeUrl}
        src={iframeUrl}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 70px)' }}
        allow="clipboard-write"
        title="Redacciones AI"
      />
    );
  }

  // Develop: config bar + iframe
  return (
    <div className="space-y-3 p-4">
      <style>{`
        .redac-config input { color: #111827 !important; -webkit-text-fill-color: #111827 !important; background: #fff !important; }
        .redac-config input::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
      `}</style>

      <div className="redac-config bg-amber-50 border border-amber-200 rounded-lg p-3">
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

      {iframeUrl ? (
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="w-full border-0 rounded-lg"
          style={{ height: 'calc(100vh - 220px)' }}
          allow="clipboard-write"
          title="Redacciones AI"
        />
      ) : (
        <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height: 'calc(100vh - 220px)', color: '#6B7280' }}>
          <p className="text-sm">Cargando...</p>
        </div>
      )}
    </div>
  );
};

export default ProposalPage;
