import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const WelcomeMagicLink = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasValidated = useRef(false);

  useEffect(() => {
    // Prevent multiple calls
    if (!hasValidated.current && token) {
      hasValidated.current = true;
      validateMagicLink();
    }
  }, [token]);

  const validateMagicLink = async () => {
    try {
      console.log('🔗 Validating magic link token:', token);

      const response = await axios.get(
        `${BACKEND_URL}/api/auth/validate-magic-link/${token}`
      );

      console.log('✅ Magic link validation response:', response.data);

      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        
        // Save to localStorage with correct key (same as AuthContext)
        localStorage.setItem('urpe_user', JSON.stringify(userData));

        // Update auth context
        updateUser(userData);

        console.log('✅ User logged in via magic link:', userData);

        // Small delay to ensure state is updated
        setTimeout(() => {
          // Redirect to dashboard (same for all user types)
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('❌ Magic link validation error:', err);
      
      if (err.response) {
        // Server responded with error
        setError(err.response.data.detail || 'Link inválido o expirado');
      } else if (err.request) {
        // Request made but no response
        setError('Error de conexión. Por favor, intenta nuevamente.');
      } else {
        // Something else happened
        setError('Error inesperado. Por favor, intenta nuevamente.');
      }
      
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Verificando acceso...</h2>
          <p className="text-gray-400">Un momento por favor</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Error de Acceso</h2>
            <p className="text-gray-300 mb-6">{error}</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/phone-login')}
              className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
            >
              Ir a Iniciar Sesión
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
