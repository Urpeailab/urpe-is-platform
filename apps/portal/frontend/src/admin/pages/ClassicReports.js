import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Send, FileText, Calendar, Loader2, TrendingUp, ChevronLeft, User, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = { en_proceso: 'En Proceso', radicado: 'Enviado', recibido_uscis: 'Recibido USCIS', rfe_recibido: 'RFE Recibido', rfe_respondido: 'RFE Respondido', devuelto: 'Devuelto', aprobado: 'Aprobado' };
const STATUS_COLORS = { en_proceso: { bg: '#FEF3C7', text: '#92400E' }, radicado: { bg: '#EDE9FE', text: '#5B21B6' }, recibido_uscis: { bg: '#E0E7FF', text: '#3730A3' }, rfe_recibido: { bg: '#FED7AA', text: '#9A3412' }, rfe_respondido: { bg: '#FDE68A', text: '#78350F' }, devuelto: { bg: '#FEE2E2', text: '#991B1B' }, aprobado: { bg: '#D1FAE5', text: '#065F46' } };

const ClassicReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [activeTab, setActiveTab] = useState('filings');
  const [coordFilter, setCoordFilter] = useState('all');

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);

  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = `dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const { data: res } = await axios.get(`${API}/api/classic-cases/admin/reports/filings?${params}`, { headers });
      setData(res);
    } catch { toast.error('Error al cargar reporte'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  const fetchStaff = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/admin/staff?limit=100`, { headers }); setStaff(data.staff || []); } catch {}
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // Quick date presets
  const setPreset = (type) => {
    const d = new Date();
    if (type === 'thisMonth') { setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setDateTo(d.toISOString().split('T')[0]); }
    else if (type === 'lastMonth') { const m = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); setDateFrom(m.toISOString().split('T')[0]); setDateTo(e.toISOString().split('T')[0]); }
    else if (type === 'thisYear') { setDateFrom(`${d.getFullYear()}-01-01`); setDateTo(d.toISOString().split('T')[0]); }
    else if (type === 'last3') { const m = new Date(d.getFullYear(), d.getMonth() - 3, 1); setDateFrom(m.toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]); }
  };

  // Filter by coordinator
  const filterByCoord = (list) => {
    if (coordFilter === 'all') return list;
    return list.filter(c => c.coordinatorId === coordFilter);
  };

  const filedFiltered = filterByCoord(data?.filedCases || []);
  const rfeFiltered = filterByCoord(data?.rfeCases || []);

  // Coordinator stats
  const getCoordStats = () => {
    const stats = {};
    for (const c of data?.filedCases || []) {
      const cid = c.coordinatorId || 'unassigned';
      const name = c.coordinatorName || 'Sin asignar';
      if (!stats[cid]) stats[cid] = { name, filings: 0, rfes: 0 };
      stats[cid].filings++;
    }
    for (const c of data?.rfeCases || []) {
      const cid = c.coordinatorId || 'unassigned';
      const name = c.coordinatorName || 'Sin asignar';
      if (!stats[cid]) stats[cid] = { name, filings: 0, rfes: 0 };
      stats[cid].rfes++;
    }
    return Object.entries(stats).sort((a, b) => (b[1].filings + b[1].rfes) - (a[1].filings + a[1].rfes));
  };

  const chartData = data?.chartData || [];
  const maxVal = Math.max(...chartData.map(d => Math.max(d.filings, d.rfes)), 1);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <div data-testid="classic-reports">
      <style>{`
        .reports-page input, .reports-page select { color: #111827 !important; -webkit-text-fill-color: #111827 !important; background: #fff !important; }
      `}</style>
      <div className="reports-page space-y-6">

      {/* Header */}
      <div>
        <button onClick={() => navigate('/admin/classic-cases')} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-3">
          <ChevronLeft className="h-4 w-4" />Volver a Clientes
        </button>
        <h1 className="text-2xl font-black" style={{ color: '#111827' }}>Reportes de Envios</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Control de casos enviados y RFEs respondidos</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-300 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-300 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Coordinador</label>
            <select value={coordFilter} onChange={e => setCoordFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-300 text-sm min-w-[180px]">
              <option value="all">Todos</option>
              {staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'thisMonth', label: 'Este mes' },
            { key: 'lastMonth', label: 'Mes anterior' },
            { key: 'last3', label: 'Ultimos 3 meses' },
            { key: 'thisYear', label: 'Este ano' },
          ].map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 transition-all" style={{ color: '#374151' }}>
              {p.label}
            </button>
          ))}
          {coordFilter !== 'all' && (
            <button onClick={() => setCoordFilter('all')} className="px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50">
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition-all ${activeTab === 'filings' ? 'ring-2 ring-indigo-500 border-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setActiveTab('filings')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Send className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Enviados</p>
              </div>
              <p className="text-3xl font-black" style={{ color: '#4F46E5' }}>{filedFiltered.length}</p>
            </div>
            <div className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition-all ${activeTab === 'rfes' ? 'ring-2 ring-amber-500 border-amber-200' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setActiveTab('rfes')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>RFEs Respondidos</p>
              </div>
              <p className="text-3xl font-black" style={{ color: '#D97706' }}>{rfeFiltered.length}</p>
            </div>
            <div className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition-all ${activeTab === 'coordinators' ? 'ring-2 ring-emerald-500 border-emerald-200' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setActiveTab('coordinators')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Por Coordinador</p>
              </div>
              <p className="text-3xl font-black" style={{ color: '#059669' }}>{getCoordStats().length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Total Actividad</p>
              </div>
              <p className="text-3xl font-black" style={{ color: '#111827' }}>{filedFiltered.length + rfeFiltered.length}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-sm mb-5 flex items-center gap-2" style={{ color: '#111827' }}>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Tendencia - Ultimos 12 meses
            </h3>
            <div className="flex items-end gap-2" style={{ height: '160px' }}>
              {chartData.map((d, i) => {
                const fH = maxVal ? (d.filings / maxVal) * 100 : 0;
                const rH = maxVal ? (d.rfes / maxVal) * 100 : 0;
                const mIdx = parseInt(d.month.split('-')[1]) - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${monthNames[mIdx]} ${d.month.split('-')[0]}: ${d.filings} enviados, ${d.rfes} RFEs`}>
                    <div className="w-full flex gap-0.5 items-end" style={{ height: '130px' }}>
                      <div className="flex-1 rounded-t-md transition-all hover:opacity-80" style={{ height: `${Math.max(fH, 4)}%`, background: '#4F46E5' }} />
                      <div className="flex-1 rounded-t-md transition-all hover:opacity-80" style={{ height: `${Math.max(rH, 4)}%`, background: '#D97706' }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{monthNames[mIdx]}</span>
                    {(d.filings > 0 || d.rfes > 0) && (
                      <span className="text-xs font-bold" style={{ color: '#374151' }}>{d.filings + d.rfes}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-4 justify-center">
              <span className="flex items-center gap-2 text-xs font-medium" style={{ color: '#374151' }}>
                <span className="h-3 w-3 rounded" style={{ background: '#4F46E5' }} />Enviados
              </span>
              <span className="flex items-center gap-2 text-xs font-medium" style={{ color: '#374151' }}>
                <span className="h-3 w-3 rounded" style={{ background: '#D97706' }} />RFEs Respondidos
              </span>
            </div>
          </div>

          {/* Coordinator breakdown */}
          {activeTab === 'coordinators' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#111827' }}>Rendimiento por Coordinador</h3>
              <div className="space-y-3">
                {getCoordStats().map(([cid, stats]) => {
                  const total = stats.filings + stats.rfes;
                  const maxTotal = Math.max(...getCoordStats().map(([, s]) => s.filings + s.rfes), 1);
                  return (
                    <div key={cid} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      onClick={() => { setCoordFilter(cid === 'unassigned' ? 'all' : cid); setActiveTab('filings'); }}>
                      <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {stats.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{stats.name}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs" style={{ color: '#4F46E5' }}>{stats.filings} enviados</span>
                          <span className="text-xs" style={{ color: '#D97706' }}>{stats.rfes} RFEs</span>
                        </div>
                      </div>
                      <div className="w-32">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                          <div className="h-full" style={{ width: `${(stats.filings / maxTotal) * 100}%`, background: '#4F46E5' }} />
                          <div className="h-full" style={{ width: `${(stats.rfes / maxTotal) * 100}%`, background: '#D97706' }} />
                        </div>
                      </div>
                      <span className="text-lg font-black" style={{ color: '#111827' }}>{total}</span>
                    </div>
                  );
                })}
                {getCoordStats().length === 0 && (
                  <p className="text-center py-6 text-sm" style={{ color: '#9CA3AF' }}>Sin datos en este rango</p>
                )}
              </div>
            </div>
          )}

          {/* Detail table */}
          {(activeTab === 'filings' || activeTab === 'rfes') && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-sm" style={{ color: '#111827' }}>
                  {activeTab === 'filings' ? `Casos Enviados (${filedFiltered.length})` : `RFEs Respondidos (${rfeFiltered.length})`}
                </h3>
              </div>
              {(activeTab === 'filings' ? filedFiltered : rfeFiltered).length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>Sin registros en este rango</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Cliente</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Coordinador</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Estado</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Fecha Envio</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Tracking</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>IOE</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Fecha RFE</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Respondido</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Deadline</th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: '#374151' }}>Aprobado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeTab === 'filings' ? filedFiltered : rfeFiltered).map(c => {
                        const st = STATUS_COLORS[c.status] || { bg: '#F3F4F6', text: '#374151' };
                        return (
                          <tr key={c.id} className="border-b border-gray-50 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                            onClick={() => navigate(`/admin/classic-cases/${c.id}`)}>
                            <td className="py-3 px-4 font-semibold" style={{ color: '#111827' }}>{c.name}</td>
                            <td className="py-3 px-4" style={{ color: '#6B7280' }}>{c.coordinatorName || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.text }}>
                                {STATUS_LABELS[c.status] || c.status}
                              </span>
                            </td>
                            <td className="py-3 px-4" style={{ color: '#374151' }}>{fmtDate(c.filingDate)}</td>
                            <td className="py-3 px-4 font-mono text-xs" style={{ color: '#6B7280' }}>{c.trackingNumber || '-'}</td>
                            <td className="py-3 px-4 font-mono text-xs" style={{ color: '#6B7280' }}>{c.ioeNumber || '-'}</td>
                            <td className="py-3 px-4" style={{ color: c.rfeReceivedDate ? '#9A3412' : '#D1D5DB' }}>{fmtDate(c.rfeReceivedDate)}</td>
                            <td className="py-3 px-4" style={{ color: c.rfeRespondedDate ? '#059669' : '#D1D5DB' }}>{fmtDate(c.rfeRespondedDate)}</td>
                            <td className="py-3 px-4" style={{ color: c.rfeDeadline ? '#DC2626' : '#D1D5DB' }}>{c.rfeDeadline || '-'}</td>
                            <td className="py-3 px-4" style={{ color: c.approvalDate ? '#065F46' : '#D1D5DB' }}>{fmtDate(c.approvalDate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      </div>
    </div>
  );
};

export default ClassicReports;
