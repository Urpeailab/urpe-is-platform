import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, Clock, User, DollarSign, Phone, Mail, Video, CheckCircle, XCircle, Loader2, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const AppointmentsManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to get stage name (handles both string and object {es, en})
  const getStageName = (name) => {
    if (!name) return 'Etapa';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') return name.es || name.en || 'Etapa';
    return 'Etapa';
  };
  
  // Modal states
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Form states
  const [confirmedDate, setConfirmedDate] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [appointments, statusFilter, searchQuery]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        navigate('/admin/auth');
        return;
      }

      const { data } = await axios.get(`${BACKEND_URL}/api/admin/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      if (error.response?.status === 401) {
        navigate('/admin/auth');
      } else {
        toast.error('Error al cargar las citas');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...appointments];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.userName?.toLowerCase().includes(query) ||
        apt.stageName?.toLowerCase().includes(query) ||
        apt.caseId?.toLowerCase().includes(query)
      );
    }

    setFilteredAppointments(filtered);
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleOpenConfirmModal = (appointment) => {
    setSelectedAppointment(appointment);
    
    // Pre-fill form with existing data
    if (appointment.confirmedDate) {
      const date = new Date(appointment.confirmedDate);
      setConfirmedDate(format(date, 'yyyy-MM-dd'));
      setConfirmedTime(format(date, 'HH:mm'));
    } else if (appointment.proposedDate) {
      const date = new Date(appointment.proposedDate);
      setConfirmedDate(format(date, 'yyyy-MM-dd'));
      setConfirmedTime(format(date, 'HH:mm'));
    } else {
      setConfirmedDate('');
      setConfirmedTime('');
    }
    
    setMeetingLink(appointment.meetingLink || '');
    setAdminNotes(appointment.adminNotes || '');
    setShowConfirmModal(true);
  };

  const handleUpdateAppointment = async (newStatus = null) => {
    try {
      setUpdating(true);
      const token = localStorage.getItem('admin_token');

      // Combine date and time if provided
      let confirmedDateTime = null;
      if (confirmedDate && confirmedTime) {
        confirmedDateTime = new Date(`${confirmedDate}T${confirmedTime}:00`).toISOString();
      }

      const payload = {
        status: newStatus || (confirmedDateTime ? 'confirmed' : selectedAppointment.status),
        confirmedDate: confirmedDateTime,
        meetingLink: meetingLink.trim() || null,
        adminNotes: adminNotes.trim() || null
      };

      const { data } = await axios.patch(
        `${BACKEND_URL}/api/admin/appointments/${selectedAppointment.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success('Cita actualizada exitosamente');
        setShowConfirmModal(false);
        setShowDetailsModal(false);
        fetchAppointments();
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Error al actualizar la cita');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      confirmed: { label: 'Confirmada', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      completed: { label: 'Completada', className: 'bg-green-100 text-green-800 border-green-300' },
      cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-800 border-red-300' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={`${config.className} border`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusCount = (status) => {
    return appointments.filter(apt => apt.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Citas</h1>
        <p className="text-gray-600">Administra las solicitudes de citas de los clientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{getStatusCount('pending')}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Confirmadas</p>
                <p className="text-2xl font-bold text-blue-600">{getStatusCount('confirmed')}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-success">{getStatusCount('completed')}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="confirmed">Confirmadas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Buscar</Label>
              <Input
                placeholder="Buscar por nombre, etapa, caso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Citas ({filteredAppointments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No hay citas para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Propuesta</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {appointment.userId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{getStageName(appointment.stageName)}</div>
                        <div className="text-xs text-gray-500">Etapa {appointment.stageNumber}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(appointment.proposedDate), "d 'de' MMM yyyy", { locale: es })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(appointment.proposedDate), 'HH:mm', { locale: es })}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(appointment.status)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          {appointment.stageAmount?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(appointment)}
                          className="mr-2"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {appointment.status === 'pending' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenConfirmModal(appointment)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirmar
                          </Button>
                        )}
                        {appointment.status === 'confirmed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenConfirmModal(appointment)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Cita</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Cliente</Label>
                  <p className="font-medium">{selectedAppointment.userId}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedAppointment.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Etapa</Label>
                  <p className="font-medium">{getStageName(selectedAppointment.stageName)}</p>
                  <p className="text-sm text-gray-500">Etapa {selectedAppointment.stageNumber}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Monto</Label>
                  <p className="font-medium text-success">${selectedAppointment.stageAmount?.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Fecha Propuesta por Cliente</Label>
                <p className="font-medium">
                  {format(new Date(selectedAppointment.proposedDate), "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>

              {selectedAppointment.confirmedDate && (
                <div>
                  <Label className="text-gray-600">Fecha Confirmada</Label>
                  <p className="font-medium text-blue-600">
                    {format(new Date(selectedAppointment.confirmedDate), "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              )}

              {selectedAppointment.meetingLink && (
                <div>
                  <Label className="text-gray-600">Link de Reunión</Label>
                  <a
                    href={selectedAppointment.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:underline"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    {selectedAppointment.meetingLink}
                  </a>
                </div>
              )}

              {selectedAppointment.clientNotes && (
                <div>
                  <Label className="text-gray-600">Notas del Cliente</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{selectedAppointment.clientNotes}</p>
                </div>
              )}

              {selectedAppointment.adminNotes && (
                <div>
                  <Label className="text-gray-600">Notas del Admin</Label>
                  <p className="text-sm bg-blue-50 p-3 rounded-md">{selectedAppointment.adminNotes}</p>
                </div>
              )}

              <div className="text-xs text-gray-500 pt-4 border-t">
                <p>Creada: {format(new Date(selectedAppointment.createdAt), "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}</p>
                {selectedAppointment.updatedAt !== selectedAppointment.createdAt && (
                  <p>Actualizada: {format(new Date(selectedAppointment.updatedAt), "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Cerrar
            </Button>
            {selectedAppointment?.status === 'pending' && (
              <Button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleOpenConfirmModal(selectedAppointment);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirmar Cita
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm/Edit Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAppointment?.status === 'pending' ? 'Confirmar Cita' : 'Editar Cita'}
            </DialogTitle>
            <DialogDescription>
              {getStageName(selectedAppointment?.stageName)} - Etapa {selectedAppointment?.stageNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="confirmedDate">Fecha *</Label>
                <Input
                  id="confirmedDate"
                  type="date"
                  value={confirmedDate}
                  onChange={(e) => setConfirmedDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmedTime">Hora *</Label>
                <Input
                  id="confirmedTime"
                  type="time"
                  value={confirmedTime}
                  onChange={(e) => setConfirmedTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="meetingLink">Link de Videollamada</Label>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-gray-400" />
                <Input
                  id="meetingLink"
                  type="url"
                  placeholder="https://zoom.us/j/... o https://meet.google.com/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Zoom, Google Meet, Microsoft Teams, etc.</p>
            </div>

            <div>
              <Label htmlFor="adminNotes">Notas Administrativas</Label>
              <Textarea
                id="adminNotes"
                placeholder="Notas internas sobre esta cita..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>

            {selectedAppointment?.clientNotes && (
              <div className="bg-gray-50 p-3 rounded-md">
                <Label className="text-gray-600">Notas del Cliente:</Label>
                <p className="text-sm mt-1">{selectedAppointment.clientNotes}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {selectedAppointment?.status !== 'cancelled' && (
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateAppointment('cancelled')}
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar Cita
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={updating}
              >
                Cerrar
              </Button>
              <Button
                onClick={() => handleUpdateAppointment()}
                disabled={!confirmedDate || !confirmedTime || updating}
                className="bg-success hover:bg-green-700"
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar y Guardar
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsManagement;
