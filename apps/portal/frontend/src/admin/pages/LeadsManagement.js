import React, { useState, useEffect } from 'react';
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
  CalendarDays
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

export const LeadsManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    converted: 0,
    rejected: 0
  });

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`${API_URL}/api/leads?limit=100${statusParam}`);
      
      if (!response.ok) throw new Error('Error fetching leads');
      
      const data = await response.json();
      setLeads(data.leads || []);
      
      // Calculate stats from ALL leads (not filtered)
      const allLeads = data.leads || [];
      setStats({
        total: allLeads.length,
        new: allLeads.filter(l => l.status === 'new').length,
        contacted: allLeads.filter(l => l.status === 'contacted').length,
        converted: allLeads.filter(l => l.status === 'converted').length,
        rejected: allLeads.filter(l => l.status === 'rejected').length
      });
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

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

  const exportToCSV = () => {
    if (filteredLeads.length === 0) {
      toast.error('No hay leads para exportar');
      return;
    }

    const headers = ['Nombre', 'Email', 'Código País', 'Teléfono', 'Estado', 'Fecha'];
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => [
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
    
    toast.success(`${filteredLeads.length} leads exportados`);
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

  const filteredLeads = leads.filter(lead => {
    // Search filter
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone_number.includes(searchTerm);
    
    // Date filter
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const leadDate = new Date(lead.created_at);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (leadDate < fromDate) matchesDate = false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (leadDate > toDate) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesDate;
  });

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
            Mostrando {filteredLeads.length} de {leads.length} leads
          </p>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center p-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay leads para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contacto</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors" data-testid={`lead-row-${lead.id}`}>
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
