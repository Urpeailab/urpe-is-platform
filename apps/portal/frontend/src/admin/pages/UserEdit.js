import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ArrowLeft, User, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const UserEdit = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    profession: '',
    userState: 'U1'
  });

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      const response = await axios.get(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const user = response.data;
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        profession: user.profession || '',
        userState: user.userState || 'U1'
      });
      
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Error al cargar los datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.put(`${API}/admin/users/${userId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Usuario actualizado exitosamente');
      navigate(`/admin/users/${userId}`);
      
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMsg = error.response?.data?.detail || 'Error al actualizar el usuario';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate(`/admin/users/${userId}`)}
          style={{ color: '#000000', borderColor: '#374151', fontWeight: 600 }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" style={{ color: '#000000' }} />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#000000' }}>
            Editar Usuario
          </h1>
          <p style={{ color: '#1f2937', fontWeight: 600 }} className="mt-1">
            Modificar información de {formData.name}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <Card className="border-2 border-gray-200 max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
            <User className="h-5 w-5" style={{ color: '#eab308' }} />
            Información del Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: '#1f2937', fontWeight: 600 }}>
                Nombre Completo
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nombre del usuario"
                style={{ color: '#000000' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: '#1f2937', fontWeight: 600 }}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@ejemplo.com"
                style={{ color: '#000000' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" style={{ color: '#1f2937', fontWeight: 600 }}>
                Teléfono
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="584121234567"
                style={{ color: '#000000' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profession" style={{ color: '#1f2937', fontWeight: 600 }}>
                Profesión
              </Label>
              <Input
                id="profession"
                value={formData.profession}
                onChange={(e) => handleChange('profession', e.target.value)}
                placeholder="Profesión del usuario"
                style={{ color: '#000000' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userState" style={{ color: '#1f2937', fontWeight: 600 }}>
                Estado del Usuario
              </Label>
              <Select 
                value={formData.userState} 
                onValueChange={(value) => handleChange('userState', value)}
              >
                <SelectTrigger style={{ color: '#000000' }}>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="U1">U1 - Visitante</SelectItem>
                  <SelectItem value="U2">U2 - Prospecto</SelectItem>
                  <SelectItem value="U3">U3 - Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/admin/users/${userId}`)}
                style={{ color: '#000000', borderColor: '#374151', fontWeight: 600 }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                style={{ backgroundColor: '#eab308', color: '#000000', fontWeight: 600 }}
                className="hover:bg-yellow-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserEdit;
