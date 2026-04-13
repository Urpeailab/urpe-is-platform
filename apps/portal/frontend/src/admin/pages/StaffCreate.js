import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { User, Mail, Phone, Shield, Briefcase, Loader2, CheckCircle, Copy, Eye, EyeOff, Linkedin } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const DEPARTMENTS = [
  { value: 'comercial', label: 'Equipo Comercial' },
  { value: 'operativo', label: 'Equipo Operativo' },
  { value: 'marketing', label: 'Equipo de Marketing' },
  { value: 'rrhh', label: 'Equipo de Recursos Humanos' },
  { value: 'qa', label: 'Equipo de QA' },
  { value: 'ceo', label: 'Gerente General (CEO)' },
  { value: 'presidente', label: 'Presidente' }
];

const ROLES = [
  { value: 'advisor', label: 'Asesor' },
  { value: 'coordinator', label: 'Coordinador' },
  { value: 'acreditador', label: 'Acreditador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'admin', label: 'Administrador' },
  { value: 'super_admin', label: 'Super Administrador' }
];

export const StaffCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'advisor',
    department: '',
    linkedin: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado al portapapeles');
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        toast.success('Copiado al portapapeles');
      } catch (fallbackError) {
        toast.error('No se pudo copiar. Por favor, copia manualmente.');
      }
      
      // Safely remove textarea with validation to prevent NotFoundError
      if (textarea.parentNode === document.body) {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.post(
        `${API}/admin/staff`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        setCreatedStaff(response.data.staff);
        setTemporaryPassword(response.data.temporaryPassword);
        setPasswordDialogOpen(true);
        
        toast.success('Personal creado exitosamente');
      }
    } catch (error) {
      console.error('Error creating staff:', error);
      toast.error(error.response?.data?.detail || 'Error al crear personal');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPasswordDialogOpen(false);
    navigate('/admin/staff-management');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Agregar Personal
          </h1>
          <p className="text-gray-600 mt-2">Crea un nuevo miembro del equipo</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/staff-management')}
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </Button>
      </div>

      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle>Información del Personal</CardTitle>
          <CardDescription>
            Se generará automáticamente una contraseña temporal que se mostrará al crear el usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Nombre Completo *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Correo Electrónico *
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                placeholder="ejemplo@urpeintegralservices.co"
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                Teléfono
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Rol *
              </label>
              <Select value={formData.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Briefcase className="h-4 w-4 mr-2" />
                Departamento *
              </label>
              <Select value={formData.department} onValueChange={(value) => handleChange('department', value)}>
                <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500">
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LinkedIn */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn (opcional)
              </label>
              <Input
                type="url"
                value={formData.linkedin}
                onChange={(e) => handleChange('linkedin', e.target.value)}
                className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>

            {/* Info Box */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 flex items-start">
                <CheckCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span>
                  Se generará automáticamente una <strong>contraseña temporal segura</strong> que se mostrará en pantalla después de crear el usuario.
                  {' '}(El email está simulado por ahora)
                </span>
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Crear Personal
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/staff-management')}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Display Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center text-success">
              <CheckCircle className="h-6 w-6 mr-2" />
              ¡Personal Creado Exitosamente!
            </DialogTitle>
            <DialogDescription>
              Guarda esta contraseña temporal de forma segura. No podrás verla nuevamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Nombre:</strong> {createdStaff?.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {createdStaff?.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Departamento:</strong> {DEPARTMENTS.find(d => d.value === formData.department)?.label}
              </p>
            </div>

            {/* Temporary Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Contraseña Temporal:
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={temporaryPassword}
                    readOnly
                    className="bg-yellow-50 border-2 border-yellow-500 text-gray-900 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={() => copyToClipboard(temporaryPassword)}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                ⚠️ <strong>Importante:</strong> El usuario debe cambiar esta contraseña al iniciar sesión por primera vez.
              </p>
            </div>

            {/* Email Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                📧 <strong>Email:</strong> Por ahora el envío de email está simulado. Debes compartir esta contraseña manualmente con el usuario.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => copyToClipboard(`Email: ${createdStaff?.email}\nContraseña: ${temporaryPassword}\nURL: https://classic-cases-hub.preview.emergentagent.com/admin/login`)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Todo
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cerrar y Volver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
