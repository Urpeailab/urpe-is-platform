import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  DollarSign, 
  Search, 
  Filter, 
  Download,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Calendar,
  User,
  CreditCard,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL + '/api';

export const PaymentsList = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true); // Initial load
  const [fetching, setFetching] = useState(false); // Subsequent fetches
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 20;
  
  // Nuevos filtros
  const [quickDateFilter, setQuickDateFilter] = useState('all');
  const [filterUserId, setFilterUserId] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [users, setUsers] = useState([]);

  // Helper function para extraer texto de objetos bilingües
  const getText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && (value.es || value.en)) {
      return value.es || value.en || '';
    }
    return '';
  };

  // Función para calcular fechas de filtros rápidos
  const getQuickDateRange = (filter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'today':
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return {
          from: weekStart.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          from: monthStart.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return {
          from: yearStart.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      default:
        return { from: '', to: '' };
    }
  };

  // Fetch users for dropdown
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 500 }
      });
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const fetchPayments = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setFetching(true);
      }
      const token = localStorage.getItem('admin_token');
      
      // Build query params
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE
      };
      
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterMethod !== 'all') params.method = filterMethod;
      
      // Handle quick date filter
      if (quickDateFilter !== 'all') {
        const dateRange = getQuickDateRange(quickDateFilter);
        params.date_from = dateRange.from;
        params.date_to = dateRange.to;
      } else {
        if (filterDateFrom) params.date_from = filterDateFrom;
        if (filterDateTo) params.date_to = filterDateTo;
      }
      
      if (filterAmountMin !== '') params.amount_min = filterAmountMin;
      if (filterAmountMax !== '') params.amount_max = filterAmountMax;
      if (debouncedSearchTerm) params.search = debouncedSearchTerm;
      if (filterUserId !== 'all') params.user_id = filterUserId;
      if (filterStage !== 'all') params.stage_number = filterStage;
      
      const response = await axios.get(`${API}/payments/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      if (response.data.success) {
        setPayments(response.data.transactions || []);
        // Update pagination info
        const paginationData = response.data.pagination;
        if (paginationData) {
          setTotalPages(paginationData.totalPages);
          setTotalCount(paginationData.total);
        }
        // Update stats
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [currentPage, filterStatus, filterMethod, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, debouncedSearchTerm, quickDateFilter, filterUserId, filterStage]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchPayments(true);
    fetchUsers(); // Cargar usuarios para el dropdown
    // Get user role from token
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || '');
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
  }, [fetchPayments]);

  // Función para editar pago
  const handleEditPayment = async () => {
    if (!editingPayment) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.put(`${API}/admin/payments/${editingPayment.id}`, {
        amount: parseFloat(editingPayment.amount),
        status: editingPayment.status,
        paymentMethod: editingPayment.paymentMethod,
        notes: editingPayment.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Pago actualizado exitosamente');
      setShowEditModal(false);
      setEditingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el pago');
    } finally {
      setSaving(false);
    }
  };

  // Función para eliminar pago
  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.delete(`${API}/admin/payments/${deletingPayment.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Pago eliminado exitosamente');
      setShowDeleteModal(false);
      setDeletingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar el pago');
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = userRole === 'super_admin';

  // Since we're doing server-side pagination and filtering, we use payments directly

  // Reset to page 1 when filters change (but not when currentPage changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterMethod, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, searchTerm, quickDateFilter, filterUserId, filterStage]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'all') count++;
    if (filterMethod !== 'all') count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (filterAmountMin !== '') count++;
    if (filterAmountMax !== '') count++;
    if (debouncedSearchTerm) count++;
    if (quickDateFilter !== 'all') count++;
    if (filterUserId !== 'all') count++;
    if (filterStage !== 'all') count++;
    return count;
  }, [filterStatus, filterMethod, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, debouncedSearchTerm, quickDateFilter, filterUserId, filterStage]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterMethod('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setQuickDateFilter('all');
    setFilterUserId('all');
    setFilterStage('all');
    setCurrentPage(1);
    toast.success('Filtros limpiados');
  };

  // Stats from backend (all filtered payments, not just current page)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    totalRevenue: 0
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'bg-green-100 text-green-800', label: 'Completado', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente', icon: Clock },
      failed: { color: 'bg-red-100 text-red-800', label: 'Fallido', icon: XCircle },
      expired: { color: 'bg-gray-100 text-gray-800', label: 'Expirado', icon: XCircle }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['Nombre', 'Email', 'Session ID', 'Caso', 'Etapa', 'Monto', 'Estado', 'Fecha'];
    const rows = payments.map(p => [
      p.userName || 'N/A',
      p.userEmail || 'N/A',
      p.sessionId || 'N/A',
      p.caseId || 'N/A',
      `Etapa ${p.stageNumber} - ${getText(p.stageName)}`,
      `$${p.amount || 0}`,
      p.status || 'N/A',
      formatDate(p.createdAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Archivo CSV descargado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando pagos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Gestión de Pagos</h1>
          <p className="text-gray-600 mt-1">Administra y monitorea todas las transacciones</p>
        </div>
        <Button
          onClick={exportToCSV}
          className="bg-success hover:bg-green-700 text-white flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Pagos */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </CardContent>
        </Card>

        {/* Completados */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            </div>
          </CardContent>
        </Card>

        {/* Pendientes */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
            </div>
          </CardContent>
        </Card>

        {/* Fallidos */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Fallidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.failed}</div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos Totales */}
        <Card className="bg-gradient-to-br from-success/10 to-success/10 border-success/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700">Ingresos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-700" />
              </div>
              <div className="text-2xl font-bold text-green-900">${stats.totalRevenue.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Quick Date Filters - Nueva sección */}
            <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 mr-2 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Período:
              </span>
              {[
                { value: 'all', label: 'Todo' },
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Esta semana' },
                { value: 'month', label: 'Este mes' },
                { value: 'year', label: 'Este año' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setQuickDateFilter(option.value);
                    if (option.value !== 'all') {
                      setFilterDateFrom('');
                      setFilterDateTo('');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    quickDateFilter === option.value
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Basic Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent appearance-none bg-white text-gray-900 cursor-pointer"
                >
                  <option value="all" className="text-gray-900">Todos los estados</option>
                  <option value="completed" className="text-gray-900">Completados</option>
                  <option value="pending" className="text-gray-900">Pendientes</option>
                  <option value="failed" className="text-gray-900">Fallidos</option>
                  <option value="expired" className="text-gray-900">Expirados</option>
                </select>
              </div>

              {/* User Filter - Nuevo */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent appearance-none bg-white text-gray-900 cursor-pointer"
                >
                  <option value="all">Todos los usuarios</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Filter - Nuevo */}
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent appearance-none bg-white text-gray-900 cursor-pointer"
                >
                  <option value="all">Todas las etapas</option>
                  <option value="1">Etapa 1 - Consulta Inicial</option>
                  <option value="2">Etapa 2 - Revisión de Documentos</option>
                  <option value="3">Etapa 3 - Preparación Petición</option>
                  <option value="4">Etapa 4 - Presentación USCIS</option>
                  <option value="5">Etapa 5 - Seguimiento</option>
                  <option value="6">Etapa 6 - Aprobación</option>
                  <option value="7">Etapa 7 - Consular/AOS</option>
                  <option value="8">Etapa 8 - Green Card</option>
                  <option value="9">Etapa 9 - Ciudadanía</option>
                </select>
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                variant="outline"
                size="sm"
                className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Más filtros {showAdvancedFilters ? '▲' : '▼'}
              </Button>
              
              {activeFiltersCount > 0 && (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="sm"
                  className="bg-white text-red-600 hover:bg-red-50 border-red-300"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Limpiar ({activeFiltersCount})
                </Button>
              )}
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                  <select
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white text-gray-900 cursor-pointer"
                  >
                    <option value="all">Todos los métodos</option>
                    <option value="zelle">Zelle</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                    <option value="transfer">Transferencia</option>
                    <option value="fanbasis">Fanbasis</option>
                    <option value="manual">Manual</option>
                    <option value="cash">Efectivo</option>
                    <option value="check">Cheque</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => {
                        setFilterDateFrom(e.target.value);
                        setQuickDateFilter('all');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white text-gray-900"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => {
                        setFilterDateTo(e.target.value);
                        setQuickDateFilter('all');
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white text-gray-900"
                    />
                  </div>
                </div>

                {/* Amount Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rango de Monto</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <input
                        type="number"
                        placeholder="Min"
                        value={filterAmountMin}
                        onChange={(e) => setFilterAmountMin(e.target.value)}
                        className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 text-sm"
                      />
                    </div>
                    <span className="text-gray-400 self-center">-</span>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <input
                        type="number"
                        placeholder="Max"
                        value={filterAmountMax}
                        onChange={(e) => setFilterAmountMax(e.target.value)}
                        className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Filters Chips */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {quickDateFilter !== 'all' && (
                  <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {quickDateFilter === 'today' ? 'Hoy' : 
                     quickDateFilter === 'week' ? 'Esta semana' : 
                     quickDateFilter === 'month' ? 'Este mes' : 'Este año'}
                    <button onClick={() => setQuickDateFilter('all')} className="ml-1 hover:text-yellow-900">×</button>
                  </Badge>
                )}
                {filterStatus !== 'all' && (
                  <Badge className="bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                    Estado: {filterStatus === 'completed' ? 'Completado' : filterStatus === 'pending' ? 'Pendiente' : filterStatus}
                    <button onClick={() => setFilterStatus('all')} className="ml-1 hover:text-blue-900">×</button>
                  </Badge>
                )}
                {filterUserId !== 'all' && (
                  <Badge className="bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {users.find(u => u.id === filterUserId)?.name || 'Usuario'}
                    <button onClick={() => setFilterUserId('all')} className="ml-1 hover:text-purple-900">×</button>
                  </Badge>
                )}
                {filterStage !== 'all' && (
                  <Badge className="bg-green-100 text-green-800 border border-green-300 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Etapa {filterStage}
                    <button onClick={() => setFilterStage('all')} className="ml-1 hover:text-green-900">×</button>
                  </Badge>
                )}
                {filterMethod !== 'all' && (
                  <Badge className="bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {filterMethod}
                    <button onClick={() => setFilterMethod('all')} className="ml-1 hover:text-orange-900">×</button>
                  </Badge>
                )}
                {debouncedSearchTerm && (
                  <Badge className="bg-gray-100 text-gray-800 border border-gray-300 flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    "{debouncedSearchTerm}"
                    <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-gray-900">×</button>
                  </Badge>
                )}
              </div>
            )}

            {/* Results Count */}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
              <p className="text-gray-600">
                Mostrando <span className="font-semibold text-gray-900">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> - <span className="font-semibold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> de <span className="font-semibold text-gray-900">{totalCount}</span> pagos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Lista de Transacciones
            </CardTitle>
            {fetching && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className={`overflow-x-auto ${fetching ? 'opacity-60 pointer-events-none' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Usuario</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Etapa</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Monto</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Referencia</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">
                      No se encontraron pagos
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{payment.userName || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{payment.userEmail || ''}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">Etapa {payment.stageNumber}</p>
                          <p className="text-xs text-gray-500">{getText(payment.stageName)}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className="font-semibold text-gray-900">
                          ${payment.amount?.toLocaleString()} {payment.currency}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className="text-gray-900">{payment.reference || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowDetailsModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                          {isSuperAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingPayment({...payment});
                                  setShowEditModal(true);
                                }}
                                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDeletingPayment(payment);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-full sm:w-auto bg-white text-gray-900 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600 order-first sm:order-none">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-full sm:w-auto bg-white text-gray-900 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 relative">
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Detalles de la Transacción
              </CardTitle>
              {/* Botón X para cerrar */}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
                aria-label="Cerrar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Información del Usuario */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información del Usuario
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Nombre:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPayment.userName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPayment.userEmail || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Teléfono:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPayment.userPhone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">User ID:</span>
                    <code className="text-xs bg-gray-800 text-white px-2 py-1 rounded border border-blue-300 font-mono">
                      {selectedPayment.userId?.substring(0, 24)}...
                    </code>
                  </div>
                </div>
              </div>

              {/* Información del Caso */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Información del Caso
                </h3>
                <div className="bg-success/10 border border-success/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tipo de Visa:</span>
                    <span className="text-sm font-bold text-green-700">{selectedPayment.visaType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estado del Caso:</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                      {selectedPayment.caseStatus || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Progreso General:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-success rounded-full transition-all"
                          style={{ width: `${selectedPayment.overallProgress || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {selectedPayment.overallProgress || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Etapa Pagada:</span>
                    <span className="text-sm font-medium text-gray-900">
                      Etapa {selectedPayment.stageNumber}: {getText(selectedPayment.stageName)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Case ID:</span>
                    <code className="text-xs bg-gray-800 text-white px-2 py-1 rounded border border-green-300 font-mono">
                      {selectedPayment.caseId?.substring(0, 24)}...
                    </code>
                  </div>
                </div>
              </div>

              {/* Información del Pago */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Información del Pago
                </h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monto:</span>
                    <span className="text-xl font-bold text-gray-900">
                      ${selectedPayment.amount?.toLocaleString()} {selectedPayment.currency || 'USD'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Estado:</span>
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estado de Pago:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPayment.paymentStatus || 'N/A'}</span>
                  </div>
                  {selectedPayment.paymentMethod && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Método de Pago:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedPayment.paymentMethod}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* IDs Técnicos */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  IDs Técnicos
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Session ID</p>
                    <code className="text-xs bg-gray-800 text-white px-2 py-1 rounded border border-gray-400 block break-all font-mono">
                      {selectedPayment.sessionId}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Transaction ID</p>
                    <code className="text-xs bg-gray-800 text-white px-2 py-1 rounded border border-gray-400 block break-all font-mono">
                      {selectedPayment.id}
                    </code>
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Fechas
                </h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Creación:</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedPayment.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Última Actualización:</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedPayment.updatedAt)}</span>
                  </div>
                  {selectedPayment.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Completado:</span>
                      <span className="text-sm font-medium text-green-700">{formatDate(selectedPayment.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPayment(null);
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Edición */}
      {showEditModal && editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
                <Pencil className="h-5 w-5 text-blue-600" />
                Editar Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Monto</label>
                <input
                  type="number"
                  value={editingPayment.amount || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Estado</label>
                <select
                  value={editingPayment.status || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="pending">Pendiente</option>
                  <option value="completed">Completado</option>
                  <option value="failed">Fallido</option>
                  <option value="refunded">Reembolsado</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Método de Pago</label>
                <select
                  value={editingPayment.paymentMethod || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, paymentMethod: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="zelle">Zelle</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                  <option value="bank_transfer">Transferencia Bancaria</option>
                  <option value="cash">Efectivo</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Referencia</label>
                <input
                  type="text"
                  value={editingPayment.reference || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, reference: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  placeholder="Número de referencia del pago"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notas</label>
                <textarea
                  value={editingPayment.notes || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPayment(null);
                  }}
                  className="flex-1"
                  style={{ color: '#000000', borderColor: '#374151' }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEditPayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...</>
                  ) : (
                    'Guardar Cambios'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Eliminación */}
      {showDeleteModal && deletingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que deseas eliminar este pago?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usuario:</span>
                    <span className="font-semibold text-gray-900">{deletingPayment.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto:</span>
                    <span className="font-semibold text-gray-900">${deletingPayment.amount?.toLocaleString()} {deletingPayment.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Etapa:</span>
                    <span className="font-semibold text-gray-900">Etapa {deletingPayment.stageNumber}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-red-600 text-sm font-medium mb-4">
                ⚠️ Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingPayment(null);
                  }}
                  className="flex-1"
                  style={{ color: '#000000', borderColor: '#374151' }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeletePayment}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Eliminando...</>
                  ) : (
                    'Eliminar Pago'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
