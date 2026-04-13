import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Edit, Trash2, Loader2, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const StaffList = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const canManage = hasPermission('canManageStaff');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/staff`, {
        params: { page, limit: 20, search: search || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(data.staff);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load staff:', error);
      toast.error('Error al cargar el personal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [page, search]);

  const handleDelete = async (staffId, staffName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${staffName}?`)) return;

    try {
      await axios.delete(`${API}/admin/staff/${staffId}`);
      toast.success('Personal eliminado exitosamente');
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar personal');
    }
  };

  const handleTransfer = async () => {
    if (!targetStaffId || !transferModal) return;
    try {
      setTransferring(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.post(
        `${API}/admin/staff/${transferModal._id}/transfer-cases`,
        { targetStaffId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${data.total_transferred} casos transferidos exitosamente`);
      setTransferModal(null);
      setTargetStaffId('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al transferir casos');
    } finally {
      setTransferring(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      super_admin: 'bg-red-500/20 text-red-600 border border-red-500/30',
      admin: 'bg-orange-500/20 text-orange-600 border border-orange-500/30',
      manager: 'bg-blue-500/20 text-blue-600 border border-blue-500/30',
      coordinator: 'bg-success/20 text-success border border-success/30',
      advisor: 'bg-purple-500/20 text-purple-600 border border-purple-500/30'
    };
    return colors[role] || 'bg-gray-500/20 text-gray-600 border border-gray-500/30';
  };

  const getRoleTranslation = (role) => {
    const translations = {
      super_admin: 'Super Administrador',
      admin: 'Administrador',
      manager: 'Gerente',
      coordinator: 'Coordinador',
      advisor: 'Asesor'
    };
    return translations[role] || role;
  };

  const getStatusTranslation = (status) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
  };

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gestión de Personal
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Administra los miembros de tu equipo</p>
        </div>
        {canManage && (
          <Button
            onClick={() => navigate('/admin/staff/create')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Personal
          </Button>
        )}
      </div>

      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {staff.map((member) => (
              <div
                key={member._id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 gap-4"
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-base sm:text-lg flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base text-gray-900 font-semibold truncate">{member.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{member.email}</p>
                    {member.phone && (
                      <p className="text-xs text-gray-500">{member.phone}</p>
                    )}
                    {/* Badges moved below on mobile */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 sm:hidden">
                      <Badge className={`${getRoleBadgeColor(member.role)} text-xs`}>
                        {getRoleTranslation(member.role)}
                      </Badge>
                      <Badge
                        className={`text-xs ${
                          member.status === 'active'
                            ? 'bg-success/20 text-success border-success/30'
                            : 'bg-gray-500/20 text-gray-600 border-gray-500/30'
                        }`}
                      >
                        {getStatusTranslation(member.status)}
                      </Badge>
                    </div>
                  </div>
                  {/* Badges for desktop */}
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    <Badge className={getRoleBadgeColor(member.role)}>
                      {getRoleTranslation(member.role)}
                    </Badge>
                    <Badge
                      className={
                        member.status === 'active'
                          ? 'bg-success/20 text-success border-success/30'
                          : 'bg-gray-500/20 text-gray-600 border-gray-500/30'
                      }
                    >
                      {getStatusTranslation(member.status)}
                    </Badge>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 sm:ml-4 justify-end sm:justify-start">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setTransferModal(member); setTargetStaffId(''); }}
                      className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                      title="Transferir casos"
                      data-testid={`transfer-btn-${member._id}`}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/admin/staff/${member._id}`)}
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(member._id, member.name)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left order-last sm:order-first">
                Mostrando {((page - 1) * pagination.limit) + 1} a {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} resultados
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 sm:flex-initial"
                >
                  Anterior
                </Button>
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap px-2">
                  Página {page} de {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 sm:flex-initial"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setTransferModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Transferir Casos</h3>
            <p className="text-sm text-gray-500 mb-5">
              Transferir todos los casos de visa y gestion clasica de <strong>{transferModal.name}</strong> a otro miembro del equipo.
            </p>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Transferir a:</label>
            <select
              data-testid="transfer-target-select"
              value={targetStaffId}
              onChange={e => setTargetStaffId(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none mb-6"
            >
              <option value="">Seleccionar miembro...</option>
              {staff.filter(s => s._id !== transferModal._id).map(s => (
                <option key={s._id} value={s._id}>{s.name} — {getRoleTranslation(s.role)}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setTransferModal(null)} className="border-gray-300 text-gray-700">
                Cancelar
              </Button>
              <Button
                data-testid="transfer-confirm-btn"
                onClick={handleTransfer}
                disabled={!targetStaffId || transferring}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                Transferir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
