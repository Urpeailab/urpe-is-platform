import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Loader2, FileText, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Image as ImageIcon, FileDown, FolderPlus, Download,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const DEFAULT_ADDRESS = '3235 North Point Pkwy, Suite 101, Alpharetta, GA. 30005';

// El documento maestro es en inglés; priorizamos 'en' en los títulos.
const getText = (v, fb = '') => {
  if (!v) return fb;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.en || v.es || fb;
  return String(v);
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const palId = (src, dId, fId) => `P|${src}|${dId}|${fId ?? 'null'}`;
const itemId = (id) => `I|${id}`;
const secZone = (sId) => `Z|sec|${sId}`;
const subZone = (sId, subId) => `Z|sub|${sId}|${subId}`;
const placedKey = (src, dId, fId) => `${src || 'deliverable'}:${dId}::${fId ?? 'ALL'}`;

// ---- palette draggable ----
const PaletteCard = ({ entry, disabled }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: palId(entry.source, entry.deliverableId, entry.fileId),
    data: { kind: 'palette', entry },
    disabled,
  });
  const isDoc = entry.source === 'document';
  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : { ...listeners, ...attributes })}
      className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm select-none ${
        disabled
          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-white border-gray-200 hover:border-blue-400 cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <FileText className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isDoc ? 'text-indigo-500' : 'text-blue-500'}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-800">{entry.label}</div>
        <div className="truncate text-xs text-gray-500">
          <span className={`mr-1 px-1 rounded text-[9px] font-bold uppercase ${
            isDoc ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'
          }`}>{isDoc ? 'Doc' : 'Entreg'}</span>
          {entry.sub}
        </div>
      </div>
      {disabled && <span className="text-[10px] text-emerald-600 font-semibold">agregado</span>}
    </div>
  );
};

// ---- sortable item inside a zone ----
const SortableItem = ({ item, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: itemId(item.id), data: { kind: 'item', itemId: item.id } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-md bg-white border border-gray-200 text-sm ${
        isDragging ? 'opacity-50 ring-2 ring-blue-300' : ''
      }`}
    >
      <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-400 flex-shrink-0">
        <GripVertical className="h-4 w-4" />
      </span>
      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <span className="truncate flex-1 min-w-0 text-gray-700">{getText(item.title) || 'Entregable'}</span>
      <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ---- droppable zone wrapper ----
const Zone = ({ id, items, onRemove, empty }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[44px] rounded-lg border-2 border-dashed p-2 space-y-1.5 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50/50'
      }`}
    >
      <SortableContext items={items.map((i) => itemId(i.id))} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <div className="text-xs text-gray-400 italic px-1 py-1.5">{empty}</div>
        ) : (
          items.map((it) => <SortableItem key={it.id} item={it} onRemove={onRemove} />)
        )}
      </SortableContext>
    </div>
  );
};

export const PrintLayoutTab = ({ caseId, deliverables = [], documents = [], token, clientName = '' }) => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState([]);
  const [branding, setBranding] = useState({ imageUrl: null, clientName: '', address: '' });
  const [master, setMaster] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // build palette from deliverables + required documents (one entry per file)
  const palette = useMemo(() => {
    const out = [];
    const pushFrom = (rows, source, fallback) => {
      for (const d of rows) {
        const name = getText(d.name, d.documentName || fallback);
        const files = d.files || [];
        const stage = d.stageNumber ?? null;
        if (files.length === 0 && d.fileUrl) {
          out.push({ source, deliverableId: d.id, fileId: null, label: d.fileName || name,
            sub: name, stageNumber: stage, key: placedKey(source, d.id, null) });
        }
        for (const f of files) {
          if (f.published === false) continue;
          out.push({ source, deliverableId: d.id, fileId: f.id, label: f.fileName || name,
            sub: name, stageNumber: stage, key: placedKey(source, d.id, f.id) });
        }
      }
    };
    pushFrom(deliverables, 'deliverable', 'Entregable');
    pushFrom(documents, 'document', 'Documento');
    return out;
  }, [deliverables, documents]);

  // agrupado por etapa para el render (con separador)
  const paletteByStage = useMemo(() => {
    const map = new Map();
    for (const e of palette) {
      const k = e.stageNumber ?? 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [palette]);

  const placedSet = useMemo(() => {
    const s = new Set();
    const add = (it) => s.add(placedKey(it.source, it.deliverableId, it.fileId));
    for (const sec of sections) {
      for (const it of sec.items || []) add(it);
      for (const sub of sec.subsections || [])
        for (const it of sub.items || []) add(it);
    }
    return s;
  }, [sections]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/admin/visa-cases/${caseId}/print-layout`, { headers });
        setSections(data.sections || []);
        setBranding({
          imageUrl: data.brandingImageUrl || null,
          // Pre-cargar: el nombre del cliente viene del caso y la dirección
          // es la de URPE por default; el admin puede editarlos igual.
          clientName: data.brandingClientName || clientName || '',
          address: data.brandingAddress || DEFAULT_ADDRESS,
        });
        setMaster(data.master || null);
      } catch (e) {
        toast.error('No se pudo cargar el layout de impresión');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId, headers, clientName]);

  // ---- tree helpers ----
  const findZoneOfItem = useCallback((id) => {
    for (const sec of sections) {
      if ((sec.items || []).some((i) => i.id === id)) return { sectionId: sec.id, subId: null };
      for (const sub of sec.subsections || [])
        if ((sub.items || []).some((i) => i.id === id)) return { sectionId: sec.id, subId: sub.id };
    }
    return null;
  }, [sections]);

  const zoneFromOver = useCallback((overId) => {
    if (!overId) return null;
    if (overId.startsWith('Z|sec|')) return { sectionId: overId.slice(6), subId: null };
    if (overId.startsWith('Z|sub|')) {
      const [, , sId, subId] = overId.split('|');
      return { sectionId: sId, subId };
    }
    if (overId.startsWith('I|')) return findZoneOfItem(overId.slice(2));
    return null;
  }, [findZoneOfItem]);

  const getZoneItems = (secs, zone) => {
    const sec = secs.find((s) => s.id === zone.sectionId);
    if (!sec) return null;
    if (!zone.subId) return sec.items || (sec.items = []);
    const sub = (sec.subsections || []).find((x) => x.id === zone.subId);
    if (!sub) return null;
    return sub.items || (sub.items = []);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;
    const targetZone = zoneFromOver(over.id);
    if (!targetZone) return;

    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      // palette → add new item
      if (active.data.current?.kind === 'palette') {
        const e = active.data.current.entry;
        const arr = getZoneItems(next, targetZone);
        if (!arr) return prev;
        if (arr.some((i) => placedKey(i.source, i.deliverableId, i.fileId) === e.key)) return prev;
        arr.push({ id: uid(), source: e.source, deliverableId: e.deliverableId, fileId: e.fileId,
          title: e.label, order: arr.length });
        return next;
      }
      // existing item → move / reorder
      if (active.data.current?.kind === 'item') {
        const movingId = active.data.current.itemId;
        const from = findZoneOfItem(movingId);
        if (!from) return prev;
        const fromArr = getZoneItems(next, from);
        const idx = fromArr.findIndex((i) => i.id === movingId);
        if (idx < 0) return prev;
        const sameZone = from.sectionId === targetZone.sectionId && from.subId === targetZone.subId;
        if (sameZone && over.id.startsWith('I|')) {
          const overIdx = fromArr.findIndex((i) => i.id === over.id.slice(2));
          const reordered = arrayMove(fromArr, idx, overIdx < 0 ? fromArr.length - 1 : overIdx);
          reordered.forEach((i, k) => (i.order = k));
          if (!targetZone.subId) next.find((s) => s.id === from.sectionId).items = reordered;
          else next.find((s) => s.id === from.sectionId).subsections.find((x) => x.id === from.subId).items = reordered;
          return next;
        }
        // move across zones
        const [moved] = fromArr.splice(idx, 1);
        const toArr = getZoneItems(next, targetZone);
        if (!toArr) return prev;
        if (toArr.some((i) => placedKey(i.source, i.deliverableId, i.fileId) === placedKey(moved.source, moved.deliverableId, moved.fileId)))
          return prev;
        toArr.push(moved);
        fromArr.forEach((i, k) => (i.order = k));
        toArr.forEach((i, k) => (i.order = k));
        return next;
      }
      return prev;
    });
  };

  const removeItem = (id) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const sec of next) {
        sec.items = (sec.items || []).filter((i) => i.id !== id);
        for (const sub of sec.subsections || []) sub.items = (sub.items || []).filter((i) => i.id !== id);
      }
      return next;
    });
  };

  // ---- section/subsection management ----
  const addSection = () => setSections((p) => [...p,
    { id: uid(), title: 'New section', order: p.length,
      includeBranding: false, items: [], subsections: [] }]);

  const addSubsection = (sId) => setSections((p) => p.map((s) =>
    s.id === sId ? { ...s, subsections: [...(s.subsections || []),
      { id: uid(), title: 'New subsection',
        order: (s.subsections || []).length, items: [] }] } : s));

  const renameSection = (sId, val) => setSections((p) => p.map((s) =>
    s.id === sId ? { ...s, title: val } : s));

  const renameSub = (sId, subId, val) => setSections((p) => p.map((s) =>
    s.id === sId ? { ...s, subsections: s.subsections.map((x) =>
      x.id === subId ? { ...x, title: val } : x) } : s));

  const deleteSection = (sId) => setSections((p) => p.filter((s) => s.id !== sId));
  const deleteSub = (sId, subId) => setSections((p) => p.map((s) =>
    s.id === sId ? { ...s, subsections: s.subsections.filter((x) => x.id !== subId) } : s));

  const toggleBranding = (sId) => setSections((p) => p.map((s) =>
    s.id === sId ? { ...s, includeBranding: !s.includeBranding } : s));

  const moveSection = (idx, dir) => setSections((p) => {
    const j = idx + dir;
    if (j < 0 || j >= p.length) return p;
    const n = arrayMove(p, idx, j);
    n.forEach((s, k) => (s.order = k));
    return n;
  });

  // ---- persistence ----
  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/visa-cases/${caseId}/print-layout`,
        { sections, brandingClientName: branding.clientName, brandingAddress: branding.address },
        { headers });
      toast.success('Organización guardada');
    } catch (e) {
      toast.error('Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const uploadBranding = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await axios.post(`${API}/admin/visa-cases/${caseId}/print-layout/branding`,
        fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setBranding((b) => ({ ...b, imageUrl: data.brandingImageUrl }));
      toast.success('Imagen de marca subida');
    } catch (e) {
      toast.error('Error subiendo la imagen');
    }
  };

  const generate = async () => {
    await save();
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API}/admin/visa-cases/${caseId}/print-layout/generate`,
        {}, { headers });
      setMaster(data.master);
      toast.success(`PDF maestro generado (${data.master.pageCount} páginas)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error generando el PDF maestro');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando layout…</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveDrag(active.data.current)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Impresión — Documento maestro</h3>
          <p className="text-sm text-gray-500">Arrastrá los entregables a cada sección y generá la visa lista para imprimir.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={save} disabled={saving} className="text-gray-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Guardar
          </Button>
          <Button onClick={generate} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
            Generar PDF maestro
          </Button>
        </div>
      </div>

      {/* branding + last master */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
            <ImageIcon className="h-4 w-4 text-blue-500" /> Marca del cliente
          </div>
          <div className="flex items-center gap-3">
            {branding.imageUrl ? (
              <img src={branding.imageUrl} alt="branding" className="h-12 w-auto rounded border border-gray-200" />
            ) : (
              <div className="h-12 w-20 rounded border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">sin logo</div>
            )}
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
              {branding.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => uploadBranding(e.target.files?.[0])} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Input placeholder="Nombre del cliente (portada)" value={branding.clientName} className="text-gray-900"
              onChange={(e) => setBranding((b) => ({ ...b, clientName: e.target.value }))} />
            <Input placeholder="Dirección (portada)" value={branding.address} className="text-gray-900"
              onChange={(e) => setBranding((b) => ({ ...b, address: e.target.value }))} />
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
            <FileDown className="h-4 w-4 text-blue-500" /> Último maestro generado
          </div>
          {master ? (
            <div className="text-sm text-gray-600 space-y-1">
              <div>{master.pageCount} páginas · {new Date(master.generatedAt).toLocaleString()}</div>
              <a href={master.fileUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                <Download className="h-4 w-4" /> Descargar PDF
              </a>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">Todavía no generaste el maestro.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* palette */}
        <div className="border border-gray-200 rounded-xl p-3 bg-white h-fit lg:sticky lg:top-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Disponibles (entregables y documentos)</div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {palette.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No hay archivos subidos en entregables ni documentos.</div>
            ) : (
              paletteByStage.map(([stage, entries]) => (
                <div key={stage} className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 px-1 border-b border-gray-100 pb-1">
                    {stage ? `Etapa ${stage}` : 'Sin etapa'}
                  </div>
                  {entries.map((e) => (
                    <PaletteCard key={e.key} entry={e} disabled={placedSet.has(e.key)} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* sections tree */}
        <div className="space-y-3 min-w-0">
          {sections.map((sec, idx) => (
            <div key={sec.id} className="border border-gray-200 rounded-xl bg-white">
              <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                <div className="flex flex-col">
                  <button onClick={() => moveSection(idx, -1)} className="text-gray-300 hover:text-gray-600"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 1)} className="text-gray-300 hover:text-gray-600"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <Input value={getText(sec.title)} onChange={(e) => renameSection(sec.id, e.target.value)}
                  className="flex-1 font-semibold text-gray-900" />
                <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={!!sec.includeBranding} onChange={() => toggleBranding(sec.id)} />
                  marca
                </label>
                <button onClick={() => addSubsection(sec.id)} title="Agregar subsección"
                  className="text-gray-400 hover:text-blue-600"><FolderPlus className="h-4 w-4" /></button>
                <button onClick={() => deleteSection(sec.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="p-3 space-y-3">
                <Zone id={secZone(sec.id)} items={sec.items || []} onRemove={removeItem}
                  empty="Arrastrá entregables acá" />
                {(sec.subsections || []).map((sub) => (
                  <div key={sub.id} className="ml-3 border-l-2 border-gray-100 pl-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Input value={getText(sub.title)} onChange={(e) => renameSub(sec.id, sub.id, e.target.value)}
                        className="flex-1 text-sm h-8 text-gray-900" />
                      <button onClick={() => deleteSub(sec.id, sub.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <Zone id={subZone(sec.id, sub.id)} items={sub.items || []} onRemove={removeItem}
                      empty="Arrastrá entregables a esta subsección" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addSection} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-1" /> Agregar sección
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.kind === 'palette' ? (
          <div className="px-3 py-2 rounded-lg bg-white border border-blue-400 shadow-lg text-sm font-medium text-gray-800">
            {activeDrag.entry.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default PrintLayoutTab;
