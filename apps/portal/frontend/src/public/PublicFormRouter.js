import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import PreValidationFormContent from './PreValidationFormContent';
import PublicFormFill from './PublicFormFill';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Smart router component that determines which form to show based on form_type
 */
const PublicFormRouter = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [formType, setFormType] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkFormType();
  }, [token]);

  const checkFormType = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/public/form/${token}`);
      setFormType(response.data.form_type);
      setLoading(false);
    } catch (err) {
      console.error('Error checking form type:', err);
      setError(err.response?.data?.detail || 'Error al cargar el formulario');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gold-primary mx-auto mb-4" />
          <p className="text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-gray-400 text-sm mt-2">
              El enlace puede haber expirado o ya fue utilizado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Route to appropriate component based on form_type
  if (formType === 'pre_validation') {
    return <PreValidationFormContent />;
  }

  // Default to full form
  return <PublicFormFill />;
};

export default PublicFormRouter;
