import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { ArrowLeft, Bell, Lock, Globe, Moon, Save } from 'lucide-react';
import { toast } from 'sonner';

export const Settings = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: true,
    language: i18n.language,
    darkMode: true
  });
  
  const [loading, setLoading] = useState(false);

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    setSettings(prev => ({
      ...prev,
      language: lng
    }));
    toast.success(`Idioma cambiado a ${lng === 'es' ? 'Español' : 'English'}`);
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      toast.error('Error al guardar la configuración');
      console.error('Settings save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Settings Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Configuración
          </h1>
          <p className="text-gray-400 mt-2">Personaliza tu experiencia</p>
        </div>

        <div className="space-y-6">
          {/* Notifications Settings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-white">Notificaciones</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Gestiona cómo recibes las notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Notificaciones por Email</p>
                  <p className="text-sm text-gray-400">Recibe actualizaciones en tu correo</p>
                </div>
                <button
                  onClick={() => handleToggle('emailNotifications')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.emailNotifications ? 'bg-yellow-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Notificaciones por SMS</p>
                  <p className="text-sm text-gray-400">Recibe mensajes de texto</p>
                </div>
                <button
                  onClick={() => handleToggle('smsNotifications')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.smsNotifications ? 'bg-yellow-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.smsNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Emails de Marketing</p>
                  <p className="text-sm text-gray-400">Recibe ofertas y novedades</p>
                </div>
                <button
                  onClick={() => handleToggle('marketingEmails')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.marketingEmails ? 'bg-yellow-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.marketingEmails ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-white">Idioma</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Selecciona tu idioma preferido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleLanguageChange('es')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.language === 'es'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="font-semibold">Español</p>
                  <p className="text-sm mt-1">Spanish</p>
                </button>

                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.language === 'en'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="font-semibold">English</p>
                  <p className="text-sm mt-1">Inglés</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-white">Seguridad</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Gestiona tu contraseña y seguridad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium">Cambiar Contraseña</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => toast.info('Función en desarrollo')}
                  >
                    Cambiar
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  Última actualización: Hace 30 días
                </p>
              </div>

              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium">Autenticación de Dos Factores</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => toast.info('Función en desarrollo')}
                  >
                    Activar
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  Agrega una capa extra de seguridad a tu cuenta
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
            >
              {loading ? (
                'Guardando...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
