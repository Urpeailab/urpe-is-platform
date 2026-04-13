import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader2, XCircle, ArrowRight, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const POLLING_INTERVAL = 3000; // 3 seconds
const TIMEOUT_DURATION = 120000; // 2 minutes (120 seconds)
const AUTO_REDIRECT_DELAY = 3000; // 3 seconds after success

export const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'failed', 'timeout'
  const [paymentData, setPaymentData] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const sessionId = searchParams.get('session_id');
  const pollingIntervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const redirectTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);
  const isProcessingRef = useRef(false); // Prevent multiple confirmations

  useEffect(() => {
    if (!sessionId) {
      setStatus('failed');
      toast.error('ID de sesión de pago no encontrado');
      return;
    }

    startTimeRef.current = Date.now();
    verifyPayment();

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      if (!token) {
        toast.error('Por favor inicia sesión nuevamente');
        navigate('/auth');
        return;
      }

      // Set timeout for 2 minutes
      timeoutRef.current = setTimeout(() => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        setStatus('timeout');
        toast.error('Tiempo de espera agotado. Por favor verifica el estado de tu pago en Mi Caso.');
      }, TIMEOUT_DURATION);

      // Start polling
      const checkPaymentStatus = async () => {
        try {
          // Stop if already processing
          if (isProcessingRef.current) {
            console.log('⏭️ Payment already being processed, stopping checks');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            return;
          }
          
          // Update elapsed time
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);

          console.log(`🔄 Checking payment status... (${elapsed}s elapsed)`);
          
          const { data } = await axios.get(
            `${BACKEND_URL}/api/payments/status/${sessionId}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          console.log('Payment status response:', data);
          setPaymentData(data);

          // Check if payment is completed
          if (data.paymentStatus === 'paid' || data.status === 'completed') {
            // Prevent multiple confirmations
            if (isProcessingRef.current) {
              console.log('⏭️ Already processing payment confirmation, skipping...');
              return;
            }
            
            isProcessingRef.current = true;
            console.log('✅ Payment completed! Confirming...');
            
            // Clear polling and timeout IMMEDIATELY
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }

            // Confirm payment and unlock stage
            try {
              await axios.post(
                `${BACKEND_URL}/api/payments/confirm/${sessionId}`,
                {},
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );
              console.log('✅ Payment confirmed and stage unlocked!');
            } catch (confirmError) {
              console.error('Error confirming payment:', confirmError);
              // Continue to success even if confirm fails (webhook will handle it)
            }
            
            setStatus('success');
            toast.success('¡Pago confirmado exitosamente!');

            // Start countdown for auto-redirect
            let secondsLeft = 3;
            setCountdown(secondsLeft);
            
            const countdownInterval = setInterval(() => {
              secondsLeft--;
              setCountdown(secondsLeft);
              
              if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
              }
            }, 1000);

            // Auto-redirect after 3 seconds to the newly unlocked stage
            redirectTimeoutRef.current = setTimeout(() => {
              // Pass the newly unlocked stage number as URL parameter
              const newStageNumber = data.stageNumber ? data.stageNumber + 1 : null;
              if (newStageNumber) {
                navigate(`/dashboard/my-case?stage=${newStageNumber}`);
              } else {
                navigate('/dashboard/my-case');
              }
            }, AUTO_REDIRECT_DELAY);

          } else if (data.status === 'failed' || data.paymentStatus === 'failed') {
            console.log('❌ Payment failed');
            
            // Clear polling and timeout
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            setStatus('failed');
            toast.error('El pago ha fallado. Por favor intenta nuevamente.');
          }
          // If status is still pending, continue polling
          
        } catch (error) {
          console.error('Error checking payment status:', error);
          
          // If it's a 404, payment not found
          if (error.response?.status === 404) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            setStatus('failed');
            toast.error('Sesión de pago no encontrada');
          }
          // For other errors, continue polling (could be temporary network issue)
        }
      };

      // Check immediately
      await checkPaymentStatus();

      // Then poll every 3 seconds
      pollingIntervalRef.current = setInterval(checkPaymentStatus, POLLING_INTERVAL);
      
    } catch (error) {
      console.error('Error verifying payment:', error);
      setStatus('failed');
      toast.error('Error al verificar el pago');
    }
  };

  const handleGoToCase = () => {
    navigate('/dashboard/my-case');
  };

  return (
    <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className={`${
          status === 'checking' ? 'bg-blue-500' : 
          status === 'success' ? 'bg-success' : 
          status === 'timeout' ? 'bg-gold-primary' :
          'bg-red-500'
        } rounded-t-xl`}>
          <CardTitle className="text-white text-center text-xl flex items-center justify-center gap-2">
            {status === 'checking' && (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Verificando Pago
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-6 w-6" />
                ¡Pago Exitoso!
              </>
            )}
            {status === 'timeout' && (
              <>
                <Clock className="h-6 w-6" />
                Tiempo de Espera Agotado
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle className="h-6 w-6" />
                Error en el Pago
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {status === 'checking' && (
            <div className="text-center">
              <div className="mb-4">
                <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
              </div>
              <p className="text-slate font-medium mb-2">
                Estamos verificando tu pago...
              </p>
              <p className="text-sm text-slate-light">
                Esto puede tardar unos segundos.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-light">
                <Clock className="h-4 w-4" />
                <span>Tiempo transcurrido: {elapsedTime}s</span>
              </div>
              <div className="mt-2 text-xs text-slate-light">
                Máximo 2 minutos de espera
              </div>
            </div>
          )}

          {status === 'success' && paymentData && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-success mb-3" />
                <h3 className="text-lg font-semibold text-gold-subtle mb-2">
                  ¡Tu pago ha sido confirmado!
                </h3>
                <p className="text-sm text-slate mb-3">
                  La Etapa {paymentData.stageNumber} ha sido desbloqueada exitosamente.
                </p>
                <div className="bg-navy-secondary border border-green-200 rounded-lg p-3 text-sm text-slate">
                  Redirigiendo en <span className="font-bold text-success">{countdown}</span> segundo{countdown !== 1 ? 's' : ''}...
                </div>
              </div>

              <div className="bg-navy-primary border border-navy-light/20 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-slate">Monto pagado:</span>
                  <span className="font-semibold text-gold-subtle">
                    ${paymentData.amount?.toLocaleString()} {paymentData.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Etapa:</span>
                  <span className="font-semibold text-gold-subtle">
                    Etapa {paymentData.stageNumber}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleGoToCase}
                className="w-full bg-success hover:bg-success text-white font-semibold flex items-center justify-center gap-2"
              >
                Ir a Mi Caso Ahora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {status === 'timeout' && (
            <div className="space-y-4">
              <div className="bg-gold-dark/10 border border-gold-dark/40 rounded-lg p-4 text-center">
                <Clock className="h-16 w-16 mx-auto text-gold-primary mb-3" />
                <h3 className="text-lg font-semibold text-gold-subtle mb-2">
                  Tiempo de espera agotado
                </h3>
                <p className="text-sm text-slate">
                  No pudimos verificar el estado de tu pago en tiempo real. 
                  Si completaste el pago, la etapa se desbloqueará automáticamente en unos minutos.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-slate">
                  <strong>¿Qué hacer ahora?</strong>
                </p>
                <ul className="text-sm text-slate mt-2 space-y-1 list-disc list-inside">
                  <li>Verifica tu email de confirmación</li>
                  <li>Revisa el estado en "Mi Caso"</li>
                  <li>Contacta a soporte si persiste el problema</li>
                </ul>
              </div>

              <Button
                onClick={handleGoToCase}
                className="w-full bg-gold-primary hover:bg-gold-dark text-white font-semibold flex items-center justify-center gap-2"
              >
                Ir a Mi Caso
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <XCircle className="h-16 w-16 mx-auto text-red-500 mb-3" />
                <h3 className="text-lg font-semibold text-gold-subtle mb-2">
                  No se pudo verificar el pago
                </h3>
                <p className="text-sm text-slate">
                  Hubo un problema al procesar tu pago. Por favor, contacta a soporte si el cargo fue realizado.
                </p>
              </div>

              <div className="bg-navy-primary border border-navy-light/20 rounded-lg p-4">
                <p className="text-sm text-slate">
                  <strong>Soporte:</strong>
                </p>
                <p className="text-sm text-slate mt-1">
                  Email: soporte@urpe.com
                </p>
                <p className="text-sm text-slate">
                  Incluye tu ID de sesión en el mensaje.
                </p>
              </div>

              <Button
                onClick={handleGoToCase}
                className="w-full bg-navy-primary0 hover:bg-gray-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                Volver a Mi Caso
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
