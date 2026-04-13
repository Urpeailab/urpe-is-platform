import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  TrendingUp, AlertTriangle, Clock, Users, ChevronRight,
  Briefcase, FileText, DollarSign, Calendar, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS_VISA = { proceso_venta: 'En proceso de venta', elegibility_approved: 'Elegibilidad', on_hold: 'En espera', active: 'Activo', in_progress: 'En progreso', eligibility_approved: 'Elegibilidad', ready_to_file: 'Listo para radicar', filed: 'Radicado', approved: 'Aprobado', denied: 'Denegado', en_proceso: 'En proceso', finalizado: 'Finalizado', analizando: 'Analizando', impreso: 'Impreso', enviado: 'Enviado', ioe: 'IOE', devuelto: 'Devuelto' };
const STATUS_LABELS_CLASSIC = { en_proceso: 'En Proceso', radicado: 'Enviado', recibido_uscis: 'Recibido USCIS', rfe_recibido: 'RFE', rfe_respondido: 'RFE Respondido', devuelto: 'Devuelto', aprobado: 'Aprobado' };
const STATUS_COLORS_CLASSIC = { en_proceso: '#3B82F6', radicado: '#8B5CF6', recibido_uscis: '#6366F1', rfe_recibido: '#F59E0B', rfe_respondido: '#D97706', devuelto: '#EF4444', aprobado: '#10B981' };

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const getTodayLabel = () => {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visa');
  const token = localStorage.getItem('admin_token');
  const adminUser = (() => {
    try {
      // Decodificar JWT directamente (siempre actualizado)
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.name) return payload;
      }
      // Fallback: admin_user localStorage
      return JSON.parse(localStorage.getItem('admin_user') || '{}');
    } catch { return {}; }
  })();
  const firstName = (adminUser.name || '').split(' ')[0] || 'Admin';

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: d } = await axios.get(`${API}/admin/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } });
        setData(d);
      } catch { toast.error('Error al cargar dashboard'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [token]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!data) return null;

  const visa = data.visaCases || {};
  const classic = data.classicCases || {};
  const totalCases = (visa.total || 0) + (classic.total || 0);
  const urgentVisa = (visa.top10 || []).filter(c => (c.daysInactive || 0) >= 14).length;
  const urgentClassic = (classic.top10 || []).filter(c => (c.daysInactive || 0) >= 7).length;
  const totalUrgent = urgentVisa + urgentClassic;

  return (
    <div className="space-y-6" style={{ color: '#111827' }}>
      <style>{`
        .dash-page select { color: #111827 !important; -webkit-text-fill-color: #111827 !important; background: #fff !important; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .dash-greet { animation: fadeSlideIn 0.5s ease both; }
        .dash-greet-stat { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .dash-greet-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
      `}</style>
      <div className="dash-page">

      {/* ===== GREETING HERO ===== */}
      <div className="dash-greet rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2544 100%)' }}>
        {/* Decorative dots */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 240, height: 240, opacity: 0.04,
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="p-7 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            {/* Left: greeting */}
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>{getTodayLabel()}</p>
              <h1 className="text-3xl font-black text-white tracking-tight">{getGreeting()}, {firstName} 👋</h1>
              <p className="text-sm mt-2" style={{ color: '#64748B' }}>
                Tienes <span className="font-bold" style={{ color: totalUrgent > 0 ? '#F87171' : '#6EE7B7' }}>{totalUrgent} caso{totalUrgent !== 1 ? 's' : ''}</span> que necesitan atención hoy.
              </p>
            </div>
            {/* Right: quick stats */}
            <div className="flex gap-3 flex-wrap">
              <div className="dash-greet-stat rounded-xl px-5 py-3 text-center cursor-default" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-black text-white">{totalCases}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Total casos</p>
              </div>
              <div className="dash-greet-stat rounded-xl px-5 py-3 text-center cursor-default" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-black" style={{ color: totalUrgent > 0 ? '#F87171' : '#6EE7B7' }}>{totalUrgent}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Urgentes</p>
              </div>
              {(visa.appointmentsPending || 0) > 0 && (
                <div className="dash-greet-stat rounded-xl px-5 py-3 text-center cursor-default" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-2xl font-black" style={{ color: '#FCD34D' }}>{visa.appointmentsPending}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Citas</p>
                </div>
              )}
            </div>
          </div>

          {/* Tab switcher inside hero */}
          <div className="mt-6 flex items-center gap-1 rounded-xl p-1 w-fit" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <button onClick={() => setActiveTab('visa')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === 'visa' ? 'rgba(255,255,255,0.12)' : 'transparent', color: activeTab === 'visa' ? '#fff' : '#64748B', border: activeTab === 'visa' ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent' }}>
              <FileText className="h-4 w-4" />Casos de Visa ({visa.total || 0})
            </button>
            <button onClick={() => setActiveTab('classic')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === 'classic' ? 'rgba(255,255,255,0.12)' : 'transparent', color: activeTab === 'classic' ? '#fff' : '#64748B', border: activeTab === 'classic' ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent' }}>
              <Briefcase className="h-4 w-4" />Gestión Clásica ({classic.total || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #E2E8F0 20%, #E2E8F0 80%, transparent)' }} />

      {/* ===== TAB VISA ===== */}
      {activeTab === 'visa' && (
        <div className="space-y-5 mt-2">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={FileText} iconColor="#4F46E5" iconBg="#EEF2FF" accent="#4F46E5" label="Casos activos" value={visa.total} />
            <MetricCard icon={TrendingUp} iconColor="#059669" iconBg="#ECFDF5" accent="#059669" label="Progreso promedio" value={`${visa.avgProgress}%`} />
            <MetricCard icon={DollarSign} iconColor="#0891B2" iconBg="#E0F2FE" accent="#0891B2" label="Total pagado" value={`$${(visa.totalPaid || 0).toLocaleString()}`} />
            <MetricCard icon={Calendar} iconColor="#D97706" iconBg="#FFFBEB" accent="#D97706" label="Citas pendientes" value={visa.appointmentsPending} />
          </div>

          {/* Status distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white border border-gray-100 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Por Estado</p>
              <div className="space-y-3">
                {Object.entries(visa.statuses || {}).sort((a, b) => b[1] - a[1]).map(([st, count]) => {
                  const pct = Math.round((count / Math.max(visa.total, 1)) * 100);
                  return (
                    <div key={st}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: '#374151' }}>{STATUS_LABELS_VISA[st] || st}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A' }}>{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Por Coordinador</p>
              <div className="space-y-3">
                {Object.entries(visa.byCoordinator || {}).slice(0, 6).map(([name, count], i) => {
                  const colors = ['#6366F1','#8B5CF6','#EC4899','#0891B2','#059669','#D97706'];
                  const c = colors[i % colors.length];
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                        style={{ background: c }}>{(name || '?')[0].toUpperCase()}</div>
                      <span className="text-sm flex-1 truncate" style={{ color: '#374151' }}>{name || 'Sin asignar'}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Casos sin staff asignado pero con progreso */}
          {(visa.unattended || []).length > 0 && (
            <div className="rounded-2xl overflow-hidden border"
              style={{ borderColor: '#FED7AA', boxShadow: '0 0 0 1px #FED7AA40, 0 4px 16px #F9731610' }}>
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: '#FED7AA' }}>
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#EA580C' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#9A3412' }}>Casos sin coordinador o vendedor</p>
                    <p className="text-xs" style={{ color: '#C2410C' }}>Progreso {'>'} 0% pero les falta asignar coordinador o vendedor</p>
                  </div>
                </div>
                <span className="text-lg font-black px-3 py-1 rounded-xl" style={{ background: '#FED7AA', color: '#9A3412' }}>
                  {visa.unattended.length}
                </span>
              </div>
              <div className="bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA40' }}>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A3412' }}>Cliente</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A3412' }}>Estado</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A3412' }}>Progreso</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A3412' }}>Inactivo</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visa.unattended.map((item, i) => {
                      const statusLabel = STATUS_LABELS_VISA[item.status] || item.status || '—';
                      const days = item.daysInactive || 0;
                      const urgency = days > 30 ? '#EF4444' : days > 14 ? '#F59E0B' : '#10B981';
                      return (
                        <tr key={item.id || i} className="group cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid #FFF7ED' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FFF7ED'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => navigate(`/admin/visa-cases/${item.id}`)}>
                          <td className="py-3 px-4 font-semibold" style={{ color: '#0F172A' }}>{item.name}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#EEF2FF', color: '#4F46E5' }}>{statusLabel}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                                <div className="h-full rounded-full" style={{ width: `${item.progress || 0}%`, background: 'linear-gradient(90deg, #F97316, #FB923C)' }} />
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: '#64748B' }}>{item.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
                              style={{ background: urgency + '15', color: urgency }}>
                              {item.daysInactive != null ? `${item.daysInactive}d` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-2"><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: '#FCA572' }} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 10 */}
          <PriorityTable title="Top 10 — Casos que necesitan atención" items={visa.top10 || []} type="visa" navigate={navigate} />
        </div>
      )}

      {/* ===== TAB CLASSIC ===== */}
      {activeTab === 'classic' && (
        <div className="space-y-5 mt-2">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={Briefcase} iconColor="#4F46E5" iconBg="#EEF2FF" accent="#4F46E5" label="Total casos" value={classic.total} />
            <MetricCard icon={TrendingUp} iconColor="#059669" iconBg="#ECFDF5" accent="#059669" label="Progreso promedio" value={`${classic.avgProgress}%`} />
            <MetricCard icon={Users} iconColor="#C9A96A" iconBg="#FEF3C7" accent="#C9A96A" label="Progreso armador" value={`${classic.avgArmador}%`} />
            <MetricCard icon={TrendingUp} iconColor="#4F46E5" iconBg="#EEF2FF" accent="#4F46E5" label="Progreso coordinador" value={`${classic.avgCoordinator}%`} />
          </div>

          {/* Alerts */}
          {(classic.alerts?.rfeActivos > 0 || classic.alerts?.enviadosSinIoe > 0 || classic.alerts?.sinContacto5d > 0 || classic.alerts?.estancados7d > 0) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {classic.alerts?.rfeActivos > 0 && <AlertCard color="#F59E0B" label="RFEs activos" value={classic.alerts.rfeActivos} />}
              {classic.alerts?.enviadosSinIoe > 0 && <AlertCard color="#8B5CF6" label="Enviados sin IOE" value={classic.alerts.enviadosSinIoe} />}
              {classic.alerts?.sinContacto5d > 0 && <AlertCard color="#EF4444" label="Sin contacto >5d" value={classic.alerts.sinContacto5d} />}
              {classic.alerts?.estancados7d > 0 && <AlertCard color="#F97316" label="Sin progreso >7d" value={classic.alerts.estancados7d} />}
            </div>
          )}

          {/* Status + Work Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-gray-100 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Por Estado</p>
              <div className="space-y-2.5">
                {Object.entries(classic.statuses || {}).map(([st, count]) => (
                  <div key={st} className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS_CLASSIC[st] || '#6B7280' }} />
                    <span className="text-sm flex-1" style={{ color: '#374151' }}>{STATUS_LABELS_CLASSIC[st] || st}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Estado de Trabajo</p>
              <div className="space-y-2.5">
                {Object.entries(classic.workStatuses || {}).map(([ws, count]) => {
                  const colors = { working: '#10B981', paused: '#F59E0B', waiting_uscis: '#3B82F6', desisted: '#6B7280' };
                  const labels = { working: 'Trabajando', paused: 'Pausado', waiting_uscis: 'Esperando USCIS', desisted: 'Desistió' };
                  return (
                    <div key={ws} className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colors[ws] || '#6B7280' }} />
                      <span className="text-sm flex-1" style={{ color: '#374151' }}>{labels[ws] || ws}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Por Coordinador</p>
              <div className="space-y-3">
                {Object.entries(classic.byCoordinator || {}).slice(0, 6).map(([name, count], i) => {
                  const colors = ['#6366F1','#8B5CF6','#EC4899','#0891B2','#059669','#D97706'];
                  const c = colors[i % colors.length];
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                        style={{ background: c }}>{(name || '?')[0].toUpperCase()}</div>
                      <span className="text-sm flex-1 truncate" style={{ color: '#374151' }}>{name || 'Sin asignar'}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#0F172A' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top 10 */}
          <PriorityTable title="Top 10 — Casos que necesitan atención" items={classic.top10 || []} type="classic" navigate={navigate} />
        </div>
      )}

      </div>
    </div>
  );
};

// ===== Components =====

const MetricCard = ({ icon: Icon, iconColor, iconBg, label, value, accent }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col justify-between gap-3"
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
    {/* Top accent line */}
    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent || iconColor }} />
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{label}</p>
      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </div>
    </div>
    <p className="text-3xl font-black tracking-tight" style={{ color: '#0F172A' }}>{value}</p>
  </div>
);

const AlertCard = ({ color, label, value }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white border p-4 shadow-sm" style={{ borderColor: color + '30', boxShadow: `0 0 0 1px ${color}20, 0 4px 16px ${color}10` }}>
    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
        <AlertTriangle className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{label}</p>
        <p className="text-2xl font-black" style={{ color }}>{value}</p>
      </div>
    </div>
  </div>
);

const PriorityTable = ({ title, items, type, navigate }) => (
  <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden"
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>
    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
      <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
        <Clock className="h-3.5 w-3.5 text-red-500" />
      </div>
      <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>{title}</h3>
    </div>
    {items.length === 0 ? (
      <p className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>Sin casos prioritarios</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Cliente</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Estado</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Progreso</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Coordinador</th>
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Inactivo</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const statusLabel = type === 'visa' ? (STATUS_LABELS_VISA[item.status] || item.status) : (STATUS_LABELS_CLASSIC[item.status] || item.status);
              const statusColor = type === 'classic' ? (STATUS_COLORS_CLASSIC[item.status] || '#6B7280') : ({
                proceso_venta: '#64748B', elegibility_approved: '#3B82F6', active: '#10B981', in_progress: '#06B6D4',
                ready_to_file: '#F59E0B', filed: '#8B5CF6', approved: '#10B981', denied: '#EF4444', on_hold: '#6B7280',
                en_proceso: '#3B82F6', finalizado: '#14B8A6', analizando: '#6366F1', impreso: '#7C3AED',
                enviado: '#F97316', ioe: '#EC4899', devuelto: '#EF4444',
              }[item.status] || '#4F46E5');
              const days = item.daysInactive || 0;
              const urgency = days > 30 ? '#EF4444' : days > 14 ? '#F59E0B' : '#10B981';
              const route = type === 'visa' ? `/admin/visa-cases/${item.id}` : `/admin/classic-cases/${item.id}`;
              return (
                <tr key={item.id || i}
                  className="group cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(route)}>
                  {/* Urgency left bar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-1 rounded-full flex-shrink-0" style={{ background: urgency + '60' }} />
                      <span className="font-semibold" style={{ color: '#0F172A' }}>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: statusColor + '18', color: statusColor }}>{statusLabel}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                        <div className="h-full rounded-full" style={{ width: `${item.progress || 0}%`, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color: '#64748B' }}>{item.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: '#64748B' }}>{item.coordinator || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
                      style={{ background: urgency + '15', color: urgency }}>
                      {item.daysInactive != null ? `${item.daysInactive}d` : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-2"><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: '#CBD5E1' }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default AdminDashboard;
