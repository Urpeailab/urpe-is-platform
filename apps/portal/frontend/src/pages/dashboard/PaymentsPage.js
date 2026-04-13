import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { 
  CreditCard, CheckCircle, Clock, Download,
  AlertCircle, Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const PaymentsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      if (!token) {
        toast.error('Por favor inicia sesión nuevamente');
        setLoading(false);
        return;
      }
      
      // Fetch case data for stages info
      const caseResponse = await axios.get(`${BACKEND_URL}/api/client/my-case`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCaseData(caseResponse.data);

      // Fetch payments
      const paymentsResponse = await axios.get(`${BACKEND_URL}/api/client/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(paymentsResponse.data.payments || []);
      setSummary(paymentsResponse.data.summary || {});
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        toast.error('Tu sesión ha expirado. Por favor inicia sesión nuevamente');
      } else if (error.response?.status !== 404) {
        toast.error('Error al cargar los datos de pagos');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-navy-primary">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-gold-primary"></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-8 sm:py-12 px-4 bg-navy-primary min-h-screen">
        <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-slate-light mx-auto mb-3 sm:mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold text-gold-subtle mb-2">
          No se encontró un caso activo
        </h2>
        <p className="text-sm sm:text-base text-slate">
          Contacta a tu coordinador para más información
        </p>
      </div>
    );
  }

  const { case: visaCase, stages, progress } = caseData;
  const totalAmount = stages.reduce((sum, s) => sum + s.amount, 0);
  const paidAmount = summary.totalPaid || 0;
  const pendingAmount = totalAmount - paidAmount;
  const progressPercent = Math.round((paidAmount / totalAmount) * 100);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 bg-navy-primary min-h-screen">
      {/* Header - Navy Premium */}
      <div className="px-1 sm:px-0">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold text-gold-subtle">Mis Pagos</h1>
        <p className="text-sm sm:text-base text-slate mt-1 sm:mt-2">
          Consulta tu historial de pagos
        </p>
      </div>

      {/* Financial Summary Card - Navy Premium */}
      <Card className="bg-navy-secondary border border-gold-dark/30 rounded-xl">
        <CardContent className="p-4 sm:p-6">
          {/* Grid responsive - stack en móvil */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="flex sm:block justify-between items-center sm:items-start">
              <p className="text-slate text-xs sm:text-sm">Total del Programa</p>
              <p className="text-2xl sm:text-3xl font-bold text-gold-primary">${totalAmount.toLocaleString()}</p>
            </div>
            <div className="flex sm:block justify-between items-center sm:items-start">
              <div>
                <p className="text-slate text-xs sm:text-sm">Total Pagado</p>
                <p className="text-xs text-gold-dark sm:hidden">{progressPercent}% completado</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-2xl sm:text-3xl font-bold text-success">${paidAmount.toLocaleString()}</p>
                <p className="text-slate text-xs sm:text-sm mt-1 hidden sm:block">{progressPercent}% completado</p>
              </div>
            </div>
            <div className="flex sm:block justify-between items-center sm:items-start">
              <div>
                <p className="text-slate text-xs sm:text-sm">Pendiente</p>
                <p className="text-xs text-gold-dark sm:hidden">
                  {stages.length - progress.paidStages.length} etapas restantes
                </p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-2xl sm:text-3xl font-bold text-warning">${pendingAmount.toLocaleString()}</p>
                <p className="text-slate text-xs sm:text-sm mt-1 hidden sm:block">
                  {stages.length - progress.paidStages.length} etapas restantes
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar - Navy Premium */}
          <div className="mt-4 sm:mt-6">
            <div className="w-full bg-navy-light/30 rounded-full h-2.5 sm:h-3">
              <div
                className="bg-gradient-to-r from-gold-dark to-success rounded-full h-2.5 sm:h-3 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History - Navy Premium */}
      <Card className="bg-navy-secondary border border-navy-light/20 rounded-xl">
        <CardHeader className="p-4 sm:p-6 border-b border-navy-light/20">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center text-base sm:text-lg text-gold-subtle">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gold-dark" />
              Historial de Pagos
            </div>
            {payments.length > 0 && (
              <Badge className="self-start sm:self-auto text-xs sm:text-sm bg-gold-dark/20 text-gold-primary border border-gold-dark/30">
                {payments.length} {payments.length === 1 ? 'pago' : 'pagos'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {payments.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <CreditCard className="h-12 w-12 sm:h-16 sm:w-16 text-slate-light mx-auto mb-3 sm:mb-4" />
              <p className="text-gold-subtle font-medium text-sm sm:text-base">Aún no hay pagos registrados</p>
              <p className="text-xs sm:text-sm text-slate mt-2">
                Los pagos realizados aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment, index) => {
                const isManual = payment.paymentSource === 'manual';
                const paymentDate = payment.paidAt || payment.date;
                
                return (
                  <div
                    key={payment.id || payment.transactionId || index}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-navy-light/20 rounded-lg hover:border-gold-dark/30 transition-colors active:scale-[0.99] touch-manipulation bg-navy-primary"
                  >
                    {/* Icon and Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        payment.status === 'completed' 
                          ? 'bg-success/20 border border-success/30' 
                          : 'bg-warning/20 border border-warning/30'
                      }`}>
                        {payment.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                        ) : (
                          <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gold-subtle text-sm sm:text-base truncate">
                            {payment.concept || `Etapa ${payment.stageNumber}`}
                          </h4>
                          {isManual && (
                            <Badge className="bg-gold-dark/20 text-gold-primary border border-gold-dark/30 text-[10px] sm:text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-xs sm:text-sm text-slate">
                          {new Date(paymentDate).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 sm:mt-2">
                          {payment.method && (
                            <span className="text-[10px] sm:text-xs text-slate bg-navy-light/30 px-2 py-0.5 sm:py-1 rounded">
                              {payment.method === 'card' && '💳 Tarjeta'}
                              {payment.method === 'transfer' && '🏦 Transfer'}
                              {payment.method === 'cash' && '💵 Efectivo'}
                              {payment.method === 'check' && '📝 Cheque'}
                              {!['card', 'transfer', 'cash', 'check'].includes(payment.method) && payment.method}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount and Actions - Stack en móvil */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-navy-light/20">
                      <div className="sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-gold-primary">
                          ${payment.amount.toLocaleString()}
                        </p>
                        <Badge className={`text-[10px] sm:text-xs ${
                          payment.status === 'completed' 
                            ? 'bg-success/20 text-success border border-success/30' 
                            : 'bg-warning/20 text-warning border border-warning/30'
                        }`}>
                          {payment.status === 'completed' ? 'Completado' : 'Pendiente'}
                        </Badge>
                      </div>
                      
                      {payment.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[40px] sm:min-h-0 touch-manipulation border-gold-dark/30 text-gold-primary hover:bg-gold-dark/10"
                          onClick={() => {
                            toast.success('Descarga de recibo iniciada (Demo)');
                          }}
                        >
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Recibo</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card - Navy Premium */}
      <Card className="border border-gold-dark/20 bg-gold-dark/5 rounded-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-gold-dark flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gold-subtle text-sm sm:text-base mb-1 sm:mb-2">
                Información sobre Pagos
              </h4>
              <p className="text-xs sm:text-sm text-slate leading-relaxed">
                Esta sección muestra todos los pagos realizados en tu caso. Para realizar un nuevo pago, contacta a tu coordinador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
