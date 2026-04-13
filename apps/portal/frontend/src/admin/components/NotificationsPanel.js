import React, { useState } from 'react';
import { Bell, X, Check, AlertCircle, Info, TrendingUp, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

export const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'info',
      title: 'Nuevo usuario registrado',
      message: 'John Smith se ha registrado en la plataforma',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      read: false
    },
    {
      id: '2',
      type: 'success',
      title: 'Webinar publicado',
      message: 'EB-2 NIW Workshop ha sido publicado exitosamente',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      read: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'Acción requerida',
      message: '3 usuarios pendientes de asignación de asesor',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      read: true
    },
    {
      id: '4',
      type: 'alert',
      title: 'Sistema actualizado',
      message: 'Nueva versión del panel admin disponible',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      read: true
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return date.toLocaleDateString();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative text-gray-400 hover:text-white"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-yellow-500 text-black text-xs border-2 border-gray-900">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96 bg-gray-900 border-gray-800 max-h-[500px] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h3 className="text-white font-semibold">Notificaciones</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-yellow-500 hover:text-yellow-400"
            >
              <Check className="h-3 w-3 mr-1" />
              Marcar todo
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-gray-800">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-800 transition-colors ${
                  !notification.read ? 'bg-gray-800/50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className={`text-sm font-medium ${
                        !notification.read ? 'text-white' : 'text-gray-400'
                      }`}>
                        {notification.title}
                      </p>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="text-gray-500 hover:text-gray-300 ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-600">
                        {getTimeAgo(notification.timestamp)}
                      </span>
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-yellow-500 hover:text-yellow-400"
                        >
                          Marcar como leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-800">
            <Button
              variant="ghost"
              className="w-full text-sm text-gray-400 hover:text-white"
            >
              Ver todas las notificaciones →
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
