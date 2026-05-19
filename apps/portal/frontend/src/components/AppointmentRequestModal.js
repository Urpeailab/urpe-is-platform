import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar, X, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const GEORGIA_TZ = 'America/New_York';

const todayISOInGeorgia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: GEORGIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Próximo día hábil (lunes-viernes) en hora Georgia, usado como valor por
// defecto del input de fecha. Si es viernes/sábado/domingo, salta al lunes.
const nextBusinessDayInGeorgia = () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let candidate = tomorrow;
  for (let i = 0; i < 4; i++) {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: GEORGIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(candidate);
    const dow = new Date(`${iso}T12:00:00`).getDay();
    if (dow !== 0 && dow !== 6) return iso;
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: GEORGIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(candidate);
};

const buildTimeSlots = (dateStr) => {
  const slots = [];
  for (let h = 9; h < 17; h++) {
    for (const m of ['00', '30']) slots.push(`${String(h).padStart(2, '0')}:${m}`);
  }
  if (!dateStr) return slots;
  const minTs = Date.now() + 4 * 60 * 60 * 1000;
  return slots.filter((slot) => {
    const naive = new Date(`${dateStr}T${slot}:00`);
    const georgiaParts = new Intl.DateTimeFormat('en-US', {
      timeZone: GEORGIA_TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(naive)
      .reduce((acc, p) => (p.type !== 'literal' ? { ...acc, [p.type]: p.value } : acc), {});
    const asUtc = Date.UTC(
      +georgiaParts.year,
      +georgiaParts.month - 1,
      +georgiaParts.day,
      +georgiaParts.hour,
      +georgiaParts.minute,
      +georgiaParts.second,
    );
    const offsetMs = naive.getTime() - asUtc;
    const ts = naive.getTime() + offsetMs;
    return ts >= minTs;
  });
};

const isWeekend = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
};

/**
 * Modal compartido para que el cliente solicite una cita.
 *
 * Props:
 * - isOpen, onClose
 * - visaCase: { id, coordinatorId, coordinatorName, salesRepId, salesRepName, advisorId, advisorName }
 * - defaultRole: 'coordinator' | 'salesRep' (opcional)
 * - onSubmitted: callback opcional cuando se solicita con éxito
 */
export const AppointmentRequestModal = ({ isOpen, onClose, visaCase, defaultRole, onSubmitted }) => {
  // El API devuelve coordinator_id/advisor_id en snake_case y los nombres con
  // alias enriched (coordinatorName/salesRepName/advisorName). Aceptamos ambos.
  const coordId = visaCase?.coordinatorId || visaCase?.coordinator_id;
  const salesId = visaCase?.salesRepId || visaCase?.advisorId || visaCase?.sales_rep_id || visaCase?.advisor_id;
  const coordName = visaCase?.coordinatorName || visaCase?.coordinator_name;
  const salesName = visaCase?.salesRepName || visaCase?.advisorName || visaCase?.sales_rep_name || visaCase?.advisor_name;
  const initialRole = defaultRole
    || (coordId ? 'coordinator' : (salesId ? 'salesRep' : 'coordinator'));
  const [apptDate, setApptDate] = useState(() => nextBusinessDayInGeorgia());
  const [apptTime, setApptTime] = useState('');
  const [apptRole, setApptRole] = useState(initialRole);
  const [apptReason, setApptReason] = useState('');
  const [apptSubmitting, setApptSubmitting] = useState(false);

  const reset = () => {
    setApptDate(nextBusinessDayInGeorgia());
    setApptTime('');
    setApptReason('');
    setApptRole(initialRole);
  };

  const close = () => {
    if (apptSubmitting) return;
    reset();
    onClose?.();
  };

  const submitAppointment = async () => {
    const caseId = visaCase?.id || visaCase?.caseId;
    if (!caseId) {
      toast.error('No se encontró el caso');
      return;
    }
    if (!apptDate || !apptTime) {
      toast.error('Selecciona fecha y hora');
      return;
    }
    if (isWeekend(apptDate)) {
      toast.error('Solo se pueden agendar citas de lunes a viernes');
      return;
    }
    if (!apptReason || apptReason.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres');
      return;
    }
    setApptSubmitting(true);
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      await axios.post(
        `${BACKEND_URL}/api/appointments/create`,
        {
          caseId,
          proposedDate: apptDate,
          proposedTime: apptTime,
          reason: apptReason.trim(),
          withRole: apptRole,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Cita solicitada. Te notificaremos cuando se confirme.');
      reset();
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al solicitar la cita');
    } finally {
      setApptSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasCoord = !!coordId;
  const hasSales = !!salesId;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-[#1E293B] rounded-2xl border border-[#334155] max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#F8FAFC] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#C9A96A]" /> Agendar cita
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">Lunes a viernes, 9:00 - 17:00 (hora Georgia, EE.UU.). Mínimo 4h de anticipación.</p>
          </div>
          <button onClick={close} className="text-[#64748B] hover:text-[#F8FAFC] p-1" disabled={apptSubmitting}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wider">¿Con quién quieres reunirte?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!hasCoord || apptSubmitting}
                onClick={() => setApptRole('coordinator')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  apptRole === 'coordinator' ? 'border-[#C9A96A] bg-[#C9A96A]/10' : 'border-[#334155] bg-[#0F172A] hover:border-[#475569]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-xs text-[#94A3B8]">Coordinador</p>
                <p className="text-sm font-medium text-[#F8FAFC] truncate">{coordName || 'No asignado'}</p>
              </button>
              <button
                type="button"
                disabled={!hasSales || apptSubmitting}
                onClick={() => setApptRole('salesRep')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  apptRole === 'salesRep' ? 'border-[#C9A96A] bg-[#C9A96A]/10' : 'border-[#334155] bg-[#0F172A] hover:border-[#475569]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <p className="text-xs text-[#94A3B8]">Vendedor</p>
                <p className="text-sm font-medium text-[#F8FAFC] truncate">{salesName || 'No asignado'}</p>
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wider">Fecha</label>
            <input
              type="date"
              value={apptDate}
              min={todayISOInGeorgia()}
              onChange={(e) => { setApptDate(e.target.value); setApptTime(''); }}
              disabled={apptSubmitting}
              className="w-full bg-[#0F172A] border border-[#334155] text-[#F8FAFC] rounded-lg px-3 py-2.5 text-sm focus:border-[#C9A96A] focus:outline-none"
            />
            {apptDate && isWeekend(apptDate) && (
              <p className="text-xs text-red-400 mt-1">Las citas solo están disponibles lunes a viernes.</p>
            )}
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wider">Hora (Georgia)</label>
            {!apptDate ? (
              <p className="text-xs text-[#64748B] py-2">Selecciona una fecha primero.</p>
            ) : isWeekend(apptDate) ? (
              <p className="text-xs text-[#64748B] py-2">Elige un día entre lunes y viernes.</p>
            ) : (() => {
              const slots = buildTimeSlots(apptDate);
              if (slots.length === 0) {
                return <p className="text-xs text-[#64748B] py-2">No hay horarios disponibles ese día (mín. 4h de anticipación).</p>;
              }
              return (
                <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      disabled={apptSubmitting}
                      onClick={() => setApptTime(slot)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        apptTime === slot ? 'bg-[#C9A96A] text-[#0F172A]' : 'bg-[#0F172A] text-[#E2E8F0] border border-[#334155] hover:border-[#C9A96A]'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wider">Motivo</label>
            <textarea
              value={apptReason}
              onChange={(e) => setApptReason(e.target.value)}
              placeholder="¿De qué quieres hablar?"
              rows={3}
              maxLength={500}
              disabled={apptSubmitting}
              className="w-full bg-[#0F172A] border border-[#334155] text-[#F8FAFC] rounded-lg px-3 py-2 text-sm focus:border-[#C9A96A] focus:outline-none resize-none"
            />
            <p className="text-[10px] text-[#64748B] mt-1">{apptReason.length}/500 · mínimo 5 caracteres</p>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={close}
            disabled={apptSubmitting}
            className="flex-1 py-2.5 rounded-lg border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]/50 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submitAppointment}
            disabled={apptSubmitting || !apptDate || !apptTime || apptReason.trim().length < 5}
            className="flex-1 py-2.5 rounded-lg bg-[#C9A96A] hover:bg-[#B8956A] disabled:opacity-50 disabled:cursor-not-allowed text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {apptSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : 'Solicitar cita'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentRequestModal;
