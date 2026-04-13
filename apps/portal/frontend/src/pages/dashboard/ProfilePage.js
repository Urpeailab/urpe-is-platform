import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { User, Mail, Phone, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${BACKEND_URL}/api/users/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        updateUser(response.data);
        toast.success('Perfil actualizado exitosamente');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-6 bg-navy-primary min-h-screen">
      {/* Header - Navy Premium */}
      <div className="px-1 sm:px-0">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold text-gold-subtle">
          Editar Perfil
        </h1>
        <p className="text-sm sm:text-base text-slate mt-1 sm:mt-2">Actualiza tu información personal</p>
      </div>

      <Card className="bg-navy-secondary border border-navy-light/20 rounded-xl">
        <CardHeader className="p-4 sm:p-6 border-b border-navy-light/20">
          <CardTitle className="font-display text-base sm:text-lg text-gold-subtle">Información Personal</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-slate">Actualiza tus datos de contacto</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Profile Picture - Navy Premium */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-gold-dark/20 border border-gold-dark/30 flex items-center justify-center text-gold-primary font-bold text-xl sm:text-3xl flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gold-subtle truncate">{user?.name}</h3>
                <p className="text-xs sm:text-sm text-slate truncate">{user?.email}</p>
              </div>
            </div>

            {/* Name Field - Navy Premium */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-slate flex items-center">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 text-gold-dark" />
                Nombre Completo
              </label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="bg-navy-primary border border-navy-light/30 text-gold-subtle focus:border-gold-dark min-h-[48px] sm:min-h-[44px] text-base placeholder:text-slate-light"
                required
              />
            </div>

            {/* Email Field - Navy Premium */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-slate flex items-center">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 text-gold-dark" />
                Correo Electrónico
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-navy-primary border border-navy-light/30 text-gold-subtle focus:border-gold-dark min-h-[48px] sm:min-h-[44px] text-base placeholder:text-slate-light"
                required
              />
            </div>

            {/* Phone Field - Navy Premium */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-slate flex items-center">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 text-gold-dark" />
                Teléfono
              </label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="bg-navy-primary border border-navy-light/30 text-gold-subtle focus:border-gold-dark min-h-[48px] sm:min-h-[44px] text-base placeholder:text-slate-light"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {/* Submit Button - Navy Premium */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold min-h-[52px] sm:min-h-[48px] text-sm sm:text-base touch-manipulation active:scale-[0.98] shadow-gold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
