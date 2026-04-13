import React from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, MoreVertical, Download, Send, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export const ActionHeader = ({ 
  clientName, 
  clientEmail,
  status,
  userState,
  onBack,
  onDownloadPDF,
  onSendLink,
  onEdit,
  onStatusChange,
  isDownloading,
  primaryAction,
  children
}) => {
  const STATUS_OPTIONS = {
    'proceso_venta': { label: 'En proceso de venta', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    'elegibility_approved': { label: 'Elegibilidad Aprobada', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    'active': { label: 'Activo', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'in_progress': { label: 'En Progreso', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    'ready_to_file': { label: 'Listo para Radicar', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    'filed': { label: 'Radicado', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'approved': { label: 'Aprobado', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'denied': { label: 'Denegado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    'on_hold': { label: 'En Espera', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    'en_proceso': { label: 'En Proceso', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    'finalizado': { label: 'Finalizado', className: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
    'analizando': { label: 'Analizando', className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    'impreso': { label: 'Impreso', className: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
    'enviado': { label: 'Enviado', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'ioe': { label: 'IOE', className: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    'devuelto': { label: 'Devuelto', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };

  const getStatusBadge = () => {
    if (onStatusChange) {
      return (
        <select
          data-testid="case-status-select-redesign"
          value={status || 'proceso_venta'}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-7 px-2 rounded-full text-xs font-semibold border outline-none cursor-pointer"
          style={{ color: '#374151', background: '#F3F4F6', borderColor: '#D1D5DB' }}
        >
          {Object.entries(STATUS_OPTIONS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      );
    }
    const config = STATUS_OPTIONS[status] || { label: status, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getUserStateBadge = () => {
    if (!userState) return null;
    const stateConfig = {
      'U1': { label: 'U1 - Visitante', className: 'bg-gray-100 text-gray-700 border-gray-300', tooltip: 'Usuario que completó formulario de elegibilidad' },
      'U2': { label: 'U2 - Prospecto', className: 'bg-amber-100 text-amber-700 border-amber-300', tooltip: 'Usuario en proceso de conversión' },
      'U3': { label: 'U3 - Cliente', className: 'bg-blue-100 text-blue-700 border-blue-300', tooltip: 'Cliente con caso activo' },
    };
    const config = stateConfig[userState] || { label: userState, className: 'bg-gray-100 text-gray-600 border-gray-300' };
    return (
      <Badge 
        className={`${config.className} text-xs font-medium`}
        title={config.tooltip}
      >
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-gray-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Back + Client Info */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  {clientName || 'Cliente'}
                </h1>
                {getStatusBadge()}
                {getUserStateBadge()}
              </div>
              {clientEmail && (
                <p className="text-sm text-gray-500">{clientEmail}</p>
              )}
            </div>
          </div>

          {/* Right: Actions - Following Fitts' Law: Large, accessible buttons */}
          <div className="flex items-center gap-3">
            {children}
            
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-2" />}
                {primaryAction.label}
              </Button>
            )}

            {/* Secondary actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 h-10 w-10">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-gray-200">
                <DropdownMenuItem 
                  onClick={onDownloadPDF}
                  disabled={isDownloading}
                  className="text-gray-700 hover:text-gray-900 focus:bg-gray-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Roadmap PDF
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onSendLink}
                  className="text-gray-700 hover:text-gray-900 focus:bg-gray-100"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Link al Cliente
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onEdit}
                  className="text-gray-700 hover:text-gray-900 focus:bg-gray-100"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Caso
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionHeader;
