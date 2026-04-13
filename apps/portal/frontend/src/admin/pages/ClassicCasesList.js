import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Search, Plus, Loader2, ChevronLeft, ChevronRight, ChevronDown,
  Users, Mail, Phone, User, Filter, ArrowUpDown, CheckSquare, Square, BarChart3
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  en_proceso: { label: 'En Proceso', bg: '#FEF3C7', text: '#92400E' },
  radicado: { label: 'Enviado', bg: '#EDE9FE', text: '#5B21B6' },
  recibido_uscis: { label: 'Recibido USCIS', bg: '#E0E7FF', text: '#3730A3' },
  rfe_recibido: { label: 'RFE Recibido', bg: '#FED7AA', text: '#9A3412' },
  rfe_respondido: { label: 'RFE Respondido', bg: '#FDE68A', text: '#78350F' },
  devuelto: { label: 'Devuelto', bg: '#FEE2E2', text: '#991B1B' },
  aprobado: { label: 'Aprobado', bg: '#D1FAE5', text: '#065F46' },
};

const ClassicCasesList = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [coordFilter, setCoordFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [staff, setStaff] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkCoordId, setBulkCoordId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newCase, setNewCase] = useState({ userId: '', name: '', email: '', phone: '', coordinatorId: '', processingType: 'normal', visaType: 'EB-2 NIW', driveFolderUrl: '' });

  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 60 });
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (coordFilter !== 'all') params.append('coordinatorId', coordFilter);
      const { data } = await axios.get(`${API}/api/classic-cases/admin?${params}`, { headers });
      let sorted = data.cases || [];
      if (sortBy === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      else if (sortBy === 'progress') sorted.sort((a, b) => (b.progress || 0) - (a.progress || 0));
      else if (sortBy === 'seniority') sorted.sort((a, b) => (a.seniorityDate || '').localeCompare(b.seniorityDate || ''));
      setCases(sorted);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch { toast.error('Error al cargar casos'); }
    finally { setLoading(false); }
  }, [search, statusFilter, coordFilter, page, sortBy]);

  const fetchStaff = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/admin/staff?limit=100`, { headers }); setStaff(data.staff || []); } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/admin/users?limit=500`, { headers }); setUsers(data.users || data || []); } catch {}
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);
  useEffect(() => { fetchStaff(); fetchUsers(); }, [fetchStaff, fetchUsers]);
  useEffect(() => { setPage(1); }, [search, statusFilter, coordFilter]);

  const toggleSelect = (id) => {
    setSelectedCases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCases.size === cases.length) setSelectedCases(new Set());
    else setSelectedCases(new Set(cases.map(c => c.id)));
  };

  const handleCreate = async () => {
    if (!newCase.userId || !newCase.name) { toast.error('Usuario y nombre requeridos'); return; }
    try {
      setCreating(true);
      const { data } = await axios.post(`${API}/api/classic-cases/admin`, newCase, { headers: { ...headers, 'Content-Type': 'application/json' } });
      toast.success('Caso creado');
      setCreateOpen(false);
      navigate(`/admin/classic-cases/${data.case.id}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setCreating(false); }
  };

  const getCoordEmail = (c) => {
    if (c.coordinatorName) return c.coordinatorName;
    const coord = staff.find(s => s._id === c.coordinatorId);
    return coord?.email || '';
  };

  return (
    <div data-testid="classic-cases-list">
      <style>{`
        .cc-list input, .cc-list select { color: #111827 !important; -webkit-text-fill-color: #111827 !important; background: #fff !important; }
        .cc-list input::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
      `}</style>
      <div className="cc-list space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3" style={{ color: '#111827' }}>
            <Users className="h-8 w-8" style={{ color: '#C9A96A' }} />
            Clientes
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Gestiona y da seguimiento a tus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/classic-cases/reports')} style={{ color: '#374151', borderColor: '#D1D5DB' }}>
            <BarChart3 className="h-4 w-4 mr-2" />Reportes
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/classic-cases/bulk-email')} style={{ color: '#374151', borderColor: '#D1D5DB' }}>
            Email Masivo
          </Button>
          <Button variant="outline" size="sm" style={{ color: '#374151', borderColor: '#D1D5DB' }}>Exportar CSV</Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4 mr-2" />Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..." className="pl-10 h-11 rounded-xl border-gray-300" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}
          className={`h-11 rounded-xl ${showFilters ? 'bg-indigo-50 border-indigo-300' : ''}`}
          style={{ color: '#374151', borderColor: '#D1D5DB' }}>
          <Filter className="h-4 w-4 mr-2" />Filtros
          {(statusFilter !== 'all' || coordFilter !== 'all') && <span className="ml-1 h-2 w-2 rounded-full bg-indigo-500 inline-block" />}
        </Button>
      </div>

      {/* Filter pills */}
      {showFilters && (
        <div className="space-y-3">
          {/* Status pills */}
          <div className="flex gap-2 flex-wrap">
            {[{ v: 'all', l: 'Todos' }, ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ v, l: c.label }))].map(f => (
              <button key={f.v} onClick={() => setStatusFilter(f.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  statusFilter === f.v ? 'ring-2 ring-offset-1' : 'bg-gray-100'
                }`}
                style={statusFilter === f.v ? { background: STATUS_CONFIG[f.v]?.bg || '#E0E7FF', color: STATUS_CONFIG[f.v]?.text || '#3730A3', ringColor: STATUS_CONFIG[f.v]?.text } : { color: '#6B7280' }}>
                {f.l}
              </button>
            ))}
          </div>
          {/* Coordinator filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Asesor:</span>
            <select value={coordFilter} onChange={e => setCoordFilter(e.target.value)}
              className="h-8 px-3 rounded-lg border border-gray-300 text-xs"
              style={{ color: '#374151', background: '#fff', WebkitTextFillColor: '#374151' }}>
              <option value="all">Todos los asesores</option>
              {staff.filter(s => ['coordinator', 'admin', 'advisor'].includes(s.role)).map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
              ))}
            </select>
            {coordFilter !== 'all' && (
              <button onClick={() => setCoordFilter('all')} className="text-xs text-red-500 hover:underline">Limpiar</button>
            )}
          </div>
        </div>
      )}

      {/* Sort + Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Ordenar:</span>
          {[{ key: 'name', label: 'Nombre' }, { key: 'progress', label: 'Progreso %' }, { key: 'seniority', label: 'Antiguedad' }].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${sortBy === s.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {s.label} {sortBy === s.key && <span className="ml-0.5">↑</span>}
            </button>
          ))}
          <span className="text-sm font-medium" style={{ color: '#C9A96A' }}>{pagination.total} cliente(s)</span>
        </div>
        <button onClick={selectAll} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50" style={{ color: '#374151' }}>
          {selectedCases.size === cases.length && cases.length > 0 ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          Seleccionar Todo
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCases.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <span className="text-sm font-bold" style={{ color: '#4F46E5' }}>{selectedCases.size} seleccionado(s)</span>
          <div className="h-5 w-px bg-indigo-200" />

          {/* Assign coordinator */}
          <div className="flex items-center gap-2">
            <select value={bulkCoordId} onChange={e => setBulkCoordId(e.target.value)}
              className="h-8 px-2 rounded-lg border border-indigo-200 text-xs"
              style={{ color: '#374151', background: '#fff', WebkitTextFillColor: '#374151' }}>
              <option value="">Asignar asesor...</option>
              {staff.filter(s => ['coordinator', 'admin', 'advisor'].includes(s.role)).map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
            {bulkCoordId && (
              <button disabled={bulkAssigning}
                onClick={async () => {
                  setBulkAssigning(true);
                  try {
                    for (const id of selectedCases) {
                      await axios.put(`${API}/api/classic-cases/admin/${id}`, { coordinatorId: bulkCoordId }, { headers: { ...headers, 'Content-Type': 'application/json' } });
                    }
                    toast.success(`Asesor asignado a ${selectedCases.size} caso(s)`);
                    setSelectedCases(new Set()); setBulkCoordId(''); fetchCases();
                  } catch { toast.error('Error'); }
                  finally { setBulkAssigning(false); }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white">
                {bulkAssigning ? 'Asignando...' : 'Aplicar'}
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-indigo-200" />

          {/* Change status */}
          <select onChange={async (e) => {
            const newStatus = e.target.value;
            if (!newStatus) return;
            try {
              for (const id of selectedCases) {
                await axios.post(`${API}/api/classic-cases/admin/${id}/status`, { newStatus }, { headers: { ...headers, 'Content-Type': 'application/json' } });
              }
              toast.success(`Estado cambiado en ${selectedCases.size} caso(s)`);
              setSelectedCases(new Set()); fetchCases();
            } catch { toast.error('Error'); }
            e.target.value = '';
          }}
            className="h-8 px-2 rounded-lg border border-indigo-200 text-xs"
            style={{ color: '#374151', background: '#fff', WebkitTextFillColor: '#374151' }}>
            <option value="">Cambiar estado...</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-2">
            {/* Delete */}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
                Eliminar ({selectedCases.size})
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-red-800">Eliminar {selectedCases.size} caso(s)?</span>
                <button disabled={bulkDeleting}
                  onClick={async () => {
                    setBulkDeleting(true);
                    try {
                      let deleted = 0;
                      for (const id of selectedCases) {
                        try { await axios.delete(`${API}/api/classic-cases/admin/${id}`, { headers }); deleted++; } catch {}
                      }
                      toast.success(`${deleted} caso(s) eliminado(s)`);
                      setSelectedCases(new Set()); setConfirmDelete(false); fetchCases();
                    } catch { toast.error('Error'); }
                    finally { setBulkDeleting(false); }
                  }}
                  className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white">
                  {bulkDeleting ? 'Eliminando...' : 'Si, eliminar'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded text-xs font-medium border border-red-300 text-red-700">
                  Cancelar
                </button>
              </div>
            )}

            {/* Deselect */}
            <button onClick={() => setSelectedCases(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300" style={{ color: '#374151' }}>
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
          <h3 className="text-lg font-semibold" style={{ color: '#111827' }}>No hay clientes</h3>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Crea un nuevo cliente para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cases.map(c => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.en_proceso;
            const isSelected = selectedCases.has(c.id);
            const coordEmail = getCoordEmail(c);
            return (
              <div key={c.id}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'}`}
                onClick={() => navigate(`/admin/classic-cases/${c.id}`)}>
                <div className="p-5">
                  {/* Top row: checkbox + name + status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-2.5">
                      <button onClick={e => { e.stopPropagation(); toggleSelect(c.id); }} className="mt-0.5">
                        {isSelected
                          ? <CheckSquare className="h-5 w-5 text-indigo-600" />
                          : <Square className="h-5 w-5" style={{ color: '#D1D5DB' }} />
                        }
                      </button>
                      <h3 className="font-bold text-sm leading-tight" style={{ color: '#111827' }}>{c.name?.toUpperCase()}</h3>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1.5 mb-4">
                    {c.email && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" /><span>{c.phone}</span>
                      </div>
                    )}
                    {coordEmail && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                        <User className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{coordEmail}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium w-16" style={{ color: '#374151' }}>Coord.</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${c.progressCoordinator || 0}%` }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: '#374151' }}>{c.progressCoordinator || 0}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium w-16" style={{ color: '#C9A96A' }}>Armador</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.progressArmador || 0}%`, background: '#C9A96A' }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: '#C9A96A' }}>{c.progressArmador || 0}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium w-16" style={{ color: '#374151' }}>Total</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${c.progress || 0}%` }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: '#374151' }}>{c.progress || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ color: '#374151' }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm" style={{ color: '#6B7280' }}>Pagina {page} de {pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ color: '#374151' }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: '#111827' }}>Nuevo Cliente</DialogTitle>
            <DialogDescription>Crea un caso de gestion clasica con checklist de entregables.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Usuario existente *</label>
              <div className="relative">
                <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setNewCase({ ...newCase, userId: '' }); }}
                  placeholder="Buscar por nombre o email..."
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm outline-none focus:border-indigo-400"
                  style={{ color: '#111827', background: '#fff', WebkitTextFillColor: '#111827' }} />
                {userSearch && !newCase.userId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {users.filter(u => {
                      const q = userSearch.toLowerCase();
                      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                    }).slice(0, 10).map(u => {
                      const uid = u.id || u._id;
                      return (
                        <button key={uid} onClick={() => {
                          setNewCase({ ...newCase, userId: uid, name: u.name || '', email: u.email || '', phone: u.phone || '' });
                          setUserSearch(u.name || u.email || '');
                        }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center justify-between border-b border-gray-100 last:border-0">
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#111827' }}>{u.name || 'Sin nombre'}</p>
                            <p className="text-xs" style={{ color: '#6B7280' }}>{u.email || u.phone || ''}</p>
                          </div>
                        </button>
                      );
                    })}
                    {users.filter(u => {
                      const q = userSearch.toLowerCase();
                      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No se encontraron usuarios</p>
                    )}
                  </div>
                )}
              </div>
              {newCase.userId && <p className="text-xs mt-1 text-indigo-600 font-medium">Seleccionado: {newCase.name} ({newCase.userId.slice(0, 8)}...)</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Nombre *</label>
                <Input value={newCase.name} onChange={e => setNewCase({ ...newCase, name: e.target.value })} placeholder="Nombre completo" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Email</label>
                <Input value={newCase.email} onChange={e => setNewCase({ ...newCase, email: e.target.value })} placeholder="email@ejemplo.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Coordinador</label>
                <select value={newCase.coordinatorId} onChange={e => setNewCase({ ...newCase, coordinatorId: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm">
                  <option value="">Sin asignar</option>
                  {staff.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Tipo de procesamiento</label>
                <select value={newCase.processingType} onChange={e => setNewCase({ ...newCase, processingType: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm">
                  <option value="normal">Normal (~700 dias)</option>
                  <option value="premium">Premium (45 dias)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>Link Google Drive</label>
              <Input value={newCase.driveFolderUrl} onChange={e => setNewCase({ ...newCase, driveFolderUrl: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} style={{ color: '#374151' }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
};

export default ClassicCasesList;
