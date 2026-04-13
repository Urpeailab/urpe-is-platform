import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const USCISFormsNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [visaCategories, setVisaCategories] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    form_code: '',
    description: '',
    visa_category: '',
    visa_subcategory: '',
  });
  const [formPdf, setFormPdf] = useState(null);
  const [instructionsPdf, setInstructionsPdf] = useState(null);
  
  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchVisaCategories();
  }, []);

  const fetchVisaCategories = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/visa-categories`, { headers });
      setVisaCategories(response.data);
    } catch (error) {
      console.error('Error fetching visa categories:', error);
      toast.error('Error al cargar las categorías de visa');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ 
      ...prev, 
      visa_category: value,
      visa_subcategory: '' // Reset subcategory when category changes
    }));
  };

  const handleSubcategoryChange = (value) => {
    setFormData(prev => ({ ...prev, visa_subcategory: value }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (type === 'form') {
        setFormPdf(file);
      } else {
        setInstructionsPdf(file);
      }
    } else {
      toast.error('Por favor seleccione un archivo PDF');
    }
  };

  const isTouristVisa = formData.visa_category === 'B-1/B-2';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.form_code || !formData.visa_category || !formData.visa_subcategory) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    if (!isTouristVisa && (!formPdf || !instructionsPdf)) {
      toast.error('Por favor suba ambos archivos PDF');
      return;
    }

    setLoading(true);
    
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('form_code', formData.form_code);
      submitData.append('description', formData.description || '');
      submitData.append('visa_category', formData.visa_category);
      submitData.append('visa_subcategory', formData.visa_subcategory);
      
      if (formPdf) {
        submitData.append('form_pdf', formPdf);
      }
      if (instructionsPdf) {
        submitData.append('instructions_pdf', instructionsPdf);
      }

      toast.loading('Creando plantilla y generando preguntas con IA...');
      
      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/templates`, submitData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.dismiss();
      toast.success('Plantilla creada exitosamente');
      navigate('/admin/uscis-forms');
    } catch (error) {
      toast.dismiss();
      console.error('Error creating template:', error);
      toast.error(error.response?.data?.detail || 'Error al crear la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = visaCategories[formData.visa_category];
  const subcategories = selectedCategory?.subcategories || {};
  const selectedSubcategory = subcategories[formData.visa_subcategory];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/uscis-forms')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva Plantilla de Formulario</h1>
          <p className="text-gray-400">Suba el formulario USCIS y sus instrucciones para generar un cuestionario inteligente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form Details */}
        <Card className="bg-navy-secondary border-navy-light">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold-primary" />
              Información del Formulario
            </CardTitle>
            <CardDescription className="text-gray-400">
              Ingrese los detalles del formulario USCIS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre del Formulario *</Label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Petition for Alien Worker"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Código del Formulario *</Label>
              <Input
                name="form_code"
                value={formData.form_code}
                onChange={handleInputChange}
                placeholder="Ej: I-140, I-485, DS-160"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Categoría de Visa *</Label>
              <Select value={formData.visa_category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="bg-navy-light border-navy-light text-white">
                  <SelectValue placeholder="Seleccione una categoría" />
                </SelectTrigger>
                <SelectContent className="bg-navy-secondary border-navy-light">
                  {Object.entries(visaCategories).map(([key, category]) => (
                    <SelectItem key={key} value={key} className="text-white hover:bg-navy-light">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-sm text-gray-500">{selectedCategory.description}</p>
              )}
            </div>

            {formData.visa_category && (
              <div className="space-y-2">
                <Label className="text-gray-300">Tipo de Visa *</Label>
                <Select value={formData.visa_subcategory} onValueChange={handleSubcategoryChange}>
                  <SelectTrigger className="bg-navy-light border-navy-light text-white">
                    <SelectValue placeholder="Seleccione un tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-secondary border-navy-light">
                    {Object.entries(subcategories).map(([key, sub]) => (
                      <SelectItem key={key} value={key} className="text-white hover:bg-navy-light">
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedSubcategory && (
              <div className="p-4 bg-navy-light rounded-lg border border-navy-light">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">{selectedSubcategory.special_notes}</p>
                    <div className="flex gap-3 mt-2">
                      {selectedSubcategory.self_petition && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Auto-Petición</span>
                      )}
                      {!selectedSubcategory.requires_employer && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Sin Empleador</span>
                      )}
                      {!selectedSubcategory.requires_labor_cert && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Sin Certificación Laboral</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-300">Descripción (Opcional)</Label>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descripción adicional del formulario..."
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - File Upload */}
        <Card className="bg-navy-secondary border-navy-light">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-gold-primary" />
              Archivos PDF
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isTouristVisa 
                ? 'Para visas B-1/B-2 (turismo), no se requieren PDFs. Se utilizarán las preguntas predefinidas del DS-160.'
                : 'Suba el formulario oficial de USCIS y sus instrucciones'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTouristVisa ? (
              <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-white font-medium">Formulario DS-160 Preconfigurado</p>
                    <p className="text-sm text-gray-400 mt-1">
                      El DS-160 es un formulario en línea. Se utilizarán preguntas predefinidas basadas en el formulario oficial.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Form PDF Upload */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Formulario USCIS (PDF) *</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      formPdf 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-navy-light hover:border-gold-primary'
                    }`}
                    onClick={() => document.getElementById('form-pdf').click()}
                  >
                    <input
                      id="form-pdf"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'form')}
                      className="hidden"
                    />
                    {formPdf ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                        <span className="text-green-400">{formPdf.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400">Click para subir el formulario PDF</p>
                        <p className="text-xs text-gray-500 mt-1">Ej: i-140.pdf</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Instructions PDF Upload */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Instrucciones Oficiales (PDF) *</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      instructionsPdf 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-navy-light hover:border-gold-primary'
                    }`}
                    onClick={() => document.getElementById('instructions-pdf').click()}
                  >
                    <input
                      id="instructions-pdf"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'instructions')}
                      className="hidden"
                    />
                    {instructionsPdf ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                        <span className="text-green-400">{instructionsPdf.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400">Click para subir las instrucciones PDF</p>
                        <p className="text-xs text-gray-500 mt-1">Ej: i-140instr.pdf</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div className="text-sm text-gray-400">
                      <p className="font-medium text-blue-400 mb-1">¿Dónde obtener los PDFs?</p>
                      <p>Descargue los formularios oficiales y sus instrucciones desde <a href="https://www.uscis.gov/forms" target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:underline">uscis.gov/forms</a></p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-primary hover:bg-gold-dark text-navy-primary font-medium py-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creando plantilla y generando preguntas...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mr-2" />
                  Crear Plantilla
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default USCISFormsNew;
