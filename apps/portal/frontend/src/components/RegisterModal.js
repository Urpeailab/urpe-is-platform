import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { TermsModal } from './TermsModal';
import { PrivacyModal } from './PrivacyModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const RegisterModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleChange = (e) => {
    setError(''); // Clear error when user types
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    
    console.log('🔥 RegisterModal: handleSubmit called', { email: formData.email, password: formData.password?.length });
    
    if (!formData.email || !formData.password) {
      const msg = 'Por favor completa todos los campos';
      setError(msg);
      toast.error(msg);
      console.log('❌ Validation error: campos vacíos');
      return;
    }

    if (formData.password.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres';
      setError(msg);
      toast.error(msg);
      console.log('❌ Validation error: password muy corta');
      return;
    }

    if (!acceptedTerms) {
      const msg = 'Debes aceptar los Términos y Condiciones';
      setError(msg);
      toast.error(msg);
      console.log('❌ Validation error: términos no aceptados');
      return;
    }

    setLoading(true);
    console.log('⏳ Setting loading to true...');

    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      console.log('📦 User data from localStorage:', { hasToken: !!token, userState: userData?.userState });

      if (!token) {
        const msg = 'Sesión no válida. Por favor inicia sesión nuevamente.';
        setError(msg);
        toast.error(msg);
        console.log('❌ No token found');
        setLoading(false);
        return;
      }

      console.log('🚀 Sending request to /api/auth/upgrade-visitor...');
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/upgrade-visitor`,
        {
          email: formData.email,
          password: formData.password
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('✅ Response received:', data);

      if (data.success) {
        // Update user in context and localStorage
        const updatedUser = {
          ...data.user,
          token: data.token
        };
        
        localStorage.setItem('urpe_user', JSON.stringify(updatedUser));
        updateUser(updatedUser);

        const successMsg = '¡Registro exitoso! Ahora tienes acceso completo';
        toast.success(successMsg);
        console.log('✅ Success! Closing modal and reloading...');
        onClose();
        
        // Reload to update sidebar
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const msg = data.message || 'Error al procesar el registro';
        setError(msg);
        toast.error(msg);
        console.log('❌ Backend returned success: false', data);
      }
    } catch (error) {
      console.error('❌ Error upgrading user:', error);
      console.error('❌ Error details:', error.response?.data);
      
      let errorMsg = 'Error al registrarse. Por favor intenta de nuevo.';
      
      if (error.response?.status === 400) {
        // Bad request - probably email already exists
        errorMsg = error.response?.data?.detail || 'Este email ya está registrado. Por favor usa otro.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Sesión expirada. Por favor inicia sesión nuevamente.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
      console.log('❌ Final error message shown:', errorMsg);
    } finally {
      setLoading(false);
      console.log('✅ Loading set to false');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎉 ¡Completa tu Registro!
          </h2>
          <p className="text-white/90">
            Crea tu cuenta para acceder a todas las funcionalidades
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
              <span className="text-success">✓</span>
              <span>Acceso completo al dashboard</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
              <span className="text-success">✓</span>
              <span>Gestión de tu caso de visa</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
              <span className="text-success">✓</span>
              <span>Subida y gestión de documentos</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <div className="text-red-500 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-2" />
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-500 focus:outline-none transition"
                placeholder="tu@email.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="h-4 w-4 inline mr-2" />
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-500 focus:outline-none transition"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 6 caracteres
              </p>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-yellow-500 border-2 border-gray-300 rounded focus:ring-yellow-500"
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-700">
                Acepto los{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTermsModal(true);
                  }}
                  className="text-yellow-600 hover:text-yellow-700 underline cursor-pointer"
                >
                  Términos y Condiciones
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPrivacyModal(true);
                  }}
                  className="text-yellow-600 hover:text-yellow-700 underline cursor-pointer"
                >
                  Política de Privacidad
                </button>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:to-amber-700 text-black font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  Registrarme y Continuar
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Terms and Privacy Modals */}
      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <PrivacyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
};
