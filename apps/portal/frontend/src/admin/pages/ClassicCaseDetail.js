import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import {
  ChevronLeft, ChevronDown, ChevronUp, Loader2, ExternalLink, Edit, Trash2,
  Check, Clock, Plus, Send, FileText, Copy, MessageSquare, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  en_proceso: { label: 'En Proceso', bg: '#3B82F6', text: '#fff' },
  radicado: { label: 'Enviado', bg: '#8B5CF6', text: '#fff' },
  recibido_uscis: { label: 'Recibido USCIS', bg: '#6366F1', text: '#fff' },
  rfe_recibido: { label: 'RFE Recibido', bg: '#F59E0B', text: '#fff' },
  rfe_respondido: { label: 'RFE Respondido', bg: '#D97706', text: '#fff' },
  devuelto: { label: 'Devuelto', bg: '#EF4444', text: '#fff' },
  aprobado: { label: 'Aprobado', bg: '#10B981', text: '#fff' },
};

const WORK_BUTTONS = [
  { key: 'working', label: 'Trabajando', active: 'bg-emerald-500 text-white ring-emerald-500', inactive: 'bg-white text-emerald-700 ring-emerald-200' },
  { key: 'paused', label: 'Pausado', active: 'bg-amber-500 text-white ring-amber-500', inactive: 'bg-white text-amber-700 ring-amber-200' },
  { key: 'waiting_uscis', label: 'Esperando USCIS', active: 'bg-blue-500 text-white ring-blue-500', inactive: 'bg-white text-blue-700 ring-blue-200' },
  { key: 'desisted', label: 'Desistió', active: 'bg-gray-500 text-white ring-gray-500', inactive: 'bg-white text-gray-500 ring-gray-200' },
];

// Inline sub-item adder
const SubItemInput = ({ itemId, onAdd }) => {
  const [text, setText] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(itemId, text); setText(''); } }}
        placeholder="Agregar sub-item..."
        className="flex-1 text-sm border-0 border-b border-dashed border-gray-300 bg-transparent px-1 py-1.5 outline-none focus:border-indigo-400"
        style={{ color: '#374151' }} />
      {text.trim() && (
        <button onClick={() => { onAdd(itemId, text); setText(''); }}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
          <Plus className="h-3 w-3" />Agregar
        </button>
      )}
    </div>
  );
};

// Strategy input for RFE
const StrategyInput = ({ onSave }) => {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
        placeholder="Escribe la estrategia de respuesta al RFE..."
        className="w-full border border-amber-200 rounded-lg p-3 text-sm outline-none focus:border-amber-400 resize-none"
        style={{ color: '#374151', background: '#fff' }} />
      {text.trim() && (
        <button onClick={() => onSave(text)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white">Guardar Estrategia</button>
      )}
    </div>
  );
};

// Note composer with @mention support
const NoteComposer = ({ caseId, headers: h, onSaved }) => {
  const [text, setText] = useState('');
  const [attention, setAttention] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const fd = new URLSearchParams(); fd.append('text', text); fd.append('requiresAttention', attention);
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/classic-cases/admin/${caseId}/notes`, fd, { headers: h });
      setText(''); setAttention(false); onSaved();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
        placeholder="Escribe una nota... Usa @email para mencionar a alguien"
        className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-400 resize-none"
        style={{ color: '#374151', background: '#FAFAFA' }} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#6B7280' }}>
          <input type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)} className="rounded" style={{ accentColor: '#F59E0B' }} />
          Requiere atencion
        </label>
        <button onClick={submit} disabled={saving || !text.trim()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white disabled:opacity-50">
          {saving ? 'Guardando...' : 'Agregar Nota'}
        </button>
      </div>
    </div>
  );
};

// Contact registration form
const ContactForm = ({ caseId, headers: h, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ medium: 'whatsapp', summary: '', emotionalState: 'satisfied', needsFollowUp: false, followUpNote: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (form.summary.trim().length < 20) { toast.error('Resumen minimo 20 caracteres'); return; }
    setSaving(true);
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/classic-cases/admin/${caseId}/contacts`, form, { headers: { ...h, 'Content-Type': 'application/json' } });
      setForm({ medium: 'whatsapp', summary: '', emotionalState: 'satisfied', needsFollowUp: false, followUpNote: '' });
      setOpen(false); onSaved();
      toast.success('Contacto registrado');
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium hover:border-indigo-400 hover:bg-indigo-50/30 transition-all" style={{ color: '#6B7280' }}>
      + Registrar Contacto
    </button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-bold text-sm" style={{ color: '#111827' }}>Registrar Contacto</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Medio</label>
          <select value={form.medium} onChange={e => setForm({ ...form, medium: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff' }}>
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Llamada</option>
            <option value="email">Email</option>
            <option value="presencial">Presencial</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Estado emocional</label>
          <select value={form.emotionalState} onChange={e => setForm({ ...form, emotionalState: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff' }}>
            <option value="satisfied">Satisfecho</option>
            <option value="with_doubts">Con dudas</option>
            <option value="worried">Preocupado</option>
            <option value="frustrated">Frustrado</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Resumen (min. 20 caracteres) *</label>
        <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3}
          placeholder="Describe el contacto con el cliente..."
          className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-indigo-400 resize-none"
          style={{ color: '#374151', background: '#fff' }} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#374151' }}>
        <input type="checkbox" checked={form.needsFollowUp} onChange={e => setForm({ ...form, needsFollowUp: e.target.checked })} className="rounded" style={{ accentColor: '#F59E0B' }} />
        Necesita seguimiento
      </label>
      {form.needsFollowUp && (
        <input value={form.followUpNote} onChange={e => setForm({ ...form, followUpNote: e.target.value })}
          placeholder="Nota de seguimiento..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: '#374151', background: '#fff' }} />
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-300" style={{ color: '#374151' }}>Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white disabled:opacity-50">
          {saving ? 'Guardando...' : 'Registrar'}
        </button>
      </div>
    </div>
  );
};

// Note input
const NoteInput = ({ itemId, onAdd }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
      <MessageSquare className="h-3 w-3" />Nota
    </button>
  );
  return (
    <div className="flex items-center gap-2 mt-1">
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(itemId, text); setText(''); setOpen(false); } if (e.key === 'Escape') setOpen(false); }}
        placeholder="Escribe una nota..."
        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
        style={{ color: '#374151', background: '#fff' }}
        autoFocus />
      <button onClick={() => { if (text.trim()) { onAdd(itemId, text); setText(''); } setOpen(false); }}
        className="text-xs font-medium px-2 py-1 rounded bg-indigo-600 text-white">OK</button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400">✕</button>
    </div>
  );
};

// Check circle component
const DualCheck = ({ checkedCoord, checkedArm, onToggleCoord, onToggleArm, size = 'md' }) => {
  const s = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconS = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onToggleCoord}
        className={`${s} rounded-md flex items-center justify-center transition-all ${
          checkedCoord ? 'bg-indigo-600 shadow-sm shadow-indigo-200' : 'bg-white border-2 border-gray-300 hover:border-indigo-400'
        }`}>
        {checkedCoord && <Check className={`${iconS} text-white`} strokeWidth={3} />}
      </button>
      <button onClick={onToggleArm}
        className={`${s} rounded-md flex items-center justify-center transition-all ${
          checkedArm ? 'shadow-sm' : 'bg-white border-2 border-gray-300 hover:border-amber-400'
        }`} style={checkedArm ? { background: '#C9A96A', boxShadow: '0 1px 3px rgba(201,169,106,0.3)' } : {}}>
        {checkedArm && <Check className={`${iconS} text-white`} strokeWidth={3} />}
      </button>
    </div>
  );
};

const ClassicCaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('deliverables');
  const [expandedCats, setExpandedCats] = useState({});
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ newStatus: '', trackingNumber: '', shippingCompany: 'FedEx', ioeNumber: '', summary: '', rfeDeadline: '', documentUrl: '', notifyClient: true });
  const [statusFile, setStatusFile] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [addItemModal, setAddItemModal] = useState({ open: false, catIndex: -1, name: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [caseNotes, setCaseNotes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [resendHistory, setResendHistory] = useState([]);
  const [notifyClientLoading, setNotifyClientLoading] = useState(false);
  const [notificationLog, setNotificationLog] = useState([]);

  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/classic-cases/admin/${caseId}`, { headers });
      setCaseData(data.case);
      if (data.case?.deliverables?.length > 0 && Object.keys(expandedCats).length === 0) {
        setExpandedCats({ 0: true });
      }
    } catch { toast.error('Error al cargar caso'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  // Fetch staff for edit modal
  useEffect(() => {
    axios.get(`${API}/api/admin/staff?limit=100`, { headers }).then(r => setStaffList(r.data.staff || [])).catch(() => {});
  }, []);

  // Fetch tab data on tab change
  useEffect(() => {
    if (!caseId || !token) return;
    if (activeTab === 'notes') {
      axios.get(`${API}/api/classic-cases/admin/${caseId}/notes`, { headers }).then(r => setCaseNotes(r.data.notes || [])).catch(() => {});
    } else if (activeTab === 'contacts') {
      axios.get(`${API}/api/classic-cases/admin/${caseId}/contacts`, { headers }).then(r => setContacts(r.data.contacts || [])).catch(() => {});
    } else if (activeTab === 'notifications') {
      axios.get(`${API}/api/classic-cases/admin/${caseId}/resend-history`, { headers }).then(r => setResendHistory(r.data.history || [])).catch(() => {});
      axios.get(`${API}/api/classic-cases/admin/${caseId}/notification-log`, { headers }).then(r => setNotificationLog(r.data.logs || [])).catch(() => {});
    }
  }, [activeTab, caseId]);

  const updateLocalCheck = (itemId, subId, role, newVal) => {
    setCaseData(prev => {
      if (!prev) return prev;
      const field = `completed_${role}`;
      const dels = prev.deliverables.map(cat => ({
        ...cat,
        items: cat.items.map(item => {
          if (subId) {
            if (item.id !== itemId) return item;
            return {
              ...item,
              sub_items: item.sub_items.map(si => {
                if (si.id !== subId) return si;
                const updated = { ...si, [field]: newVal };
                updated.completed = updated.completed_coordinator && updated.completed_armador;
                return updated;
              })
            };
          }
          if (item.id !== itemId) return item;
          const updated = { ...item, [field]: newVal };
          updated.completed = updated.completed_coordinator && updated.completed_armador;
          return updated;
        })
      }));
      // Recalc progress
      let total = 0, cDone = 0, aDone = 0;
      dels.forEach(cat => cat.items.forEach(item => {
        total++; if (item.completed_coordinator) cDone++; if (item.completed_armador) aDone++;
        (item.sub_items || []).forEach(si => { total++; if (si.completed_coordinator) cDone++; if (si.completed_armador) aDone++; });
      }));
      const pC = total ? Math.round((cDone / total) * 1000) / 10 : 0;
      const pA = total ? Math.round((aDone / total) * 1000) / 10 : 0;
      return { ...prev, deliverables: dels, progressCoordinator: pC, progressArmador: pA, progress: Math.round((pC + pA) / 2 * 10) / 10 };
    });
  };

  const toggleCheck = async (itemId, role, currentVal) => {
    updateLocalCheck(itemId, null, role, !currentVal);
    try {
      const fd = new URLSearchParams(); fd.append('role', role); fd.append('checked', !currentVal);
      await axios.put(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/check`, fd, { headers });
    } catch { toast.error('Error'); fetchCase(); }
  };

  const toggleSubCheck = async (itemId, subId, role, currentVal) => {
    updateLocalCheck(itemId, subId, role, !currentVal);
    try {
      const fd = new URLSearchParams(); fd.append('role', role); fd.append('checked', !currentVal);
      await axios.put(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/sub-items/${subId}/check`, fd, { headers });
    } catch { toast.error('Error'); fetchCase(); }
  };

  const addSubItem = async (itemId, text) => {
    if (!text.trim()) return;
    const fd = new URLSearchParams(); fd.append('text', text);
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/sub-items`, fd, { headers });
    fetchCase();
  };

  const deleteSubItem = async (itemId, subId) => {
    await axios.delete(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/sub-items/${subId}`, { headers });
    fetchCase();
  };

  const updateItemStatus = async (itemId, status) => {
    // Optimistic
    setCaseData(prev => {
      if (!prev) return prev;
      const dels = prev.deliverables.map(cat => ({
        ...cat, items: cat.items.map(item => item.id === itemId ? { ...item, status: status || null } : item)
      }));
      return { ...prev, deliverables: dels };
    });
    try {
      const fd = new URLSearchParams(); fd.append('status', status);
      await axios.put(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/status`, fd, { headers });
    } catch { toast.error('Error'); fetchCase(); }
  };

  const addNote = async (itemId, text) => {
    if (!text.trim()) return;
    try {
      const fd = new URLSearchParams(); fd.append('text', text);
      await axios.post(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/notes`, fd, { headers });
      fetchCase();
    } catch { toast.error('Error'); }
  };

  const deleteNote = async (itemId, noteId) => {
    try {
      await axios.delete(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}/notes/${noteId}`, { headers });
      fetchCase();
    } catch { toast.error('Error'); }
  };

  const massCheck = async (role, action) => {
    const fd = new URLSearchParams(); fd.append('role', role); fd.append('action', action);
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/deliverables/mass-check`, fd, { headers });
    toast.success(action === 'check' ? 'Completado' : 'Desmarcado');
    fetchCase();
  };

  const changeWorkStatus = async (ws) => {
    const fd = new URLSearchParams(); fd.append('workStatus', ws);
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/work-status`, fd, { headers });
    setCaseData(prev => ({ ...prev, workStatus: ws }));
  };

  const handleFileScan = async (file, type) => {
    setStatusFile(file);
    if (!file) return;
    setScanningFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      let endpoint, resultHandler;

      if (type === 'tracking') {
        endpoint = 'scan-tracking';
        resultHandler = (data) => {
          if (data.trackingNumber) {
            setStatusForm(prev => ({ ...prev, trackingNumber: data.trackingNumber, shippingCompany: data.shippingCompany || prev.shippingCompany }));
            toast.success(`Tracking detectado: ${data.trackingNumber}`);
          } else toast.info('No se detecto automaticamente. Ingresalo manualmente.');
        };
      } else if (type === 'ioe') {
        endpoint = 'scan-ioe';
        resultHandler = (data) => {
          if (data.receiptNumber) {
            setStatusForm(prev => ({ ...prev, ioeNumber: data.receiptNumber }));
            toast.success(`IOE detectado: ${data.receiptNumber}`);
          } else toast.info('No se detecto automaticamente. Ingresalo manualmente.');
        };
      } else if (type === 'rfe') {
        endpoint = 'scan-rfe';
        resultHandler = (data) => {
          if (data.deadline) {
            // Try to convert deadline to YYYY-MM-DD for the date input
            let deadlineFormatted = data.deadline;
            try {
              const d = new Date(data.deadline);
              if (!isNaN(d)) deadlineFormatted = d.toISOString().split('T')[0];
            } catch {}
            setStatusForm(prev => ({ ...prev, rfeDeadline: deadlineFormatted }));
            toast.success(`Fecha limite detectada: ${data.deadline}`);
          }
          if (data.summary) toast.info('Analisis del RFE extraido');
        };
      }

      if (endpoint) {
        const { data } = await axios.post(`${API}/api/classic-cases/admin/${caseId}/${endpoint}`, fd, { headers });
        if (data.success && resultHandler) resultHandler(data);
        else if (!data.success) toast.info('No se pudo analizar. Ingresa los datos manualmente.');
      }
    } catch {
      toast.info('No se pudo escanear. Ingresalo manualmente.');
    } finally {
      setScanningFile(false);
    }
  };

  const changeStatus = async () => {
    setStatusLoading(true);
    try {
      const ns = statusForm.newStatus;
      const fd = new FormData();

      if (ns === 'radicado') {
        fd.append('trackingNumber', statusForm.trackingNumber);
        fd.append('shippingCompany', statusForm.shippingCompany);
        fd.append('notifyClient', statusForm.notifyClient);
        if (statusFile) fd.append('file', statusFile);
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/filing`, fd, { headers });
      } else if (ns === 'recibido_uscis') {
        fd.append('ioeNumber', statusForm.ioeNumber);
        fd.append('notifyClient', statusForm.notifyClient);
        if (statusFile) fd.append('file', statusFile);
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/ioe`, fd, { headers });
      } else if (ns === 'devuelto') {
        fd.append('summary', statusForm.summary);
        fd.append('notifyClient', statusForm.notifyClient);
        if (statusFile) fd.append('file', statusFile);
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/devolucion`, fd, { headers });
      } else if (ns === 'rfe_recibido') {
        fd.append('deadline', statusForm.rfeDeadline);
        if (statusFile) fd.append('file', statusFile);
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/rfe`, fd, { headers });
      } else if (ns === 'rfe_respondido') {
        fd.append('trackingNumber', statusForm.trackingNumber);
        fd.append('shippingCompany', statusForm.shippingCompany);
        fd.append('notifyClient', statusForm.notifyClient);
        if (statusFile) fd.append('file', statusFile);
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/rfe-responded`, fd, { headers });
      } else if (ns === 'aprobado') {
        await axios.post(`${API}/api/classic-cases/admin/${caseId}/approve`, {}, { headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      toast.success('Estado cambiado');
      setStatusModalOpen(false);
      setStatusFile(null);
      fetchCase();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setStatusLoading(false); }
  };

  const generateStrategy = async () => {
    setStrategyLoading(true);
    try {
      const fd = new URLSearchParams(); fd.append('strategy', ''); fd.append('source', 'ai');
      const { data } = await axios.post(`${API}/api/classic-cases/admin/${caseId}/rfe-strategy`, fd, { headers });
      toast.success('Estrategia generada');
      fetchCase();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setStrategyLoading(false); }
  };

  const saveStrategy = async (text) => {
    const fd = new URLSearchParams(); fd.append('strategy', text); fd.append('source', 'manual');
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/rfe-strategy`, fd, { headers });
    toast.success('Estrategia guardada');
    fetchCase();
  };

  const notifyClientRfe = async () => {
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/rfe-notify-client`, {}, { headers: { ...headers, 'Content-Type': 'application/json' } });
    toast.success('Cliente notificado');
    fetchCase();
  };

  const addItem = async () => {
    if (!addItemModal.name.trim()) return;
    const fd = new URLSearchParams(); fd.append('categoryIndex', addItemModal.catIndex); fd.append('itemName', addItemModal.name);
    await axios.post(`${API}/api/classic-cases/admin/${caseId}/deliverables/add-item`, fd, { headers });
    setAddItemModal({ open: false, catIndex: -1, name: '' });
    fetchCase();
  };

  const deleteItem = async (itemId) => {
    await axios.delete(`${API}/api/classic-cases/admin/${caseId}/deliverables/${itemId}`, { headers });
    fetchCase();
  };

  const getNextStatuses = () => {
    const s = caseData?.status;
    if (s === 'en_proceso') {
      // Only show "Radicado" when armador is at 100%
      if ((caseData?.progressArmador || 0) >= 100) return ['radicado'];
      return [];
    }
    const map = { radicado: ['recibido_uscis', 'devuelto'], recibido_uscis: ['rfe_recibido', 'aprobado'], rfe_recibido: ['rfe_respondido'], rfe_respondido: ['aprobado'], devuelto: ['radicado'] };
    return map[s] || [];
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!caseData) return <div className="text-center py-12" style={{ color: '#6B7280' }}>Caso no encontrado</div>;

  const st = STATUS_CONFIG[caseData.status] || STATUS_CONFIG.en_proceso;
  const deliverables = caseData.deliverables || [];
  const timeline = caseData.timeline || [];

  return (
    <div data-testid="classic-case-detail">
      <style>{`
        .cc-detail input, .cc-detail select, .cc-detail textarea { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
        .cc-detail input::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
      `}</style>
      <div className="cc-detail space-y-5">

      {/* Back */}
      <button onClick={() => navigate('/admin/classic-cases')} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
        <ChevronLeft className="h-4 w-4" />Volver a Clientes
      </button>

      {/* Header card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0F172A' }}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">{caseData.name}</h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.text }}>{st.label}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {caseData.email && <span>✉ {caseData.email}</span>}
                {caseData.phone && <span>✆ {caseData.phone}</span>}
              </div>
              {caseData.seniorityDate && <p className="text-xs text-gray-500 mt-2">Antigüedad: {caseData.seniorityDate}</p>}
              {caseData.updatedAt && (() => {
                const dt = new Date(caseData.updatedAt);
                const diffMs = Date.now() - dt.getTime();
                const diffDays = Math.floor(diffMs / 86400000);
                const label = diffDays === 0 ? 'hoy'
                  : diffDays === 1 ? 'hace 1 día'
                  : diffDays < 30 ? `hace ${diffDays} días`
                  : dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                const color = diffDays >= 7 ? '#F59E0B' : '#6EE7B7';
                return (
                  <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color }} />
                    Última actualización: {label}
                  </p>
                );
              })()}
            </div>
            <div className="flex gap-2">
              {caseData.email && (
                <Button size="sm" data-testid="notify-client-btn"
                  disabled={notifyClientLoading}
                  className="bg-emerald-500/80 text-white border-emerald-400/30 hover:bg-emerald-500 rounded-xl"
                  onClick={async () => {
                    setNotifyClientLoading(true);
                    try {
                      await axios.post(`${API}/api/classic-cases/admin/${caseId}/notify-client-status`, {}, { headers: { ...headers, 'Content-Type': 'application/json' } });
                      toast.success('Email enviado al cliente');
                    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                    finally { setNotifyClientLoading(false); }
                  }}>
                  {notifyClientLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                  Informar al Cliente
                </Button>
              )}
              {caseData.driveFolderUrl && (
                <a href={caseData.driveFolderUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#C9A96A', color: '#0F172A' }}>
                  <ExternalLink className="h-4 w-4" />Drive
                </a>
              )}
              <Button size="sm" className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-xl"
                onClick={() => { setEditForm({ name: caseData.name || '', email: caseData.email || '', phone: caseData.phone || '', coordinatorId: caseData.coordinatorId || '', processingType: caseData.processingType || 'normal', driveFolderUrl: caseData.driveFolderUrl || '', seniorityDate: caseData.seniorityDate || '', ioeNumber: caseData.ioeNumber || '', trackingNumber: caseData.trackingNumber || '', shippingCompany: caseData.shippingCompany || 'FedEx' }); setEditOpen(true); }}>
                <Edit className="h-4 w-4 mr-1" />Editar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Work status + Next actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {WORK_BUTTONS.map(wb => (
            <button key={wb.key} onClick={() => changeWorkStatus(wb.key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold ring-1 ring-inset transition-all ${caseData.workStatus === wb.key ? wb.active : wb.inactive}`}>
              {wb.label}
            </button>
          ))}
        </div>
        {getNextStatuses().length > 0 && (
          <div className="flex gap-2">
            {getNextStatuses().map(ns => {
              const nst = STATUS_CONFIG[ns];
              return (
                <button key={ns} onClick={() => { setStatusForm({ ...statusForm, newStatus: ns }); setStatusModalOpen(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ background: nst?.bg }}>
                  <Send className="h-3.5 w-3.5" />{nst?.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Coordinador', value: caseData.progressCoordinator || 0, color: '#4F46E5' },
          { label: 'Armador', value: caseData.progressArmador || 0, color: '#C9A96A' },
          { label: 'Total', value: caseData.progress || 0, color: '#111827' },
        ].map(p => (
          <div key={p.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: p.color }}>{p.label}</span>
              <span className="text-xl font-bold" style={{ color: p.color }}>{p.value}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${p.value}%`, background: p.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Case Info Cards */}
      {(caseData.ioeNumber || caseData.trackingNumber || caseData.status === 'rfe_recibido' || caseData.status === 'rfe_respondido' || caseData.status === 'devuelto') && (
        <div className="space-y-3">
          {/* Filing + IOE info */}
          {(caseData.ioeNumber || caseData.trackingNumber || caseData.rfeResponseTrackingNumber) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex gap-8 flex-wrap">
                {caseData.trackingNumber && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Tracking Caso ({caseData.shippingCompany})</p>
                    <p className="font-mono text-sm font-semibold text-gray-900">{caseData.trackingNumber}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {caseData.trackingDocumentUrl && <a href={caseData.trackingDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Ver documento</a>}
                      <label className="text-xs text-amber-600 hover:underline cursor-pointer">
                        {caseData.trackingDocumentUrl ? 'Re-subir' : 'Adjuntar'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const fd = new FormData(); fd.append('file', f); fd.append('documentType', 'tracking');
                          try { const { data } = await axios.post(`${API}/api/classic-cases/admin/${caseId}/upload-document`, fd, { headers }); toast.success('Documento subido'); fetchCase(); } catch { toast.error('Error'); }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                  </div>
                )}
                {caseData.ioeNumber && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">IOE Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-lg text-gray-900">{caseData.ioeNumber}</p>
                      <button onClick={() => { navigator.clipboard.writeText(caseData.ioeNumber); toast.success('IOE copiado'); }} className="p-1 hover:bg-gray-100 rounded"><Copy className="h-3.5 w-3.5 text-gray-400" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {caseData.ioeDocumentUrl && <a href={caseData.ioeDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Ver I-797C</a>}
                      <label className="text-xs text-amber-600 hover:underline cursor-pointer">
                        {caseData.ioeDocumentUrl ? 'Re-subir' : 'Adjuntar'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const fd = new FormData(); fd.append('file', f); fd.append('documentType', 'ioe');
                          try { await axios.post(`${API}/api/classic-cases/admin/${caseId}/upload-document`, fd, { headers }); toast.success('Documento subido'); fetchCase(); } catch { toast.error('Error'); }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                  </div>
                )}
                {caseData.rfeResponseTrackingNumber && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Tracking RFE ({caseData.rfeResponseShippingCompany})</p>
                    <p className="font-mono text-sm font-semibold text-gray-900">{caseData.rfeResponseTrackingNumber}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {caseData.rfeResponseDocumentUrl && <a href={caseData.rfeResponseDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Ver documento</a>}
                      <label className="text-xs text-amber-600 hover:underline cursor-pointer">
                        {caseData.rfeResponseDocumentUrl ? 'Re-subir' : 'Adjuntar'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const fd = new FormData(); fd.append('file', f); fd.append('documentType', 'rfe_response');
                          try { await axios.post(`${API}/api/classic-cases/admin/${caseId}/upload-document`, fd, { headers }); toast.success('Documento subido'); fetchCase(); } catch { toast.error('Error'); }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Devolucion info */}
          {caseData.status === 'devuelto' && caseData.devolucionSummary && caseData.devolucionSummary !== 'null' && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <p className="text-xs font-bold text-red-800 mb-1">Motivo de Devolucion</p>
              <p className="text-sm text-red-700">{caseData.devolucionSummary}</p>
              {caseData.devolucionDocumentUrl && <a href={caseData.devolucionDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline mt-1 inline-block">Ver documento</a>}
            </div>
          )}

          {/* RFE Section */}
          {(caseData.status === 'rfe_recibido' || caseData.status === 'rfe_respondido') && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-900">Request for Evidence (RFE)</h3>
                {caseData.rfeDeadline && <Badge className="bg-red-100 text-red-800">Deadline: {caseData.rfeDeadline}</Badge>}
              </div>
              {caseData.rfeDocumentUrl && <a href={caseData.rfeDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 hover:underline flex items-center gap-1"><FileText className="h-3 w-3" />Ver documento RFE</a>}

              {/* Analysis */}
              {caseData.rfeAnalysis && (
                <div>
                  <p className="text-xs font-bold text-amber-800 mb-1">Analisis del RFE</p>
                  <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{caseData.rfeAnalysis}</div>
                </div>
              )}

              {/* Strategy */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-amber-800">Estrategia de Respuesta</p>
                  {!caseData.rfeStrategy && (
                    <button onClick={generateStrategy} disabled={strategyLoading}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                      {strategyLoading ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      Generar con IA
                    </button>
                  )}
                </div>
                {caseData.rfeStrategy ? (
                  <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {caseData.rfeStrategy}
                    <p className="text-xs text-gray-400 mt-2">Fuente: {caseData.rfeStrategySource === 'ai' ? 'IA' : 'Manual'}</p>
                  </div>
                ) : (
                  <StrategyInput onSave={saveStrategy} />
                )}
              </div>

              {/* Notify client */}
              {caseData.status === 'rfe_recibido' && caseData.rfeStrategy && (
                <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                  {caseData.rfeClientNotified ? (
                    <p className="text-xs text-amber-700">Cliente notificado el {caseData.rfeClientNotifiedDate ? new Date(caseData.rfeClientNotifiedDate).toLocaleDateString('es') : ''}</p>
                  ) : (
                    <button onClick={notifyClientRfe} className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                      <Send className="h-3 w-3 inline mr-1" />Notificar al Cliente
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'deliverables', label: 'Entregables', icon: '✓' },
          { key: 'notes', label: 'Notas', icon: '✎' },
          { key: 'contacts', label: 'Contactos', icon: '☎' },
          { key: 'notifications', label: 'Notificaciones', icon: '✉' },
          { key: 'timeline', label: 'Historial', icon: '◷' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Deliverables tab */}
      {activeTab === 'deliverables' && (
        <div className="space-y-3">
          {/* Legend + Mass actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-5 text-xs font-semibold">
              <span className="flex items-center gap-1.5" style={{ color: '#374151' }}><span className="h-3 w-3 rounded bg-indigo-600 inline-block" />Coordinador</span>
              <span className="flex items-center gap-1.5" style={{ color: '#374151' }}><span className="h-3 w-3 rounded inline-block" style={{ background: '#C9A96A' }} />Armador</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => massCheck('coordinator', 'check')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Completar Coord.</button>
              <button onClick={() => massCheck('coordinator', 'uncheck')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Desmarcar Coord.</button>
              <button onClick={() => massCheck('armador', 'check')} className="px-3 py-1.5 text-xs font-medium rounded-lg hover:opacity-80" style={{ background: '#C9A96A20', color: '#92700C' }}>Completar Armador</button>
              <button onClick={() => massCheck('armador', 'uncheck')} className="px-3 py-1.5 text-xs font-medium rounded-lg hover:opacity-80" style={{ background: '#C9A96A10', color: '#92700C' }}>Desmarcar Armador</button>
            </div>
          </div>

          {/* Categories */}
          {deliverables.map((cat, catIdx) => {
            const isOpen = expandedCats[catIdx];
            const catItems = cat.items || [];
            let total = 0, coordDone = 0, armDone = 0;
            catItems.forEach(i => {
              total++;
              if (i.completed_coordinator) coordDone++;
              if (i.completed_armador) armDone++;
              (i.sub_items || []).forEach(si => {
                total++;
                if (si.completed_coordinator) coordDone++;
                if (si.completed_armador) armDone++;
              });
            });
            const fullyDone = total > 0 && coordDone === total && armDone === total;
            return (
              <div key={catIdx} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                {/* Category header */}
                <button onClick={() => setExpandedCats(prev => ({ ...prev, [catIdx]: !prev[catIdx] }))}
                  className="w-full text-left px-5 py-4 flex items-center justify-between" style={{ background: '#0F172A' }}>
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                      fullyDone ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500'
                    }`}>
                      {fullyDone && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="font-bold text-white">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium" style={{ color: '#C9A96A' }}>{catItems.length} items</span>
                    <div className="flex gap-1 w-24">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${total ? (coordDone / total) * 100 : 0}%` }} /></div>
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${total ? (armDone / total) * 100 : 0}%`, background: '#C9A96A' }} /></div>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="bg-white">
                    {catItems.map((item) => (
                      <div key={item.id}>
                        {/* Main item row */}
                        <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50/50">
                          <DualCheck
                            checkedCoord={item.completed_coordinator} checkedArm={item.completed_armador}
                            onToggleCoord={() => toggleCheck(item.id, 'coordinator', item.completed_coordinator)}
                            onToggleArm={() => toggleCheck(item.id, 'armador', item.completed_armador)}
                          />
                          <span className={`flex-1 text-sm font-medium ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {item.item}
                          </span>
                          {/* Status dropdown */}
                          <select value={item.status || ''} onChange={e => updateItemStatus(item.id, e.target.value)}
                            className={`text-xs rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                              item.status === 'pedido' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              item.status === 'en_revision' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                              'bg-gray-50 border-gray-200 text-gray-500'
                            }`} style={{ minWidth: '90px', WebkitTextFillColor: 'inherit' }}>
                            <option value="">Sin estado</option>
                            <option value="pedido">Pedido</option>
                            <option value="en_revision">En revisión</option>
                          </select>
                          {/* Note button */}
                          <NoteInput itemId={item.id} onAdd={addNote} />
                          {/* Delete */}
                          <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 opacity-40 hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>

                        {/* Notes display */}
                        {item.notes && item.notes.length > 0 && (
                          <div className="mx-5 my-1.5 space-y-1">
                            {item.notes.map(note => (
                              <div key={note.id} className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2 group">
                                <MessageSquare className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-700">{note.text}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{note.author} · {note.createdAt ? new Date(note.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}</p>
                                </div>
                                <button onClick={() => deleteNote(item.id, note.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded">
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sub-items */}
                        {item.sub_items && item.sub_items.length > 0 && (
                          <div className="ml-16 mr-5 border-l-2 border-gray-200">
                            {item.sub_items.map(si => (
                              <div key={si.id} className="flex items-center gap-3 pl-4 py-2.5 hover:bg-gray-50/50">
                                <DualCheck size="sm"
                                  checkedCoord={si.completed_coordinator} checkedArm={si.completed_armador}
                                  onToggleCoord={() => toggleSubCheck(item.id, si.id, 'coordinator', si.completed_coordinator)}
                                  onToggleArm={() => toggleSubCheck(item.id, si.id, 'armador', si.completed_armador)}
                                />
                                <span className={`flex-1 text-sm ${si.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{si.text}</span>
                                <button onClick={() => deleteSubItem(item.id, si.id)} className="p-1 rounded hover:bg-red-50 opacity-30 hover:opacity-100">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            ))}
                            <div className="pl-4 py-2">
                              <SubItemInput itemId={item.id} onAdd={addSubItem} />
                            </div>
                          </div>
                        )}

                        {/* Add sub-item if no sub-items exist */}
                        {(!item.sub_items || item.sub_items.length === 0) && (
                          <div className="ml-16 mr-5 py-2">
                            <SubItemInput itemId={item.id} onAdd={addSubItem} />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add item to category */}
                    <button onClick={() => setAddItemModal({ open: true, catIndex: catIdx, name: '' })}
                      className="flex items-center gap-2 px-5 py-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full border-t border-gray-100">
                      <Plus className="h-4 w-4" />Agregar item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <NoteComposer caseId={caseId} headers={headers} onSaved={() => axios.get(`${API}/api/classic-cases/admin/${caseId}/notes`, { headers }).then(r => setCaseNotes(r.data.notes || []))} />
          {caseNotes.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>No hay notas</p>
          ) : (
            <div className="space-y-3">
              {caseNotes.map(note => (
                <div key={note.id} className={`bg-white rounded-xl border p-4 ${note.requiresAttention ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {(note.authorName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-semibold" style={{ color: '#111827' }}>{note.authorName}</span>
                        {note.edited && <span className="text-xs ml-1" style={{ color: '#9CA3AF' }}>(editada)</span>}
                        {note.requiresAttention && <Badge className="ml-2 bg-amber-100 text-amber-800 text-xs">Requiere atencion</Badge>}
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                      {note.createdAt ? new Date(note.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#374151' }}>{note.text}</p>
                  <button onClick={async () => { await axios.delete(`${API}/api/classic-cases/admin/${caseId}/notes/${note.id}`, { headers }); setCaseNotes(prev => prev.filter(n => n.id !== note.id)); }}
                    className="text-xs mt-2 opacity-40 hover:opacity-100" style={{ color: '#EF4444' }}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <ContactForm caseId={caseId} headers={headers} onSaved={() => axios.get(`${API}/api/classic-cases/admin/${caseId}/contacts`, { headers }).then(r => setContacts(r.data.contacts || []))} />
          {contacts.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>No hay contactos registrados</p>
          ) : (
            <div className="space-y-2">
              {contacts.map(c => {
                const mediumIcons = { whatsapp: '💬', call: '📞', email: '✉️', presencial: '🤝' };
                const emotionColors = { satisfied: '#10B981', with_doubts: '#F59E0B', worried: '#F97316', frustrated: '#EF4444' };
                const emotionLabels = { satisfied: 'Satisfecho', with_doubts: 'Con dudas', worried: 'Preocupado', frustrated: 'Frustrado' };
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{mediumIcons[c.medium] || '📋'}</span>
                        <span className="text-sm font-semibold" style={{ color: '#111827' }}>{c.registeredBy}</span>
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: emotionColors[c.emotionalState] || '#9CA3AF' }} title={emotionLabels[c.emotionalState]} />
                        <span className="text-xs font-medium" style={{ color: emotionColors[c.emotionalState] }}>{emotionLabels[c.emotionalState]}</span>
                      </div>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#374151' }}>{c.summary}</p>
                    {c.needsFollowUp && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#F59E0B' }}>
                        ⚠ Necesita seguimiento {c.followUpNote && <span style={{ color: '#6B7280' }}>— {c.followUpNote}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-sm mb-3" style={{ color: '#111827' }}>Reenviar Notificaciones</h3>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Reenviar al cliente y/o al coordinador</p>
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'radicado', label: 'Radicado', show: !!caseData?.trackingNumber },
                { type: 'ioe', label: 'IOE Asignado', show: !!caseData?.ioeNumber },
                { type: 'devolucion', label: 'Devolucion', show: !!caseData?.devolucionSummary },
                { type: 'rfe', label: 'RFE', show: !!caseData?.rfeAnalysis },
                { type: 'aprobado', label: 'Aprobacion', show: !!caseData?.approvalDate },
              ].filter(n => n.show).map(n => (
                <div key={n.type} className="flex gap-1">
                <button data-testid={`resend-client-${n.type}`}
                  onClick={async () => {
                    try {
                      const fd = new URLSearchParams();
                      fd.append('notificationType', n.type);
                      fd.append('sendToClient', 'true');
                      fd.append('sendToCoordinator', 'false');
                      await axios.post(`${API}/api/classic-cases/admin/${caseId}/resend-notification`, fd, { headers });
                      toast.success(`Reenviado al cliente: ${n.label}`);
                      axios.get(`${API}/api/classic-cases/admin/${caseId}/resend-history`, { headers }).then(r => setResendHistory(r.data.history || []));
                      axios.get(`${API}/api/classic-cases/admin/${caseId}/notification-log`, { headers }).then(r => setNotificationLog(r.data.logs || []));
                    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                  }}
                  className="px-3 py-2 rounded-l-xl text-xs font-semibold border border-gray-300 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                  style={{ color: '#374151' }}>
                  ✉ {n.label} → Cliente
                </button>
                <button data-testid={`resend-coord-${n.type}`}
                  onClick={async () => {
                    try {
                      const fd = new URLSearchParams();
                      fd.append('notificationType', n.type);
                      fd.append('sendToClient', 'false');
                      fd.append('sendToCoordinator', 'true');
                      await axios.post(`${API}/api/classic-cases/admin/${caseId}/resend-notification`, fd, { headers });
                      toast.success(`Reenviado al coordinador: ${n.label}`);
                      axios.get(`${API}/api/classic-cases/admin/${caseId}/resend-history`, { headers }).then(r => setResendHistory(r.data.history || []));
                      axios.get(`${API}/api/classic-cases/admin/${caseId}/notification-log`, { headers }).then(r => setNotificationLog(r.data.logs || []));
                    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                  }}
                  className="px-3 py-2 rounded-r-xl text-xs font-semibold border border-gray-300 border-l-0 hover:bg-amber-50 hover:border-amber-300 transition-all"
                  style={{ color: '#374151' }}>
                  → Coord.
                </button>
                </div>
              ))}
              {![caseData?.trackingNumber, caseData?.ioeNumber, caseData?.devolucionSummary, caseData?.rfeAnalysis, caseData?.approvalDate].some(Boolean) && (
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No hay notificaciones disponibles para reenviar</p>
              )}
            </div>
          </div>

          {/* Resend history */}
          {resendHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-sm mb-3" style={{ color: '#111827' }}>Historial de Reenvios</h3>
              <div className="space-y-2">
                {resendHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <span className="text-sm font-medium" style={{ color: '#111827' }}>{h.type}</span>
                      <span className="text-xs ml-2" style={{ color: '#6B7280' }}>→ {h.sentTo}</span>
                    </div>
                    <div className="text-xs" style={{ color: '#9CA3AF' }}>
                      {h.sentBy} · {h.sentAt ? new Date(h.sentAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification Log */}
          {notificationLog.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="notification-log">
              <h3 className="font-bold text-sm mb-3" style={{ color: '#111827' }}>Registro de Notificaciones</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {notificationLog.map((log, i) => {
                  const typeColors = {
                    radicado: '#8B5CF6', ioe_recibido: '#6366F1', devolucion: '#EF4444',
                    aprobado: '#10B981', rfe_recibido: '#F59E0B', rfe_respondido: '#D97706',
                    client_status_update: '#3B82F6', client_desisted: '#6B7280',
                    bulk_email: '#8B5CF6', rfe_notificacion_cliente: '#F59E0B',
                  };
                  const color = typeColors[log.event_type] || '#6B7280';
                  return (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs font-semibold" style={{ color }}>{log.event_type}</span>
                        <span className="text-xs" style={{ color: '#6B7280' }}>→ {log.recipient}</span>
                      </div>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {log.sentAt ? new Date(log.sentAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {timeline.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">Sin actividad registrada</p>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
              {timeline.map((entry, i) => (
                <div key={i} className="relative pb-5 last:pb-0">
                  <div className="absolute left-[-15px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white" />
                  <p className="text-xs font-medium text-gray-400">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{entry.action}</p>
                  <p className="text-xs text-gray-400">{entry.performedBy?.name || ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Change Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#111827' }}>
              {statusForm.newStatus === 'radicado' ? 'Enviar Caso' : STATUS_CONFIG[statusForm.newStatus]?.label}
            </DialogTitle>
            {statusForm.newStatus === 'radicado' && (
              <p className="text-sm" style={{ color: '#6B7280' }}>Ingresa el numero de tracking del paquete enviado</p>
            )}
          </DialogHeader>
          <div className="space-y-3 py-2">
            {statusForm.newStatus === 'radicado' && (<>
              {/* Client info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{caseData?.name}</p>
              </div>

              {/* Option 1: Scan or upload */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 1: Escanear o adjuntar documento</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Tomar Foto</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Usar camara</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'tracking')} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Adjuntar</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Imagen o PDF</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'tracking')} />
                  </label>
                </div>
                {scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Escaneando documento con IA...</p>}
                {statusFile && !scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium">Archivo: {statusFile.name}</p>}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs" style={{ color: '#9CA3AF' }}>o</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Option 2: Manual */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 2: Ingresar numero manualmente</p>
                <Input value={statusForm.trackingNumber} onChange={e => setStatusForm({ ...statusForm, trackingNumber: e.target.value })}
                  placeholder="Ej: 1Z999AA10123456784" />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Empresa de envio</p>
                <select value={statusForm.shippingCompany} onChange={e => setStatusForm({ ...statusForm, shippingCompany: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff' }}>
                  <option>FedEx</option><option>USPS</option><option>UPS</option><option>DHL</option></select>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={statusForm.notifyClient}
                  onChange={e => setStatusForm({ ...statusForm, notifyClient: e.target.checked })}
                  className="h-4 w-4 rounded" style={{ accentColor: '#4F46E5' }} />
                <div>
                  <span className="text-sm font-medium" style={{ color: '#374151' }}>Enviar correo al cliente</span>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>El equipo interno siempre recibe notificacion</p>
                </div>
              </label>
            </>)}
            {statusForm.newStatus === 'recibido_uscis' && (<>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{caseData?.name}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 1: Subir carta I-797C (la IA extraera el IOE)</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Tomar Foto</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'ioe')} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Adjuntar</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'ioe')} />
                  </label>
                </div>
                {scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Escaneando con IA...</p>}
                {statusFile && !scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium">Archivo: {statusFile.name}</p>}
              </div>

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs" style={{ color: '#9CA3AF' }}>o</span><div className="flex-1 h-px bg-gray-200" /></div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 2: Ingresar IOE manualmente</p>
                <Input value={statusForm.ioeNumber} onChange={e => setStatusForm({ ...statusForm, ioeNumber: e.target.value })} placeholder="Ej: IOE0934567345" />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={statusForm.notifyClient}
                  onChange={e => setStatusForm({ ...statusForm, notifyClient: e.target.checked })}
                  className="h-4 w-4 rounded" style={{ accentColor: '#4F46E5' }} />
                <div>
                  <span className="text-sm font-medium" style={{ color: '#374151' }}>Enviar correo al cliente</span>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>El equipo interno siempre recibe notificacion</p>
                </div>
              </label>
            </>)}
            {statusForm.newStatus === 'devuelto' && (<>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{caseData?.name}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 1: Subir documento de devolucion (la IA extraera el motivo)</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Tomar Foto</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Usar camara</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { setStatusFile(e.target.files?.[0] || null); }} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Adjuntar</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Imagen o PDF</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => { setStatusFile(e.target.files?.[0] || null); }} />
                  </label>
                </div>
                {statusFile && <p className="text-xs mt-2 text-indigo-600 font-medium">Archivo: {statusFile.name}</p>}
              </div>

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs" style={{ color: '#9CA3AF' }}>o</span><div className="flex-1 h-px bg-gray-200" /></div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 2: Escribir el motivo manualmente</p>
                <textarea value={statusForm.summary} onChange={e => setStatusForm({ ...statusForm, summary: e.target.value })}
                  placeholder="Describe el motivo de la devolucion..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none outline-none focus:border-red-400" rows={3} style={{ color: '#374151', background: '#fff' }} />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={statusForm.notifyClient}
                  onChange={e => setStatusForm({ ...statusForm, notifyClient: e.target.checked })}
                  className="h-4 w-4 rounded" style={{ accentColor: '#4F46E5' }} />
                <div>
                  <span className="text-sm font-medium" style={{ color: '#374151' }}>Enviar correo al cliente</span>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>El equipo interno siempre recibe notificacion</p>
                </div>
              </label>
            </>)}
            {statusForm.newStatus === 'rfe_recibido' && (<>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{caseData?.name}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 1: Subir documento RFE (la IA extraera la fecha limite)</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Tomar Foto</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Usar camara</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'rfe')} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Adjuntar</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>Imagen o PDF</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'rfe')} />
                  </label>
                </div>
                {scanningFile && <p className="text-xs mt-2 text-amber-600 font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analizando documento con IA...</p>}
                {statusFile && !scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium">Archivo: {statusFile.name}</p>}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Fecha limite de respuesta {statusForm.rfeDeadline && <span className="text-xs font-normal text-emerald-600 ml-1">(detectada por IA)</span>}</p>
                <Input type="date" value={statusForm.rfeDeadline} onChange={e => setStatusForm({ ...statusForm, rfeDeadline: e.target.value })} />
              </div>
            </>)}
            {(statusForm.newStatus === 'rfe_respondido') && (<>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{caseData?.name}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 1: Escanear o adjuntar recibo de envio</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Tomar Foto</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'tracking')} />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                    <svg className="h-8 w-8" style={{ color: '#9CA3AF' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Adjuntar</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => handleFileScan(e.target.files?.[0], 'tracking')} />
                  </label>
                </div>
                {scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Escaneando con IA...</p>}
                {statusFile && !scanningFile && <p className="text-xs mt-2 text-indigo-600 font-medium">Archivo: {statusFile.name}</p>}
              </div>

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs" style={{ color: '#9CA3AF' }}>o</span><div className="flex-1 h-px bg-gray-200" /></div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Opcion 2: Ingresar tracking manualmente</p>
                <Input value={statusForm.trackingNumber} onChange={e => setStatusForm({ ...statusForm, trackingNumber: e.target.value })} placeholder="Ej: 1Z999AA10123456784" />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Empresa de envio</p>
                <select value={statusForm.shippingCompany} onChange={e => setStatusForm({ ...statusForm, shippingCompany: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff' }}>
                  <option>FedEx</option><option>USPS</option><option>UPS</option><option>DHL</option></select>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={statusForm.notifyClient}
                  onChange={e => setStatusForm({ ...statusForm, notifyClient: e.target.checked })}
                  className="h-4 w-4 rounded" style={{ accentColor: '#4F46E5' }} />
                <div>
                  <span className="text-sm font-medium" style={{ color: '#374151' }}>Enviar correo al cliente</span>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>El equipo interno siempre recibe notificacion</p>
                </div>
              </label>
            </>)}
            {(statusForm.newStatus === 'aprobado') && (
              <p className="text-sm py-4 text-center" style={{ color: '#374151' }}>
                ¿Confirmas cambiar el estado a <strong>{STATUS_CONFIG[statusForm.newStatus]?.label}</strong>?
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStatusModalOpen(false); setStatusFile(null); }} style={{ color: '#374151' }}>Cancelar</Button>
            <Button onClick={changeStatus} disabled={statusLoading}
              className={statusForm.newStatus === 'radicado' ? '' : ''}
              style={{ background: statusForm.newStatus === 'radicado' ? '#6EE7B7' : STATUS_CONFIG[statusForm.newStatus]?.bg, color: statusForm.newStatus === 'radicado' ? '#065F46' : '#fff' }}>
              {statusLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              {statusForm.newStatus === 'radicado' ? 'Confirmar Envio' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#111827' }}>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Nombre *</label>
                <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Email</label>
                <Input value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Telefono</label>
                <Input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Fecha de antiguedad</label>
                <Input value={editForm.seniorityDate || ''} onChange={e => setEditForm({ ...editForm, seniorityDate: e.target.value })} placeholder="MM/DD/YYYY" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Coordinador</label>
                <select value={editForm.coordinatorId || ''} onChange={e => setEditForm({ ...editForm, coordinatorId: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff', WebkitTextFillColor: '#374151' }}>
                  <option value="">Sin asignar</option>
                  {staffList.map(s => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Tipo de procesamiento</label>
                <select value={editForm.processingType || 'normal'} onChange={e => setEditForm({ ...editForm, processingType: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" style={{ color: '#374151', background: '#fff', WebkitTextFillColor: '#374151' }}>
                  <option value="normal">Normal (~700 dias)</option>
                  <option value="premium">Premium (45 dias)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Link Google Drive</label>
              <Input value={editForm.driveFolderUrl || ''} onChange={e => setEditForm({ ...editForm, driveFolderUrl: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>
            <div className="border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs font-bold mb-2" style={{ color: '#6B7280' }}>DATOS DE USCIS</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>IOE Number</label>
                  <Input value={editForm.ioeNumber || ''} onChange={e => setEditForm({ ...editForm, ioeNumber: e.target.value })} placeholder="IOE0934567345" className="font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Tracking Number</label>
                  <Input value={editForm.trackingNumber || ''} onChange={e => setEditForm({ ...editForm, trackingNumber: e.target.value })} placeholder="1Z999AA1..." className="font-mono" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} style={{ color: '#374151' }}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={async () => {
                try {
                  await axios.put(`${API}/api/classic-cases/admin/${caseId}`, editForm, { headers: { ...headers, 'Content-Type': 'application/json' } });
                  toast.success('Cliente actualizado');
                  setEditOpen(false);
                  fetchCase();
                } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
              }}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={addItemModal.open} onOpenChange={(o) => setAddItemModal({ ...addItemModal, open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle style={{ color: '#111827' }}>Agregar Item</DialogTitle></DialogHeader>
          <Input value={addItemModal.name} onChange={e => setAddItemModal({ ...addItemModal, name: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }} placeholder="Nombre del item" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModal({ open: false, catIndex: -1, name: '' })} style={{ color: '#374151' }}>Cancelar</Button>
            <Button onClick={addItem} className="bg-gray-900 hover:bg-gray-800 text-white">Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
};

export default ClassicCaseDetail;
