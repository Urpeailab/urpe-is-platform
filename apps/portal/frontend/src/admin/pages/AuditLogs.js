import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Search,
  Download,
  Filter,
  TrendingUp,
  UserPlus,
  Edit,
  Trash2,
  Eye,
  Clock
} from 'lucide-react';
import { AdvancedFilters } from '../components/AdvancedFilters';
import { toast } from 'sonner';
import { exportAuditLogs } from '../utils/exportData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);

  const filterOptions = [
    {
      key: 'action',
      label: 'Acción',
      options: [
        { value: 'created', label: 'Creación' },
        { value: 'updated', label: 'Actualización' },
        { value: 'deleted', label: 'Eliminación' },
        { value: 'viewed', label: 'Visualización' },
        { value: 'all', label: 'Todas' }
      ]
    },
    {
      key: 'resource',
      label: 'Recurso',
      options: [
        { value: 'users', label: 'Usuarios' },
        { value: 'staff', label: 'Staff' },
        { value: 'webinars', label: 'Webinars' },
        { value: 'documents', label: 'Documentos' },
        { value: 'all', label: 'Todos' }
      ]
    },
    {
      key: 'timeRange',
      label: 'Período',
      options: [
        { value: '24h', label: 'Últimas 24 horas' },
        { value: '7d', label: 'Últimos 7 días' },
        { value: '30d', label: 'Últimos 30 días' },
        { value: 'all', label: 'Todo el tiempo' }
      ]
    }
  ];

  // Mock data for audit logs
  const mockLogs = [
    {
      id: '1',
      action: 'created',
      resource: 'user',
      resourceId: 'usr_123',
      staffName: 'Admin User',
      staffEmail: 'admin@urpe.com',
      description: 'Creó nuevo usuario: John Smith',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      ipAddress: '192.168.1.1',
      metadata: { userEmail: 'john@example.com' }
    },
    {
      id: '2',
      action: 'updated',
      resource: 'webinar',
      resourceId: 'web_456',
      staffName: 'Maria Garcia',
      staffEmail: 'maria@urpe.com',
      description: 'Actualizó webinar: EB-2 NIW Workshop',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      ipAddress: '192.168.1.2',
      metadata: { field: 'date', oldValue: '2024-01-15', newValue: '2024-01-20' }
    },
    {
      id: '3',
      action: 'deleted',
      resource: 'document',
      resourceId: 'doc_789',
      staffName: 'Admin User',
      staffEmail: 'admin@urpe.com',
      description: 'Eliminó documento: Legal Guide Draft',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      ipAddress: '192.168.1.1',
      metadata: { documentName: 'Legal Guide Draft.pdf' }
    },
    {
      id: '4',
      action: 'viewed',
      resource: 'user',
      resourceId: 'usr_321',
      staffName: 'Carlos Rodriguez',
      staffEmail: 'carlos@urpe.com',
      description: 'Visualizó perfil de usuario: Ana Martinez',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      ipAddress: '192.168.1.3',
      metadata: {}
    }
  ];

  useEffect(() => {
    fetchLogs();
  }, [page, activeFilters]);

  const fetchLogs = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setLogs(mockLogs);
    setLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setSearch('');
    setPage(1);
  };

  const handleExport = () => {
    try {
      exportAuditLogs(logs, 'excel');
      toast.success('Logs de auditoría exportados exitosamente');
    } catch (error) {
      toast.error('Error al exportar logs');
      console.error('Export error:', error);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return <UserPlus className="h-4 w-4" />;
      case 'updated': return <Edit className="h-4 w-4" />;
      case 'deleted': return <Trash2 className="h-4 w-4" />;
      case 'viewed': return <Eye className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created': return 'bg-success/20 text-success border-success/30';
      case 'updated': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'deleted': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'viewed': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Logs de Auditoría
          </h1>
          <p className="text-gray-600 mt-2">Rastrea todas las acciones del sistema</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Acciones Hoy</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <UserPlus className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Modificaciones</p>
                <p className="text-2xl font-bold text-gray-900">42</p>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Edit className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Eliminaciones</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar en logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white border-gray-300 text-gray-900"
                />
              </div>
              <AdvancedFilters
                filters={filterOptions}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>
            
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                {/* Icon */}
                <div className={`p-2 rounded-lg mr-4 ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-900 font-medium">{log.description}</p>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-sm text-gray-600">
                          Por <span className="text-gray-900 font-medium">{log.staffName}</span>
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{log.staffEmail}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{log.ipAddress}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  {Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs border border-gray-200">
                      <code className="text-gray-700">
                        {JSON.stringify(log.metadata, null, 2)}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {logs.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron logs</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
