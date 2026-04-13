import React, { useState, useRef } from 'react';
import { CheckCircle2, Loader2, CreditCard, User, FileText, Pen, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PaymentAuthForm = () => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const [form, setForm] = useState({
    payerName: '', payerAddress: '', payerZip: '', payerPhone: '', payerEmail: '',
    paymentMethod: 'card',
    cardType: 'credit', cardLastFour: '',
    bankName: '', accountType: 'checking', accountLastFour: '',
    amount: '', currency: 'USD',
    procedureType: 'EB-2 NIW',
    beneficiaryName: '', beneficiaryAddress: '', beneficiaryZip: '',
    isSamePerson: false, relationship: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1C3A6B';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSigned(false);
  };

  const handleSubmit = async () => {
    if (!hasSigned) { toast.error('Debes firmar el documento'); return; }
    const signatureDataUrl = canvasRef.current?.toDataURL('image/png') || '';

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        signatureDataUrl,
        agreedToTerms: true,
      };

      const res = await fetch(`${API}/api/public/payment-authorization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      setResult(data);
      setStep(4);
    } catch (e) {
      toast.error(e.message || 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const isCard = form.paymentMethod === 'card';
  const cardLabel = form.cardType === 'credit' ? 'Credito' : 'Debito';

  if (step === 4 && result) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: '#34C759' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1C3A6B' }}>Confirmacion Registrada</h2>
          <p className="text-sm text-gray-500 mb-6">Tu confirmacion de pago ha sido registrada exitosamente.</p>
          {result.pdfUrl && (
            <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm"
              style={{ background: '#1C3A6B' }}>
              <FileText className="h-4 w-4" />Descargar PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-[#1C3A6B] focus:ring-1 focus:ring-[#1C3A6B]/30 outline-none";

  return (
    <div className="min-h-screen bg-[#F8F9FB] py-6 px-4 pay-auth-form">
      <div className="max-w-lg mx-auto" style={{ color: '#1C3A6B' }}>
        <style>{`
          .pay-auth-form input, .pay-auth-form select, .pay-auth-form textarea {
            color: #1C3A6B !important; background-color: #FFFFFF !important; -webkit-text-fill-color: #1C3A6B !important;
          }
          .pay-auth-form input::placeholder { color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; }
        `}</style>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full mb-3" style={{ background: '#EBF0F7' }}>
            <CreditCard className="h-7 w-7" style={{ color: '#1C3A6B' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1C3A6B' }}>URPE Integral Services</h1>
          <div className="mt-3 rounded-xl p-4" style={{ background: '#EBF0F7' }}>
            <p className="text-sm font-semibold" style={{ color: '#1C3A6B' }}>Confirmacion de pago realizado</p>
            <p className="text-xs mt-1" style={{ color: '#4B6A9B' }}>
              Para confirmar tu pago, necesitamos verificar algunos datos. Solo tomara un minuto.
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'text-white' : step > s ? 'text-white' : 'bg-gray-200 text-gray-500'
              }`} style={step >= s ? { background: '#1C3A6B' } : {}}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-[#1C3A6B]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Payer info */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5" style={{ color: '#1C3A6B' }} />
              <h2 className="text-base font-bold" style={{ color: '#1C3A6B' }}>Datos del Pagador</h2>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Metodo de pago *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="method-card-btn"
                  onClick={() => set('paymentMethod', 'card')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    isCard ? 'border-[#1C3A6B] bg-[#EBF0F7]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={isCard ? { color: '#1C3A6B' } : { color: '#6B7280' }}
                >
                  <CreditCard className="h-4 w-4" />
                  Tarjeta
                </button>
                <button
                  type="button"
                  data-testid="method-ach-btn"
                  onClick={() => set('paymentMethod', 'ach')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    !isCard ? 'border-[#1C3A6B] bg-[#EBF0F7]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={!isCard ? { color: '#1C3A6B' } : { color: '#6B7280' }}
                >
                  <Building2 className="h-4 w-4" />
                  ACH
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {isCard ? 'Titular de la tarjeta con la que se realizo el pago' : 'Titular de la cuenta bancaria desde la que se realizo la transferencia'}
            </p>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre completo *</label>
              <input value={form.payerName} onChange={e => set('payerName', e.target.value)}
                className={inputCls} placeholder={isCard ? 'Nombre del titular de la tarjeta' : 'Nombre del titular de la cuenta'} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Direccion *</label>
              <input value={form.payerAddress} onChange={e => set('payerAddress', e.target.value)}
                className={inputCls} placeholder="Direccion completa" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Codigo postal *</label>
                <input value={form.payerZip} onChange={e => set('payerZip', e.target.value)}
                  className={inputCls} placeholder="12345" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Telefono *</label>
                <input value={form.payerPhone} onChange={e => set('payerPhone', e.target.value)}
                  className={inputCls} placeholder="+1 234 567 8901" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
                <input value={form.payerEmail} onChange={e => set('payerEmail', e.target.value)} type="email"
                  className={inputCls} placeholder="correo@ejemplo.com" />
              </div>
            </div>

            {/* Card-specific fields */}
            {isCard && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de tarjeta</label>
                  <select value={form.cardType} onChange={e => set('cardType', e.target.value)}
                    className={inputCls}>
                    <option value="credit">Credito</option>
                    <option value="debit">Debito</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Ultimos 4 digitos *</label>
                  <input value={form.cardLastFour} onChange={e => set('cardLastFour', e.target.value.replace(/\D/g,'').slice(0,4))}
                    maxLength={4} className={`${inputCls} text-center font-mono tracking-widest`}
                    placeholder="0000" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto ($) *</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} type="number"
                    className={inputCls} placeholder="0.00" />
                </div>
              </div>
            )}

            {/* ACH-specific fields */}
            {!isCard && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre del banco *</label>
                    <input value={form.bankName} onChange={e => set('bankName', e.target.value)}
                      className={inputCls} placeholder="Bank of America, Chase..." />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de cuenta</label>
                    <select value={form.accountType} onChange={e => set('accountType', e.target.value)}
                      className={inputCls}>
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Ultimos 4 digitos de la cuenta *</label>
                    <input value={form.accountLastFour} onChange={e => set('accountLastFour', e.target.value.replace(/\D/g,'').slice(0,4))}
                      maxLength={4} className={`${inputCls} text-center font-mono tracking-widest`}
                      placeholder="0000" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto ($) *</label>
                    <input value={form.amount} onChange={e => set('amount', e.target.value)} type="number"
                      className={inputCls} placeholder="0.00" />
                  </div>
                </div>
              </>
            )}

            {/* Procedure type */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de tramite *</label>
              <select value={form.procedureType} onChange={e => set('procedureType', e.target.value)}
                className={inputCls} data-testid="procedure-type-select">
                <option value="EB-2 NIW">Visa EB-2 NIW</option>
                <option value="Asilo">Asilo</option>
                <option value="Visa L1A">Visa L1A</option>
                <option value="Ajustes de estatus">Ajustes de estatus</option>
              </select>
            </div>

            <button onClick={() => {
              if (!form.payerName || !form.payerAddress || !form.payerZip || !form.payerPhone || !form.amount) {
                toast.error('Completa los campos obligatorios'); return;
              }
              if (isCard && (!form.cardLastFour || form.cardLastFour.length !== 4)) {
                toast.error('Ingresa los ultimos 4 digitos de la tarjeta'); return;
              }
              if (!isCard && (!form.bankName || !form.accountLastFour || form.accountLastFour.length !== 4)) {
                toast.error('Completa los datos bancarios'); return;
              }
              setStep(2);
            }} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: '#1C3A6B' }}>
              Continuar
            </button>
          </div>
        )}

        {/* Step 2: Beneficiary info */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-5 w-5" style={{ color: '#1C3A6B' }} />
              <h2 className="text-base font-bold" style={{ color: '#1C3A6B' }}>Datos del Beneficiario</h2>
            </div>
            <p className="text-xs text-gray-500">Persona que recibira el servicio migratorio</p>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={form.isSamePerson} onChange={e => {
                set('isSamePerson', e.target.checked);
                if (e.target.checked) { set('beneficiaryName', form.payerName); set('beneficiaryAddress', form.payerAddress); set('beneficiaryZip', form.payerZip); }
                else { set('beneficiaryName', ''); set('beneficiaryAddress', ''); set('beneficiaryZip', ''); }
              }} className="h-4 w-4 rounded" style={{ accentColor: '#1C3A6B' }} />
              <span className="text-sm" style={{ color: '#1C3A6B' }}>Yo soy el beneficiario del proceso migratorio (la misma persona que paga)</span>
            </label>

            {!form.isSamePerson && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre del beneficiario *</label>
                  <input value={form.beneficiaryName} onChange={e => set('beneficiaryName', e.target.value)}
                    className={inputCls} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Direccion del beneficiario *</label>
                  <input value={form.beneficiaryAddress} onChange={e => set('beneficiaryAddress', e.target.value)}
                    className={inputCls} placeholder="Direccion completa" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Codigo postal *</label>
                    <input value={form.beneficiaryZip} onChange={e => set('beneficiaryZip', e.target.value)}
                      className={inputCls} placeholder="12345" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Relacion con el beneficiario *</label>
                    <select value={form.relationship} onChange={e => set('relationship', e.target.value)}
                      className={inputCls}>
                      <option value="">Seleccionar...</option>
                      <option value="Conyuge">Conyuge</option>
                      <option value="Familiar">Familiar</option>
                      <option value="Socio">Socio</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm">Atras</button>
              <button onClick={() => {
                if (!form.beneficiaryName) { toast.error('Nombre del beneficiario requerido'); return; }
                if (!form.isSamePerson && !form.relationship) { toast.error('Selecciona la relacion'); return; }
                if (!form.isSamePerson && !form.beneficiaryAddress) { toast.error('Direccion del beneficiario requerida'); return; }
                setStep(3);
              }} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: '#1C3A6B' }}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review + Sign */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Pen className="h-5 w-5" style={{ color: '#1C3A6B' }} />
              <h2 className="text-base font-bold" style={{ color: '#1C3A6B' }}>Revisar y Firmar</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 leading-relaxed space-y-2 max-h-60 overflow-y-auto border border-gray-200">
              <p>Yo, <strong>{form.payerName}</strong>, con domicilio en <strong>{form.payerAddress}, {form.payerZip}</strong>, por medio de la presente declaro voluntariamente:</p>
              {isCard ? (
                <p><strong>1.</strong> Autorizo el cargo a mi tarjeta de {cardLabel} terminada en <strong>****{form.cardLastFour}</strong>, por el monto de <strong>${parseFloat(form.amount || 0).toLocaleString()} {form.currency}</strong>.</p>
              ) : (
                <p><strong>1.</strong> Autorizo la transferencia ACH desde mi cuenta {form.accountType === 'checking' ? 'Checking' : 'Savings'} en <strong>{form.bankName}</strong>, terminada en <strong>****{form.accountLastFour}</strong>, por el monto de <strong>${parseFloat(form.amount || 0).toLocaleString()} {form.currency}</strong>.</p>
              )}
              <p><strong>2.</strong> El pago cubre los honorarios del proceso migratorio <strong>{form.procedureType}</strong> de <strong>{form.beneficiaryName}</strong>.</p>
              <p><strong>3.</strong> Tengo pleno conocimiento de los terminos de URPE INTEGRAL SERVICES.</p>
              <p><strong>4.</strong> Me comprometo a no iniciar disputas o chargebacks ante mi entidad bancaria.</p>
              {!form.isSamePerson && <p><strong>5.</strong> Mi relacion con el beneficiario es de <strong>{form.relationship}</strong>.</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Firma digital *</label>
                <button onClick={clearSignature} className="text-xs text-red-500 hover:underline">Limpiar</button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                <canvas ref={canvasRef} width={450} height={120}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                  className="w-full cursor-crosshair" />
              </div>
              {!hasSigned && <p className="text-xs text-gray-400 mt-1 text-center">Dibuja tu firma arriba</p>}
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
              <input type="checkbox" checked={true} readOnly className="h-4 w-4 mt-0.5 rounded" style={{ accentColor: '#1C3A6B' }} />
              <span className="text-xs text-gray-600">Acepto los terminos y confirmo que la informacion proporcionada sobre el pago es veridica.</span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm">Atras</button>
              <button onClick={handleSubmit} disabled={submitting || !hasSigned}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#1C3A6B' }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Firmar y Enviar'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">URPE Integral Services · 3235 North Point Pkwy, Suite 101 · Alpharetta, GA 30005</p>
      </div>
    </div>
  );
};

export default PaymentAuthForm;
