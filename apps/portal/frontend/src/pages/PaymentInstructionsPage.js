import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AlertCircle, ExternalLink, CheckCircle, Copy, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentInstructionsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const sessionId = searchParams.get('session_id');
  const amount = searchParams.get('amount');
  const stage = searchParams.get('stage');

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success('Session ID copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Instrucciones de Pago
          </h1>
          <p className="text-gray-600 text-sm">
            Completa tu pago para continuar con tu caso de visa
          </p>
        </div>

        {/* Main Card */}
        <Card className="bg-white shadow-xl mb-4">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" />
              Información del Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Payment Details */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-base mb-3 text-gray-900">Detalles del Pago</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Etapa:</span>
                    <span className="font-semibold text-gray-900">Etapa {stage}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Monto:</span>
                    <span className="font-bold text-2xl text-success">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Session ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-700">{sessionId?.substring(0, 20)}...</span>
                      <button
                        onClick={copySessionId}
                        className="text-blue-600 hover:text-blue-700"
                        title="Copiar Session ID"
                      >
                        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="font-semibold text-base mb-3 text-gray-900">Cómo Completar tu Pago</h3>
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Contacta a tu Coordinador</h4>
                      <p className="text-gray-600 text-xs">
                        Ponte en contacto con tu coordinador asignado para procesar el pago de esta etapa.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Proporciona el Session ID</h4>
                      <p className="text-gray-600 text-xs">
                        Comparte el Session ID con tu coordinador para que pueda procesar tu pago correctamente.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Realiza el Pago</h4>
                      <p className="text-gray-600 text-xs">
                        Tu coordinador te proporcionará el enlace de pago de FanBasis o las instrucciones para completar la transacción.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-success text-white rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5">Confirmación Automática</h4>
                      <p className="text-gray-600 text-xs">
                        Una vez procesado el pago, tu etapa se desbloqueará automáticamente y recibirás una notificación.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 text-sm mb-0.5">Nota Importante</h4>
                    <p className="text-yellow-800 text-xs">
                      Por favor, no realices pagos por medios no autorizados. Todos los pagos deben procesarse 
                      a través de FanBasis con supervisión de tu coordinador.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => navigate('/dashboard/my-case')}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Mi Caso
                </Button>
                <Button
                  onClick={() => window.open('https://www.fanbasis.com', '_blank')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Sobre FanBasis
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="bg-white shadow-lg">
          <CardHeader className="py-3">
            <CardTitle className="text-lg">Preguntas Frecuentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">¿Por qué no puedo pagar directamente aquí?</h4>
              <p className="text-gray-600 text-xs">
                Para garantizar la seguridad y el correcto procesamiento de tu pago, trabajamos con coordinadores 
                que gestionan los enlaces de pago de FanBasis de manera personalizada.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">¿Cuánto tiempo tarda en procesarse el pago?</h4>
              <p className="text-gray-600 text-xs">
                Una vez realizado el pago a través de FanBasis, la confirmación es automática e inmediata. 
                Tu etapa se desbloqueará en cuestión de minutos.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">¿Es seguro pagar a través de FanBasis?</h4>
              <p className="text-gray-600 text-xs">
                Sí, FanBasis es una plataforma segura y confiable para procesar pagos. Todos los pagos están 
                protegidos con encriptación de nivel bancario.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
