import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Loader2, Briefcase, FileText, Edit, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const VISA_STATUS_LABELS = {
  proceso_venta: 'En proceso de venta', elegibility_approved: 'Elegibilidad', active: 'Activo',
  in_progress: 'En progreso', ready_to_file: 'Listo para radicar', filed: 'Radicado',
  approved: 'Aprobado', denied: 'Denegado', on_hold: 'En espera', en_proceso: 'En proceso',
  finalizado: 'Finalizado', analizando: 'Analizando', impreso: 'Impreso',
  enviado: 'Enviado', ioe: 'IOE', devuelto: 'Devuelto',
};

const CLASSIC_STATUS_LABELS = {
  en_proceso: 'En Proceso', radicado: 'Enviado', recibido_uscis: 'Recibido USCIS',
  rfe_recibido: 'RFE Recibido', rfe_respondido: 'RFE Respondido', devuelto: 'Devuelto', aprobado: 'Aprobado',
};

const STATUS_COLORS = {
  proceso_venta: '#64748B', elegibility_approved: '#3B82F6', active: '#10B981', in_progress: '#06B6D4',
  ready_to_file: '#F59E0B', filed: '#8B5CF6', approved: '#10B981', denied: '#EF4444', on_hold: '#6B7280',
  en_proceso: '#3B82F6', finalizado: '#14B8A6', analizando: '#6366F1', impreso: '#7C3AED',
  enviado: '#F97316', ioe: '#EC4899', devuelto: '#EF4444', radicado: '#8B5CF6',
  recibido_uscis: '#6366F1', rfe_recibido: '#F59E0B', rfe_respondido: '#D97706',
};

const ROLE_LABELS = {
  super_admin: 'Super Admin', admin: 'Administrador', manager: 'Gerente',
  coordinator: 'Coordinador', advisor: 'Asesor',
};

export default function StaffDetail() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visa');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const { data: res } = await axios.get(`${API}/api/admin/staff/${staffId}/detail`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res);
      } catch (e) {
        toast.error('Error al cargar detalle');
        navigate('/admin/staff-management');
      } finally { setLoading(false); }
    };
    fetchDetail();
  }, [staffId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
    </div>
  );

  if (!data) return null;

  const { staff, visaCases, classicCases } = data;

  return (
    <div data-testid="staff-detail" className="space-y-6 bg-white min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin/staff-management')}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ChevronLeft className="h-4 w-4" />Volver
        </button>
        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/staff/${staffId}`)}
          className="text-gray-700 border-gray-300">
          <Edit className="h-4 w-4 mr-1" />Editar
        </Button>
      </div>

      {/* Staff Info Card */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            {staff.photo ? (
              <img src={staff.photo} alt={staff.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-2xl flex-shrink-0">
                {staff.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge className={staff.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                  {staff.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge className="bg-yellow-100 text-yellow-800">{ROLE_LABELS[staff.role] || staff.role}</Badge>
                {staff.department && <Badge className="bg-blue-100 text-blue-700">{staff.department}</Badge>}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{staff.email}</span>
                {staff.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{staff.phone}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Casos de Visa (Coord.)" value={visaCases.asCoordinator} color="#8B5CF6" />
        <SummaryCard label="Casos de Visa (Ventas)" value={visaCases.asSalesRep} color="#3B82F6" />
        <SummaryCard label="Total Casos Visa" value={visaCases.total} color="#6366F1" />
        <SummaryCard label="Casos Clasicos" value={classicCases.total} color="#F59E0B" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('visa')}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'visa' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Briefcase className="h-4 w-4 inline mr-1.5" />Casos de Visa ({visaCases.total})
        </button>
        <button onClick={() => setActiveTab('classic')}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'classic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <FileText className="h-4 w-4 inline mr-1.5" />Gestion Clasica ({classicCases.total})
        </button>
      </div>

      {/* Status breakdown */}
      {activeTab === 'visa' && (
        <div className="space-y-4">
          <StatusBreakdown byStatus={visaCases.byStatus} labels={VISA_STATUS_LABELS} />
          <CaseTable
            cases={visaCases.cases}
            columns={[
              { key: 'clientName', label: 'Cliente' },
              { key: 'visaType', label: 'Tipo de Visa' },
              { key: 'status', label: 'Estado', render: (v) => <StatusBadge status={v} labels={VISA_STATUS_LABELS} /> },
              { key: 'overallProgress', label: 'Progreso', render: (v) => <ProgressBar value={v || 0} /> },
            ]}
            onRowClick={(c) => navigate(`/admin/visa-cases/${c.id}`)}
            emptyMsg="No tiene casos de visa asignados"
          />
        </div>
      )}

      {activeTab === 'classic' && (
        <div className="space-y-4">
          <StatusBreakdown byStatus={classicCases.byStatus} labels={CLASSIC_STATUS_LABELS} />
          <CaseTable
            cases={classicCases.cases}
            columns={[
              { key: 'name', label: 'Cliente' },
              { key: 'status', label: 'Estado', render: (v) => <StatusBadge status={v} labels={CLASSIC_STATUS_LABELS} /> },
              { key: 'workStatus', label: 'Estado de Trabajo', render: (v) => v ? <Badge className="bg-gray-100 text-gray-700 text-xs">{v}</Badge> : <span className="text-gray-400 text-xs">-</span> },
            ]}
            onRowClick={(c) => navigate(`/admin/classic-cases/${c.id}`)}
            emptyMsg="No tiene casos clasicos asignados"
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4 text-center">
        <p className="text-3xl font-bold" style={{ color }}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusBreakdown({ byStatus, labels }) {
  const entries = Object.entries(byStatus).filter(([, c]) => c > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([st, count]) => (
        <div key={st} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[st] || '#6B7280' }} />
          <span className="text-xs font-medium text-gray-700">{labels[st] || st}</span>
          <span className="text-xs font-bold text-gray-900">{count}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, labels }) {
  const color = STATUS_COLORS[status] || '#6B7280';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {labels[status] || status}
    </span>
  );
}

function ProgressBar({ value }) {
  const color = value >= 80 ? '#10B981' : value >= 50 ? '#F59E0B' : '#3B82F6';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" style={{ maxWidth: 80 }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-medium text-gray-600">{value}%</span>
    </div>
  );
}

function CaseTable({ cases, columns, onRowClick, emptyMsg }) {
  if (!cases || cases.length === 0) {
    return <p className="text-center text-gray-400 py-8 text-sm">{emptyMsg}</p>;
  }
  return (
    <Card className="border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => (
              <tr key={c.id || i} onClick={() => onRowClick?.(c)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(c[col.key], c) : (c[col.key] || '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
