import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Calendar, Clock, CheckCircle2, AlertCircle, Loader2, User, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_MAP = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Clock },
  approved: { label: 'Aprobada', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazada', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: XCircle },
  completed: { label: 'Completada', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle },
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIME_SLOTS = [
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
];

export const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [caseTeam, setCaseTeam] = useState({ coordinator: null, salesRep: null });
  const [step, setStep] = useState(1); // 1=who, 2=date, 3=time, 4=reason

  const [selectedDate, setSelectedDate] = useState(null); // Date object
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [withRole, setWithRole] = useState('coordinator');

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const token = JSON.parse(localStorage.getItem('urpe_user') || '{}')?.token;
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [apptRes, caseRes] = await Promise.all([
        axios.get(`${API}/api/appointments/my-appointments`, { headers }),
        axios.get(`${API}/api/client/my-case`, { headers }).catch(() => null),
      ]);
      setAppointments(apptRes.data.appointments || []);
      if (caseRes?.data?.case) {
        const c = caseRes.data.case;
        setCaseData(c);
        const coord = c.coordinatorName ? { name: c.coordinatorName, id: c.coordinatorId } : null;
        const sales = c.salesRepName ? { name: c.salesRepName, id: c.salesRepId } : null;
        setCaseTeam({ coordinator: coord, salesRep: sales });
        if (coord && !sales) setWithRole('coordinator');
        else if (!coord && sales) setWithRole('salesRep');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Calendar helpers
  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m, y) => new Date(y, m, 1).getDay();

  const isDateDisabled = (day) => {
    const d = new Date(calYear, calMonth, day);
    if (d < today) return true;
    if (d.getDay() === 0 || d.getDay() === 6) return true; // weekend
    return false;
  };

  const isDateSelected = (day) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
  };

  const handleSelectDay = (day) => {
    if (isDateDisabled(day)) return;
    setSelectedDate(new Date(calYear, calMonth, day));
    setSelectedTime('');
    setStep(3);
  };

  const getAvailableSlots = () => {
    if (!selectedDate) return TIME_SLOTS;
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return TIME_SLOTS;
    const minHour = now.getHours() + 3;
    return TIME_SLOTS.filter(t => parseInt(t.value.split(':')[0]) >= minHour);
  };

  const hasPending = appointments.some(a => a.status === 'pending' || a.status === 'approved');

  const formatDateStr = (d) => {
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !reason.trim() || !caseData) return;
    try {
      setSubmitting(true);
      await axios.post(`${API}/api/appointments/create`, {
        caseId: caseData.id || caseData._id || caseData.caseId,
        proposedDate: formatDateStr(selectedDate),
        proposedTime: selectedTime,
        reason: reason.trim(),
        withRole,
      }, { headers });
      toast.success('Cita solicitada. Te notificaremos cuando sea aprobada.');
      setStep(1); setSelectedDate(null); setSelectedTime(''); setReason('');
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al solicitar cita');
    } finally { setSubmitting(false); }
  };

  const selectedPerson = withRole === 'salesRep' ? caseTeam.salesRep : caseTeam.coordinator;

  // Render calendar grid
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calMonth, calYear);
    const firstDay = getFirstDayOfMonth(calMonth, calYear);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      const selected = isDateSelected(day);
      const isToday = today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
      const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;

      cells.push(
        <button
          key={day}
          onClick={() => handleSelectDay(day)}
          disabled={disabled}
          className={`
            h-10 w-10 rounded-full text-sm font-medium transition-all
            ${selected ? 'bg-[#C9A96A] text-[#0F172A] font-bold scale-110' : ''}
            ${!selected && isToday ? 'ring-2 ring-[#C9A96A]/50 text-[#C9A96A]' : ''}
            ${!selected && !disabled && !isToday ? 'text-[#E2E8F0] hover:bg-[#334155]' : ''}
            ${disabled ? 'text-[#334155] cursor-not-allowed' : 'cursor-pointer'}
            ${isWeekend && !selected ? 'text-[#475569]' : ''}
          `}
        >
          {day}
        </button>
      );
    }
    return cells;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A96A]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-5 bg-[#0F172A] min-h-screen pb-24 sm:pb-8">
      <div className="text-center pt-2">
        <Calendar className="h-8 w-8 text-[#C9A96A] mx-auto mb-2" />
        <h1 className="text-xl font-bold text-[#F8FAFC]">Agendar Cita</h1>
        <p className="text-xs text-[#64748B] mt-1">Horario: Lun-Vie, 8:00 AM - 5:00 PM</p>
      </div>

      {/* New appointment */}
      {!hasPending ? (
        <Card className="bg-[#1E293B] border border-[#334155] overflow-hidden">
          {/* Step indicators */}
          <div className="flex border-b border-[#334155]">
            {['Con quién', 'Fecha', 'Hora', 'Motivo'].map((s, i) => (
              <button
                key={i}
                onClick={() => { if (i + 1 < step || (i + 1 === 2 && step >= 1) || (i + 1 === 1)) setStep(i + 1); }}
                className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2 ${
                  step === i + 1 ? 'text-[#C9A96A] border-[#C9A96A] bg-[#C9A96A]/5' :
                  step > i + 1 ? 'text-emerald-400 border-emerald-500/50' :
                  'text-[#475569] border-transparent'
                }`}
              >
                {step > i + 1 ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : null}
                {s}
              </button>
            ))}
          </div>

          <CardContent className="p-5">
            {/* Step 1: With whom */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-[#94A3B8] text-center mb-4">Selecciona con quién deseas reunirte</p>
                <div className="space-y-2">
                  {caseTeam.coordinator && (
                    <button
                      onClick={() => { setWithRole('coordinator'); setStep(2); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        withRole === 'coordinator' ? 'border-[#C9A96A] bg-[#C9A96A]/10' : 'border-[#334155] hover:border-[#475569]'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-[#F8FAFC]">{caseTeam.coordinator.name}</p>
                        <p className="text-xs text-[#64748B]">Coordinador de tu caso</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#475569]" />
                    </button>
                  )}
                  {caseTeam.salesRep && (
                    <button
                      onClick={() => { setWithRole('salesRep'); setStep(2); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        withRole === 'salesRep' ? 'border-[#C9A96A] bg-[#C9A96A]/10' : 'border-[#334155] hover:border-[#475569]'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-[#F8FAFC]">{caseTeam.salesRep.name}</p>
                        <p className="text-xs text-[#64748B]">Vendedor de tu caso</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#475569]" />
                    </button>
                  )}
                  {!caseTeam.coordinator && !caseTeam.salesRep && (
                    <div className="text-center py-6">
                      <AlertCircle className="h-8 w-8 text-[#EF4444] mx-auto mb-2" />
                      <p className="text-sm text-[#EF4444]">Tu caso no tiene coordinador ni vendedor asignado</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Date */}
            {step === 2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else setCalMonth(m => m - 1);
                  }} className="p-1.5 rounded-lg hover:bg-[#334155] text-[#94A3B8]">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="text-sm font-semibold text-[#F8FAFC]">
                    {MONTHS[calMonth]} {calYear}
                  </p>
                  <button onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else setCalMonth(m => m + 1);
                  }} className="p-1.5 rounded-lg hover:bg-[#334155] text-[#94A3B8]">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-[#475569]">{d}</div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1 place-items-center">
                  {renderCalendar()}
                </div>

                <p className="text-xs text-[#475569] text-center mt-3">Solo dias laborales (Lun-Vie)</p>
              </div>
            )}

            {/* Step 3: Time */}
            {step === 3 && (
              <div>
                <p className="text-sm text-[#94A3B8] text-center mb-1">
                  {selectedDate?.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-[#475569] text-center mb-4">Selecciona la hora</p>

                {getAvailableSlots().length === 0 ? (
                  <div className="text-center py-4">
                    <AlertCircle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-amber-300">No hay horarios disponibles para hoy</p>
                    <p className="text-xs text-[#64748B] mt-1">Se requieren al menos 3 horas de anticipacion</p>
                    <Button onClick={() => setStep(2)} size="sm" className="mt-3 bg-[#334155] text-[#94A3B8]">
                      Elegir otro dia
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {getAvailableSlots().map(slot => (
                      <button
                        key={slot.value}
                        onClick={() => { setSelectedTime(slot.value); setStep(4); }}
                        className={`py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                          selectedTime === slot.value
                            ? 'bg-[#C9A96A] text-[#0F172A] font-bold scale-105'
                            : 'bg-[#0F172A] text-[#E2E8F0] border border-[#334155] hover:border-[#C9A96A]/50 hover:bg-[#C9A96A]/5'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Reason + Confirm */}
            {step === 4 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-[#0F172A] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-[#94A3B8]">Con:</span>
                    <span className="text-[#F8FAFC] font-medium">{selectedPerson?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-[#94A3B8]">Fecha:</span>
                    <span className="text-[#F8FAFC] font-medium">
                      {selectedDate?.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-[#94A3B8]">Hora:</span>
                    <span className="text-[#F8FAFC] font-medium">
                      {TIME_SLOTS.find(t => t.value === selectedTime)?.label || selectedTime}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#94A3B8] mb-2 block">Motivo de la cita *</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: Consulta sobre documentos pendientes, dudas sobre el proceso..."
                    rows={3}
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl text-[#F8FAFC] placeholder:text-[#475569] p-3 text-sm focus:border-[#C9A96A] focus:ring-1 focus:ring-[#C9A96A]/50 focus:outline-none resize-none"
                    data-testid="reason-input"
                  />
                  {reason.trim().length > 0 && reason.trim().length < 5 && (
                    <p className="text-xs text-amber-400 mt-1">Minimo 5 caracteres</p>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || reason.trim().length < 5}
                  className="w-full bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-bold min-h-[48px] rounded-xl"
                  data-testid="submit-appointment"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Solicitar Cita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1E293B] border border-amber-500/20">
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-[#F8FAFC] font-medium">Ya tienes una cita pendiente</p>
            <p className="text-xs text-[#64748B] mt-1">Espera a que se complete para solicitar otra</p>
          </CardContent>
        </Card>
      )}

      {/* Appointments list */}
      {appointments.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC] mb-3">Mis Citas</h2>
          <div className="space-y-2">
            {appointments.map(appt => {
              const st = STATUS_MAP[appt.status] || STATUS_MAP.pending;
              const StIcon = st.icon;
              return (
                <Card key={appt.id} className="bg-[#1E293B] border border-[#334155]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={`${st.color} border text-xs`}>
                        <StIcon className="h-3 w-3 mr-1" />{st.label}
                      </Badge>
                      <span className="text-xs text-[#475569]">
                        {appt.proposedDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#C9A96A]" />
                      <span className="text-sm text-[#F8FAFC] font-medium">
                        {appt.proposedDate} a las {appt.proposedTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-3.5 w-3.5 text-[#64748B]" />
                      <span className="text-xs text-[#94A3B8]">{appt.withStaffName || 'Coordinador'}</span>
                    </div>
                    <p className="text-xs text-[#64748B] bg-[#0F172A] rounded-lg p-2">{appt.reason}</p>
                    {appt.meetingLink && appt.status === 'approved' && (
                      <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-[#C9A96A] hover:underline font-medium">
                        Unirse a la reunion
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
