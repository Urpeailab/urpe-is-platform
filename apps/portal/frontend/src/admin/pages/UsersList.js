import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Search, UserPlus, Edit, Loader2, Download, FileText, CheckSquare, Trash2, Upload, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { AdvancedFilters } from '../components/AdvancedFilters';
import { BulkActions } from '../components/BulkActions';
import { exportUsers } from '../utils/exportData';
import { CSVImportModal } from '../components/CSVImportModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const UsersList = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Delete confirmation modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Todos los usuarios del staff pueden gestionar usuarios
  const canManage = true;

  const filterOptions = [
    {
      key: 'status',
      label: 'Estado',
      options: [
        { value: 'active', label: 'Activos' },
        { value: 'inactive', label: 'Inactivos' },
        { value: 'all', label: 'Todos' }
      ]
    },
    {
      key: 'userType',
      label: 'Tipo de Usuario',
      options: [
        { value: 'prospect', label: 'Prospectos' },
        { value: 'client', label: 'Clientes' },
        { value: 'all', label: 'Todos' }
      ]
    }
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/users`, {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          userState: filter !== 'all' ? filter : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Users data from API:', data.users.slice(0, 2)); // Debug log
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed a load users:', error);
      toast.error('Failed a load users');
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Confirm delete user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/users/${userToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Usuario "${userToDelete.name}" eliminado exitosamente`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers(); // Recargar la lista
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMsg = error.response?.data?.detail || 'Error al eliminar usuario';
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setFilter('all');
    setSearch('');
    setPage(1);
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if ( selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleBulkAction = async (action) => {
    if (action === 'clear') {
      setSelectedUsers([]);
      return;
    }

    if (action === 'export') {
      const usersToExport = users.filter(u =>  selectedUsers.includes(u.id));
      exportUsers(usersToExport, 'excel');
      toast.success(`${ selectedUsers.length} usuarios exportados exitosamente`);
      setSelectedUsers([]);
      return;
    }

    if (action === 'delete') {
      if (window.confirm(`¿Eliminar ${ selectedUsers.length} usuarios?`)) {
        toast.success(`${ selectedUsers.length} usuarios eliminados`);
        setSelectedUsers([]);
        fetchUsers();
      }
      return;
    }

    toast.info(`Acción "${action}" en proceso...`);
    setSelectedUsers([]);
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, filter]);

  const getStateBadge = (state) => {
    const badges = {
      U1: { label: 'Prospect', color: 'bg-gray-500/20 text-gray-500' },
      U2: { label: 'Qualified', color: 'bg-blue-500/20 text-blue-500' },
      U3: { label: 'Client', color: 'bg-success/20 text-success' }
    };
    return badges[state] || badges.U1;
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 mt-2">Administra tus clientes y prospectos</p>
        </div>
      </div>

      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por nombre, email, teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                />
              </div>
              <AdvancedFilters
                filters={filterOptions}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  exportUsers(users, 'excel');
                  toast.success('Todos los usuarios exportados');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              {canManage && (
                <>
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                    onClick={() => setShowImportModal(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar CSV
                  </Button>
                  <Button
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    onClick={() => toast.info('Crear usuario...')}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Seleccionar Todos Checkbox */}
          <div className="flex items-center mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <CheckSquare className={`h-4 w-4 ${ selectedUsers.length === users.length && users.length > 0 ? 'text-yellow-500' : ''}`} />
              <span>
                { selectedUsers.length === users.length && users.length > 0
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </span>
            </button>
            { selectedUsers.length > 0 && (
              <span className="ml-4 text-sm text-yellow-500">
                { selectedUsers.length} seleccionado{ selectedUsers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => {
              const stateBadge = getStateBadge(user.userState);
              return (
                <div
                  key={user._id}
                  className={`flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-lg transition-all border ${
                     selectedUsers.includes(user.id) 
                      ? 'bg-yellow-500/10 border-2 border-yellow-500/50' 
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {/* Main content row */}
                  <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                    {/* Selection Checkbox */}
                    <button
                      onClick={() => handleSelectUser(user.id)}
                      className="flex-shrink-0"
                    >
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                         selectedUsers.includes(user.id)
                          ? 'bg-yellow-500 border-yellow-500'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}>
                        { selectedUsers.includes(user.id) && (
                          <CheckSquare className="h-4 w-4 text-black" />
                        )}
                      </div>
                    </button>
                    
                    {/* Avatar */}
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-base md:text-lg flex-shrink-0">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-semibold truncate">{user.name || 'Unnamed'}</h3>
                      <p className="text-sm text-gray-600 truncate">{user.email || user.phone}</p>
                      {user.profession && (
                        <p className="text-xs text-gray-500 truncate">{user.profession}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Badges and Actions - Stacked on mobile, row on desktop */}
                  <div className="flex items-center justify-between md:justify-end mt-3 md:mt-0 gap-2 md:gap-3 md:ml-4">
                    {/* Badges Container */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* User State Badge (U1/U3) */}
                      <Badge 
                        className={`text-xs ${
                          user.userState === 'U3' 
                            ? 'bg-success/20 text-green-700 border-success/30' 
                            : 'bg-gray-500/20 text-gray-700 border-gray-500/30'
                        }`}
                      >
                        {user.userState || 'U1'}
                      </Badge>
                      
                      {/* Status Badge */}
                      <Badge className={`text-xs ${stateBadge.color}`}>
                        {stateBadge.label}
                      </Badge>
                      
                      {/* Cases Count Badge */}
                      <Badge 
                        className="bg-blue-500/20 text-blue-700 border-blue-500/30 font-semibold text-xs"
                        title={`${user.casesCount || 0} caso(s) de visa`}
                      >
                        📁 {user.casesCount || 0}
                      </Badge>
                      
                      {user.assignedAdvisor?.id && (
                        <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-xs hidden lg:inline-flex">
                          Has Advisor
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/users/${user._id}`)}
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-8 w-8 p-0"
                          title="Editar usuario"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDeleteDialog(user)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Mostrando {((page - 1) * pagination.limit) + 1} a {Math.min(page * pagination.limit, pagination.total)} de {pagination.total}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">P00e1gina {page} de {pagination.pages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActions
         seleccionadoCount={ selectedUsers.length}
        onAction={handleBulkAction}
        actions={[
          {
            key: 'export',
            label: 'Exportar seleccionados',
            icon: Download,
            variant: 'default'
          },
          {
            key: 'assign-advisor',
            label: 'Asignar asesor',
            icon: UserPlus,
            variant: 'default'
          },
          {
            key: 'delete',
            label: 'Eliminar',
            icon: Trash2,
            variant: 'destructive'
          }
        ]}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        type="users"
        onImportComplete={() => {
          fetchUsers();
          toast.success('Clientes importados exitosamente');
        }}
      />

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">
              ¿Eliminar Usuario?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {userToDelete && (
                <>
                  Estás a punto de eliminar al usuario <strong>"{userToDelete.name}"</strong>.
                  <br /><br />
                  <span className="text-red-600 font-medium">Esta acción eliminará:</span>
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>El usuario y su cuenta</li>
                    <li>Todos sus casos de visa</li>
                    <li>Todos los documentos asociados</li>
                    <li>Todos los pagos registrados</li>
                  </ul>
                  <br />
                  <span className="text-red-600 font-semibold">Esta acción NO se puede deshacer.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleting}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};