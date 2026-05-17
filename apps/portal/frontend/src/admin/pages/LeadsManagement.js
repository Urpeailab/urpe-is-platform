import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Phone,
  Mail,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  UserCheck,
  MessageCircle,
  Download,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ITEMS_PER_PAGE = 20;

export const LeadsManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    converted: 0,
    rejected: 0
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const response = await fetch(`${API_URL}/api/leads?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching leads');

      const data = await response.json();
      setLeads(data.leads || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los leads');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearchTerm, dateFrom, dateTo]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to first page and clear selection when any filter changes
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, debouncedSearchTerm, dateFrom, dateTo]);

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/leads/${leadId}/status?status=${newStatus}`, {
        method: 'PATCH'
      });

      if (!response.ok) throw new Error('Error updating status');

      toast.success('Estado actualizado');
      fetchLeads();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelectedIds(prev => {
      const pageIds = leads.map(l => l.id);
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map(id =>
          fetch(`${API_URL}/api/leads/${id}/status?status=${bulkStatus}`, { method: 'PATCH' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      const ok = results.length - failed;
      if (ok > 0) toast.success(`${ok} lead(s) actualizados`);
      if (failed > 0) toast.error(`${failed} fallaron al actualizar`);
      clearSelection();
      setBulkStatus('');
      fetchLeads();
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Error al actualizar en masa');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;
    
    try {
      const response = await fetch(`${API_URL}/api/leads/${leadToDelete}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Error deleting lead');
      
      toast.success('Lead eliminado');
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
      fetchLeads();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar el lead');
    }
  };

  const openWhatsApp = (lead) => {
    const phone = `${lead.country_code}${lead.phone_number}`.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hola ${lead.name}, soy de URPE Integral Services. Recibimos tu solicitud de evaluación de elegibilidad migratoria.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const exportToCSV = async () => {
    // Fetch all matching leads (not just current page) so the CSV reflects
    // every result the current filters select, not only the visible page.
    try {
      const params = new URLSearchParams({ page: '1', limit: '10000' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const response = await fetch(`${API_URL}/api/leads?${params.toString()}`);
      if (!response.ok) throw new Error('export fetch failed');
      const data = await response.json();
      const rows = data.leads || [];
      if (rows.length === 0) {
        toast.error('No hay leads para exportar');
        return;
      }

      const headers = ['Nombre', 'Email', 'Código País', 'Teléfono', 'Estado', 'Fecha'];
      const csvContent = [
        headers.join(','),
        ...rows.map(lead => [
          `"${lead.name}"`,
          lead.email,
          lead.country_code,
          lead.phone_number,
          lead.status,
          formatDate(lead.created_at)
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${rows.length} leads exportados`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar leads');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      new: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock },
      contacted: { label: 'Contactado', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: UserCheck },
      converted: { label: 'Convertido', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle },
      rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle }
    };
    
    const config = statusConfig[status] || statusConfig.new;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6" data-testid="leads-management-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-yellow-500" />
            Leads
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los prospectos del landing page</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            data-testid="export-leads-btn"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button 
            onClick={fetchLeads} 
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white"
            data-testid="refresh-leads-btn"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <p className="text-sm text-blue-600">Nuevos</p>
          <p className="text-2xl font-bold text-blue-700">{stats.new}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-sm text-yellow-600">Contactados</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.contacted}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-sm text-green-600">Convertidos</p>
          <p className="text-2xl font-bold text-green-700">{stats.converted}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-sm text-red-600">Rechazados</p>
          <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </h3>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar nombre, email, teléfono..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 text-gray-900 placeholder:text-gray-500 bg-white border-gray-300"
              data-testid="leads-search-input"
            />
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger 
              data-testid="leads-status-filter"
              className="text-gray-900 bg-white border-gray-300"
            >
              <SelectValue placeholder="Estado" className="text-gray-900" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-gray-900">Todos los estados</SelectItem>
              <SelectItem value="new" className="text-gray-900">Nuevos</SelectItem>
              <SelectItem value="contacted" className="text-gray-900">Contactados</SelectItem>
              <SelectItem value="converted" className="text-gray-900">Convertidos</SelectItem>
              <SelectItem value="rejected" className="text-gray-900">Rechazados</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Date From */}
          <div className="relative">
            <label className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-gray-900 bg-white border-gray-300 pt-2"
              data-testid="leads-date-from"
            />
          </div>
          
          {/* Date To */}
          <div className="relative">
            <label className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-gray-900 bg-white border-gray-300 pt-2"
              data-testid="leads-date-to"
            />
          </div>
        </div>
        
        {/* Active filters indicator */}
        {hasActiveFilters && (
          <p className="text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? 'lead encontrado' : 'leads encontrados'}
          </p>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <span className="text-sm font-semibold text-yellow-900">
            {selectedIds.size} seleccionado(s)
          </span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger
              className="w-[180px] h-9 bg-white border-yellow-300 text-gray-900"
              data-testid="bulk-status-select"
            >
              <SelectValue placeholder="Cambiar estado a..." />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="new" className="text-gray-900">Nuevo</SelectItem>
              <SelectItem value="contacted" className="text-gray-900">Contactado</SelectItem>
              <SelectItem value="converted" className="text-gray-900">Convertido</SelectItem>
              <SelectItem value="rejected" className="text-gray-900">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkStatusChange}
            disabled={!bulkStatus || bulkUpdating}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            data-testid="apply-bulk-status-btn"
          >
            {bulkUpdating ? (
              <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Aplicando...</>
            ) : (
              <>Aplicar a {selectedIds.size}</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearSelection}
            disabled={bulkUpdating}
            className="border-yellow-400 text-yellow-900"
          >
            Deseleccionar
          </Button>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center p-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay leads para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos en esta página"
                      checked={leads.length > 0 && leads.every(l => selectedIds.has(l.id))}
                      onChange={toggleSelectAllPage}
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-yellow-500"
                      data-testid="select-all-leads"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contacto</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-50 transition-colors ${selectedIds.has(lead.id) ? 'bg-yellow-50' : ''}`}
                    data-testid={`lead-row-${lead.id}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-yellow-500"
                        data-testid={`select-lead-${lead.id}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{lead.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.country_code} {lead.phone_number}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(lead.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Select 
                        value={lead.status} 
                        onValueChange={(value) => handleStatusChange(lead.id, value)}
                      >
                        <SelectTrigger className="w-[140px] h-8 border-0 p-0 focus:ring-0">
                          {getStatusBadge(lead.status)}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Nuevo</SelectItem>
                          <SelectItem value="contacted">Contactado</SelectItem>
                          <SelectItem value="converted">Convertido</SelectItem>
                          <SelectItem value="rejected">Rechazado</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openWhatsApp(lead)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`whatsapp-lead-${lead.id}`}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setLeadToDelete(lead.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          data-testid={`delete-lead-${lead.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-white">
            <p className="text-sm text-gray-600">
              Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, totalCount)} de {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border-gray-300"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-gray-700 px-2">
                Página {page} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="border-gray-300"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El lead será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
