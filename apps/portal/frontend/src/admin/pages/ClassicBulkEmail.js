import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ChevronLeft, Send, Loader2, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  en_proceso: { label: 'En Proceso', color: '#3B82F6' },
  radicado: { label: 'Enviado', color: '#8B5CF6' },
  recibido_uscis: { label: 'Recibido USCIS', color: '#6366F1' },
  rfe_recibido: { label: 'RFE Recibido', color: '#F59E0B' },
  rfe_respondido: { label: 'RFE Respondido', color: '#D97706' },
  devuelto: { label: 'Devuelto', color: '#EF4444' },
  aprobado: { label: 'Aprobado', color: '#10B981' },
};

export default function ClassicBulkEmail() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (search) params.append('search', search);
      const { data } = await axios.get(`${API}/api/classic-cases/admin?${params}`, { headers });
      setCases(data.cases || []);
    } catch { toast.error('Error al cargar casos'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const withEmail = cases.filter(c => c.email);
    if (selectedIds.size === withEmail.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(withEmail.map(c => c.id)));
    }
  };

  const sendBulk = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Asunto y cuerpo son obligatorios'); return; }
    if (selectedIds.size === 0) { toast.error('Selecciona al menos un caso'); return; }

    setSending(true);
    try {
      const { data } = await axios.post(`${API}/api/classic-cases/admin/bulk-email`, {
        subject, body, caseIds: Array.from(selectedIds)
      }, { headers: { ...headers, 'Content-Type': 'application/json' } });
      setResult(data);
      toast.success(`${data.sent} emails enviados`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Error al enviar'); }
    finally { setSending(false); }
  };

  const withEmail = cases.filter(c => c.email);

  return (
    <div data-testid="classic-bulk-email" className="space-y-5">
      <style>{`
        .bulk-email input, .bulk-email textarea { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
        .bulk-email input::placeholder, .bulk-email textarea::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
      `}</style>
      <div className="bulk-email">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/classic-cases')} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
            <ChevronLeft className="h-4 w-4" />Volver
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Email Masivo - Gestion Clasica</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recipient Selection */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-bold text-sm" style={{ color: '#111827' }}>Seleccionar Destinatarios</h2>

              {/* Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="pl-9"
                  />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-gray-300 text-sm"
                  style={{ color: '#374151', background: '#fff' }}>
                  <option value="all">Todos los estados</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Select all */}
              <div className="flex items-center justify-between">
                <button onClick={selectAll} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  {selectedIds.size === withEmail.length && withEmail.length > 0 ? 'Deseleccionar todos' : `Seleccionar todos (${withEmail.length})`}
                </button>
                <Badge className="bg-indigo-100 text-indigo-700">{selectedIds.size} seleccionados</Badge>
              </div>

              {/* Case list */}
              <div className="max-h-96 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : withEmail.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">No hay casos con email</p>
                ) : (
                  withEmail.map(c => {
                    const isSelected = selectedIds.has(c.id);
                    const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.en_proceso;
                    return (
                      <div key={c.id}
                        onClick={() => toggleSelect(c.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'}`}>
                        <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-600' : 'border-2 border-gray-300'}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{c.name}</p>
                          <p className="text-xs truncate" style={{ color: '#6B7280' }}>{c.email}</p>
                        </div>
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: st.color }} title={st.label} />
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Compose Email */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-bold text-sm" style={{ color: '#111827' }}>Redactar Email</h2>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> para personalizar con el nombre del cliente</p>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Asunto *</label>
                <Input
                  value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Actualizacion importante - {nombre}"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Cuerpo del email *</label>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  rows={10}
                  placeholder="Hola {nombre},&#10;&#10;Queremos informarte que..."
                  className="w-full border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-indigo-400 resize-none"
                  style={{ color: '#374151', background: '#FAFAFA' }}
                />
              </div>

              {/* Preview */}
              {body && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>Vista previa:</p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm" style={{ color: '#374151' }}>
                    <p className="font-semibold mb-2">{subject.replace('{nombre}', 'Juan Perez')}</p>
                    <div className="whitespace-pre-wrap">{body.replace(/\{nombre\}/g, 'Juan Perez')}</div>
                  </div>
                </div>
              )}

              {/* Send */}
              <Button
                data-testid="send-bulk-email-btn"
                onClick={sendBulk}
                disabled={sending || !subject.trim() || !body.trim() || selectedIds.size === 0}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl h-11">
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Enviar a {selectedIds.size} destinatario(s)</>
                )}
              </Button>

              {/* Result */}
              {result && (
                <div className={`rounded-xl p-4 text-sm ${result.failed > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <p className="font-semibold" style={{ color: result.failed > 0 ? '#92400E' : '#065F46' }}>
                    {result.sent} enviados{result.failed > 0 ? `, ${result.failed} fallidos` : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
