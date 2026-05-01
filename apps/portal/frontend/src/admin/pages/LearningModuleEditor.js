import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { ArrowLeft, Save, Upload, Trash2, RefreshCw, Plus, X, FileText, Sparkles, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const blank = {
  title: '',
  description: '',
  system_prompt:
    'Eres un tutor virtual de URPE especializado en este módulo. Responde en español de forma clara y concisa.',
  mode: 'free',
  objectives: [],
  llm_model: 'openai/gpt-4o-mini',
  status: 'draft',
  order_index: 0,
};

export const LearningModuleEditor = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const isNew = !moduleId || moduleId === 'new';

  const [form, setForm] = useState(blank);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null); // { file, filename } — se indexa al Guardar
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalResult, setRetrievalResult] = useState(null);
  const fileInputRef = useRef();
  const draftInputRef = useRef();

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
  });

  const fetchModule = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/admin/learning/modules/${moduleId}`, {
        headers: headers(),
      });
      const m = data.module;
      setForm({
        ...blank,
        ...m,
        objectives: m.objectives || [],
      });
      setDocuments(data.documents || []);
    } catch (err) {
      toast.error('Error cargando módulo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isNew) fetchModule();
  }, [moduleId]);

  const uploadPendingDocFor = async (targetModuleId) => {
    if (!pendingDoc?.file || !targetModuleId) return false;
    const fd = new FormData();
    fd.append('file', pendingDoc.file);
    fd.append('module_id', targetModuleId);
    try {
      await axios.post(`${API}/admin/learning/documents`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Indexando "${pendingDoc.filename}"…`);
      setPendingDoc(null);
      return true;
    } catch (err) {
      toast.error(
        `Módulo guardado, pero falló subir "${pendingDoc.filename}": ${
          err.response?.data?.detail || err.message
        }`,
      );
      return false;
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.system_prompt.trim()) {
      toast.error('Título y prompt del sistema son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await axios.post(`${API}/admin/learning/modules`, form, {
          headers: headers(),
        });
        const newId = data.module.id;
        toast.success('Módulo creado');
        if (pendingDoc) await uploadPendingDocFor(newId);
        navigate(`/admin/learning-admin/${newId}`, { replace: true });
      } else {
        await axios.patch(`${API}/admin/learning/modules/${moduleId}`, form, {
          headers: headers(),
        });
        toast.success('Cambios guardados');
        if (pendingDoc) await uploadPendingDocFor(moduleId);
        fetchModule();
        setTimeout(fetchModule, 5000);
      }
    } catch (err) {
      toast.error('Error guardando módulo');
    } finally {
      setSaving(false);
    }
  };

  const handleDraftFromDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasUserContent =
      form.title.trim() ||
      (form.description || '').trim() ||
      (form.system_prompt || '').trim() !== blank.system_prompt.trim() ||
      (form.objectives || []).length > 0;

    if (hasUserContent) {
      const ok = window.confirm(
        'Esto reemplazará los campos del formulario con la propuesta del AI. ¿Continuar?'
      );
      if (!ok) {
        if (draftInputRef.current) draftInputRef.current.value = '';
        return;
      }
    }

    const fd = new FormData();
    fd.append('file', file);

    setDrafting(true);
    try {
      const { data } = await axios.post(
        `${API}/admin/learning/modules/draft-from-document`,
        fd,
        { headers: { ...headers(), 'Content-Type': 'multipart/form-data' } },
      );
      const d = data.draft || {};
      setForm((prev) => ({
        ...prev,
        title: d.title || prev.title,
        description: d.description || prev.description,
        system_prompt: d.system_prompt || prev.system_prompt,
        mode: d.mode || prev.mode,
        objectives: Array.isArray(d.objectives) ? d.objectives : prev.objectives,
      }));
      setPendingDoc({ file, filename: file.name });
      toast.success(
        data.truncated
          ? 'Borrador generado (documento truncado). Al Guardar, el archivo se indexará automáticamente.'
          : 'Borrador generado. Al Guardar, el archivo se indexará automáticamente.',
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error generando el borrador con AI');
    } finally {
      setDrafting(false);
      if (draftInputRef.current) draftInputRef.current.value = '';
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isNew) {
      toast.error('Guarda el módulo primero antes de subir documentos');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('module_id', moduleId);

    setUploading(true);
    try {
      await axios.post(`${API}/admin/learning/documents`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Documento subido. Indexación en proceso…');
      fetchModule();
      // Refresca a los pocos segundos para ver el status actualizado
      setTimeout(fetchModule, 5000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error subiendo documento');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReindex = async (docId) => {
    try {
      await axios.post(`${API}/admin/learning/documents/${docId}/reindex`, {}, { headers: headers() });
      toast.success('Reindexando…');
      setTimeout(fetchModule, 4000);
    } catch (err) {
      toast.error('Error reindexando');
    }
  };

  const handleDeleteDoc = async (docId, name) => {
    if (!window.confirm(`¿Eliminar documento "${name}"?`)) return;
    try {
      await axios.delete(`${API}/admin/learning/documents/${docId}`, { headers: headers() });
      toast.success('Documento eliminado');
      fetchModule();
    } catch (err) {
      toast.error('Error eliminando');
    }
  };

  const addObjective = () => {
    const id = `obj_${Date.now()}`;
    setForm({ ...form, objectives: [...(form.objectives || []), { id, text: '' }] });
  };

  const updateObjective = (idx, text) => {
    const next = [...(form.objectives || [])];
    next[idx] = { ...next[idx], text };
    setForm({ ...form, objectives: next });
  };

  const removeObjective = (idx) => {
    const next = [...(form.objectives || [])];
    next.splice(idx, 1);
    setForm({ ...form, objectives: next });
  };

  const handleTestRetrieval = async () => {
    const q = retrievalQuery.trim();
    if (!q || isNew) return;
    setRetrievalLoading(true);
    setRetrievalResult(null);
    try {
      const { data } = await axios.post(
        `${API}/admin/learning/modules/${moduleId}/test-retrieval`,
        { text: q },
        { headers: headers() },
      );
      setRetrievalResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error en la prueba de retrieval');
    } finally {
      setRetrievalLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Cargando…</div>;

  return (
    <div className="space-y-6 bg-white min-h-screen p-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/admin/learning-admin')} className="text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Nuevo módulo' : `Editar: ${form.title || '...'}`}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-gray-900">Información del módulo</CardTitle>
            <div className="flex flex-col items-end gap-2">
              <input
                ref={draftInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleDraftFromDocument}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => draftInputRef.current?.click()}
                disabled={drafting}
                className="text-gray-900 border-yellow-400 bg-yellow-50 hover:bg-yellow-100"
                title="Sube un PDF o DOCX. La AI propondrá los campos y el archivo se indexará al Guardar."
              >
                {drafting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 text-yellow-600" />
                    Generar con AI desde documento
                  </>
                )}
              </Button>
              {pendingDoc && (
                <div className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-300 rounded px-2 py-1 text-gray-800 max-w-xs">
                  <FileText className="h-3 w-3 text-yellow-700 flex-shrink-0" />
                  <span className="truncate" title={pendingDoc.filename}>
                    Se indexará al Guardar: <strong>{pendingDoc.filename}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingDoc(null)}
                    className="text-gray-500 hover:text-red-600"
                    title="Quitar archivo pendiente"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-900">Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Onboarding de asesores legales"
              className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
            />
          </div>
          <div>
            <Label className="text-gray-900">Descripción</Label>
            <Textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Resumen visible en el listado"
              className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
            />
          </div>
          <div>
            <Label className="text-gray-900">Prompt del sistema *</Label>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={6}
              className="font-mono text-sm bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
              placeholder="Instrucciones específicas para el avatar en este módulo"
            />
            <p className="text-xs text-gray-500 mt-1">
              El sistema añadirá automáticamente reglas de tono y modo (libre/guiado).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-900">Modo</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="free" className="text-gray-900">Libre (preguntas abiertas)</SelectItem>
                  <SelectItem value="guided" className="text-gray-900">Guiado (con objetivos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-900">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="draft" className="text-gray-900">Borrador</SelectItem>
                  <SelectItem value="published" className="text-gray-900">Publicado</SelectItem>
                  <SelectItem value="archived" className="text-gray-900">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-900">Modelo LLM (OpenRouter)</Label>
              <Input
                value={form.llm_model || ''}
                onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
                placeholder="openai/gpt-4o-mini"
                className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
              />
            </div>
          </div>

          {form.mode === 'guided' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-900">Objetivos del módulo</Label>
                <Button size="sm" variant="outline" onClick={addObjective} className="text-gray-900 border-gray-300">
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {(form.objectives || []).length === 0 && (
                  <p className="text-sm text-gray-400 italic">Sin objetivos. El avatar guiará genéricamente.</p>
                )}
                {(form.objectives || []).map((o, idx) => (
                  <div key={o.id || idx} className="flex gap-2">
                    <Input
                      value={o.text || ''}
                      onChange={(e) => updateObjective(idx, e.target.value)}
                      placeholder={`Objetivo ${idx + 1}`}
                      className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeObjective(idx)} className="text-gray-900 hover:bg-gray-100">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isNew && (
        <Card id="documents">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900">Material indexado (RAG)</CardTitle>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  className="text-gray-900 border-gray-300"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Subiendo…' : 'Subir PDF o DOCX'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aún no hay material para este módulo.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between border rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-900">{d.filename}</div>
                        <div className="text-xs text-gray-500 flex gap-2 items-center">
                          <Badge variant="outline" className="text-xs text-gray-700">{d.status}</Badge>
                          <span>{d.chunk_count || 0} chunks</span>
                          {d.size_bytes && (
                            <span>{Math.round(d.size_bytes / 1024)} KB</span>
                          )}
                        </div>
                        {d.error_message && (
                          <div className="text-xs text-red-600 mt-1">{d.error_message}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReindex(d.id)}
                        title="Reindexar"
                        className="text-gray-900 hover:bg-gray-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDoc(d.id, d.filename)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Search className="h-5 w-5 text-yellow-600" />
              Probar recuperación (RAG)
            </CardTitle>
            <p className="text-sm text-gray-500">
              Escribí una pregunta y mirá qué chunks devuelve el motor de búsqueda vectorial.
              Si esto está vacío o con similitud muy baja, el avatar no tendrá contexto y va a
              responder genérico (o canned). No invoca al LLM, solo el retrieval.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={retrievalQuery}
                onChange={(e) => setRetrievalQuery(e.target.value)}
                placeholder="Ej: criterios de decisión para reembolsos"
                className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTestRetrieval();
                  }
                }}
              />
              <Button
                onClick={handleTestRetrieval}
                disabled={retrievalLoading || !retrievalQuery.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {retrievalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Probar
                  </>
                )}
              </Button>
            </div>

            {retrievalResult && (
              <div className="space-y-2">
                <div className="text-xs text-gray-600">
                  Chunks indexados en este módulo:{' '}
                  <span className="font-semibold text-gray-900">
                    {retrievalResult.total_chunks_in_module}
                  </span>
                  {' • '}
                  Matches sobre umbral ({retrievalResult.min_similarity_threshold}):{' '}
                  <span className="font-semibold text-gray-900">
                    {retrievalResult.matches.length}
                  </span>
                </div>
                {retrievalResult.total_chunks_in_module === 0 ? (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                    Este módulo tiene <strong>0 chunks indexados</strong>. El documento no se
                    indexó (status pending/failed) o no produjo chunks. Revisá el badge y el
                    error_message en la sección de Material.
                  </div>
                ) : retrievalResult.matches.length === 0 ? (
                  <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3">
                    Hay {retrievalResult.total_chunks_in_module} chunks indexados pero ninguno
                    superó el umbral de similitud para esta pregunta. El avatar va a responder
                    "no tengo esa info en el material" (canned). Probá reformular o verificá si
                    el contenido realmente está en el doc.
                  </div>
                ) : (
                  retrievalResult.matches.map((m, idx) => (
                    <div
                      key={m.id}
                      className="border border-gray-200 rounded-lg p-3 text-sm bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-600">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-gray-700">
                          similitud:{' '}
                          <span
                            className={
                              m.similarity > 0.6
                                ? 'text-green-700'
                                : m.similarity > 0.45
                                ? 'text-yellow-700'
                                : 'text-orange-700'
                            }
                          >
                            {(m.similarity || 0).toFixed(3)}
                          </span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">{m.source}</div>
                      <div className="text-gray-800 whitespace-pre-wrap">{m.preview}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LearningModuleEditor;
