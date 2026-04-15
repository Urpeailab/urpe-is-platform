import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Plus, Search, Eye, Loader2, Briefcase, Filter, CheckCircle, FileText, X, Download, ChevronDown, ChevronUp, Calendar, Trash2, LayoutGrid, List, Copy } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  'eligibility_approved': 'Elegibilidad Aprobada',
  'active': 'Activo',
  'stage_1': 'Etapa 1',
  'stage_2': 'Etapa 2',
  'stage_3': 'Etapa 3',
  'stage_4': 'Etapa 4',
  'ready_to_file': 'Listo para Radicar',
  'filed': 'Radicado',
  'approved': 'Aprobado',
  'denied': 'Denegado',
  'on_hold': 'En Espera'
};

const STATUS_COLORS = {
  'eligibility_approved': 'bg-blue-100 text-blue-800',
  'active': 'bg-green-100 text-green-800',
  'stage_1': 'bg-yellow-100 text-yellow-800',
  'stage_2': 'bg-yellow-100 text-yellow-800',
  'stage_3': 'bg-orange-100 text-orange-800',
  'stage_4': 'bg-orange-100 text-orange-800',
  'ready_to_file': 'bg-purple-100 text-purple-800',
  'filed': 'bg-indigo-100 text-indigo-800',
  'approved': 'bg-green-100 text-green-800',
  'denied': 'bg-red-100 text-red-800',
  'on_hold': 'bg-gray-100 text-gray-800'
};

export const VisaCasesList = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visaTypeFilter, setVisaTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [caseStats, setCaseStats] = useState({ active: 0, filed: 0, approved: 0 });
  const [coordinators, setCoordinators] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  
  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [progressMin, setProgressMin] = useState('');
  const [progressMax, setProgressMax] = useState('');
  const [coordinatorFilter, setCoordinatorFilter] = useState('all');
  const [salesRepFilter, setSalesRepFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  
  // View mode: 'list' or 'pipeline'
  const [viewMode, setViewMode] = useState('list');

  // Stage names for filter and pipeline columns
  const stageNames = [
    { number: 1, name: 'Bienvenida' },
    { number: 2, name: 'Reporte de Elegibilidad' },
    { number: 3, name: 'Estrategia Central' },
    { number: 4, name: 'Validación Económica' },
    { number: 5, name: 'Identidad y Profundidad Técnica' },
    { number: 6, name: 'Autoridad Académica' },
    { number: 7, name: 'Desarrollo Tecnológico (MVP)' },
    { number: 8, name: 'Prueba Social' },
    { number: 9, name: 'Aval de Expertos' },
    { number: 10, name: 'Argumentación Técnica' },
    { number: 11, name: 'Traducciones y Logística Final' }
  ];

  // Delete case state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState(null);

  // Get user role and name on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
        setUserName(payload.name);
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
  }, []);

  // Fetch coordinators and advisors list once on mount
  useEffect(() => {
    const fetchStaffAndAdvisors = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        
        // Fetch staff for coordinators and sellers
        const { data: staffData } = await axios.get(`${BACKEND_URL}/api/admin/staff`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Extract unique coordinator names (role: coordinator or admin)
        const coordinatorNames = staffData.staff
          .filter(s => s.role === 'coordinator' || s.role === 'admin')
          .map(s => s.name)
          .filter(Boolean);
        
        // Remove duplicates and sort
        const uniqueCoordinators = [...new Set(coordinatorNames)].sort();
        setCoordinators(uniqueCoordinators);
        
        // Extract unique seller/advisor names (role: advisor or sales)
        const sellerNames = staffData.staff
          .filter(s => s.role === 'advisor' || s.role === 'sales' || s.role === 'seller')
          .map(s => s.name)
          .filter(Boolean);
        
        // Remove duplicates and sort
        const uniqueSellers = [...new Set(sellerNames)].sort();
        setSalesReps(uniqueSellers);
      } catch (error) {
        console.error('Error fetching staff/advisors:', error);
      }
    };
    
    fetchStaffAndAdvisors();
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      const params = new URLSearchParams();
      params.append('page', page);
      // En modo Pipeline obtener más casos para ver el tablero completo
      params.append('limit', viewMode === 'pipeline' ? 200 : 20);
      if (visaTypeFilter && visaTypeFilter !== 'all') params.append('visaType', visaTypeFilter);
      if (search && search.trim()) params.append('search', search.trim());
      
      // Advanced filters - now sent to backend
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (progressMin !== '') params.append('progressMin', progressMin);
      if (progressMax !== '') params.append('progressMax', progressMax);
      if (coordinatorFilter && coordinatorFilter !== 'all') {
        if (coordinatorFilter === 'unassigned') {
          params.append('unassigned', 'true');
        } else {
          params.append('coordinatorName', coordinatorFilter);
        }
      }
      if (salesRepFilter && salesRepFilter !== 'all') {
        params.append('salesRepName', salesRepFilter);
      }
      // No aplicar filtro de etapa en modo Pipeline (se ve todo en columnas)
      if (stageFilter && stageFilter !== 'all' && viewMode !== 'pipeline') {
        params.append('stageFilter', stageFilter);
      }
      
      // Si es coordinador, filtrar por su nombre (coordinador O vendedor)
      if (userRole === 'coordinator' && userName) {
        params.append('coordinatorOrAdvisor', userName);
      }
      
      // Sorting
      if (sortBy) params.append('sortBy', sortBy);
      
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/visa-cases?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCases(data.cases || []);
      setPagination(data.pagination);
      if (data.stats) setCaseStats(data.stats);
    } catch (error) {
      console.error('Error fetching visa cases:', error);
      toast.error('Error al cargar los casos de visa');
    } finally {
      setLoading(false);
    }
  }, [page, visaTypeFilter, search, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter, sortBy, viewMode, userRole, userName]);


  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    
    setDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(
        `${BACKEND_URL}/api/admin/visa-cases/${caseToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      toast.success('Caso eliminado exitosamente');
      setDeleteModalOpen(false);
      setCaseToDelete(null);
      
      // Refresh the list
      fetchCases();
    } catch (error) {
      console.error('Error deleting case:', error);
      const errorMsg = error.response?.data?.detail || 'Error al eliminar el caso';
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };


  // Debounce search to avoid too many API calls
  // For search: 500ms delay, for other filters: immediate
  useEffect(() => {
    // Skip if it's the initial mount (cases are empty)
    const debounceTimer = setTimeout(() => {
      fetchCases();
    }, search ? 500 : 0);
    
    return () => clearTimeout(debounceTimer);
  }, [page, visaTypeFilter, search, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, fetchCases]);
  
  // Reset to page 1 when any filter changes (but not on initial mount)
  const isInitialMount = React.useRef(true);
  const prevFilters = React.useRef({ visaTypeFilter, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter, sortBy });
  
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFilters.current = { visaTypeFilter, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter, sortBy };
      return;
    }
    
    const filtersChanged = 
      prevFilters.current.visaTypeFilter !== visaTypeFilter ||
      prevFilters.current.dateFrom !== dateFrom ||
      prevFilters.current.dateTo !== dateTo ||
      prevFilters.current.progressMin !== progressMin ||
      prevFilters.current.progressMax !== progressMax ||
      prevFilters.current.coordinatorFilter !== coordinatorFilter ||
      prevFilters.current.salesRepFilter !== salesRepFilter ||
      prevFilters.current.stageFilter !== stageFilter ||
      prevFilters.current.sortBy !== sortBy;
    
    if (filtersChanged && page !== 1) {
      setPage(1);
    }
    
    prevFilters.current = { visaTypeFilter, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter, sortBy };
  }, [visaTypeFilter, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter, sortBy, page, setPage]);

  // All filtering is now handled by the backend
  // No need for local filtering - just use cases directly
  const filteredCases = cases;
  
  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (visaTypeFilter !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (progressMin !== '') count++;
    if (progressMax !== '') count++;
    if (coordinatorFilter !== 'all') count++;
    if (salesRepFilter !== 'all') count++;
    if (stageFilter !== 'all') count++;
    return count;
  }, [visaTypeFilter, dateFrom, dateTo, progressMin, progressMax, coordinatorFilter, salesRepFilter, stageFilter]);
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearch('');
    setVisaTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setProgressMin('');
    setProgressMax('');
    setCoordinatorFilter('all');
    setSalesRepFilter('all');
    setStageFilter('all');
    toast.success('Filtros limpiados');
  };
  
  // Group cases by stage for Pipeline view
  const casesByStage = useMemo(() => {
    const grouped = {};
    // Initialize all stages (0 to 11)
    for (let i = 0; i <= 11; i++) {
      grouped[i] = [];
    }
    // Group cases by lastPaidStage
    // Los casos sin pagos (etapa 0) se muestran en etapa 1 por defecto
    cases.forEach(c => {
      const stage = c.lastPaidStage || 0;
      const displayStage = stage === 0 ? 1 : stage; // Sin pagos va a etapa 1
      if (grouped[displayStage]) {
        grouped[displayStage].push(c);
      }
    });
    return grouped;
  }, [cases]);

  // Pipeline column colors
  const stageColors = [
    'bg-gray-100 border-gray-300',      // 0 - Sin pagos
    'bg-blue-50 border-blue-300',       // 1 - Bienvenida
    'bg-indigo-50 border-indigo-300',   // 2 - Reporte
    'bg-purple-50 border-purple-300',   // 3 - Estrategia
    'bg-pink-50 border-pink-300',       // 4 - Validación
    'bg-red-50 border-red-300',         // 5 - Identidad
    'bg-orange-50 border-orange-300',   // 6 - Autoridad
    'bg-yellow-50 border-yellow-300',   // 7 - MVP
    'bg-lime-50 border-lime-300',       // 8 - Prueba Social
    'bg-green-50 border-green-300',     // 9 - Aval
    'bg-teal-50 border-teal-300',       // 10 - Argumentación
    'bg-cyan-50 border-cyan-300',       // 11 - Traducciones
  ];
  
  // Export filtered results to CSV
  const exportToCSV = () => {
    const headers = ['Cliente', 'Email', 'Tipo de Visa', 'Progreso %', 'Coordinador', 'Fecha Creación'];
    const rows = filteredCases.map(c => [
      c.userName || 'N/A',
      c.userEmail || 'N/A',
      c.visaType || 'N/A',
      `${c.overallProgress || 0}%`,
      c.coordinatorName || 'Sin asignar',
      new Date(c.createdAt).toLocaleDateString('es-ES')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casos_visa_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Archivo CSV descargado');
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-gray-300';
  };

  return (
    <div className="space-y-6 p-6 relative">
      {/* Header Moderno */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Casos de Visa</h1>
          <p className="text-gray-600 mt-1">Sistema Pay As You Advance Visa™</p>
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`rounded-none ${viewMode === 'list' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('pipeline')}
              className={`rounded-none ${viewMode === 'pipeline' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Pipeline
            </Button>
          </div>
          {userRole !== 'acreditador' && (
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          )}
          {userRole !== 'acreditador' && (
          <Button
            onClick={() => navigate('/admin/visa-cases/create')}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold shadow-lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Crear Caso Nuevo
          </Button>
          )}
        </div>
      </div>

      {/* Filtros Modernos - Fondo claro */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
        {/* Sort Dropdown */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Ordenar por:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-80 bg-gray-50 border-gray-300 text-gray-900">
              <SelectValue className="text-gray-900" placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">
                <span className="flex items-center gap-2">
                  🎯 Más Urgentes (Recomendado)
                </span>
              </SelectItem>
              <SelectItem value="updated">
                <span className="flex items-center gap-2">
                  ⏰ Sin Actualizar (Más Antiguos)
                </span>
              </SelectItem>
              <SelectItem value="recent">
                <span className="flex items-center gap-2">
                  📅 Más Recientes
                </span>
              </SelectItem>
              <SelectItem value="oldest">
                <span className="flex items-center gap-2">
                  ⏳ Más Antiguos
                </span>
              </SelectItem>
              <SelectItem value="progress_asc">
                <span className="flex items-center gap-2">
                  📉 Menor Progreso
                </span>
              </SelectItem>
              <SelectItem value="progress_desc">
                <span className="flex items-center gap-2">
                  📈 Mayor Progreso
                </span>
              </SelectItem>
              <SelectItem value="stage">
                <span className="flex items-center gap-2">
                  📊 Por Etapa Actual
                </span>
              </SelectItem>
              <SelectItem value="status">
                <span className="flex items-center gap-2">
                  ⚡ Por Estado
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, teléfono, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Reset to page 1 when searching
                  if (page !== 1) setPage(1);
                }}
                className="pl-10 bg-gray-50 border-gray-300 text-gray-900"
              />
            </div>
          </div>

          {/* Visa Type Filter */}
          <Select value={visaTypeFilter} onValueChange={setVisaTypeFilter}>
            <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900">
              <SelectValue className="text-gray-900" placeholder="Todos los Tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Tipos</SelectItem>
              <SelectItem value="EB-2 NIW">EB-2 NIW</SelectItem>
              <SelectItem value="EB-1">EB-1</SelectItem>
              <SelectItem value="EB-1A">EB-1A</SelectItem>
              <SelectItem value="EB-1B">EB-1B</SelectItem>
              <SelectItem value="O-1">O-1</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filters Toggle */}
          <Button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 relative"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros Avanzados
            {activeFiltersCount > 0 && (
              <Badge className="ml-2 bg-blue-600 text-white">{activeFiltersCount}</Badge>
            )}
            {showAdvancedFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Filtros Avanzados</h3>
              {activeFiltersCount > 0 && (
                <Button
                  onClick={clearAllFilters}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpiar Filtros
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Fecha Desde
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-gray-50 border-gray-300 text-gray-900"
                />
              </div>

              {/* Date Range To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Fecha Hasta
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-gray-50 border-gray-300 text-gray-900"
                />
              </div>

              {/* Coordinator Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coordinador
                </label>
                <Select value={coordinatorFilter} onValueChange={setCoordinatorFilter}>
                  <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900">
                    <SelectValue className="text-gray-900" placeholder="Todos los Coordinadores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Coordinadores</SelectItem>
                    <SelectItem value="unassigned">
                      <span className="flex items-center gap-2 text-orange-700 font-medium">
                        ⚠️ Sin Coordinador Asignado
                      </span>
                    </SelectItem>
                    {coordinators.map((coord) => (
                      <SelectItem key={coord} value={coord}>
                        {coord}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advisor/Vendedor Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendedor/a
                </label>
                <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                  <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900">
                    <SelectValue className="text-gray-900" placeholder="Todos los Vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Vendedores</SelectItem>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep} value={rep}>
                        {rep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Última Etapa Pagada
                </label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900">
                    <SelectValue className="text-gray-900" placeholder="Todas las Etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Etapas</SelectItem>
                    <SelectItem value="0">Sin pagos (Etapa 0)</SelectItem>
                    {stageNames.map((stage) => (
                      <SelectItem key={stage.number} value={String(stage.number)}>
                        {stage.number}. {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Progress Range Min */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Progreso Mínimo (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progressMin}
                  onChange={(e) => setProgressMin(e.target.value)}
                  placeholder="0"
                  className="bg-gray-50 border-gray-300 text-gray-900"
                />
              </div>

              {/* Progress Range Max */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Progreso Máximo (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progressMax}
                  onChange={(e) => setProgressMax(e.target.value)}
                  placeholder="100"
                  className="bg-gray-50 border-gray-300 text-gray-900"
                />
              </div>
            </div>

            {/* Filter Summary */}
            {activeFiltersCount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{activeFiltersCount}</strong> filtro(s) activo(s) - 
                  Mostrando <strong>{filteredCases.length}</strong> de <strong>{cases.length}</strong> casos
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards Modernos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total de Casos */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-yellow-500 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Casos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{pagination?.total || 0}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Casos Activos */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-success hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Casos Activos</p>
              <p className="text-3xl font-bold text-success mt-2">
                {caseStats.active}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
          </div>
        </div>

        {/* Radicados */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-indigo-500 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Radicados</p>
              <p className="text-3xl font-bold text-indigo-600 mt-2">
                {caseStats.filed}
              </p>
            </div>
            <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Aprobados */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-success hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Aprobados</p>
              <p className="text-3xl font-bold text-success mt-2">
                {caseStats.approved}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
          </div>
        </div>
      </div>

      {/* Cases View - List or Pipeline */}
      {viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden relative">
          {/* Loading Overlay - discreto */}
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                <span className="text-sm text-gray-700">Cargando casos...</span>
              </div>
            </div>
          )}
          
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Lista de Casos <span className="text-yellow-600">({filteredCases.length})</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {filteredCases.length === 0 && !loading ? (
                <div className="text-center py-16">
                  <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg mb-6">No hay casos de visa creados</p>
                  <Button
                    onClick={() => navigate('/admin/visa-cases/create')}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Crear Primer Caso
                  </Button>
                </div>
              ) : (
                filteredCases.map((caseItem) => (
                <div
                  key={caseItem._id || caseItem.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:border-yellow-500 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                  onClick={() => navigate(`/admin/visa-cases/${caseItem._id || caseItem.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {caseItem.userName?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-yellow-600 transition-colors">
                              {caseItem.userName || 'Cliente Sin Nombre'}
                            </h3>
                            {/* Priority Score Badge - Always visible when score exists */}
                            {caseItem.priorityScore !== undefined && caseItem.scoreBreakdown && (
                              <div className="relative group/tooltip">
                                <span 
                                  className={`
                                    inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold cursor-help
                                    ${caseItem.priorityScore >= 80 ? 'bg-red-100 text-red-800' : 
                                      caseItem.priorityScore >= 60 ? 'bg-orange-100 text-orange-800' :
                                      caseItem.priorityScore >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                      caseItem.priorityScore >= 20 ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'}
                                  `}
                                >
                                  🎯 {caseItem.priorityScore}
                                </span>
                                
                                {/* Tooltip detallado */}
                                <div className="absolute left-0 top-full mt-2 w-80 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                                  <div className="text-xs">
                                    <div className="font-bold text-gray-900 mb-3 text-sm border-b pb-2">
                                      📊 Cálculo de Prioridad: {caseItem.priorityScore} pts
                                    </div>
                                    
                                    {/* Urgencia */}
                                    <div className="mb-3">
                                      <div className="font-semibold text-red-700 mb-1">
                                        🚨 Urgencia: {caseItem.scoreBreakdown.urgency.score}/{caseItem.scoreBreakdown.urgency.max} pts
                                      </div>
                                      <div className="space-y-1 pl-3">
                                        {caseItem.scoreBreakdown.urgency.details.map((detail, idx) => (
                                          <div key={idx} className="text-gray-700">{detail}</div>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Actividad */}
                                    <div className="mb-3">
                                      <div className="font-semibold text-orange-700 mb-1">
                                        ⚡ Actividad: {caseItem.scoreBreakdown.activity.score}/{caseItem.scoreBreakdown.activity.max} pts
                                      </div>
                                      <div className="space-y-1 pl-3">
                                        {caseItem.scoreBreakdown.activity.details.map((detail, idx) => (
                                          <div key={idx} className="text-gray-700">{detail}</div>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Progreso */}
                                    <div>
                                      <div className="font-semibold text-blue-700 mb-1">
                                        📈 Progreso: {caseItem.scoreBreakdown.progress.score}/{caseItem.scoreBreakdown.progress.max} pts
                                      </div>
                                      <div className="space-y-1 pl-3">
                                        {caseItem.scoreBreakdown.progress.details.map((detail, idx) => (
                                          <div key={idx} className="text-gray-700">{detail}</div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 group">
                            <p className="text-sm text-gray-600">{caseItem.userEmail}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const textArea = document.createElement('textarea');
                                textArea.value = caseItem.userEmail;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-9999px';
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                toast.success('Email copiado');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                              title="Copiar email"
                            >
                              <Copy className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                          </div>
                          {caseItem.userPhone && caseItem.userPhone !== 'No disponible' && (
                            <div className="flex items-center gap-1 group">
                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                <span>📞</span> {caseItem.userPhone}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const textArea = document.createElement('textarea');
                                  textArea.value = caseItem.userPhone;
                                  textArea.style.position = 'fixed';
                                  textArea.style.left = '-9999px';
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                  toast.success('Teléfono copiado');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                                title="Copiar teléfono"
                              >
                                <Copy className="h-3.5 w-3.5 text-gray-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <Badge className={`${STATUS_COLORS[caseItem.status] || 'bg-gray-100'} px-3 py-1`}>
                          {STATUS_LABELS[caseItem.status] || caseItem.status}
                        </Badge>
                        <Badge className="bg-gray-200 text-gray-900 px-3 py-1">
                          {caseItem.visaType}
                        </Badge>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fecha de Creación</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {caseItem.createdAt ? new Date(caseItem.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date(caseItem.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Coordinadora</p>
                          <p className="text-sm text-gray-900 font-medium">{caseItem.coordinatorName || 'No asignada'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Vendedor/a</p>
                          <p className="text-sm text-gray-900 font-medium">{caseItem.advisorName || 'No asignado/a'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Última Etapa Pagada</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {caseItem.lastPaidStage || 0} de {caseItem.totalStages || 11}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600">Progreso General</span>
                          <span className="font-bold text-yellow-600">{caseItem.overallProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(caseItem.overallProgress)}`}
                            style={{ width: `${caseItem.overallProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-6 flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/visa-cases/${caseItem._id || caseItem.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalle
                      </Button>
                      {(userRole === 'admin' || userRole === 'super_admin') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCaseToDelete({
                              id: caseItem._id || caseItem.id,
                              name: caseItem.userName || 'Cliente Sin Nombre'
                            });
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-full sm:w-auto"
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600 order-first sm:order-none">
                Página {page} de {pagination.pages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="w-full sm:w-auto"
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>
      ) : (
        /* KANBAN VIEW */
        <div className="relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                <span className="text-sm text-gray-700">Cargando casos...</span>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Vista Pipeline <span className="text-yellow-600">({cases.length} casos)</span>
            </h2>
            <p className="text-sm text-gray-500">Los clientes se muestran en la última etapa que tienen pagada (sin pagos = Etapa 1)</p>
          </div>
          
          {/* Pipeline Board - Horizontal Scroll */}
          <div className="overflow-x-auto pb-4 pipeline-scroll">
            <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
              {/* Stages 1-11 (los sin pagos ya están en etapa 1) */}
              {stageNames.map((stage, index) => (
                <div key={stage.number} className={`flex-shrink-0 w-72 ${stageColors[stage.number]} border-2 rounded-xl`}>
                  <div className="p-3 border-b bg-white/50 rounded-t-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-500">ETAPA {stage.number}</span>
                      <Badge className="bg-yellow-500 text-black text-xs">
                        {casesByStage[stage.number]?.length || 0}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight">{stage.name}</h3>
                  </div>
                  <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                    {casesByStage[stage.number]?.map((caseItem) => (
                      <div
                        key={caseItem._id || caseItem.id}
                        onClick={() => navigate(`/admin/visa-cases/${caseItem._id || caseItem.id}`)}
                        className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 hover:border-yellow-400"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {caseItem.userName?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{caseItem.userName || 'Sin nombre'}</p>
                            <p className="text-xs text-gray-500 truncate">{caseItem.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{caseItem.coordinatorName || 'Sin coord.'}</span>
                          <span className="font-medium text-yellow-600">{caseItem.overallProgress || 0}%</span>
                        </div>
                      </div>
                    ))}
                    {casesByStage[stage.number]?.length === 0 && (
                      <p className="text-center text-gray-400 text-xs py-4">Sin casos</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription className="text-left pt-4">
              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-semibold mb-2">
                    ⚠️ Esta acción es irreversible
                  </p>
                  <p className="text-sm text-red-700">
                    Estás a punto de eliminar el caso de:{' '}
                    <strong className="text-red-900">{caseToDelete?.name}</strong>
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    Se eliminarán permanentemente:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
                    <li>Todas las etapas del caso</li>
                    <li>Todos los entregables</li>
                    <li>Todos los documentos del cliente</li>
                    <li>Todos los pagos registrados</li>
                    <li>Todas las citas programadas</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-600 font-medium">
                  ¿Estás seguro de que deseas continuar?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setCaseToDelete(null);
              }}
              disabled={deleting}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCase}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Caso
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisaCasesList;
