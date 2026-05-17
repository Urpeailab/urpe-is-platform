import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  ArrowLeft, User, Mail, Phone, Briefcase, Calendar,
  DollarSign, Loader2, Link as LinkIcon, Trash2, FileText,
  AlertCircle, Copy, CheckCircle, Pencil, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_LABELS = {
  'eligibility_approved': 'Elegibilidad Aprobada',
  'active': 'Activo',
  'on_hold': 'En Espera',
  'completed': 'Completado',
  'cancelled': 'Cancelado'
};

const CLASSIC_STATUS = {
  en_proceso:      { label: 'En Proceso',      bg: '#FEF3C7', text: '#92400E' },
  radicado:        { label: 'Enviado',         bg: '#EDE9FE', text: '#5B21B6' },
  recibido_uscis:  { label: 'Recibido USCIS',  bg: '#E0E7FF', text: '#3730A3' },
  rfe_recibido:    { label: 'RFE Recibido',    bg: '#FED7AA', text: '#9A3412' },
  rfe_respondido:  { label: 'RFE Respondido',  bg: '#FDE68A', text: '#78350F' },
  devuelto:        { label: 'Devuelto',        bg: '#FEE2E2', text: '#991B1B' },
  aprobado:        { label: 'Aprobado',        bg: '#D1FAE5', text: '#065F46' },
};

export const UserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [userCases, setUserCases] = useState([]);
  const [userClassicCases, setUserClassicCases] = useState([]);
  const [userPayments, setUserPayments] = useState([]);
  const [userLinks, setUserLinks] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      // Fetch user data
      const userResponse = await axios.get(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(userResponse.data);
      
      // Fetch user cases
      const casesResponse = await axios.get(`${API}/admin/visa-cases?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCases(casesResponse.data.cases || []);

      // Fetch classic (gestión antigua) cases for this client
      try {
        const classicResponse = await axios.get(`${API}/classic-cases/admin?userId=${userId}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserClassicCases(classicResponse.data.cases || []);
      } catch (err) {
        console.warn('No se pudieron cargar casos clásicos:', err?.response?.data?.detail || err.message);
        setUserClassicCases([]);
      }

      // Fetch user payments
      const paymentsResponse = await axios.get(`${API}/admin/payments?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserPayments(paymentsResponse.data.payments || paymentsResponse.data || []);
      
      // Fetch magic links (use UUID, not phone)
      const linksResponse = await axios.get(`${API}/admin/users/${userId}/magic-links`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserLinks(linksResponse.data.magicLinks || linksResponse.data.links || []);
      
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Error al cargar los detalles del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.delete(`${API}/admin/visa-cases/${caseToDelete.id || caseToDelete.caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Caso eliminado exitosamente');
      setDeleteModalOpen(false);
      setCaseToDelete(null);
      
      // Refresh cases
      fetchUserDetails();
      
    } catch (error) {
      console.error('Error deleting case:', error);
      const errorMsg = error.response?.data?.detail || 'Error al eliminar el caso';
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const buildMagicLinkUrl = (link) => {
    if (link?.magicLinkUrl) return link.magicLinkUrl;
    const token = link?.magicToken || '';
    return `${window.location.origin}/welcome/${token}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Usuario no encontrado</h2>
          <Button onClick={() => navigate('/admin/users')} className="mt-4">
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/users')}
            style={{ color: '#000000', borderColor: '#374151', fontWeight: 600 }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" style={{ color: '#000000' }} />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#000000' }}>
              {userData.name}
            </h1>
            <p style={{ color: '#1f2937', fontWeight: 600 }} className="mt-1">Detalles del usuario</p>
          </div>
        </div>
        <Button 
          onClick={() => navigate(`/admin/users/${userId}/edit`)}
          style={{ backgroundColor: '#eab308', color: '#000000', fontWeight: 600 }}
          className="hover:bg-yellow-400"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Editar Usuario
        </Button>
      </div>

      {/* User Information Card */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
            <User className="h-5 w-5" style={{ color: '#eab308' }} />
            Información del Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 mt-0.5" style={{ color: '#1f2937' }} />
              <div>
                <p className="text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>Email</p>
                <p style={{ color: '#000000', fontWeight: 700 }}>{userData.email || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 mt-0.5" style={{ color: '#1f2937' }} />
              <div>
                <p className="text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>Teléfono</p>
                <p style={{ color: '#000000', fontWeight: 700 }}>{userData.phone || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 mt-0.5" style={{ color: '#1f2937' }} />
              <div>
                <p className="text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>Profesión</p>
                <p style={{ color: '#000000', fontWeight: 700 }}>{userData.profession || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 mt-0.5" style={{ color: '#1f2937' }} />
              <div>
                <p className="text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>Estado</p>
                <Badge style={{ backgroundColor: userData.userState === 'U3' ? '#16a34a' : '#475569', color: '#ffffff', fontWeight: 600 }}>
                  {userData.userState || 'U1'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Card */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between" style={{ color: '#000000' }}>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: '#3b82f6' }} />
              Casos de Visa ({userCases.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userCases.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#1f2937', fontWeight: 600 }}>
              No hay casos registrados para este usuario
            </div>
          ) : (
            <div className="space-y-3">
              {userCases.map((caso) => {
                const totalStages = caso.totalStages || 11;
                const currentStage = caso.currentStage || 1;
                const lastPaid = caso.lastPaidStage || 0;
                const progress = totalStages > 0 ? (lastPaid / totalStages) * 100 : 0;
                return (
                  <div
                    key={caso.id || caso.caseId}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge style={{ backgroundColor: '#eab308', color: '#000000', fontWeight: 600 }}>
                            {caso.visaType || 'EB-2 NIW'}
                          </Badge>
                          <Badge style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
                            {STATUS_LABELS[caso.status] || caso.status}
                          </Badge>
                          {caso.priority && (
                            <Badge style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                              {caso.priority}
                            </Badge>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#374151', fontWeight: 600 }}>
                            <span>Progreso · Etapa {currentStage}/{totalStages}</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: '#eab308' }} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>
                          {caso.coordinatorName && (
                            <span><span style={{ color: '#6B7280' }}>Coord.:</span> {caso.coordinatorName}</span>
                          )}
                          {(caso.salesRepName || caso.advisorName) && (
                            <span><span style={{ color: '#6B7280' }}>Vendedor:</span> {caso.salesRepName || caso.advisorName}</span>
                          )}
                          {lastPaid > 0 && (
                            <span><span style={{ color: '#6B7280' }}>Pagada:</span> Etapa {lastPaid}</span>
                          )}
                          {caso.createdAt && (
                            <span><span style={{ color: '#6B7280' }}>Creado:</span> {format(new Date(caso.createdAt), 'dd/MM/yyyy')}</span>
                          )}
                          {caso.updatedAt && (
                            <span><span style={{ color: '#6B7280' }}>Actualizado:</span> {format(new Date(caso.updatedAt), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/visa-cases/${caso.id || caso.caseId}`)}
                          style={{ color: '#000000', borderColor: '#4b5563', fontWeight: 600 }}
                        >
                          Ver Detalle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCaseToDelete(caso);
                            setDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classic Cases Card (Gestión Antigua) */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
            <ClipboardList className="h-5 w-5" style={{ color: '#C9A96A' }} />
            Gestión Clásica ({userClassicCases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userClassicCases.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#1f2937', fontWeight: 600 }}>
              No hay casos de gestión clásica para este usuario
            </div>
          ) : (
            <div className="space-y-3">
              {userClassicCases.map((c) => {
                const st = CLASSIC_STATUS[c.status] || { label: c.status || 'Sin estado', bg: '#E5E7EB', text: '#374151' };
                const progress = c.progress || 0;
                const pCoord = c.progressCoordinator || 0;
                const pArm = c.progressArmador || 0;
                return (
                  <div
                    key={c.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge style={{ backgroundColor: st.bg, color: st.text, fontWeight: 600 }}>
                            {st.label}
                          </Badge>
                          {c.processingType && (
                            <Badge style={{ backgroundColor: c.processingType === 'premium' ? '#FEE2E2' : '#DBEAFE', color: c.processingType === 'premium' ? '#991B1B' : '#1E40AF', fontWeight: 600 }}>
                              {c.processingType === 'premium' ? 'Premium' : 'Normal'}
                            </Badge>
                          )}
                          {c.workStatus && c.workStatus !== 'working' && (
                            <Badge style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                              {c.workStatus === 'paused' ? 'Pausado' : c.workStatus === 'waiting_uscis' ? 'Esperando USCIS' : c.workStatus === 'desisted' ? 'Desistió' : c.workStatus}
                            </Badge>
                          )}
                          {c.ioeNumber && (
                            <Badge style={{ backgroundColor: '#F3F4F6', color: '#374151', fontWeight: 600 }}>
                              IOE: {c.ioeNumber}
                            </Badge>
                          )}
                        </div>

                        {/* Progress bars: total + coord + armador */}
                        <div className="mb-2 space-y-1.5">
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#374151', fontWeight: 600 }}>
                              <span>Progreso Total</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: '#10B981' }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#6B7280', fontWeight: 600 }}>
                                <span>Coordinador</span>
                                <span>{Math.round(pCoord)}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pCoord))}%`, background: '#6366F1' }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#6B7280', fontWeight: 600 }}>
                                <span>Armador</span>
                                <span>{Math.round(pArm)}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pArm))}%`, background: '#C9A96A' }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: '#1f2937', fontWeight: 600 }}>
                          {c.coordinatorName && (
                            <span><span style={{ color: '#6B7280' }}>Coord.:</span> {c.coordinatorName}</span>
                          )}
                          {c.seniorityDate && (
                            <span><span style={{ color: '#6B7280' }}>Antigüedad:</span> {c.seniorityDate}</span>
                          )}
                          {c.trackingNumber && (
                            <span><span style={{ color: '#6B7280' }}>Tracking:</span> {c.trackingNumber}{c.shippingCompany ? ` (${c.shippingCompany})` : ''}</span>
                          )}
                          {c.filingDate && (
                            <span><span style={{ color: '#6B7280' }}>Radicado:</span> {c.filingDate}</span>
                          )}
                          {c.rfeDeadline && (
                            <span><span style={{ color: '#6B7280' }}>RFE deadline:</span> {c.rfeDeadline}</span>
                          )}
                          {c.lastContactAt && (
                            <span><span style={{ color: '#6B7280' }}>Último contacto:</span> {format(new Date(c.lastContactAt), 'dd/MM/yyyy')}</span>
                          )}
                          {c.createdAt && (
                            <span><span style={{ color: '#6B7280' }}>Creado:</span> {format(new Date(c.createdAt), 'dd/MM/yyyy')}</span>
                          )}
                          {c.updatedAt && (
                            <span><span style={{ color: '#6B7280' }}>Actualizado:</span> {format(new Date(c.updatedAt), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/classic-cases/${c.id}`)}
                        style={{ color: '#000000', borderColor: '#4b5563', fontWeight: 600 }}
                        className="flex-shrink-0"
                      >
                        Ver Detalle
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Card */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
            <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
            Pagos Realizados ({userPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userPayments.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#1f2937', fontWeight: 600 }}>
              No hay pagos registrados para este usuario
            </div>
          ) : (
            <div className="space-y-3">
              {userPayments.map((payment, index) => (
                <div 
                  key={payment.paymentId || index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p style={{ color: '#000000', fontWeight: 700 }}>${payment.amount || 0}</p>
                    <div className="flex items-center gap-3 text-sm mt-1" style={{ color: '#1f2937', fontWeight: 600 }}>
                      <span>Método: {payment.paymentMethod || 'No especificado'}</span>
                      {payment.paymentDate && (
                        <span>Fecha: {format(new Date(payment.paymentDate), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <Badge style={{ 
                    backgroundColor: payment.status === 'completed' ? '#dcfce7' : '#fef3c7',
                    color: payment.status === 'completed' ? '#166534' : '#92400e',
                    fontWeight: 600
                  }}>
                    {payment.status === 'completed' ? 'Completado' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Magic Links Card */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
            <LinkIcon className="h-5 w-5" style={{ color: '#a855f7' }} />
            Magic Links ({userLinks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userLinks.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#1f2937', fontWeight: 600 }}>
              No hay magic links generados para este usuario
            </div>
          ) : (
            <div className="space-y-3">
              {userLinks.map((link, index) => (
                <div 
                  key={link.magicToken || index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge style={{
                        backgroundColor: link.used ? '#cbd5e1' : '#bbf7d0',
                        color: link.used ? '#1e293b' : '#14532d',
                        fontWeight: 600
                      }}>
                        {link.used ? 'Usado' : 'Activo'}
                      </Badge>
                      {link.expiresAt && new Date(link.expiresAt) < new Date() && (
                        <Badge style={{ backgroundColor: '#fecaca', color: '#991b1b', fontWeight: 600 }}>
                          Expirado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm truncate" style={{ color: '#1f2937', fontWeight: 600 }} title={buildMagicLinkUrl(link)}>
                      {buildMagicLinkUrl(link)}
                    </p>
                    {link.createdAt && (
                      <p className="text-xs mt-1" style={{ color: '#374151', fontWeight: 600 }}>
                        Creado: {format(new Date(link.createdAt), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(buildMagicLinkUrl(link))}
                    style={{ color: '#000000', borderColor: '#4b5563', fontWeight: 600 }}
                    className="flex-shrink-0"
                    title="Copiar link completo"
                  >
                    <Copy className="h-4 w-4" style={{ color: '#000000' }} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Case Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este caso de visa?
            </DialogDescription>
          </DialogHeader>
          
          {caseToDelete && (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Caso:</strong> {caseToDelete.visaType || 'EB-2 NIW'}
                </p>
                <p className="text-sm text-red-800 mt-2">
                  Esta acción eliminará permanentemente el caso y todos sus datos asociados (stages, deliverables, documentos, pagos).
                </p>
                <p className="text-sm text-red-800 mt-2 font-semibold">
                  Esta acción NO se puede deshacer.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setCaseToDelete(null);
              }}
              disabled={isDeleting}
              className="border-gray-300 text-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteCase}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
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

export default UserDetail;
