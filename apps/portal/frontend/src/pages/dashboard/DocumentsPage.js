import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Lock, ChevronRight, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const toText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.es || v.en || '';
  return '';
};

const _refersToOtherCv = (name) => /\b(de\s+quien|del\s+firmante|del\s+experto|del\s+recomendador|del\s+autor|de\s+experto|tercero)\b/.test(name);

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const fileKey = (f) => `${f.parentType}:${f.parentId}:${f.id || 'legacy'}`;

export const DocumentsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [userCvs, setUserCvs] = useState([]);
  const [selected, setSelected] = useState({}); // { fileKey: true }
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      if (!token) {
        toast.error('Por favor inicia sesión');
        navigate('/auth');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const caseRes = await axios.get(`${BACKEND_URL}/api/client/my-case`, { headers });
      setCaseData(caseRes.data);

      try {
        const cvRes = await axios.get(`${BACKEND_URL}/api/client/my-cvs`, { headers });
        setUserCvs(cvRes.data.cvs || []);
      } catch { /* sin CVs */ }
    } catch (err) {
      console.error('Error fetching documents:', err);
      if (err.response?.status === 401) toast.error('Tu sesión ha expirado');
      else toast.error('Error al cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    if (!caseData) return [];
    const { stages = [], deliverables = [], documents = [], progress = {} } = caseData;
    const paidSet = new Set(progress.paidStages || []);
    const cv = userCvs[0];

    const sorted = [...stages].sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0));

    return sorted.map((stage) => {
      const stageNumber = stage.stageNumber;
      const isPaid = paidSet.has(stageNumber);
      const isFree = stage.amount === 0;
      const isCompleted = (progress.completedStages || []).includes(stageNumber) || stage.status === 'completed';
      const isUnlocked = stage.status === 'unlocked' || isPaid || isFree || isCompleted;

      // Entregables con archivo
      const delFiles = deliverables
        .filter((d) => d.stageNumber === stageNumber)
        .flatMap((d) => {
          const parentName = toText(d.deliverableName) || toText(d.name) || 'Entregable';
          const parentId = d.id || d._id;
          const files = d.files?.length > 0
            ? d.files
            : (d.fileUrl ? [{ id: 'legacy', fileName: d.fileName || parentName, fileUrl: d.fileUrl, uploadedAt: d.uploadedAt }] : []);
          return files.map((f) => ({
            ...f,
            parentName,
            parentId,
            parentType: 'deliverable',
            kind: 'entregable',
          }));
        });

      // Documentos requeridos con archivo (+ CV auto-attached)
      const docFiles = documents
        .filter((d) => d.stageNumber === stageNumber)
        .flatMap((d) => {
          const parentName = toText(d.documentName) || toText(d.name) || 'Documento';
          const parentId = d.id || d._id;
          const nameLc = parentName.toLowerCase();
          const isCvDoc = !_refersToOtherCv(nameLc) && (nameLc.includes('hoja de vida') || nameLc.includes('curriculum') || nameLc.includes('resume'));
          const raw = d.files?.length > 0
            ? d.files
            : (d.fileUrl ? [{ id: 'legacy', fileName: d.fileName || parentName, fileUrl: d.fileUrl, uploadedAt: d.uploadedAt }] : []);
          if (raw.length === 0 && isCvDoc && cv) {
            raw.push({
              id: 'cv-auto',
              fileName: cv.file_name || cv.fileName || 'Hoja de vida',
              fileUrl: cv.file_url || cv.url,
              uploadedAt: cv.created_at || cv.uploadedAt,
              _autoCv: true,
            });
          }
          return raw.map((f) => ({
            ...f,
            parentName,
            parentId,
            parentType: 'document',
            kind: 'documento',
          }));
        });

      const allFiles = [...delFiles, ...docFiles].filter((f) => !!f.fileUrl);
      return {
        stage,
        stageNumber,
        stageName: toText(stage.name) || `Etapa ${stageNumber}`,
        isUnlocked,
        files: allFiles,
      };
    }).filter((g) => g.files.length > 0 || !g.isUnlocked);
  }, [caseData, userCvs]);

  // Sólo se pueden seleccionar archivos de etapas desbloqueadas, no CV auto-attached
  // (el CV no vive en visa_documents, así que el backend no lo encuentra).
  const isFileSelectable = (g, f) => g.isUnlocked && !f._autoCv && !!f.fileUrl;

  const selectedCount = Object.keys(selected).filter((k) => selected[k]).length;

  const totalSelectable = groups.reduce((s, g) => s + g.files.filter((f) => isFileSelectable(g, f)).length, 0);
  const totalFiles = groups.reduce((s, g) => s + g.files.length, 0);

  const toggleFile = (g, f) => {
    if (!isFileSelectable(g, f)) return;
    const key = fileKey(f);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStageAll = (g) => {
    const selectable = g.files.filter((f) => isFileSelectable(g, f));
    if (selectable.length === 0) return;
    const allOn = selectable.every((f) => selected[fileKey(f)]);
    setSelected((prev) => {
      const next = { ...prev };
      selectable.forEach((f) => {
        const k = fileKey(f);
        if (allOn) delete next[k];
        else next[k] = true;
      });
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCount > 0) {
      setSelected({});
      return;
    }
    const next = {};
    groups.forEach((g) => g.files.forEach((f) => {
      if (isFileSelectable(g, f)) next[fileKey(f)] = true;
    }));
    setSelected(next);
  };

  const clearSelection = () => setSelected({});

  const handleDownloadZip = async () => {
    if (selectedCount === 0) return;

    // Agrupar selecciones por parentType:parentId (para enviar fileIds del mismo item juntos)
    const itemMap = new Map(); // key = `${parentType}:${parentId}`
    groups.forEach((g) => g.files.forEach((f) => {
      if (!isFileSelectable(g, f)) return;
      const k = fileKey(f);
      if (!selected[k]) return;
      const groupKey = `${f.parentType}:${f.parentId}`;
      if (!itemMap.has(groupKey)) itemMap.set(groupKey, { type: f.parentType, itemId: f.parentId, fileIds: [] });
      itemMap.get(groupKey).fileIds.push(f.id || 'legacy');
    }));

    // Convertir a items para el endpoint (uno por fileId)
    const items = [];
    itemMap.forEach(({ type, itemId, fileIds }) => {
      fileIds.forEach((fileId) => items.push({ type, itemId, fileId }));
    });

    if (items.length === 0) {
      toast.error('No hay archivos seleccionables');
      return;
    }

    setDownloading(true);
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      const res = await axios.post(
        `${BACKEND_URL}/api/client/my-case/download-zip`,
        { items },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        },
      );

      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^";]+)"?/);
      a.download = match ? match[1] : `mis_documentos_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`ZIP descargado (${items.length} archivo${items.length === 1 ? '' : 's'})`);
      setSelected({});
    } catch (err) {
      console.error('zip error:', err);
      const detail = err.response?.data?.detail || 'No se pudo generar el ZIP';
      toast.error(typeof detail === 'string' ? detail : 'No se pudo generar el ZIP');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-navy-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-primary" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12 px-4 bg-navy-primary min-h-screen">
        <AlertCircle className="h-12 w-12 text-slate-light mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gold-subtle mb-2">No se encontró un caso activo</h2>
        <p className="text-sm text-slate">Contacta a tu coordinador para más información</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 pb-32 bg-navy-primary min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-1 sm:px-0">
        <div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold text-gold-subtle">Mis Documentos</h1>
          <p className="text-sm sm:text-base text-slate mt-1 sm:mt-2">
            {totalFiles > 0
              ? `${totalFiles} archivo${totalFiles === 1 ? '' : 's'} agrupados por etapa`
              : 'Aún no hay archivos disponibles'}
          </p>
        </div>
        {totalSelectable > 0 && (
          <button
            onClick={toggleSelectAll}
            className="text-xs text-gold-primary hover:text-gold-subtle transition-colors self-start sm:self-auto"
          >
            {selectedCount > 0 ? 'Limpiar selección' : `Seleccionar todos (${totalSelectable})`}
          </button>
        )}
      </div>

      {/* Stages */}
      {groups.length === 0 ? (
        <div className="bg-navy-secondary border border-navy-light/20 rounded-xl p-8 text-center">
          <FileText className="h-10 w-10 text-slate mx-auto mb-3" />
          <p className="text-slate">Cuando tengas archivos en tus etapas, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const stageSelectable = g.files.filter((f) => isFileSelectable(g, f));
            const stageAllChecked = stageSelectable.length > 0 && stageSelectable.every((f) => selected[fileKey(f)]);
            const stageSomeChecked = stageSelectable.some((f) => selected[fileKey(f)]) && !stageAllChecked;
            return (
            <div
              key={g.stageNumber}
              className="bg-navy-secondary border border-navy-light/20 rounded-xl overflow-hidden"
            >
              {/* Stage header */}
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-navy-light/20">
                {stageSelectable.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={stageAllChecked}
                    ref={(el) => { if (el) el.indeterminate = stageSomeChecked; }}
                    onChange={() => toggleStageAll(g)}
                    className="h-4 w-4 rounded border-navy-light/40 bg-navy-primary accent-gold-primary cursor-pointer"
                    title="Seleccionar todos los archivos de esta etapa"
                  />
                ) : (
                  <div className="w-4" />
                )}
                <button
                  onClick={() => navigate(`/dashboard/my-case/stage/${g.stageNumber}`)}
                  className="flex-1 flex items-center justify-between min-w-0 hover:opacity-80 transition-opacity text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-semibold text-gold-dark tracking-wider">
                      ETAPA {g.stageNumber}
                    </span>
                    <span className="text-sm sm:text-base font-medium text-gold-subtle truncate">{g.stageName}</span>
                    {!g.isUnlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        <Lock className="h-3 w-3" /> Bloqueada
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate flex-shrink-0 ml-2" />
                </button>
              </div>

              {/* Files list */}
              {g.files.length === 0 ? (
                <div className="px-4 sm:px-5 py-4 text-xs text-slate">
                  No hay archivos disponibles en esta etapa todavía.
                </div>
              ) : (
                <ul className="divide-y divide-navy-light/10">
                  {g.files.map((f, idx) => {
                    const selectable = isFileSelectable(g, f);
                    const k = fileKey(f);
                    const checked = !!selected[k];
                    const canDownload = g.isUnlocked && !!f.fileUrl;
                    return (
                      <li
                        key={`${g.stageNumber}-${f.parentId}-${f.id || idx}`}
                        className={`px-4 sm:px-5 py-3 flex items-center gap-3 transition-colors ${checked ? 'bg-gold-primary/5' : 'hover:bg-navy-primary/20'}`}
                      >
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFile(g, f)}
                            className="h-4 w-4 rounded border-navy-light/40 bg-navy-primary accent-gold-primary cursor-pointer flex-shrink-0"
                          />
                        ) : (
                          <div className="w-4 flex-shrink-0" />
                        )}
                        <FileText className="h-4 w-4 text-gold-dark flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F8FAFC] truncate">{f.fileName || 'Archivo'}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate">
                            <span className="capitalize">{f.kind}</span>
                            <span>•</span>
                            <span className="truncate">{f.parentName}</span>
                            {fmtDate(f.uploadedAt) && (
                              <>
                                <span>•</span>
                                <span>{fmtDate(f.uploadedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {canDownload ? (
                          <a
                            href={f.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-gold-primary hover:text-gold-subtle transition-colors px-2.5 py-1.5 rounded-md hover:bg-gold-primary/10 flex-shrink-0"
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Descargar</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate flex-shrink-0">
                            <Lock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Bloqueado</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );})}
        </div>
      )}

      {/* Sticky bottom bar para descarga masiva */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 w-full max-w-2xl">
          <div className="bg-navy-secondary border border-gold-dark/40 rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="bg-gold-primary text-navy-primary text-xs font-bold rounded-full h-6 min-w-[1.5rem] px-2 inline-flex items-center justify-center">
                {selectedCount}
              </span>
              <span className="text-sm text-gold-subtle truncate">
                {selectedCount === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={clearSelection}
                className="text-xs text-slate hover:text-gold-subtle transition-colors px-2 py-1.5"
                disabled={downloading}
                title="Limpiar selección"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownloadZip}
                disabled={downloading}
                className="inline-flex items-center gap-2 bg-gold-primary text-navy-primary text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gold-subtle transition-colors disabled:opacity-60"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Descargar ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
