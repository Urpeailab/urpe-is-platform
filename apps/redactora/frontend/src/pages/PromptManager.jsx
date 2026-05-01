import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = window.location.origin;
const ADMIN_EMAIL = 'dau@urpeailab.com';

// ── Category badge colors ─────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  'Sistema':     { bg: '#1e293b', text: '#60a5fa', border: '#334155' },
  'Reglas':      { bg: '#2d1b1b', text: '#f87171', border: '#7f1d1d' },
  'Finanzas':    { bg: '#1a2e1a', text: '#4ade80', border: '#166534' },
  'Estructura':  { bg: '#1a1a2e', text: '#a78bfa', border: '#3730a3' },
  'Calidad':     { bg: '#2d2418', text: '#fb923c', border: '#92400e' },
  'Redacción':   { bg: '#18272d', text: '#22d3ee', border: '#155e75' },
  'Generación':  { bg: '#1a2e28', text: '#34d399', border: '#065f46' },
  'Traducción':  { bg: '#2a1f2e', text: '#c084fc', border: '#6b21a8' },
  'Grupo 1':     { bg: '#1e2020', text: '#94a3b8', border: '#334155' },
  'Grupo 2':     { bg: '#1e2020', text: '#94a3b8', border: '#334155' },
  'Grupo 3':     { bg: '#1e2020', text: '#94a3b8', border: '#334155' },
  'Grupo 4':     { bg: '#1e2020', text: '#94a3b8', border: '#334155' },
  'Grupo 5':     { bg: '#1e2020', text: '#94a3b8', border: '#334155' },
  'default':     { bg: '#1e293b', text: '#94a3b8', border: '#334155' },
};

function getCategoryStyle(category) {
  // Section-like categories
  if (category && category.startsWith('Sección')) {
    return { bg: '#1a1a2e', text: '#818cf8', border: '#3730a3' };
  }
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
}

// ── Module icons & colors ─────────────────────────────────────────────────────
const MODULE_STYLES = {
  business_plan_v3:    { gradient: 'from-indigo-900 to-indigo-700', badge: '#6366f1' },
  business_plan_v1:    { gradient: 'from-emerald-900 to-emerald-700', badge: '#10b981' },
  whitepaper_niw:      { gradient: 'from-amber-900 to-amber-700', badge: '#f59e0b' },
  econometric_study:   { gradient: 'from-pink-900 to-pink-700', badge: '#ec4899' },
  niw_plan_sections:   { gradient: 'from-violet-900 to-violet-700', badge: '#8b5cf6' },
  patent_uspto:        { gradient: 'from-sky-900 to-sky-700', badge: '#0ea5e9' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatChars(n) {
  if (n > 1000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${n} chars`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PromptManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveNotes, setSaveNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyContent, setHistoryContent] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // ── Full Module View ─────────────────────────────────────────────────────────
  const [isFullView, setIsFullView] = useState(false);
  const [fullContent, setFullContent] = useState('');
  const [fullOriginal, setFullOriginal] = useState('');
  const [fullViewLoading, setFullViewLoading] = useState(false);
  const [isSavingFull, setIsSavingFull] = useState(false);
  const [fullSaveNotes, setFullSaveNotes] = useState('');
  const [fullSaveResult, setFullSaveResult] = useState(null);

  // ── JSON Override View ───────────────────────────────────────────────────────
  const [isJsonView, setIsJsonView] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const [jsonOriginal, setJsonOriginal] = useState('');
  const [jsonOverrideInfo, setJsonOverrideInfo] = useState(null); // {has_override, updated_at, key_count, notes}
  const [jsonViewLoading, setJsonViewLoading] = useState(false);
  const [isSavingJson, setIsSavingJson] = useState(false);
  const [isDeletingJson, setIsDeletingJson] = useState(false);
  const [jsonNotes, setJsonNotes] = useState('');
  const [jsonError, setJsonError] = useState('');

  // ── JSON Override History ────────────────────────────────────────────────────
  const [showJsonHistory, setShowJsonHistory] = useState(false);
  const [jsonHistory, setJsonHistory] = useState([]);
  const [jsonHistoryLoading, setJsonHistoryLoading] = useState(false);
  const [jsonHistoryVersionContent, setJsonHistoryVersionContent] = useState(null);
  const [editingResultNotes, setEditingResultNotes] = useState(null); // { version, value }
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [isSavingResultNotes, setIsSavingResultNotes] = useState(false);

  const textareaRef = useRef(null);

  // ── Auth Guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Axios already has Authorization header set from AuthContext (localStorage)
  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`
  });

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // State for tracking JSON override status per module
  const [moduleJsonStatus, setModuleJsonStatus] = useState({}); // { module_id: { has_override, key_count } }

  // ── Load modules ────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/api/admin/prompts/modules`, { headers: authHeader() })
      .then(r => {
        setModules(r.data);
        if (r.data.length > 0) setSelectedModule(r.data[0]);
      })
      .catch(() => showToast('Error cargando módulos', 'error'));
  }, []);

  // ── Load prompts for selected module ────────────────────────────────────────
  useEffect(() => {
    if (!selectedModule) return;
    setPrompts([]);
    setSelectedPromptKey(null);
    setEditorContent('');
    setOriginalContent('');
    setSearchFilter('');
    setCategoryFilter('');
    setIsFullView(false);
    setFullContent('');
    setFullOriginal('');
    setFullSaveResult(null);
    setIsJsonView(false);
    setJsonContent('');
    setJsonOriginal('');
    setJsonOverrideInfo(null);
    setJsonError('');
    setShowJsonHistory(false);
    setJsonHistory([]);
    setJsonHistoryVersionContent(null);
    setEditingResultNotes(null);

    axios.get(`${API}/api/admin/prompts/${selectedModule.id}`, { headers: authHeader() })
      .then(r => setPrompts(r.data))
      .catch(() => showToast('Error cargando prompts', 'error'));

    // Load JSON override status for this module (for sidebar badge)
    axios.get(`${API}/api/admin/json-override/${selectedModule.id}`, { headers: authHeader() })
      .then(r => setModuleJsonStatus(prev => ({
        ...prev,
        [selectedModule.id]: { has_override: r.data.has_override, key_count: r.data.key_count }
      })))
      .catch(() => {});
  }, [selectedModule]);

  // ── Load Full Module View ──────────────────────────────────────────────────
  const handleOpenFullView = async () => {
    setIsFullView(true);
    setIsJsonView(false);
    setSelectedPromptKey(null);
    setShowHistory(false);
    setFullSaveResult(null);
    setFullViewLoading(true);
    setFullContent('');
    setFullOriginal('');
    try {
      const r = await axios.get(
        `${API}/api/admin/prompts-full/${selectedModule.id}`,
        { headers: authHeader() }
      );
      setFullContent(r.data.content || '');
      setFullOriginal(r.data.content || '');
    } catch {
      showToast('Error cargando vista completa', 'error');
      setIsFullView(false);
    } finally {
      setFullViewLoading(false);
    }
  };

  // ── Save Full Module ────────────────────────────────────────────────────────
  const handleSaveFull = async () => {
    if (!fullContent.trim()) return;
    setIsSavingFull(true);
    setFullSaveResult(null);
    try {
      const r = await axios.post(
        `${API}/api/admin/prompts-full/${selectedModule.id}`,
        { content: fullContent, notes: fullSaveNotes },
        { headers: authHeader() }
      );
      setFullOriginal(fullContent);
      setFullSaveNotes('');
      setFullSaveResult(r.data);
      showToast(r.data.message || 'Guardado correctamente');
      // Refresh prompts list metadata
      const pr = await axios.get(`${API}/api/admin/prompts/${selectedModule.id}`, { headers: authHeader() });
      setPrompts(pr.data);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Error al guardar';
      showToast(msg, 'error');
    } finally {
      setIsSavingFull(false);
    }
  };

  // ── Open JSON Override View ──────────────────────────────────────────────────
  const handleOpenJsonView = async () => {
    setIsJsonView(true);
    setIsFullView(false);
    setSelectedPromptKey(null);
    setShowHistory(false);
    setShowJsonHistory(false);
    setJsonHistoryVersionContent(null);
    setEditingResultNotes(null);
    setJsonError('');
    setJsonViewLoading(true);
    setJsonContent('');
    setJsonOriginal('');
    try {
      const r = await axios.get(
        `${API}/api/admin/json-override/${selectedModule.id}`,
        { headers: authHeader() }
      );
      setJsonOverrideInfo(r.data);

      if (r.data.has_override && r.data.json_content) {
        // Has active override — show it
        let pretty = r.data.json_content;
        try { pretty = JSON.stringify(JSON.parse(r.data.json_content), null, 2); } catch {}
        setJsonContent(pretty);
        setJsonOriginal(pretty);
      } else {
        // No override — auto-export the current active prompts as JSON baseline
        try {
          const exp = await axios.get(
            `${API}/api/admin/json-export/${selectedModule.id}`,
            { headers: authHeader() }
          );
          const pretty = JSON.stringify(exp.data, null, 2);
          setJsonContent(pretty);
          setJsonOriginal('');  // Mark as not-yet-saved (changed vs empty original)
        } catch {
          setJsonContent('');
          setJsonOriginal('');
        }
      }
    } catch {
      showToast('Error cargando JSON override', 'error');
      setIsJsonView(false);
    } finally {
      setJsonViewLoading(false);
    }
  };

  // ── Reload export into editor (reset to current active prompts) ──────────────
  const handleReloadExport = async () => {
    if (!window.confirm('¿Recargar los prompts activos actuales en el editor? Se perderán los cambios no guardados.')) return;
    setJsonViewLoading(true);
    try {
      const exp = await axios.get(
        `${API}/api/admin/json-export/${selectedModule.id}`,
        { headers: authHeader() }
      );
      const pretty = JSON.stringify(exp.data, null, 2);
      setJsonContent(pretty);
      setJsonOriginal('');  // not saved yet
      setJsonError('');
    } catch {
      showToast('Error cargando prompts actuales', 'error');
    } finally {
      setJsonViewLoading(false);
    }
  };
  const handleJsonChange = (val) => {
    setJsonContent(val);
    if (!val.trim()) { setJsonError(''); return; }
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('El JSON debe ser un objeto con pares clave-valor, no un array.');
      } else {
        setJsonError('');
      }
    } catch (e) {
      setJsonError(`JSON inválido: ${e.message}`);
    }
  };

  // ── Save JSON Override ───────────────────────────────────────────────────────
  const handleSaveJson = async () => {
    if (!jsonContent.trim() || jsonError) return;
    setIsSavingJson(true);
    try {
      const r = await axios.put(
        `${API}/api/admin/json-override/${selectedModule.id}`,
        { json_content: jsonContent, notes: jsonNotes },
        { headers: authHeader() }
      );
      setJsonOriginal(jsonContent);
      setJsonNotes('');
      const newInfo = {
        has_override: true,
        key_count: r.data.key_count,
        updated_at: r.data.updated_at,
      };
      setJsonOverrideInfo(prev => ({ ...prev, ...newInfo }));
      setModuleJsonStatus(prev => ({ ...prev, [selectedModule.id]: newInfo }));
      showToast(r.data.message || 'JSON override guardado y activo');
      // Refresh history panel if open
      if (showJsonHistory) {
        const hr = await axios.get(
          `${API}/api/admin/json-override/${selectedModule.id}/history`,
          { headers: authHeader() }
        );
        setJsonHistory(hr.data);
      }
    } catch (e) {
      const msg = e.response?.data?.detail || 'Error al guardar JSON';
      showToast(msg, 'error');
    } finally {
      setIsSavingJson(false);
    }
  };

  // ── Delete JSON Override ─────────────────────────────────────────────────────
  const handleDeleteJson = async () => {
    if (!window.confirm('¿Desactivar el JSON override? Se volverán a usar los prompts individuales.')) return;
    setIsDeletingJson(true);
    try {
      await axios.delete(
        `${API}/api/admin/json-override/${selectedModule.id}`,
        { headers: authHeader() }
      );
      const newInfo = { has_override: false, key_count: 0 };
      setJsonOverrideInfo(prev => ({ ...prev, ...newInfo }));
      setModuleJsonStatus(prev => ({ ...prev, [selectedModule.id]: newInfo }));
      setJsonContent('');
      setJsonOriginal('');
      showToast('JSON override desactivado');
    } catch {
      showToast('Error al desactivar JSON override', 'error');
    } finally {
      setIsDeletingJson(false);
    }
  };

  // ── Load JSON Override History ───────────────────────────────────────────────
  const handleOpenJsonHistory = async () => {
    setShowJsonHistory(true);
    setJsonHistoryLoading(true);
    setJsonHistoryVersionContent(null);
    setEditingResultNotes(null);
    try {
      const r = await axios.get(
        `${API}/api/admin/json-override/${selectedModule.id}/history`,
        { headers: authHeader() }
      );
      setJsonHistory(r.data);
    } catch {
      showToast('Error cargando historial JSON', 'error');
    } finally {
      setJsonHistoryLoading(false);
    }
  };

  // ── View JSON Version Content ────────────────────────────────────────────────
  const handleViewJsonVersionContent = async (version) => {
    if (jsonHistoryVersionContent?.version === version) {
      setJsonHistoryVersionContent(null);
      return;
    }
    try {
      const r = await axios.get(
        `${API}/api/admin/json-override/${selectedModule.id}/history/${version}/content`,
        { headers: authHeader() }
      );
      setJsonHistoryVersionContent(r.data);
    } catch {
      showToast('Error cargando contenido de la versión', 'error');
    }
  };

  // ── Restore JSON Version ─────────────────────────────────────────────────────
  const handleRestoreJsonVersion = async (version) => {
    if (!window.confirm(`¿Restaurar la versión v${version} como el JSON override activo? Se creará una nueva versión con este contenido.`)) return;
    setIsRestoringVersion(true);
    try {
      const r = await axios.post(
        `${API}/api/admin/json-override/${selectedModule.id}/history/${version}/restore`,
        { notes: `Restaurado desde v${version}` },
        { headers: authHeader() }
      );
      showToast(r.data.message || `v${version} restaurado correctamente`);
      // Refresh history
      const hr = await axios.get(
        `${API}/api/admin/json-override/${selectedModule.id}/history`,
        { headers: authHeader() }
      );
      setJsonHistory(hr.data);
      setJsonHistoryVersionContent(null);
      // Refresh the override info + content in editor
      const or = await axios.get(
        `${API}/api/admin/json-override/${selectedModule.id}`,
        { headers: authHeader() }
      );
      setJsonOverrideInfo(or.data);
      if (or.data.has_override && or.data.json_content) {
        let pretty = or.data.json_content;
        try { pretty = JSON.stringify(JSON.parse(or.data.json_content), null, 2); } catch {}
        setJsonContent(pretty);
        setJsonOriginal(pretty);
      }
      setModuleJsonStatus(prev => ({
        ...prev,
        [selectedModule.id]: { has_override: or.data.has_override, key_count: or.data.key_count }
      }));
    } catch (e) {
      showToast(e.response?.data?.detail || 'Error al restaurar versión', 'error');
    } finally {
      setIsRestoringVersion(false);
    }
  };

  // ── Save Result Notes ────────────────────────────────────────────────────────
  const handleSaveResultNotes = async (version) => {
    if (!editingResultNotes || editingResultNotes.version !== version) return;
    setIsSavingResultNotes(true);
    try {
      await axios.patch(
        `${API}/api/admin/json-override/${selectedModule.id}/history/${version}/notes`,
        { result_notes: editingResultNotes.value },
        { headers: authHeader() }
      );
      setJsonHistory(prev => prev.map(v =>
        v.version === version ? { ...v, result_notes: editingResultNotes.value } : v
      ));
      setEditingResultNotes(null);
      showToast('Notas guardadas');
    } catch {
      showToast('Error guardando notas', 'error');
    } finally {
      setIsSavingResultNotes(false);
    }
  };

  // ── Select prompt & load content ────────────────────────────────────────────
  const handleSelectPrompt = useCallback(async (key) => {
    if (key === selectedPromptKey) return;
    setSelectedPromptKey(key);
    setEditorContent('');
    setOriginalContent('');
    setLoadingContent(true);
    setShowHistory(false);
    setHistoryContent(null);
    setSaveNotes('');
    try {
      const r = await axios.get(
        `${API}/api/admin/prompts/${selectedModule.id}/${key}/content`,
        { headers: authHeader() }
      );
      setEditorContent(r.data.content || '');
      setOriginalContent(r.data.content || '');
    } catch {
      showToast('Error cargando contenido', 'error');
    } finally {
      setLoadingContent(false);
    }
  }, [selectedPromptKey, selectedModule]);

  // ── Save prompt ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedPromptKey || !editorContent.trim()) return;
    setIsSaving(true);
    try {
      await axios.put(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}`,
        { content: editorContent, notes: saveNotes },
        { headers: authHeader() }
      );
      setOriginalContent(editorContent);
      setSaveNotes('');
      // Refresh prompts list for updated metadata
      const r = await axios.get(`${API}/api/admin/prompts/${selectedModule.id}`, { headers: authHeader() });
      setPrompts(r.data);
      showToast('Prompt guardado correctamente');
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset prompt ─────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selectedPromptKey) return;
    if (!window.confirm('¿Seguro que quieres restablecer al valor por defecto? Esta acción guardará el valor actual en el historial.')) return;
    setIsResetting(true);
    try {
      await axios.post(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/reset`,
        {},
        { headers: authHeader() }
      );
      // Reload content from default
      const r = await axios.get(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/content`,
        { headers: authHeader() }
      );
      setEditorContent(r.data.content || '');
      setOriginalContent(r.data.content || '');
      // Refresh prompts list
      const pr = await axios.get(`${API}/api/admin/prompts/${selectedModule.id}`, { headers: authHeader() });
      setPrompts(pr.data);
      showToast('Restablecido al valor por defecto');
    } catch {
      showToast('Error al restablecer', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Load history ─────────────────────────────────────────────────────────────
  const handleViewHistory = async () => {
    if (!selectedPromptKey) return;
    setShowHistory(true);
    setHistoryLoading(true);
    setHistoryContent(null);
    try {
      const r = await axios.get(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/history`,
        { headers: authHeader() }
      );
      setHistory(r.data);
    } catch {
      showToast('Error cargando historial', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Load history version content ─────────────────────────────────────────────
  const handleViewHistoryVersion = async (version) => {
    try {
      const r = await axios.get(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/history/${version}/content`,
        { headers: authHeader() }
      );
      setHistoryContent(r.data);
    } catch {
      showToast('Error cargando versión', 'error');
    }
  };

  // ── Restore version ──────────────────────────────────────────────────────────
  const handleRestoreVersion = async (version) => {
    if (!window.confirm(`¿Restaurar la versión ${version}? El estado actual se guardará en el historial.`)) return;
    try {
      await axios.post(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/restore`,
        { version },
        { headers: authHeader() }
      );
      // Reload editor content
      const r = await axios.get(
        `${API}/api/admin/prompts/${selectedModule.id}/${selectedPromptKey}/content`,
        { headers: authHeader() }
      );
      setEditorContent(r.data.content || '');
      setOriginalContent(r.data.content || '');
      setShowHistory(false);
      setHistoryContent(null);
      const pr = await axios.get(`${API}/api/admin/prompts/${selectedModule.id}`, { headers: authHeader() });
      setPrompts(pr.data);
      showToast(`Versión ${version} restaurada`);
    } catch {
      showToast('Error al restaurar', 'error');
    }
  };

  // ── Filter prompts ────────────────────────────────────────────────────────────
  const filteredPrompts = prompts.filter(p => {
    const matchSearch = !searchFilter ||
      p.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilter.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(prompts.map(p => p.category))];
  const selectedPromptMeta = prompts.find(p => p.key === selectedPromptKey);
  const hasChanges = editorContent !== originalContent;
  const modifiedCount = prompts.filter(p => p.is_modified).length;

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0a0e1a',
      color: '#e2e8f0',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#7f1d1d' : '#14532d',
          border: `1px solid ${toast.type === 'error' ? '#dc2626' : '#16a34a'}`,
          color: '#f1f5f9', padding: '12px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          fontSize: 14, fontWeight: 500,
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* ── Left: Module Sidebar ──────────────────────────────────────────── */}
      <div style={{
        width: 260,
        background: '#0f1629',
        borderRight: '1px solid #1e2d47',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e2d47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button
              onClick={() => navigate('/dashboard')}
              data-testid="back-to-dashboard"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', fontSize: 18, padding: '0 4px', lineHeight: 1,
              }}
              title="Volver al Dashboard"
            >←</button>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              Prompt Manager
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Solo acceso: dau@urpeailab.com</div>
        </div>

        {/* Module list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {modules.map(mod => {
            const isActive = selectedModule?.id === mod.id;
            const style = MODULE_STYLES[mod.id] || MODULE_STYLES.business_plan_v3;
            const jsonStatus = moduleJsonStatus[mod.id];
            const hasJson = jsonStatus?.has_override;
            return (
              <button
                key={mod.id}
                data-testid={`module-btn-${mod.id}`}
                onClick={() => setSelectedModule(mod)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                  gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                  background: isActive ? '#1a2744' : 'transparent',
                  border: isActive ? `1px solid ${style.badge}44` : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{mod.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#f1f5f9' : '#94a3b8',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {mod.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {mod.prompt_count} prompts
                    {hasJson && (
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 8,
                        background: '#0c2a1a', color: '#34d399', border: '1px solid #065f46',
                        fontWeight: 700, letterSpacing: '0.3px',
                      }}>JSON</span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: style.badge, flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center: Prompt List ───────────────────────────────────────────── */}
      <div style={{
        width: 310,
        background: '#0d1527',
        borderRight: '1px solid #1e2d47',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {selectedModule ? (
          <>
            {/* Module header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e2d47' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{selectedModule.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
                    {selectedModule.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    {modifiedCount > 0 ? (
                      <span style={{ color: '#fb923c' }}>{modifiedCount} modificado{modifiedCount > 1 ? 's' : ''}</span>
                    ) : (
                      <span style={{ color: '#22c55e' }}>Usando defaults</span>
                    )} · {prompts.length} prompts
                  </div>
                </div>
              </div>
              {/* Search */}
              <input
                type="text"
                placeholder="Buscar prompt..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                data-testid="prompt-search"
                style={{
                  width: '100%', background: '#0a0e1a', border: '1px solid #1e2d47',
                  borderRadius: 6, padding: '7px 10px', color: '#e2e8f0',
                  fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {/* Vista Completa button */}
              <button
                data-testid="btn-full-view"
                onClick={handleOpenFullView}
                style={{
                  width: '100%', marginTop: 8, padding: '8px 12px',
                  background: isFullView ? '#1e1b4b' : '#0a0e1a',
                  border: `1px solid ${isFullView ? '#6366f1' : '#1e2d47'}`,
                  borderRadius: 8, cursor: 'pointer',
                  color: isFullView ? '#a5b4fc' : '#64748b',
                  fontSize: 12, fontWeight: 600, textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 14 }}>⚡</span>
                Vista Completa del Módulo
              </button>
              {/* JSON Import button */}
              <button
                data-testid="btn-json-view"
                onClick={handleOpenJsonView}
                style={{
                  width: '100%', marginTop: 6, padding: '8px 12px',
                  background: isJsonView ? '#0c2a1a' : '#0a0e1a',
                  border: `1px solid ${isJsonView ? '#16a34a' : (moduleJsonStatus[selectedModule?.id]?.has_override ? '#065f46' : '#1e2d47')}`,
                  borderRadius: 8, cursor: 'pointer',
                  color: isJsonView ? '#34d399' : (moduleJsonStatus[selectedModule?.id]?.has_override ? '#4ade80' : '#64748b'),
                  fontSize: 12, fontWeight: 600, textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 13 }}>{ '{' }{ '}' }</span>
                JSON Import
                {moduleJsonStatus[selectedModule?.id]?.has_override && (
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 8,
                    background: '#065f46', color: '#34d399', border: '1px solid #16a34a',
                    fontWeight: 700,
                  }}>ACTIVO</span>
                )}
              </button>
              {/* Category filter */}
              {categories.length > 2 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    onClick={() => setCategoryFilter('')}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 12,
                      border: `1px solid ${!categoryFilter ? '#6366f1' : '#1e2d47'}`,
                      background: !categoryFilter ? '#1e1b4b' : 'transparent',
                      color: !categoryFilter ? '#a5b4fc' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >Todos</button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                      style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 12,
                        border: `1px solid ${categoryFilter === cat ? getCategoryStyle(cat).border : '#1e2d47'}`,
                        background: categoryFilter === cat ? getCategoryStyle(cat).bg : 'transparent',
                        color: categoryFilter === cat ? getCategoryStyle(cat).text : '#64748b',
                        cursor: 'pointer',
                      }}
                    >{cat}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {filteredPrompts.map(p => {
                const isActive = selectedPromptKey === p.key;
                const catStyle = getCategoryStyle(p.category);
                return (
                  <button
                    key={p.key}
                    data-testid={`prompt-item-${p.key}`}
                    onClick={() => handleSelectPrompt(p.key)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px',
                      borderRadius: 8, marginBottom: 3,
                      background: isActive ? '#131f35' : 'transparent',
                      border: isActive ? '1px solid #1e3a5f' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{
                        fontSize: 12, fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#f1f5f9' : '#94a3b8',
                        lineHeight: 1.4, flex: 1,
                      }}>
                        {p.label}
                      </div>
                      {p.is_modified && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#fb923c', flexShrink: 0, marginTop: 4,
                        }} title="Modificado" />
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 9.5, padding: '2px 7px', borderRadius: 10,
                        background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                        fontWeight: 600,
                      }}>{p.category}</span>
                      <span style={{ fontSize: 10, color: '#475569' }}>{formatChars(p.char_count)}</span>
                      {p.history_count > 0 && (
                        <span style={{ fontSize: 10, color: '#334155' }}>
                          {p.history_count} vers.
                        </span>
                      )}
                    </div>
                    {p.is_modified && p.updated_at && (
                      <div style={{ fontSize: 10, color: '#92400e', marginTop: 3 }}>
                        Editado: {formatDate(p.updated_at)}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredPrompts.length === 0 && (
                <div style={{ textAlign: 'center', color: '#334155', padding: '24px 0', fontSize: 12 }}>
                  Sin resultados
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            Selecciona un módulo
          </div>
        )}
      </div>

      {/* ── Right: Editor (Individual or Full View) ──────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        
        {/* ── FULL VIEW MODE ─────────────────────────────────────────────── */}
        {isFullView ? (
          <>
            {/* Full view toolbar */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #1e2d47',
              background: '#0d1527',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 12,
                    background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #6366f1',
                    fontWeight: 700,
                  }}>⚡ VISTA COMPLETA</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                    {selectedModule?.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    — {prompts.length} prompts en un solo editor
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                  Edita todo el módulo directamente. Los separadores (╔═══╗) definen cada sección — no los borres.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {fullContent !== fullOriginal && (
                  <span style={{
                    fontSize: 11, color: '#f59e0b', background: '#451a03',
                    padding: '3px 8px', borderRadius: 6, border: '1px solid #78350f',
                  }}>Cambios sin guardar</span>
                )}
                <button
                  data-testid="btn-exit-full-view"
                  onClick={() => { setIsFullView(false); setFullSaveResult(null); }}
                  style={{
                    background: '#1e293b', border: '1px solid #334155',
                    color: '#94a3b8', padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >← Vista Individual</button>
                <button
                  data-testid="btn-save-full"
                  onClick={handleSaveFull}
                  disabled={isSavingFull || fullContent === fullOriginal}
                  style={{
                    background: fullContent !== fullOriginal ? '#1d4ed8' : '#111827',
                    border: `1px solid ${fullContent !== fullOriginal ? '#2563eb' : '#1e293b'}`,
                    color: fullContent !== fullOriginal ? '#fff' : '#374151',
                    padding: '7px 20px', borderRadius: 8,
                    cursor: fullContent !== fullOriginal ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 700,
                  }}
                >{isSavingFull ? 'Guardando...' : 'Guardar Todo'}</button>
              </div>
            </div>
            {/* Notes + stats bar */}
            <div style={{
              padding: '7px 20px', borderBottom: '1px solid #1e2d47',
              background: '#0a0e1a', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>Nota:</span>
              <input
                type="text"
                placeholder="Ej: Reforzar prohibiciones en toda la sección (opcional)"
                value={fullSaveNotes}
                onChange={e => setFullSaveNotes(e.target.value)}
                data-testid="full-save-notes"
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, outline: 'none' }}
              />
              <span style={{ fontSize: 10.5, color: '#334155', whiteSpace: 'nowrap' }}>
                {fullContent.length.toLocaleString()} chars
              </span>
              {fullSaveResult && (
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 8,
                  background: '#14532d', color: '#4ade80', border: '1px solid #166534', whiteSpace: 'nowrap',
                }}>
                  {fullSaveResult.saved_count} guardadas · {fullSaveResult.unchanged_count} sin cambios
                </span>
              )}
            </div>
            {/* Full editor */}
            {fullViewLoading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#475569' }}>
                <div style={{ fontSize: 24 }}>⚡</div>
                <div style={{ fontSize: 13 }}>Cargando todos los prompts del módulo...</div>
              </div>
            ) : (
              <textarea
                data-testid="full-prompt-editor"
                value={fullContent}
                onChange={e => setFullContent(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1, width: '100%', background: '#050810', color: '#d4e0f7',
                  border: 'none', outline: 'none', resize: 'none',
                  padding: '20px 28px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: 12, lineHeight: 1.75, boxSizing: 'border-box', tabSize: 2,
                }}
              />
            )}
          </>
        ) : isJsonView ? (
          <>
            {/* ── JSON Override toolbar ──────────────────────────────────── */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #1e2d47',
              background: '#0d1527',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 12,
                    background: jsonOverrideInfo?.has_override ? '#0c2a1a' : '#1a1a2e',
                    color: jsonOverrideInfo?.has_override ? '#34d399' : '#6366f1',
                    border: `1px solid ${jsonOverrideInfo?.has_override ? '#16a34a' : '#4f46e5'}`,
                    fontWeight: 700,
                  }}>
                    {jsonOverrideInfo?.has_override ? '● JSON ACTIVO' : '○ VISTA ACTUAL (sin override)'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                    {selectedModule?.label}
                  </span>
                  {jsonOverrideInfo?.has_override && (
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      — {jsonOverrideInfo.key_count} secciones · Actualizado: {formatDate(jsonOverrideInfo.updated_at)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                  {jsonOverrideInfo?.has_override
                    ? 'Este JSON está activo y reemplaza todos los prompts individuales del módulo.'
                    : 'Cargando los prompts activos del módulo. Edítalos y haz clic en "Activar JSON" para usarlos.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {jsonContent !== jsonOriginal && (
                  <span style={{
                    fontSize: 11, color: '#f59e0b', background: '#451a03',
                    padding: '3px 8px', borderRadius: 6, border: '1px solid #78350f',
                  }}>Cambios sin guardar</span>
                )}
                <button
                  data-testid="btn-json-history"
                  onClick={handleOpenJsonHistory}
                  style={{
                    background: showJsonHistory ? '#131f35' : '#1e293b',
                    border: `1px solid ${showJsonHistory ? '#3b5bdb' : '#334155'}`,
                    color: showJsonHistory ? '#818cf8' : '#94a3b8',
                    padding: '7px 12px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >Historial{jsonHistory.length > 0 && <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{jsonHistory.length}</span>}</button>
                <button
                  data-testid="btn-reload-json-export"
                  onClick={handleReloadExport}
                  title="Recargar desde los prompts actuales del módulo"
                  style={{
                    background: '#0f172a', border: '1px solid #334155',
                    color: '#94a3b8', padding: '7px 12px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >↺ Recargar</button>
                {jsonOverrideInfo?.has_override && (
                  <button
                    data-testid="btn-delete-json-override"
                    onClick={handleDeleteJson}
                    disabled={isDeletingJson}
                    style={{
                      background: '#2d1b1b', border: '1px solid #7f1d1d',
                      color: '#f87171', padding: '7px 14px', borderRadius: 8,
                      cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    }}
                  >{isDeletingJson ? 'Desactivando...' : 'Desactivar'}</button>
                )}
                <button
                  data-testid="btn-exit-json-view"
                  onClick={() => { setIsJsonView(false); }}
                  style={{
                    background: '#1e293b', border: '1px solid #334155',
                    color: '#94a3b8', padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >← Volver</button>
                <button
                  data-testid="btn-save-json-override"
                  onClick={handleSaveJson}
                  disabled={isSavingJson || !jsonContent.trim() || !!jsonError || jsonContent === jsonOriginal}
                  style={{
                    background: (!jsonError && jsonContent.trim() && jsonContent !== jsonOriginal) ? '#166534' : '#111827',
                    border: `1px solid ${(!jsonError && jsonContent.trim() && jsonContent !== jsonOriginal) ? '#16a34a' : '#1e293b'}`,
                    color: (!jsonError && jsonContent.trim() && jsonContent !== jsonOriginal) ? '#fff' : '#374151',
                    padding: '7px 20px', borderRadius: 8,
                    cursor: (!jsonError && jsonContent.trim() && jsonContent !== jsonOriginal) ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 700,
                  }}
                >{isSavingJson ? 'Guardando...' : (jsonOverrideInfo?.has_override ? 'Actualizar JSON' : 'Activar JSON')}</button>
              </div>
            </div>

            {/* Notes + char count bar */}
            <div style={{
              padding: '7px 20px', borderBottom: '1px solid #1e2d47',
              background: '#0a0e1a', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>Nota:</span>
              <input
                type="text"
                placeholder="Ej: Nuevo prompt para versión campaña Q2 (opcional)"
                value={jsonNotes}
                onChange={e => setJsonNotes(e.target.value)}
                data-testid="json-save-notes"
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, outline: 'none' }}
              />
              {jsonError ? (
                <span style={{
                  fontSize: 11, color: '#f87171', background: '#2d1b1b',
                  padding: '3px 8px', borderRadius: 6, border: '1px solid #7f1d1d',
                  whiteSpace: 'nowrap', maxWidth: 320,
                }}>⚠ {jsonError}</span>
              ) : (
                <span style={{ fontSize: 10.5, color: '#334155', whiteSpace: 'nowrap' }}>
                  {jsonContent.length.toLocaleString()} chars
                  {!jsonError && jsonContent.trim() && (
                    <span style={{ color: '#34d399', marginLeft: 6 }}>
                      ✓ JSON válido{(() => { try { const k = Object.keys(JSON.parse(jsonContent)); return ` · ${k.length} claves`; } catch { return ''; } })()}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* JSON editor */}
            {jsonViewLoading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#475569' }}>
                <div style={{ fontSize: 24 }}>{ '{' }{ '}' }</div>
                <div style={{ fontSize: 13 }}>Cargando JSON override...</div>
              </div>
            ) : (
              <textarea
                data-testid="json-override-editor"
                value={jsonContent}
                onChange={e => handleJsonChange(e.target.value)}
                spellCheck={false}
                placeholder={`Los prompts activos del módulo se cargan automáticamente aquí en formato JSON.\n\nPuedes:\n• Editar directamente este JSON y hacer clic en "Activar JSON"\n• Copiar el contenido para trabajarlo en un editor externo\n• Pegar un JSON editado externamente\n• Usar "↺ Recargar" para volver al estado actual del módulo\n\nFormato:\n{\n  "system_prompt": "You are an expert NIW business plan writer...",\n  "absolute_prohibitions": "NEVER invent statistics...",\n  "section_1_instructions": "Write the Executive Summary..."\n}`}
                style={{
                  flex: 1, width: '100%',
                  background: jsonError ? '#0d0808' : '#050810',
                  color: jsonError ? '#fca5a5' : '#d4e0f7',
                  border: jsonError ? '2px solid #7f1d1d' : 'none',
                  outline: 'none', resize: 'none',
                  padding: '20px 28px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: 12, lineHeight: 1.75, boxSizing: 'border-box', tabSize: 2,
                  transition: 'background 0.2s, border 0.2s',
                }}
              />
            )}
          </>
        ) : selectedPromptKey ? (
          <>
            {/* Editor toolbar */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #1e2d47',
              background: '#0d1527',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
                  {selectedPromptMeta?.label || selectedPromptKey}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {selectedPromptMeta?.description}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {hasChanges && (
                  <span style={{
                    fontSize: 11, color: '#f59e0b',
                    background: '#451a03', padding: '3px 8px',
                    borderRadius: 6, border: '1px solid #78350f',
                  }}>Cambios sin guardar</span>
                )}

                <button
                  data-testid="btn-view-history"
                  onClick={handleViewHistory}
                  style={{
                    background: '#1e293b', border: '1px solid #334155',
                    color: '#94a3b8', padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >
                  Historial
                </button>

                <button
                  data-testid="btn-reset-default"
                  onClick={handleReset}
                  disabled={isResetting || !selectedPromptMeta?.is_modified}
                  style={{
                    background: selectedPromptMeta?.is_modified ? '#2d1b1b' : '#111827',
                    border: `1px solid ${selectedPromptMeta?.is_modified ? '#7f1d1d' : '#1e293b'}`,
                    color: selectedPromptMeta?.is_modified ? '#f87171' : '#374151',
                    padding: '7px 14px', borderRadius: 8, cursor: selectedPromptMeta?.is_modified ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 500,
                  }}
                >
                  {isResetting ? 'Restableciendo...' : 'Restablecer Default'}
                </button>

                <button
                  data-testid="btn-save-prompt"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  style={{
                    background: hasChanges ? '#1d4ed8' : '#111827',
                    border: `1px solid ${hasChanges ? '#2563eb' : '#1e293b'}`,
                    color: hasChanges ? '#fff' : '#374151',
                    padding: '7px 18px', borderRadius: 8,
                    cursor: hasChanges ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>

            {/* Notes input */}
            <div style={{
              padding: '8px 20px',
              borderBottom: '1px solid #1e2d47',
              background: '#0a0e1a',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>Nota de versión:</span>
              <input
                type="text"
                placeholder="Ej: Aumenté la strictness en citas bibliográficas (opcional)"
                value={saveNotes}
                onChange={e => setSaveNotes(e.target.value)}
                data-testid="save-notes-input"
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: '#94a3b8', fontSize: 12, outline: 'none',
                  padding: '4px 0',
                }}
              />
              <span style={{ fontSize: 10, color: '#334155', whiteSpace: 'nowrap' }}>
                {editorContent.length.toLocaleString()} chars
              </span>
            </div>

            {/* Editor area */}
            {loadingContent ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: 13,
              }}>
                Cargando contenido...
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                data-testid="prompt-editor"
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1,
                  width: '100%',
                  background: '#050810',
                  color: '#d4e0f7',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '20px 24px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  boxSizing: 'border-box',
                  tabSize: 2,
                }}
                placeholder="Escribe aquí el prompt..."
              />
            )}
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#334155', gap: 12,
          }}>
            <div style={{ fontSize: 40 }}>✍️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
              Selecciona un prompt para editar
            </div>
            <div style={{ fontSize: 12, color: '#334155', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
              Elige un prompt de la lista para editarlo individualmente, usa
              <strong style={{ color: '#a5b4fc' }}> ⚡ Vista Completa</strong> para editar todo el módulo,
              o usa <strong style={{ color: '#34d399' }}> {'{}'} JSON Import</strong> para cargar un JSON completo que reemplaza todos los prompts.
            </div>
          </div>
        )}
      </div>

      {/* ── History Panel (slide-in) ──────────────────────────────────────── */}
      {showHistory && (
        <div style={{
          width: 400,
          background: '#0d1527',
          borderLeft: '1px solid #1e2d47',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* History header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #1e2d47',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Historial de Versiones</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                {selectedPromptMeta?.label}
              </div>
            </div>
            <button
              data-testid="btn-close-history"
              onClick={() => { setShowHistory(false); setHistoryContent(null); }}
              style={{
                background: 'none', border: 'none', color: '#475569',
                cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px',
              }}
            >✕</button>
          </div>

          {historyLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
              Cargando historial...
            </div>
          ) : history.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
              Sin historial de versiones
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Version detail (if selected) */}
              {historyContent && (
                <div style={{
                  padding: '12px 14px',
                  background: '#0a0e1a',
                  borderBottom: '1px solid #1e2d47',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                      Versión {historyContent.version} — {formatDate(historyContent.saved_at)}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        data-testid={`btn-restore-${historyContent.version}`}
                        onClick={() => handleRestoreVersion(historyContent.version)}
                        style={{
                          background: '#1d4ed8', border: 'none',
                          color: '#fff', padding: '5px 12px', borderRadius: 6,
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}
                      >Restaurar</button>
                      <button
                        onClick={() => setHistoryContent(null)}
                        style={{
                          background: '#1e293b', border: '1px solid #334155',
                          color: '#64748b', padding: '5px 8px', borderRadius: 6,
                          cursor: 'pointer', fontSize: 11,
                        }}
                      >✕</button>
                    </div>
                  </div>
                  <textarea
                    value={historyContent.content}
                    readOnly
                    style={{
                      width: '100%', height: 200, background: '#050810',
                      border: '1px solid #1e2d47', borderRadius: 6,
                      color: '#94a3b8', fontFamily: 'monospace', fontSize: 11,
                      padding: '10px 12px', boxSizing: 'border-box',
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Version list */}
              {history.map(v => (
                <div
                  key={v.version}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #131f2e',
                    cursor: 'pointer',
                    background: historyContent?.version === v.version ? '#131f35' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => handleViewHistoryVersion(v.version)}
                  data-testid={`history-version-${v.version}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                        Versión {v.version}
                        {v.is_default_snapshot && (
                          <span style={{
                            marginLeft: 6, fontSize: 9, background: '#1e3a5f',
                            color: '#60a5fa', padding: '2px 6px', borderRadius: 8,
                          }}>DEFAULT</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
                        {formatDate(v.saved_at)}
                      </div>
                      {v.notes && (
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3, fontStyle: 'italic' }}>
                          "{v.notes}"
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#334155', whiteSpace: 'nowrap' }}>
                      {formatChars(v.char_count)}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 6, lineHeight: 1.4 }}>
                    {v.preview}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── JSON History Panel (slide-in) ─────────────────────────────────── */}
      {showJsonHistory && (
        <div style={{
          width: 440,
          background: '#0d1527',
          borderLeft: '1px solid #1e2d47',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #1e2d47',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Historial de JSON Overrides</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                {selectedModule?.label} — {jsonHistory.length} versione{jsonHistory.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              data-testid="btn-close-json-history"
              onClick={() => { setShowJsonHistory(false); setJsonHistoryVersionContent(null); setEditingResultNotes(null); }}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}
            >✕</button>
          </div>

          {jsonHistoryLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
              Cargando historial...
            </div>
          ) : jsonHistory.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 8 }}>
              <div style={{ fontSize: 28 }}>{'{ }'}</div>
              <div style={{ fontSize: 12 }}>Sin versiones guardadas</div>
              <div style={{ fontSize: 11, color: '#1e3a5f', maxWidth: 220, textAlign: 'center' }}>
                Cada vez que guardes un JSON override se creará una versión aquí.
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Version list with inline JSON expansion */}
              {jsonHistory.map(v => {
                const isExpanded = jsonHistoryVersionContent?.version === v.version;
                let prettyJson = '';
                if (isExpanded && jsonHistoryVersionContent?.json_content) {
                  try { prettyJson = JSON.stringify(JSON.parse(jsonHistoryVersionContent.json_content), null, 2); }
                  catch { prettyJson = jsonHistoryVersionContent.json_content; }
                }
                return (
                <div
                  key={v.version}
                  data-testid={`json-history-v${v.version}`}
                  style={{
                    borderBottom: '1px solid #131f2e',
                    background: isExpanded ? '#0e1a2e' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Version header row */}
                  <div style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isExpanded ? '#818cf8' : '#94a3b8' }}>
                            v{v.version}
                          </span>
                          {v.is_active && (
                            <span style={{
                              fontSize: 9, background: '#0c2a1a', color: '#34d399',
                              border: '1px solid #16a34a', padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                            }}>ACTIVO</span>
                          )}
                          {v.restored_from && (
                            <span style={{
                              fontSize: 9, background: '#1e1b4b', color: '#a5b4fc',
                              border: '1px solid #3730a3', padding: '2px 6px', borderRadius: 10,
                            }}>↩ desde v{v.restored_from}</span>
                          )}
                          <span style={{ fontSize: 10, color: '#334155' }}>{v.key_count} secciones</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3 }}>
                          {formatDate(v.saved_at)} · {v.saved_by}
                        </div>
                        {v.notes && (
                          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3, fontStyle: 'italic' }}>
                            "{v.notes}"
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                        <button
                          data-testid={`btn-ver-json-v${v.version}`}
                          onClick={() => handleViewJsonVersionContent(v.version)}
                          style={{
                            background: isExpanded ? '#1e1b4b' : '#1e293b',
                            border: `1px solid ${isExpanded ? '#3730a3' : '#334155'}`,
                            color: isExpanded ? '#a5b4fc' : '#64748b',
                            padding: '4px 9px', borderRadius: 6,
                            cursor: 'pointer', fontSize: 10.5, fontWeight: 500,
                          }}
                        >{isExpanded ? 'Ocultar' : 'Ver JSON'}</button>
                        <button
                          data-testid={`btn-restore-v${v.version}`}
                          onClick={() => handleRestoreJsonVersion(v.version)}
                          disabled={isRestoringVersion || v.is_active}
                          style={{
                            background: v.is_active ? '#0c2a1a' : '#1e3a5f',
                            border: `1px solid ${v.is_active ? '#16a34a' : '#1e3a8a'}`,
                            color: v.is_active ? '#34d399' : '#60a5fa',
                            padding: '4px 10px', borderRadius: 6,
                            cursor: isRestoringVersion || v.is_active ? 'not-allowed' : 'pointer',
                            fontSize: 10.5, fontWeight: 600,
                            opacity: isRestoringVersion ? 0.6 : 1,
                          }}
                        >{v.is_active ? '✓ Activo' : isRestoringVersion ? '...' : 'Restaurar'}</button>
                      </div>
                    </div>

                    {/* Documents generated */}
                    {v.doc_count > 0 && (
                      <div style={{
                        marginTop: 7, padding: '5px 8px',
                        background: '#0a0e1a', borderRadius: 5,
                        border: '1px solid #1e2d47',
                      }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>
                          {v.doc_count} doc{v.doc_count !== 1 ? 's' : ''} generado{v.doc_count !== 1 ? 's' : ''} con esta versión:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {v.documents_generated.slice(0, 6).map(docId => (
                            <span
                              key={docId}
                              data-testid={`doc-badge-${docId}`}
                              title={docId}
                              style={{
                                fontSize: 9.5, background: '#131f35', color: '#60a5fa',
                                border: '1px solid #1e3a5f', padding: '2px 6px',
                                borderRadius: 4, fontFamily: 'monospace', cursor: 'default',
                              }}
                            >{docId.slice(0, 8)}…</span>
                          ))}
                          {v.doc_count > 6 && (
                            <span style={{ fontSize: 9.5, color: '#334155' }}>+{v.doc_count - 6} más</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Result notes */}
                    <div style={{ marginTop: 7 }}>
                      {editingResultNotes?.version === v.version ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <textarea
                            data-testid={`result-notes-input-v${v.version}`}
                            value={editingResultNotes.value}
                            onChange={e => setEditingResultNotes({ version: v.version, value: e.target.value })}
                            placeholder="¿Qué tan bien funcionó esta versión? Resultados, observaciones..."
                            rows={2}
                            style={{
                              flex: 1, background: '#0a0e1a', border: '1px solid #1e3a5f',
                              borderRadius: 5, color: '#94a3b8', fontSize: 11, padding: '5px 8px',
                              resize: 'none', outline: 'none', fontFamily: 'inherit',
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button
                              data-testid={`btn-save-notes-v${v.version}`}
                              onClick={() => handleSaveResultNotes(v.version)}
                              disabled={isSavingResultNotes}
                              style={{
                                background: '#166534', border: 'none', color: '#fff',
                                padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
                                fontSize: 10, fontWeight: 600,
                              }}
                            >{isSavingResultNotes ? '...' : 'Guardar'}</button>
                            <button
                              onClick={() => setEditingResultNotes(null)}
                              style={{
                                background: '#1e293b', border: '1px solid #334155',
                                color: '#64748b', padding: '4px 8px', borderRadius: 5,
                                cursor: 'pointer', fontSize: 10,
                              }}
                            >Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          data-testid={`result-notes-v${v.version}`}
                          onClick={() => setEditingResultNotes({ version: v.version, value: v.result_notes || '' })}
                          style={{
                            fontSize: 10.5, padding: '4px 8px', borderRadius: 5,
                            border: '1px dashed #1e2d47', cursor: 'text',
                            color: v.result_notes ? '#94a3b8' : '#334155',
                            background: '#0a0e1a', minHeight: 28,
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          {v.result_notes || '+ Añadir nota de resultado (¿qué tan bien funcionó?)'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline JSON preview (expandable) */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 14px 14px',
                      background: '#050810',
                      borderTop: '1px solid #1e2d47',
                    }}>
                      <div style={{ fontSize: 10, color: '#475569', padding: '8px 0 5px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>JSON completo · v{v.version}</span>
                        <span style={{ color: '#334155' }}>{v.key_count} claves</span>
                      </div>
                      <textarea
                        value={prettyJson}
                        readOnly
                        data-testid={`json-version-preview-${v.version}`}
                        style={{
                          width: '100%', height: 240, background: '#0a0e1a',
                          border: '1px solid #1e2d47', borderRadius: 6,
                          color: '#94a3b8', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontSize: 10.5, padding: '10px 12px',
                          boxSizing: 'border-box', resize: 'vertical', outline: 'none', lineHeight: 1.6,
                        }}
                      />
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d47; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
        textarea, input { caret-color: #60a5fa; }
      `}</style>
    </div>
  );
}
