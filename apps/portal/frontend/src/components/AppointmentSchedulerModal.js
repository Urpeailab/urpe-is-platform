import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar as CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AppointmentSchedulerModal = ({ 
  isOpen, 
  onClose, 
  onSchedule,
  stage,
  loading = false
}) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  // Available time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  // Helper function to get stage name (handles both string and object {es, en})
  const getStageName = (name) => {
    if (!name) return 'Etapa';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') return name.es || name.en || 'Etapa';
    return 'Etapa';
  };

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) {
      return;
    }

    // Combine date and time
    const [hours, minutes] = selectedTime.split(':');
    const appointmentDate = new Date(selectedDate);
    appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    onSchedule({
      proposedDate: appointmentDate.toISOString(),
      notes: notes.trim() || null
    });
  };

  const resetForm = () => {
    setSelectedDate(null);
    setSelectedTime('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            Agendar Cita para Siguiente Paso
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Selecciona una fecha y hora para tu consulta sobre la{' '}
            <strong className="text-gray-900">{getStageName(stage?.name)}</strong>
            {' '}(${stage?.amount?.toLocaleString()})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Calendar Section */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Selecciona una fecha
            </Label>
            <div className="flex justify-center border rounded-lg p-4 bg-white">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={es}
                disabled={(date) => {
                  // Disable past dates and Sundays
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today || date.getDay() === 0;
                }}
                className="rounded-md border bg-white"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium text-gray-900",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-white border border-gray-300 p-0 opacity-70 hover:opacity-100 text-gray-700",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-gray-600 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 p-0 font-normal text-gray-900 hover:bg-blue-100 rounded-md",
                  day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                  day_today: "bg-gray-100 text-gray-900 font-semibold",
                  day_outside: "text-gray-400 opacity-50",
                  day_disabled: "text-gray-300 opacity-50 cursor-not-allowed",
                  day_hidden: "invisible",
                }}
              />
            </div>
          </div>

          {/* Time Slots Section */}
          {selectedDate && (
            <div>
              <Label className="text-base font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Selecciona una hora
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {timeSlots.map((time) => (
                  <Button
                    key={time}
                    type="button"
                    variant={selectedTime === time ? 'default' : 'outline'}
                    className={`text-sm ${
                      selectedTime === time 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'hover:bg-blue-50'
                    }`}
                    onClick={() => setSelectedTime(time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {selectedDate && selectedTime && (
            <div>
              <Label htmlFor="notes" className="text-base font-semibold mb-2 block">
                Notas adicionales (opcional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Ej: Prefiero la reunión en español, tengo preguntas sobre documentos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {/* Selected Summary */}
          {selectedDate && selectedTime && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                📅 Resumen de tu cita:
              </p>
              <p className="text-sm text-blue-800">
                <strong>Fecha:</strong> {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Hora:</strong> {selectedTime}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                ℹ️ Esta es una propuesta de horario. El equipo confirmará la cita o propondrá un horario alternativo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedDate || !selectedTime || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agendando...
              </>
            ) : (
              'Solicitar Cita'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
