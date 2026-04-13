import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  History, 
  Loader2, 
  User, 
  FileText, 
  Upload, 
  Trash2, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Edit,
  Link as LinkIcon,
  MoveRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Action type to icon mapping
const ACTION_ICONS = {
  case_created: User,
  case_updated: Edit,
  case_status_changed: Edit,
  coordinator_assigned: User,
  seller_assigned: User,
  stage_unlocked: CheckCircle,
  stage_completed: CheckCircle,
  stage_amount_updated: DollarSign,
  document_uploaded: Upload,
  document_validated: CheckCircle,
  document_rejected: XCircle,
  document_deleted: Trash2,
  deliverable_added: FileText,
  deliverable_updated: Edit,
  deliverable_deleted: Trash2,
  deliverable_file_uploaded: Upload,
  deliverable_moved: MoveRight,
  payment_registered: DollarSign,
  payment_deleted: Trash2,
  form_submitted: FileText,
  form_saved: FileText,
  form_completed: CheckCircle,
  magic_link_generated: LinkIcon,
  eligibility_report_generated: FileText,
};

// Action type to color mapping
const ACTION_COLORS = {
  case_created: 'bg-blue-100 text-blue-800',
  case_updated: 'bg-yellow-100 text-yellow-800',
  case_status_changed: 'bg-purple-100 text-purple-800',
  coordinator_assigned: 'bg-indigo-100 text-indigo-800',
  seller_assigned: 'bg-indigo-100 text-indigo-800',
  stage_unlocked: 'bg-green-100 text-green-800',
  stage_completed: 'bg-green-100 text-green-800',
  stage_amount_updated: 'bg-yellow-100 text-yellow-800',
  document_uploaded: 'bg-blue-100 text-blue-800',
  document_validated: 'bg-green-100 text-green-800',
  document_rejected: 'bg-red-100 text-red-800',
  document_deleted: 'bg-red-100 text-red-800',
  deliverable_added: 'bg-blue-100 text-blue-800',
  deliverable_updated: 'bg-yellow-100 text-yellow-800',
  deliverable_deleted: 'bg-red-100 text-red-800',
  deliverable_file_uploaded: 'bg-blue-100 text-blue-800',
  deliverable_moved: 'bg-purple-100 text-purple-800',
  payment_registered: 'bg-green-100 text-green-800',
  payment_deleted: 'bg-red-100 text-red-800',
  form_submitted: 'bg-blue-100 text-blue-800',
  form_saved: 'bg-yellow-100 text-yellow-800',
  form_completed: 'bg-green-100 text-green-800',
  magic_link_generated: 'bg-purple-100 text-purple-800',
  eligibility_report_generated: 'bg-blue-100 text-blue-800',
};

// Role labels
const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  coordinator: 'Coordinador',
  advisor: 'Asesor',
  client: 'Cliente',
};

// Role colors
const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-red-100 text-red-800 border-red-200',
  coordinator: 'bg-blue-100 text-blue-800 border-blue-200',
  advisor: 'bg-teal-100 text-teal-800 border-teal-200',
  client: 'bg-amber-100 text-amber-800 border-amber-200',
};

// Human-readable detail labels
const DETAIL_LABELS = {
  deliverableId: null, // hide
  documentId: null,
  paymentId: null,
  totalFiles: 'Archivos totales',
  fileName: 'Archivo',
  stageNumber: 'Etapa',
  stageNumbers: 'Etapas',
  amount: 'Monto',
  paymentMethod: 'Metodo de pago',
  reference: 'Referencia',
  documentType: 'Tipo de documento',
  rejectionReason: 'Motivo de rechazo',
  documentName: 'Documento',
  deliverableName: 'Entregable',
  stageName: 'Etapa',
  clientName: 'Cliente',
  coordinatorName: 'Coordinador',
  oldStatus: 'Estado anterior',
  newStatus: 'Nuevo estado',
};

// Action type labels
const ACTION_TYPE_LABELS = {
  case_created: 'Caso creado',
  case_updated: 'Caso actualizado',
  case_status_changed: 'Estado cambiado',
  coordinator_assigned: 'Coordinador asignado',
  seller_assigned: 'Vendedor asignado',
  stage_unlocked: 'Etapa desbloqueada',
  stage_completed: 'Etapa completada',
  stage_amount_updated: 'Monto actualizado',
  document_uploaded: 'Documento subido',
  document_validated: 'Documento validado',
  document_rejected: 'Documento rechazado',
  document_deleted: 'Documento eliminado',
  deliverable_added: 'Entregable agregado',
  deliverable_updated: 'Entregable actualizado',
  deliverable_deleted: 'Entregable eliminado',
  deliverable_file_uploaded: 'Archivo subido',
  deliverable_moved: 'Entregable movido',
  payment_registered: 'Pago registrado',
  payment_deleted: 'Pago eliminado',
  form_submitted: 'Formulario enviado',
  form_saved: 'Formulario guardado',
  form_completed: 'Formulario completado',
  magic_link_generated: 'Link generado',
  eligibility_report_generated: 'Reporte generado',
};

export const CaseAuditLog = ({ caseId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filterType, setFilterType] = useState('all');

  const fetchLogs = useCallback(async () => {
    if (!caseId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        setError('No autorizado');
        return;
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (filterType && filterType !== 'all') {
        params.append('action_type', filterType);
      }

      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/audit/case/${caseId}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1,
      }));
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [caseId, pagination.page, pagination.limit, filterType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      return format(date, "d MMM yyyy, HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const renderDetails = (log) => {
    const { details, oldValues, newValues } = log;
    const items = [];

    // Show old -> new values
    if (oldValues && newValues) {
      Object.keys(newValues).forEach(key => {
        if (oldValues[key] !== newValues[key]) {
          const label = DETAIL_LABELS[key] !== undefined ? DETAIL_LABELS[key] : key;
          if (label === null) return; // hidden field
          items.push(
            <div key={key} className="text-xs text-gray-500">
              <span className="font-medium">{label}:</span>{' '}
              <span className="line-through text-red-500">{String(oldValues[key] || 'vacio')}</span>
              {' → '}
              <span className="text-green-600">{String(newValues[key] || 'vacio')}</span>
            </div>
          );
        }
      });
    }

    // Show additional details with human-readable labels
    if (details && Object.keys(details).length > 0) {
      Object.entries(details).forEach(([key, value]) => {
        if (!value || key === 'timestamp') return;
        const label = DETAIL_LABELS[key] !== undefined ? DETAIL_LABELS[key] : key;
        if (label === null) return; // hidden field (IDs)
        const displayValue = key === 'amount' ? `$${Number(value).toLocaleString()}` 
          : Array.isArray(value) ? value.join(', ')
          : String(value);
        items.push(
          <div key={key} className="text-xs text-gray-500">
            <span className="font-medium">{label}:</span> {displayValue}
          </div>
        );
      });
    }

    return items.length > 0 ? (
      <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
        {items}
      </div>
    ) : null;
  };

  const ActionIcon = ({ actionType }) => {
    const Icon = ACTION_ICONS[actionType] || History;
    return <Icon className="h-4 w-4" />;
  };

  if (loading && logs.length === 0) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Auditoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Cargando historial...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Auditoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Auditoría
            <Badge variant="outline" className="ml-2">
              {pagination.total} registros
            </Badge>
          </CardTitle>
          
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={filterType} onValueChange={(value) => {
              setFilterType(value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="document_uploaded">Documentos subidos</SelectItem>
                <SelectItem value="document_validated">Documentos validados</SelectItem>
                <SelectItem value="deliverable_added">Entregables agregados</SelectItem>
                <SelectItem value="deliverable_file_uploaded">Archivos subidos</SelectItem>
                <SelectItem value="payment_registered">Pagos registrados</SelectItem>
                <SelectItem value="stage_completed">Etapas completadas</SelectItem>
                <SelectItem value="case_updated">Actualizaciones de caso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay registros de auditoría para este caso</p>
            <p className="text-sm text-gray-400 mt-1">
              Los cambios realizados a partir de ahora serán registrados
            </p>
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="space-y-4">
              {logs.map((log, index) => {
                const Icon = ACTION_ICONS[log.actionType] || History;
                const colorClass = ACTION_COLORS[log.actionType] || 'bg-gray-100 text-gray-800';
                
                return (
                  <div key={log.id || index} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {index < logs.length - 1 && (
                        <div className="w-px h-full bg-gray-200 my-1" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {log.action || ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs ${ROLE_COLORS[log.performedBy?.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {ROLE_LABELS[log.performedBy?.role] || log.performedBy?.role || 'Sistema'}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {log.performedBy?.name || 'Usuario desconocido'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(log.timestamp)}
                        </div>
                      </div>
                      
                      {/* Details */}
                      {renderDetails(log)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-gray-500">
                  Página {pagination.page} de {pagination.pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages || loading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseAuditLog;
