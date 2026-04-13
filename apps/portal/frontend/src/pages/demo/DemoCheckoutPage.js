import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const DemoCheckoutPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  
  const sessionId = searchParams.get('session_id');
  const amount = searchParams.get('amount');

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard/my-case');
    }
  }, [sessionId, navigate]);

  const handlePayment = async () => {
    setProcessing(true);
    
    try {
      // Get user token
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      if (!token) {
        toast.error('Por favor inicia sesión nuevamente');
        navigate('/auth');
        return;
      }

      console.log('🎬 Demo: Simulating payment processing...');
      
      // Simulate payment processing delay (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Demo: Payment processed, confirming with backend...');
      
      // Call backend to confirm payment and unlock stage
      await axios.post(
        `${BACKEND_URL}/api/payments/confirm/${sessionId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('✅ Demo: Payment confirmed! Redirecting to success page...');
      
      // Redirect to payment success page
      navigate(`/dashboard/payment-success?session_id=${sessionId}`);
      
    } catch (error) {
      console.error('❌ Error confirming payment:', error);
      toast.error('Error al procesar el pago. Por favor intenta nuevamente.');
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard/my-case');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
          <CardTitle className="text-white text-center text-xl flex items-center justify-center gap-2">
            <CreditCard className="h-6 w-6" />
            FanBasis Checkout - Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Demo Notice */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong className="font-medium">🎬 Modo Demo</strong>
                  <br />
                  Esta es una simulación de la página de pago de FanBasis. En producción, serás redirigido a la plataforma real de FanBasis.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Detalles del Pago</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Session ID:</span>
                <span className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                  {sessionId?.substring(0, 20)}...
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Monto:</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${amount ? parseFloat(amount).toLocaleString() : '0'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Lock className="h-3 w-3" />
                <span>Transacción segura y encriptada</span>
              </div>
            </div>
          </div>

          {/* Demo Payment Form */}
          <div className="space-y-4">
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Información de Tarjeta (Demo)
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Número de Tarjeta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                  value="4242 4242 4242 4242"
                  readOnly
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                    value="12/25"
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="CVV"
                    className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                    value="123"
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                <div className="text-sm text-green-700">
                  <p className="font-medium">Demo Mode Activo</p>
                  <p className="mt-1">
                    Al confirmar, simularemos un pago exitoso y desbloquearemos tu etapa automáticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold flex items-center justify-center gap-2"
              disabled={processing}
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  Confirmar Pago Demo
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Security Notice */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <Lock className="h-3 w-3 inline mr-1" />
            Powered by FanBasis (Demo Mode)
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
