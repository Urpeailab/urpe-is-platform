import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Search, Edit, Trash2, Loader2, Users, TrendingUp, Megaphone, UserCheck, Bug, Crown, Briefcase, Download, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { exportStaff } from '../utils/exportData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Departamentos de URPE
const DEPARTMENTS = {
  all: { label: 'Todo el Personal', icon: Users },
  comercial: { label: 'Equipo Comercial', icon: TrendingUp },
  operativo: { label: 'Equipo Operativo', icon: Briefcase },
  marketing: { label: 'Equipo de Marketing', icon: Megaphone },
  rrhh: { label: 'Equipo de Recursos Humanos', icon: UserCheck },
  qa: { label: 'Equipo de QA', icon: Bug },
  ceo: { label: 'Gerente General (CEO)', icon: Crown },
  presidente: { label: 'Presidente', icon: Crown }
};

export const StaffManagement = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false); // Para cambios de página sin bloquear UI
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Pagination states - server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const canManage = hasPermission('canManageStaff');

  const [transferModal, setTransferModal] = useState(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [allStaffForTransfer, setAllStaffForTransfer] = useState([]);

  // Fetch counts for all departments
  const [departmentCounts, setDepartmentCounts] = useState({
    all: 0,
    comercial: 0,
    operativo: 0,
    marketing: 0,
    rrhh: 0,
    qa: 0,
    ceo: 0,
    presidente: 0
  });

  const fetchDepartmentCounts = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Fetch counts for each department in parallel
      const departments = ['all', 'comercial', 'operativo', 'marketing', 'rrhh', 'qa', 'ceo', 'presidente'];
      
      const countPromises = departments.map(async (dept) => {
        const params = new URLSearchParams({
          page: '1',
          limit: '1',
        });
        
        if (dept !== 'all') {
          params.append('department', dept);
        }
        
        const response = await axios.get(`${API}/admin/staff?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        return { dept, count: response.data.pagination?.total || 0 };
      });
      
      const results = await Promise.all(countPromises);
      const counts = {};
      results.forEach(({ dept, count }) => {
        counts[dept] = count;
      });
      
      setDepartmentCounts(counts);
    } catch (error) {
      console.error('Error loading department counts:', error);
    }
  };

  const handleExport = () => {
    if (staff.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    exportStaff(staff, 'csv');
    toast.success(`${staff.length} registros exportados exitosamente`);
  };

  // Initial load
  useEffect(() => {
    fetchAllData(true);
    fetchDepartmentCounts();
  }, []); // Initial load only

  // Subsequent loads (pagination, search, filters)
  useEffect(() => {
    if (!loading) {
      fetchAllData(false);
    }
  }, [currentPage, search, activeTab, loading]); // Depend on these values

  const fetchAllData = async (isInitialLoad = false) => {
    try {
      // Use different loading states for initial vs subsequent loads
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      
      const token = localStorage.getItem('admin_token');
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      
      if (search) {
        params.append('search', search);
      }
      
      if (activeTab && activeTab !== 'all') {
        params.append('department', activeTab);
      }
      
      // Fetch staff with pagination
      const staffResponse = await axios.get(`${API}/admin/staff?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStaff(staffResponse.data.staff || []);
      
      // Update pagination metadata
      if (staffResponse.data.pagination) {
        setTotalRecords(staffResponse.data.pagination.total);
        setTotalPages(staffResponse.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  const openTransferModal = async (member) => {
    setTransferModal(member);
    setTargetStaffId('');
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/staff?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllStaffForTransfer(data.staff || []);
    } catch (e) {
      setAllStaffForTransfer(staff);
    }
  };

  const handleTransfer = async () => {
    if (!targetStaffId || !transferModal) return;
    try {
      setTransferring(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.post(
        `${API}/admin/staff/${transferModal.id || transferModal._id}/transfer-cases`,
        { targetStaffId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${data.total_transferred} casos transferidos exitosamente`);
      setTransferModal(null);
      setTargetStaffId('');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al transferir casos');
    } finally {
      setTransferring(false);
    }
  };


  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${staffName}?`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Personal eliminado exitosamente');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar personal');
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

  // Staff data comes paginated from server
  // No need for local filtering or pagination

  // Reset to page 1 when tab changes or search changes
  const handleTabChange = (value) => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pagination component
  const Pagination = ({ total, current, onPageChange }) => {
    if (total <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, current - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(total, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>
            Mostrando <span className="font-medium">{Math.min((current - 1) * itemsPerPage + 1, totalRecords)}</span> - <span className="font-medium">{Math.min(current * itemsPerPage, totalRecords)}</span> de <span className="font-medium">{totalRecords}</span> registros
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(current - 1)}
            disabled={current === 1}
            className="text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </Button>
          
          {startPage > 1 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(1)}
                className={current === 1 ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' : 'text-gray-700 hover:bg-gray-100'}
              >
                1
              </Button>
              {startPage > 2 && <span className="px-2 text-gray-500">...</span>}
            </>
          )}

          {pages.map(page => (
            <Button
              key={page}
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page)}
              className={current === page 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500 font-semibold' 
                : 'text-gray-700 hover:bg-gray-100 border-gray-300'
              }
            >
              {page}
            </Button>
          ))}

          {endPage < total && (
            <>
              {endPage < total - 1 && <span className="px-2 text-gray-500">...</span>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(total)}
                className={current === total 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500 font-semibold' 
                  : 'text-gray-700 hover:bg-gray-100 border-gray-300'
                }
              >
                {total}
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(current + 1)}
            disabled={current === total}
            className="text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gestión de Personal
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Administra todo tu equipo en un solo lugar</p>
        </div>
        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              onClick={handleExport}
              className="bg-success hover:bg-success text-white w-full sm:w-auto justify-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              onClick={() => navigate('/admin/staff/create')}
              className="bg-yellow-500 hover:bg-yellow-600 text-black w-full sm:w-auto justify-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Persona
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="mb-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 bg-gray-100 p-1 rounded-lg gap-1 h-auto">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
            >
              <Users className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">Todos</span>
              <span className="inline sm:hidden">Todos</span> ({departmentCounts.all})
            </TabsTrigger>
          <TabsTrigger 
            value="comercial" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <TrendingUp className="h-3 w-3 flex-shrink-0" />
            <span className="hidden md:inline">Comercial</span>
            <span className="inline md:hidden">Com</span> ({departmentCounts.comercial})
          </TabsTrigger>
          <TabsTrigger 
            value="operativo" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <Briefcase className="h-3 w-3 flex-shrink-0" />
            <span className="hidden md:inline">Operativo</span>
            <span className="inline md:hidden">Oper</span> ({departmentCounts.operativo})
          </TabsTrigger>
          <TabsTrigger 
            value="marketing" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <Megaphone className="h-3 w-3 flex-shrink-0" />
            <span className="hidden md:inline">Marketing</span>
            <span className="inline md:hidden">Mkt</span> ({departmentCounts.marketing})
          </TabsTrigger>
          <TabsTrigger 
            value="rrhh" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <UserCheck className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">RRHH</span> ({departmentCounts.rrhh})
          </TabsTrigger>
          <TabsTrigger 
            value="qa" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <Bug className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">QA</span> ({departmentCounts.qa})
          </TabsTrigger>
          <TabsTrigger 
            value="ceo" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <Crown className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">CEO</span> ({departmentCounts.ceo})
          </TabsTrigger>
          <TabsTrigger 
            value="presidente" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center justify-center gap-1 text-xs px-2 py-2.5 h-auto whitespace-nowrap"
          >
            <Crown className="h-3 w-3 text-yellow-600 flex-shrink-0" />
            <span className="hidden lg:inline">Presidente</span>
            <span className="inline lg:hidden">Pres</span> ({departmentCounts.presidente})
          </TabsTrigger>
          </TabsList>
        </div>

        {/* Search Bar */}
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
              />
            </div>
          </CardHeader>

          {/* Helper function to render staff list */}
          {(() => {
            const StaffList = ({ emptyMessage = "No se encontraron resultados" }) => (
              <>
                <CardContent className="relative">
                  {/* Overlay loader for subsequent loads */}
                  {isFetching && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                      <div className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="font-medium">Cargando...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Initial loading state */}
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {staff.map((member) => (
                  <div
                    key={member.id || member._id}
                    className="flex flex-col p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 gap-3 cursor-pointer"
                    onClick={() => navigate(`/admin/staff/${member.id || member._id}/detail`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-base flex-shrink-0">
                          {member.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-gray-900 font-semibold truncate">{member.name}</h3>
                        <p className="text-xs text-gray-600 truncate">{member.email}</p>
                        {member.phone && <p className="text-xs text-gray-500">{member.phone}</p>}
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openTransferModal(member)}
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                            title="Transferir casos"
                            data-testid={`transfer-btn-${member.id || member._id}`}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/staff/${member.id || member._id}`)}
                            className="text-gray-600 hover:text-gray-900 hover:bg-gray-200 h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteStaff(member.id || member._id, member.name)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-[52px]">
                      <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs">
                        Visa: {member.visaCasesCount ?? 0}
                      </Badge>
                      <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs">
                        Clásica: {member.classicCasesCount ?? 0}
                      </Badge>
                      <Badge className={`${getRoleBadgeColor(member.role)} text-xs`}>
                        {getRoleTranslation(member.role)}
                      </Badge>
                      <Badge className={`text-xs ${member.status === 'active' ? 'bg-success/20 text-success border-success/30' : 'bg-gray-500/20 text-gray-600 border-gray-500/30'}`}>
                        {member.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                      ))}
                      {staff.length === 0 && !loading && (
                        <p className="text-center text-gray-500 py-8">{emptyMessage}</p>
                      )}
                    </div>
                  )}
                </CardContent>
                <Pagination 
                  total={totalPages}
                  current={currentPage}
                  onPageChange={handlePageChange}
                />
              </>
            );

            return (
              <>
                <TabsContent value="all">
                  <StaffList emptyMessage="No se encontró personal" />
                </TabsContent>
                <TabsContent value="comercial">
                  <StaffList emptyMessage="No hay personal en Equipo Comercial" />
                </TabsContent>
                <TabsContent value="operativo">
                  <StaffList emptyMessage="No hay personal en Equipo Operativo" />
                </TabsContent>
                <TabsContent value="marketing">
                  <StaffList emptyMessage="No hay personal en Equipo de Marketing" />
                </TabsContent>
                <TabsContent value="rrhh">
                  <StaffList emptyMessage="No hay personal en Equipo de Recursos Humanos" />
                </TabsContent>
                <TabsContent value="qa">
                  <StaffList emptyMessage="No hay personal en Equipo de QA" />
                </TabsContent>
                <TabsContent value="ceo">
                  <StaffList emptyMessage="No hay Gerente General asignado" />
                </TabsContent>
                <TabsContent value="presidente">
                  <StaffList emptyMessage="No hay Presidente asignado" />
                </TabsContent>
              </>
            );
          })()}
        </Card>
      </Tabs>

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
              {allStaffForTransfer.filter(s => s._id !== transferModal.id || transferModal._id).map(s => (
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
