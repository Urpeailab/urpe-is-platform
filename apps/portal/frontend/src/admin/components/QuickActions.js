import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { 
  UserPlus, 
  Video, 
  FileText, 
  TrendingUp, 
  Calendar,
  Send,
  Users,
  Settings
} from 'lucide-react';

export const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'new-user',
      icon: UserPlus,
      label: 'Nuevo Usuario',
      description: 'Crear usuario',
      color: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
      onClick: () => navigate('/admin/users')
    },
    {
      id: 'new-webinar',
      icon: Video,
      label: 'Nuevo Webinar',
      description: 'Programar webinar',
      color: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20',
      onClick: () => navigate('/admin/webinars')
    },
    {
      id: 'new-document',
      icon: FileText,
      label: 'Nuevo Documento',
      description: 'Subir documento',
      color: 'bg-success/10 text-success hover:bg-success/20',
      onClick: () => navigate('/admin/legal-library')
    },
    {
      id: 'view-analytics',
      icon: TrendingUp,
      label: 'Analytics',
      description: 'Ver estadísticas',
      color: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
      onClick: () => navigate('/admin/dashboard')
    },
    {
      id: 'manage-staff',
      icon: Users,
      label: 'Staff',
      description: 'Gestionar equipo',
      color: 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20',
      onClick: () => navigate('/admin/staff')
    },
    {
      id: 'send-notification',
      icon: Send,
      label: 'Notificación',
      description: 'Enviar mensaje',
      color: 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20',
      onClick: () => alert('Función de envío de notificaciones en desarrollo')
    },
    {
      id: 'schedule-event',
      icon: Calendar,
      label: 'Evento',
      description: 'Programar evento',
      color: 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20',
      onClick: () => navigate('/admin/webinars')
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Configuración',
      description: 'Ajustes del sistema',
      color: 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20',
      onClick: () => alert('Página de configuración en desarrollo')
    }
  ];

  return (
    <Card className="bg-white border-2 border-gray-200 shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h3>
          <span className="text-xs text-gray-500">Atajos frecuentes</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`flex flex-col items-center p-4 rounded-xl transition-all ${action.color} group border border-gray-200 hover:border-gray-300`}
              >
                <div className="p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-gray-900 mb-0.5">
                  {action.label}
                </span>
                <span className="text-xs text-gray-600">
                  {action.description}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
