import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DollarSign, User, Calendar, CreditCard, FileText, Upload, Loader2, Eye, Plus, CheckCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ManualPaymentsManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cases, setCases] = useState([]);

  // Helper function to get stage name (handles both string and object {es, en})
  const getStageName = (name) => {
    if (!name) return 'Etapa';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') return name.es || name.en || 'Etapa';
    return 'Etapa';
  };
  
  // Modal states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [registering, setRegistering] = useState(false);
  
  // Form states for register payment
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [stages, setStages] = useState([]);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchCases();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [payments, searchQuery]);

  useEffect(() => {
    if (selectedCase) {
      fetchStagesForCase(selectedCase);
    }
  }, [selectedCase]);

  // Auto-open modal if navigated from case detail with caseId
  useEffect(() => {
    if (location.state?.caseId && cases.length > 0) {
      setSelectedCase(location.state.caseId);
      setShowRegisterModal(true);
      // Clear the state after using it
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, cases, navigate, location.pathname]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        navigate('/admin/auth');
        return;
      }

      const { data } = await axios.get(`${BACKEND_URL}/api/admin/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      if (error.response?.status === 401) {
        navigate('/admin/auth');
      } else {
        toast.error('Error al cargar los pagos');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/visa-cases`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCases(data.cases || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const fetchStagesForCase = async (caseId) => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/visa-cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Filter stages that are locked and not paid
      const lockedStages = data.stages?.filter(s => s.status === 'locked' && !s.isPaid) || [];
      setStages(lockedStages);
      
      if (lockedStages.length > 0) {
        setSelectedStage(lockedStages[0]);
        setAmount(lockedStages[0].amount?.toString() || '');
      }
    } catch (error) {
      console.error('Error fetching stages:', error);
      toast.error('Error al cargar las etapas');
    }
  };

  const applyFilters = () => {
    let filtered = [...payments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.stageName?.toLowerCase().includes(query) ||
        payment.reference?.toLowerCase().includes(query) ||
        payment.registeredByName?.toLowerCase().includes(query)
      );
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    setFilteredPayments(filtered);
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) return null;

    try {
      setUploadingReceipt(true);
      const token = localStorage.getItem('admin_token');
      
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('documentType', 'receipt');

      const { data } = await axios.post(
        `${BACKEND_URL}/api/storage/upload`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('Error al subir el comprobante');
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRegisterPayment = async () => {
    try {
      setRegistering(true);
      const token = localStorage.getItem('admin_token');

      // Upload receipt if provided
      let receiptUrl = null;
      if (receiptFile) {
        receiptUrl = await handleUploadReceipt();
        if (!receiptUrl) {
          toast.error('Error al subir el comprobante. Intenta nuevamente.');
          return;
        }
      }

      const payload = {
        caseId: selectedCase,
        stageId: selectedStage.id,
        stageNumber: selectedStage.stageNumber,
        amount: parseFloat(amount),
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        reference: reference.trim() || null,
        receiptUrl: receiptUrl,
        notes: notes.trim() || null
      };

      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/payments/register`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success('¡Pago registrado exitosamente!');
        toast.info('La etapa ha sido desbloqueada automáticamente');
        setShowRegisterModal(false);
        resetForm();
        fetchPayments();
      }
    } catch (error) {
      console.error('Error registering payment:', error);
      toast.error(error.response?.data?.detail || 'Error al registrar el pago');
    } finally {
      setRegistering(false);
    }
  };

  const resetForm = () => {
    setSelectedCase('');
    setSelectedStage(null);
    setStages([]);
    setAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentMethod('transfer');
    setReference('');
    setNotes('');
    setReceiptFile(null);
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setShowDetailsModal(true);
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      zelle: 'Zelle',
      wire: 'Wire Transfer',
      check: 'Cheque',
      other: 'Otro'
    };
    return methods[method] || method;
  };

  const getTotalAmount = () => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Pagos</h1>
          <p className="text-gray-600">Registra y administra los pagos manuales de los clientes</p>
        </div>
        <Button
          onClick={() => setShowRegisterModal(true)}
          className="bg-success hover:bg-green-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Registrar Pago
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pagos</p>
                <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monto Total</p>
                <p className="text-2xl font-bold text-success">${getTotalAmount().toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Este Mes</p>
                <p className="text-2xl font-bold text-blue-600">
                  {payments.filter(p => {
                    const paymentMonth = new Date(p.paymentDate).getMonth();
                    const currentMonth = new Date().getMonth();
                    return paymentMonth === currentMonth;
                  }).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div>
            <Label>Buscar</Label>
            <Input
              placeholder="Buscar por etapa, referencia, registrado por..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Registrados ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No hay pagos registrados</p>
              <Button
                onClick={() => setShowRegisterModal(true)}
                className="mt-4 bg-success hover:bg-green-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Registrar Primer Pago
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registrado Por</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(payment.paymentDate), "d 'de' MMM yyyy", { locale: es })}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{getStageName(payment.stageName)}</div>
                        <div className="text-xs text-gray-500">Etapa {payment.stageNumber}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-success">
                          ${payment.amount?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          {getPaymentMethodLabel(payment.paymentMethod)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{payment.reference || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center text-sm text-gray-900">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          {payment.registeredByName}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(payment)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register Payment Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-success" />
              Registrar Pago Manual
            </DialogTitle>
            <DialogDescription>
              Registra el pago de una etapa. La etapa se desbloqueará automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Case Selection */}
            <div>
              <Label htmlFor="case">Caso *</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un caso" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.visaType} - {c.userName || c.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage Selection */}
            {selectedCase && stages.length > 0 && (
              <div>
                <Label htmlFor="stage">Etapa *</Label>
                <Select 
                  value={selectedStage?.id || ''} 
                  onValueChange={(value) => {
                    const stage = stages.find(s => s.id === value);
                    setSelectedStage(stage);
                    setAmount(stage?.amount?.toString() || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        Etapa {stage.stageNumber}: {getStageName(stage.name)} (${stage.amount?.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedCase && stages.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  No hay etapas pendientes de pago para este caso.
                </p>
              </div>
            )}

            {/* Payment Details */}
            {selectedStage && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Monto *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="paymentDate">Fecha de Pago *</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentMethod">Método de Pago *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                        <SelectItem value="wire">Wire Transfer</SelectItem>
                        <SelectItem value="check">Cheque</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reference">Referencia/ID Transacción</Label>
                    <Input
                      id="reference"
                      placeholder="Ej: REF-12345"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="receipt">Comprobante de Pago (Opcional)</Label>
                  <div className="mt-2">
                    <Input
                      id="receipt"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files[0])}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Sube una imagen o PDF del comprobante de pago
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    placeholder="Notas adicionales sobre este pago..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-semibold mb-1">Al registrar este pago:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>La etapa se desbloqueará automáticamente</li>
                        <li>El cliente podrá acceder al contenido</li>
                        <li>Las citas relacionadas se marcarán como completadas</li>
                        <li>Se enviará notificación al cliente (próximamente)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRegisterModal(false);
                resetForm();
              }}
              disabled={registering || uploadingReceipt}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={!selectedCase || !selectedStage || !amount || registering || uploadingReceipt}
              className="bg-success hover:bg-green-700"
            >
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingReceipt ? 'Subiendo comprobante...' : 'Registrando...'}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Registrar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Pago</DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Fecha de Pago</Label>
                  <p className="font-medium">
                    {format(new Date(selectedPayment.paymentDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">Monto</Label>
                  <p className="font-bold text-success text-xl">${selectedPayment.amount?.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Etapa</Label>
                  <p className="font-medium">{getStageName(selectedPayment.stageName)}</p>
                  <p className="text-sm text-gray-500">Etapa {selectedPayment.stageNumber}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Método de Pago</Label>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 mt-1">
                    {getPaymentMethodLabel(selectedPayment.paymentMethod)}
                  </Badge>
                </div>
              </div>

              {selectedPayment.reference && (
                <div>
                  <Label className="text-gray-600">Referencia/ID Transacción</Label>
                  <p className="font-mono text-sm bg-gray-50 p-2 rounded">{selectedPayment.reference}</p>
                </div>
              )}

              {selectedPayment.receiptUrl && (
                <div>
                  <Label className="text-gray-600">Comprobante de Pago</Label>
                  <a
                    href={selectedPayment.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:underline mt-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ver/Descargar Comprobante
                  </a>
                </div>
              )}

              {selectedPayment.notes && (
                <div>
                  <Label className="text-gray-600">Notas</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{selectedPayment.notes}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-gray-600">Registrado Por</Label>
                <div className="flex items-center mt-1">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="font-medium">{selectedPayment.registeredByName}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-2 border-t">
                <p>Registrado: {format(new Date(selectedPayment.createdAt), "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManualPaymentsManagement;
