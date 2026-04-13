import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PreValidationForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  
  const [answers, setAnswers] = useState({
    uscis_account: '',
    ssn: '',
    street_address: '',
    apt_suite: '',
    city: '',
    state: '',
    zip_code: '',
    province: '',
    postal_code: '',
    country: '',
    a_number: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    fetchFormData();
  }, [token]);

  const fetchFormData = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/public/form/${token}`);
      setFormData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error(error.response?.data?.detail || 'Error al cargar el formulario');
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const required = ['uscis_account', 'ssn', 'street_address', 'city', 'country', 'a_number', 'email', 'phone'];
    
    for (const field of required) {
      if (!answers[field] || answers[field].trim() === '') {
        toast.error('Por favor complete todos los campos obligatorios');
        return false;
      }
    }

    // Validate no hyphens
    const fieldsToCheck = ['uscis_account', 'ssn', 'a_number', 'phone'];
    for (const field of fieldsToCheck) {
      if (answers[field].includes('-')) {
        toast.error(`El campo ${field} no debe contener guiones`);
        return false;
      }
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(answers.email)) {
      toast.error('Por favor ingrese un email válido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Format answers for submission
      const formattedAnswers = [
        { question: 'Número de cuenta USCIS', answer: answers.uscis_account },
        { question: 'Número de Seguro Social', answer: answers.ssn },
        { question: 'Dirección - Calle y Número', answer: answers.street_address },
        { question: 'Dirección - Apartamento/Suite', answer: answers.apt_suite || 'N/A' },
        { question: 'Dirección - Ciudad', answer: answers.city },
        { question: 'Dirección - Estado', answer: answers.state || 'N/A' },
        { question: 'Dirección - Código Postal (ZIP)', answer: answers.zip_code || 'N/A' },
        { question: 'Dirección - Provincia', answer: answers.province || 'N/A' },
        { question: 'Dirección - Código Postal', answer: answers.postal_code || 'N/A' },
        { question: 'Dirección - País', answer: answers.country },
        { question: 'Código A (Alien Registration Number)', answer: answers.a_number },
        { question: 'Correo Electrónico', answer: answers.email },
        { question: 'Número de Teléfono', answer: answers.phone }
      ];

      await axios.post(`${BACKEND_URL}/api/uscis-forms/public/form/${token}/submit`, {
        client_name: formData?.client_name || '',
        client_email: answers.email,
        answers: formattedAnswers
      });

      setSubmitted(true);
      toast.success('Respuestas enviadas exitosamente');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar las respuestas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Card className="bg-navy-secondary border-navy-light max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">¡Gracias!</h2>
            <p className="text-gray-300 mb-4">
              Un coordinador de tu caso verificará las respuestas y continuará con el proceso.
            </p>
            <p className="text-sm text-gray-400">
              Esta información es para validar antes de diligenciar el formulario, mantente atento a los siguientes pasos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-primary p-4">
      <div className="max-w-3xl mx-auto py-8">
        <Card className="bg-navy-secondary border-navy-light">
          <CardHeader>
            <CardTitle className="text-white text-2xl">
              Pre-Validación de Información - {formData?.form_code}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Por favor complete la siguiente información básica. Esta información es necesaria para validar antes de diligenciar el formulario completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* USCIS Account Number */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Número de Cuenta USCIS <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={answers.uscis_account}
                  onChange={(e) => handleChange('uscis_account', e.target.value)}
                  placeholder="Sin guiones"
                  className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  required
                />
                <p className="text-xs text-gray-500">Parte 1 / Other Information, Item 8</p>
              </div>

              {/* SSN */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Número de Seguro Social (SSN) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={answers.ssn}
                  onChange={(e) => handleChange('ssn', e.target.value)}
                  placeholder="9 dígitos sin guiones"
                  className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  maxLength={9}
                  required
                />
                <p className="text-xs text-gray-500">Parte 1 / Other Information, Item 7</p>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-4 border-t border-navy-light">
                <h3 className="text-lg font-semibold text-white">
                  Dirección de Residencia de su País Anterior
                </h3>
                <p className="text-xs text-gray-500">Part 4 / Processing Information, Items 3.a - 3.h</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-gray-300">
                      Calle y Número <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={answers.street_address}
                      onChange={(e) => handleChange('street_address', e.target.value)}
                      placeholder="Street Number and Name"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Apartamento/Suite/Piso</Label>
                    <Input
                      type="text"
                      value={answers.apt_suite}
                      onChange={(e) => handleChange('apt_suite', e.target.value)}
                      placeholder="Apt/Ste/Flr (opcional)"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">
                      Ciudad <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={answers.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="City or Town"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Estado (si aplica)</Label>
                    <Input
                      type="text"
                      value={answers.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      placeholder="State"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Código Postal (ZIP)</Label>
                    <Input
                      type="text"
                      value={answers.zip_code}
                      onChange={(e) => handleChange('zip_code', e.target.value)}
                      placeholder="ZIP Code"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Provincia</Label>
                    <Input
                      type="text"
                      value={answers.province}
                      onChange={(e) => handleChange('province', e.target.value)}
                      placeholder="Province"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Código Postal</Label>
                    <Input
                      type="text"
                      value={answers.postal_code}
                      onChange={(e) => handleChange('postal_code', e.target.value)}
                      placeholder="Postal Code"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">
                      País <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={answers.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      placeholder="Country (en inglés)"
                      className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* A-Number */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Código A - Alien Registration Number <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  value={answers.a_number}
                  onChange={(e) => handleChange('a_number', e.target.value)}
                  placeholder="9 dígitos sin guiones ni A-"
                  className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  maxLength={9}
                  required
                />
                <p className="text-xs text-gray-500">Parte 3, Item 8</p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Confirma tu Correo Electrónico <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="email"
                  value={answers.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  required
                />
                <p className="text-xs text-gray-500">Parte 8, Item 5</p>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Confirma tu Número de Teléfono <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="tel"
                  value={answers.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="10 dígitos sin guiones"
                  className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  maxLength={10}
                  required
                />
                <p className="text-xs text-gray-500">Parte 8, Items 3 y 4</p>
              </div>

              {/* Info Note */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ℹ️ Esta información es para validar antes de diligenciar el formulario, mantente atento a los siguientes pasos.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold px-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Información'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PreValidationForm;
