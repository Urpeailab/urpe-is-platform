import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Phone, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function PhoneAuth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signInPhone } = useAuth();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signInPhone(phone);
      
      if (result.success) {
        const userData = result.data;
        // Update user language preference if needed
        if (userData.language) {
          i18n.changeLanguage(userData.language);
        }
        userData.language = i18n.language;
        
        toast.success(`¡Bienvenido a URPE, ${userData.name}!`);
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Error en el login');
      }
    } catch (error) {
      toast.error('Error en el login. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255,193,7) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">URPE</h1>
          <p className="text-gray-400">Integral Services</p>
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFC107]/10 rounded-full mb-4">
              <Phone className="w-8 h-8 text-[#FFC107]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Acceso con Teléfono
            </h2>
            <p className="text-gray-400 text-sm">
              Ingresa tu número de teléfono registrado
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phone input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Número de Teléfono
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="3001234567"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/50 focus:border-[#FFC107]/50 transition-all"
                  required
                  disabled={loading}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Ingresa solo los dígitos, sin espacios ni guiones
              </p>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-black font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Verificando...' : 'Ingresar'}</span>
              {!loading && <ArrowRight className="w-5 h-5" />}
            </Button>
          </form>

          {/* Footer info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-gray-500">
              Solo usuarios autorizados de la empresa pueden acceder
            </p>
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            ¿Necesitas ayuda? Contacta a tu asesor
          </p>
        </div>
      </div>
    </div>
  );
}
