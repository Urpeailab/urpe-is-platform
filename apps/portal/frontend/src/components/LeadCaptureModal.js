import React, { useState } from 'react';
import { X, User, Mail, Phone, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Common country codes
const countryCodes = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+52', country: 'MX', flag: '🇲🇽' },
  { code: '+57', country: 'CO', flag: '🇨🇴' },
  { code: '+58', country: 'VE', flag: '🇻🇪' },
  { code: '+54', country: 'AR', flag: '🇦🇷' },
  { code: '+56', country: 'CL', flag: '🇨🇱' },
  { code: '+51', country: 'PE', flag: '🇵🇪' },
  { code: '+593', country: 'EC', flag: '🇪🇨' },
  { code: '+34', country: 'ES', flag: '🇪🇸' },
  { code: '+55', country: 'BR', flag: '🇧🇷' },
  { code: '+591', country: 'BO', flag: '🇧🇴' },
  { code: '+502', country: 'GT', flag: '🇬🇹' },
  { code: '+503', country: 'SV', flag: '🇸🇻' },
  { code: '+504', country: 'HN', flag: '🇭🇳' },
  { code: '+505', country: 'NI', flag: '🇳🇮' },
  { code: '+506', country: 'CR', flag: '🇨🇷' },
  { code: '+507', country: 'PA', flag: '🇵🇦' },
  { code: '+809', country: 'DO', flag: '🇩🇴' },
  { code: '+53', country: 'CU', flag: '🇨🇺' },
];

export const LeadCaptureModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    country_code: '+1',
    phone_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresa un email válido';
    }
    
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'El teléfono es requerido';
    } else if (!/^\d{6,15}$/.test(formData.phone_number.replace(/\s/g, ''))) {
      newErrors.phone_number = 'Ingresa un número válido (solo dígitos)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar los datos');
      }
      
      // Success - redirect to WhatsApp
      const fullPhone = `${formData.country_code}${formData.phone_number}`.replace(/[^0-9+]/g, '');
      const whatsappMessage = encodeURIComponent(
        `¡Hola! Soy ${formData.name}, quiero evaluar mi perfil migratorio.`
      );
      
      toast.success('¡Datos enviados correctamente!', {
        description: 'Te redirigiremos a WhatsApp...'
      });
      
      // Small delay before redirect
      setTimeout(() => {
        window.open(`https://wa.me/14705500109?text=${whatsappMessage}`, '_blank');
        onClose();
        // Reset form
        setFormData({
          name: '',
          email: '',
          country_code: '+1',
          phone_number: ''
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar los datos', {
        description: 'Por favor intenta de nuevo'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="lead-capture-modal-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-primary/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md bg-navy-secondary border border-navy-light/30 rounded-2xl shadow-premium-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
        data-testid="lead-capture-modal"
      >
        {/* Header decorative line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate hover:text-gold-primary transition-colors z-10"
          data-testid="lead-modal-close-btn"
        >
          <X className="h-5 w-5" />
        </button>
        
        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold-dark/20 border border-gold-dark/30 mb-4">
              <CheckCircle2 className="h-7 w-7 text-gold-primary" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-gold-subtle mb-2">
              Verifica tu Elegibilidad
            </h2>
            <p className="text-sm text-slate">
              Completa tus datos y un asesor te contactará
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gold-subtle text-sm font-medium">
                Nombre completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className="pl-10 bg-navy-primary border-navy-light/30 text-gold-subtle placeholder:text-slate/50 focus:border-gold-dark focus:ring-gold-dark/20"
                  data-testid="lead-name-input"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name}</p>
              )}
            </div>
            
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gold-subtle text-sm font-medium">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className="pl-10 bg-navy-primary border-navy-light/30 text-gold-subtle placeholder:text-slate/50 focus:border-gold-dark focus:ring-gold-dark/20"
                  data-testid="lead-email-input"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email}</p>
              )}
            </div>
            
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gold-subtle text-sm font-medium">
                Número de teléfono
              </Label>
              <div className="flex gap-2">
                {/* Country Code Select */}
                <Select
                  value={formData.country_code}
                  onValueChange={value => handleChange('country_code', value)}
                >
                  <SelectTrigger 
                    className="w-[100px] bg-navy-primary border-navy-light/30 text-gold-subtle focus:border-gold-dark focus:ring-gold-dark/20"
                    data-testid="lead-country-code-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-secondary border-navy-light/30">
                    {countryCodes.map(({ code, country, flag }) => (
                      <SelectItem 
                        key={code} 
                        value={code}
                        className="text-gold-subtle hover:bg-navy-primary focus:bg-navy-primary"
                      >
                        <span className="flex items-center gap-2">
                          <span>{flag}</span>
                          <span>{code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Phone Number */}
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="1234567890"
                    value={formData.phone_number}
                    onChange={e => handleChange('phone_number', e.target.value.replace(/\D/g, ''))}
                    className="pl-10 bg-navy-primary border-navy-light/30 text-gold-subtle placeholder:text-slate/50 focus:border-gold-dark focus:ring-gold-dark/20"
                    data-testid="lead-phone-input"
                  />
                </div>
              </div>
              {errors.phone_number && (
                <p className="text-xs text-red-400">{errors.phone_number}</p>
              )}
            </div>
            
            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold py-6 rounded-lg shadow-gold hover:shadow-premium-lg transition-all duration-300 mt-6"
              data-testid="lead-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
          
          {/* Footer note */}
          <p className="text-center text-xs text-slate mt-4">
            Al enviar, aceptas nuestra{' '}
            <a href="/privacy" className="text-gold-primary hover:underline">
              política de privacidad
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
