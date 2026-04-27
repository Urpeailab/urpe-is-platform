import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { User, Mail, Phone, Shield, Briefcase, Loader2, Upload, X, Linkedin, Camera, Key, Copy, CheckCircle } from 'lucide-react';
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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' }
];

export const StaffEdit = () => {
  const navigate = useNavigate();
  const { staffId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Password reset states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newTemporaryPassword, setNewTemporaryPassword] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'advisor',
    department: '',
    linkedin: '',
    status: 'active',
    photo: null
  });

  useEffect(() => {
    fetchStaff();
  }, [staffId]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        const staff = response.data;
        setFormData({
          name: staff.name || '',
          email: staff.email || '',
          phone: staff.phone || '',
          role: staff.role || 'advisor',
          department: staff.department || '',
          linkedin: staff.linkedin || '',
          status: staff.status || 'active',
          photo: staff.photo || null
        });
        
        if (staff.photo) {
          setPhotoPreview(staff.photo);
        }
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Error al cargar los datos del personal');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no puede superar los 5MB');
        return;
      }

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten archivos de imagen');
        return;
      }

      setPhotoFile(file);

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(formData.photo); // Volver a la foto original si existe
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('admin_token');
      
      // Si hay foto nueva, convertirla a base64
      let photoData = formData.photo;
      if (photoFile) {
        photoData = photoPreview; // Ya está en base64
      }

      const updateData = {
        ...formData,
        photo: photoData
      };

      const response = await axios.put(
        `${API}/admin/staff/${staffId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        toast.success('Personal actualizado exitosamente');
        navigate(`/admin/staff/${staffId}/detail`);
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar personal');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setResettingPassword(true);
      const token = localStorage.getItem('admin_token');
      
      const response = await axios.post(
        `${API}/admin/staff/${staffId}/reset-password`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setNewTemporaryPassword(response.data.temporaryPassword);
        setShowPasswordModal(true);
        toast.success('Contraseña reseteada exitosamente');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.detail || 'Error al resetear contraseña');
    } finally {
      setResettingPassword(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado al portapapeles');
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      // Fallback method
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Editar Personal
          </h1>
          <p className="text-gray-600 mt-2">Actualiza la información del miembro del equipo</p>
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
            Actualiza los datos y la foto de perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Camera className="h-4 w-4 mr-2" />
                Foto de Perfil
              </label>
              <div className="flex items-center gap-4">
                {/* Photo Preview */}
                <div className="relative">
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="h-24 w-24 rounded-full object-cover border-4 border-gray-200"
                      />
                      {photoFile && (
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-3xl">
                      {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex-1">
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors border-2 border-gray-300"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {photoPreview ? 'Cambiar Foto' : 'Subir Foto'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG o GIF. Máximo 5MB.
                  </p>
                </div>
              </div>
            </div>

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
                  <SelectValue />
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
                  <SelectValue />
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
                LinkedIn
              </label>
              <Input
                type="url"
                value={formData.linkedin}
                onChange={(e) => handleChange('linkedin', e.target.value)}
                className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500"
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Estado *
              </label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 focus:border-yellow-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Guardar Cambios
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

      {/* Password Reset Card */}
      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gestión de Contraseña
          </CardTitle>
          <CardDescription>
            Resetear la contraseña del usuario y generar una nueva temporal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Importante:</strong> Al resetear la contraseña, se generará una nueva contraseña temporal que deberás compartir con el usuario. El usuario deberá cambiarla en su primer inicio de sesión.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={resettingPassword}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reseteando...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Resetear Contraseña
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-6 w-6" />
              ¡Contraseña Reseteada!
            </DialogTitle>
            <DialogDescription>
              La contraseña ha sido reseteada exitosamente. Guarda esta contraseña temporal de forma segura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">Usuario: {formData.name}</p>
              <p className="text-sm text-blue-700">Email: {formData.email}</p>
            </div>

            {/* Temporary Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Nueva Contraseña Temporal:
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newTemporaryPassword}
                  readOnly
                  className="font-mono bg-yellow-50 border-2 border-yellow-300 text-gray-900 font-semibold text-lg"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => copyToClipboard(newTemporaryPassword)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <strong>⚠️ Importante:</strong> El usuario debe cambiar esta contraseña al iniciar sesión por primera vez.
              </p>
            </div>

            {/* Email Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                📧 Debes compartir esta contraseña manualmente con el usuario.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              onClick={() => copyToClipboard(`Email: ${formData.email}\nContraseña Temporal: ${newTemporaryPassword}`)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Todo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
