import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, Copy, Sparkles, Languages, Play, Scale, Edit, Check, File, Info, Search, Star, User, X, Lightbulb } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

const CreatePatentInteractive = () => {
  const [step, setStep] = useState('cv'); // cv, invention_titles, details, generating, review
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    project_description: ''
  });
  const [inventionSuggestions, setInventionSuggestions] = useState([]);
  const [patentRecommendation, setPatentRecommendation] = useState(null);
  const [selectedInvention, setSelectedInvention] = useState(null);
  const [formData, setFormData] = useState({
    invention_title: '',
    inventor_name: '',
    inventor_residence: '',
    invention_description: '',
    technical_field: '',
    mode: 'SPEC',
    language: 'es',
    client_id: null
  });
  const [patentId, setPatentId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [drawingsGenerated, setDrawingsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('text');
  const [uploadingCV, setUploadingCV] = useState(false);
  const [projectInputMode, setProjectInputMode] = useState('text'); // 'text' or 'file'
  const [uploadingProject, setUploadingProject] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('es');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Update formData with client_id when component mounts
  React.useEffect(() => {
    if (clientId && !formData.client_id) {
      setFormData(prev => ({ ...prev, client_id: clientId }));
      
      // Load client data to prefill author fields
      const loadClientData = async () => {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/clients/${clientId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const client = await response.json();
            // Prefill author name from client
            setFormData(prev => ({
              ...prev,
              author_name: client.full_name || prev.author_name
            }));
          }
        } catch (error) {
          console.error('Error loading client data:', error);
        }
      };
      
      loadClientData();
    }
  }, [clientId]);
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/patents/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setPatentId(doc.id);
            setFormData({
              invention_title: doc.invention_title || '',
              inventor_name: doc.inventor_name || '',
              inventor_residence: doc.inventor_residence || '',
              invention_description: doc.invention_description || '',
              technical_field: doc.technical_field || '',
              mode: doc.mode || 'SPEC',
              language: doc.language || 'es',
              client_id: doc.client_id || null
            });
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Patente cargada - ${doc.sections.length} secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Patente cargada - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar patente');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'patent' && draft.content) {
            if (draft.content.cvData) setCvData(draft.content.cvData);
            if (draft.content.formData) setFormData(draft.content.formData);
            if (draft.content.selectedInvention) setSelectedInvention(draft.content.selectedInvention);
            if (draft.content.step) setStep(draft.content.step);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = window.location.origin;
      
      let completion = 0;
      if (cvData.applicant_name) completion += 20;
      if (cvData.applicant_cv) completion += 30;
      if (selectedInvention || formData.invention_title) completion += 25;
      if (formData.invention_description) completion += 25;
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'patent',
          title: formData.invention_title || selectedInvention || cvData.applicant_name || 'Borrador Patent sin título',
          content: {
            cvData,
            formData,
            selectedInvention,
            inventionSuggestions,
            step
          },
          client_id: formData.client_id || clientId,
          notes: `Borrador guardado en paso: ${step}`,
          completion_percentage: completion
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Error al guardar borrador');
    }
  };

  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const PATENT_SECTIONS_EN = [
    "Header",
    "Cross-Reference to Related Applications",
    "Statement Regarding Federally Sponsored R&D",
    "Field of the Invention",
    "Background",
    "Summary",
    "Definitions",
    "Brief Description of the Drawings",
    "Detailed Description of Embodiments",
    "Claims",
    "Abstract",
    "Appendices",
    "Filing Package Checklist"
  ];

  const PATENT_SECTIONS_ES = [
    "Encabezado",
    "Referencia Cruzada a Solicitudes Relacionadas",
    "Declaración sobre I+D Patrocinada Federalmente",
    "Campo de la Invención",
    "Antecedentes",
    "Resumen",
    "Definiciones",
    "Breve Descripción de los Dibujos",
    "Descripción Detallada de las Realizaciones",
    "Reivindicaciones",
    "Abstracto",
    "Apéndices",
    "Lista de Verificación del Paquete de Presentación"
  ];

  const PATENT_SECTIONS = i18n.language === 'es' ? PATENT_SECTIONS_ES : PATENT_SECTIONS_EN;

  const handleCVPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingCV(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-cv`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setCvData({
          ...cvData,
          applicant_cv: response.data.analyzed_cv
        });
        toast.success('✅ CV analizado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingCV(false);
    }
  };
  const handleProjectFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingProject(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-project`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setCvData({
          ...cvData,
          project_description: response.data.analyzed_content
        });
        toast.success('✅ Documento analizado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingProject(false);
    }
  };

  const handleCVSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const dataWithLanguage = {
        ...cvData,
        language: i18n.language
      };
      const response = await axios.post(`${API}/patents/suggest-invention-titles`, dataWithLanguage, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setInventionSuggestions(response.data.suggestions || []);
      setPatentRecommendation(response.data.recommendation || null); // Restaurar recomendación de Monica
      setStep('invention_titles');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sugerencias');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleInventionSelection = async (invention) => {
    setSelectedInvention(invention);
    setFormData({
      invention_title: invention.title,
      inventor_name: cvData.applicant_name,
      inventor_residence: '',
      // ✅ FIXED: Only use technical invention description, NOT CV (avoids NIW biographical info in patent)
      invention_description: invention.description,
      technical_field: invention.technical_field,
      mode: 'SPEC',
      language: i18n.language,
      client_id: clientId,  // Preserve client_id from URL params
      inventor_cv: cvData.applicant_cv,  // ✅ NUEVO: Incluir CV del inventor
      project_description: cvData.project_description  // ✅ NUEVO: Incluir descripción del proyecto
    });
    setStep('details');
  };

  const handleStartPatent = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      // ✅ NUEVO: Asegurar que el CV del inventor se envíe
      const patentData = {
        ...formData,
        inventor_cv: formData.inventor_cv || cvData.applicant_cv,
        project_description: formData.project_description || cvData.project_description
      };
      const response = await axios.post(`${API}/patents/start-interactive`, patentData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPatentId(response.data.id);
      setStep('generating');
      await generateSection(response.data.id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la patente');
      setGenerating(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/patents/generate-section/${id}?section_number=${secNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setCurrentSection(response.data.section);
      setSectionNumber(secNum);
      setStep('review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const approveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⭐ FIX: Send only required fields with correct types to avoid 422 validation errors
      const sectionPayload = {
        number: currentSection.number,
        title: currentSection.title || "",
        content: currentSection.content || "",
        content_es: currentSection.content_es || "",
        content_en: currentSection.content_en || "",
        approved: Boolean(currentSection.approved),
        edit_history: Array.isArray(currentSection.edit_history) ? currentSection.edit_history : []
      };
      
      await axios.post(
        `${API}/patents/approve-section/${patentId}`,
        sectionPayload,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = currentSection;
      } else {
        updatedSections.push(currentSection);
      }
      
      setSections(updatedSections);
      
      if (sectionNumber < 13) {
        await generateSection(patentId, sectionNumber + 1);
      } else {
        toast.success('Todas las secciones completadas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
    } finally {
      setGenerating(false);
    }
  };

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/patents/edit-section/${patentId}`,
        {
          section_number: currentSection.number,
          edit_instructions: editInstructions
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = response.data.section;
        setSections(updatedSections);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Sección actualizada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 13) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(patentId, secNum);
    }
  };

  const generateDrawings = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/patents/generate-drawings/${patentId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setDrawingsGenerated(true);
      toast.success('Dibujos generados exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar dibujos');
    } finally {
      setGenerating(false);
    }
  };

  const finalizePatent = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // Si los dibujos no han sido generados, intentar generarlos primero
      if (!drawingsGenerated) {
        toast.info('Generando dibujos técnicos...');
        try {
          const drawingsResponse = await axios.post(
            `${API}/patents/generate-drawings/${patentId}`,
            {},
            { 
              headers: { 'Authorization': `Bearer ${token}` },
              timeout: 180000 // 3 minutes timeout for drawings
            }
          );
          
          if (drawingsResponse.data.success !== false) {
            setDrawingsGenerated(true);
            toast.success('Dibujos generados exitosamente');
          } else {
            // Drawings failed but continue with finalization
            toast.warning('No se pudieron generar los dibujos. Continuando con finalización...');
          }
        } catch (drawingError) {
          // Drawings failed but continue with finalization
          console.error('Drawings error:', drawingError);
          toast.warning('No se pudieron generar los dibujos. Continuando con finalización...');
        }
      }
      
      // Finalizar la patente
      console.log('Starting patent finalization...');
      toast.info('Finalizando patente...');
      
      const response = await axios.post(
        `${API}/patents/finalize/${patentId}`,
        {},
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 60000 // 1 minute timeout for finalization
        }
      );
      
      console.log('Finalization response:', response.data);
      
      // Check if response has the expected structure
      if (!response.data || !response.data.id) {
        console.error('Invalid response structure:', response.data);
        throw new Error('Respuesta inválida del servidor');
      }
      
      toast.success('¡Patente USPTO generada exitosamente!');
      
      // Navigate with a small delay to ensure toast is visible
      setTimeout(() => {
        console.log('Navigating to:', `/view-patent/${response.data.id}`);
        navigate(`/view-patent/${response.data.id}`);
      }, 500);
      
    } catch (error) {
      console.error('Finalization error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // More specific error messages
      if (error.code === 'ECONNABORTED') {
        toast.error('La operación tardó demasiado. Por favor refresca la página.');
      } else if (error.response?.status === 404) {
        toast.error('Patente no encontrada. Por favor refresca la página.');
      } else if (error.response?.status === 500) {
        toast.error('Error del servidor. La patente puede haberse generado. Refresca la página.');
      } else {
        toast.error('Error al finalizar patente. Refresca la página para verificar.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Step 1: CV/Project Input
  if (step === 'cv') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">Solicitud de Patente USPTO Provisional</h1>
            <p className="form-subtitle">
              Paso 1: Proporciona tu información técnica y el sistema sugerirá invenciones patentables
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleCVSubmit} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="applicant_name">Nombre del Inventor *</Label>
                  <Input
                    id="applicant_name"
                    value={cvData.applicant_name}
                    onChange={(e) => setCvData({ ...cvData, applicant_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="applicant_cv">Hoja de Vida / Experiencia Técnica *</Label>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={cvInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={cvInputMode === 'pdf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('pdf')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {cvInputMode === 'text' ? (
                    <Textarea
                      id="applicant_cv"
                      value={cvData.applicant_cv}
                      onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                      required
                      placeholder="Incluye: educación, experiencia técnica, investigación, publicaciones, proyectos relevantes..."
                      rows={8}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVPdfUpload}
                          className="hidden"
                          id="cv-pdf-upload"
                          disabled={uploadingCV}
                        />
                        <label 
                          htmlFor="cv-pdf-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingCV ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Analizando CV...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir tu CV (PDF, DOC o DOCX)
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.applicant_cv && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ CV Analizado
                          </p>
                          <Textarea
                            value={cvData.applicant_cv}
                            onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                            rows={6}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="project_description">Proyecto o Investigación (Opcional)</Label>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={projectInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProjectInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={projectInputMode === 'file' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProjectInputMode('file')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {projectInputMode === 'text' ? (
                    <Textarea
                      id="project_description"
                      value={cvData.project_description}
                      onChange={(e) => setCvData({ ...cvData, project_description: e.target.value })}
                      placeholder="Describe tu proyecto de investigación, innovación o tecnología que deseas patentar..."
                      rows={6}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleProjectFileUpload}
                          className="hidden"
                          id="project-file-upload"
                          disabled={uploadingProject}
                        />
                        <label 
                          htmlFor="project-file-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingProject ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Analizando documento...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir documento del proyecto (PDF, DOC o DOCX)
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.project_description && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ Documento Analizado
                          </p>
                          <Textarea
                            value={cvData.project_description}
                            onChange={(e) => setCvData({ ...cvData, project_description: e.target.value })}
                            rows={6}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSuggestions} 
                  className="submit-button"
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Generando Sugerencias...
                    </>
                  ) : (
                    <>
                      Sugerir Invenciones Patentables →
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Invention Title Selection
  if (step === 'invention_titles') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('cv')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">Selecciona una Invención para Patentar</h1>
            <p className="form-subtitle">
              Paso 2: Elige la invención que deseas desarrollar como patente USPTO
            </p>
          </div>

          {/* ⭐ Mostrar recomendación de Monica */}
          {patentRecommendation && (
            <Card className="mb-6 border-2 border-purple-300 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <span className="text-2xl">💡</span>
                  Recomendación de Monica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 italic">"{patentRecommendation.reason}"</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {inventionSuggestions.map((invention, index) => {
              // ⭐ Verificar si esta es la opción recomendada
              const isRecommended = patentRecommendation && patentRecommendation.recommended_index === index;
              
              return (
                <Card 
                  key={index} 
                  className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${
                    isRecommended ? 'border-purple-400 bg-purple-50' : 'hover:border-blue-500'
                  }`}
                  onClick={() => handleInventionSelection(invention)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">💡</span>
                      {invention.title}
                      {/* ⭐ Badge de recomendado */}
                      {isRecommended && (
                        <span className="ml-auto text-xs font-semibold px-3 py-1 bg-purple-600 text-white rounded-full">
                          ⭐ Recomendada
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      <strong>Campo Técnico:</strong> {invention.technical_field}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{invention.description}</p>
                    <Button className={`mt-4 w-full ${isRecommended ? 'bg-purple-600 hover:bg-purple-700' : ''}`} variant={isRecommended ? 'default' : 'outline'}>
                      Seleccionar esta Invención →
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Final Details
  if (step === 'details') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('invention_titles')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">{selectedInvention?.title}</h1>
            <p className="form-subtitle">
              Paso 3: Confirma los detalles y comienza la generación
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartPatent} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="invention_title">Título de la Invención *</Label>
                  <Input
                    id="invention_title"
                    value={formData.invention_title}
                    onChange={(e) => setFormData({ ...formData, invention_title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="inventor_name">Nombre del Inventor *</Label>
                  <Input
                    id="inventor_name"
                    value={formData.inventor_name}
                    onChange={(e) => setFormData({ ...formData, inventor_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="inventor_residence">Residencia del Inventor *</Label>
                  <Input
                    id="inventor_residence"
                    value={formData.inventor_residence}
                    onChange={(e) => setFormData({ ...formData, inventor_residence: e.target.value })}
                    required
                    placeholder="San Francisco, California, USA"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="technical_field">Campo Técnico</Label>
                  <Input
                    id="technical_field"
                    value={formData.technical_field}
                    onChange={(e) => setFormData({ ...formData, technical_field: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <Button 
                    type="button"
                    onClick={saveDraft}
                    variant="outline"
                    disabled={generating}
                    style={{ flex: 1 }}
                  >
                    <Save className="mr-2" size={18} />
                    Guardar Borrador
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generating} 
                    className="submit-button"
                    style={{ flex: 1 }}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Iniciando Generación...
                      </>
                    ) : (
                      <>
                        Generar Patente USPTO →
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Review Section
  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 13
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {/* Section Navigation */}
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 13 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => goToSection(num)}
                disabled={num > sections.length + 1}
                title={PATENT_SECTIONS[num - 1]}
                className={`px-3 py-2 rounded text-xs ${
                  num === sectionNumber 
                    ? 'bg-black text-white' 
                    : num <= sections.length 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {currentSection.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentSection.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentSection.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Problemas detectados:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {(currentSection.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                </div>
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentSection.validation_warning.metrics.character_count || 'N/A'} (requerido: {currentSection.validation_warning.metrics.required_range || '2500-3000'})</li>
                      <li style={{ color: '#5d4037' }}>📝 Estructura técnica: {currentSection.validation_warning.metrics.has_conclusion ? '✓ Adecuada' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Claridad: {currentSection.validation_warning.metrics.has_repetition ? '❌ Contiene repeticiones' : '✓ Clara'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Esta sección pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Sección aprobada en intento {currentSection.evaluation_history.length}
                  </p>
                </div>
                {currentSection.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentSection.content.length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura técnica: ✓ Adecuada para USPTO</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Esta sección está lista para continuar o puedes editarla para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Sección {sectionNumber} de 13</CardTitle>
                  <CardDescription>{currentSection.title}</CardDescription>
                </div>
                {!editMode && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                  }}>
                    <span style={{ 
                      fontWeight: currentLanguage === 'es' ? 'bold' : 'normal',
                      color: currentLanguage === 'es' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇪🇸 Español
                    </span>
                    
                    <button
                      onClick={() => {
                        const newLang = currentLanguage === 'es' ? 'en' : 'es';
                        setCurrentLanguage(newLang);
                        
                        // ⭐ En CreatePatentInteractive no mostramos toast
                        // Las secciones se generan bilingües automáticamente desde el backend
                        // No necesitamos "Generar Traducción" manualmente
                        
                        console.log('🌐 Idioma cambiado a:', newLang);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.4rem 1.2rem',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                      }}
                    >
                      <Globe size={14} className="inline mr-1" />
                      {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
                    </button>
                    
                    <span style={{ 
                      fontWeight: currentLanguage === 'en' ? 'bold' : 'normal',
                      color: currentLanguage === 'en' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇺🇸 English
                    </span>
                  </div>
                )}
              </div>
              {!editMode && (
                <p className="text-sm text-gray-500 mt-2">
                  {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: currentLanguage === 'es'
                    ? (currentSection.content_es || currentSection.content || '')
                    : (currentSection.content_en || currentSection.content || '')
                }}
                style={{
                  lineHeight: '1.6',
                  color: '#333'
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 1.5rem;
                  margin-bottom: 1rem;
                  color: #000;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={approveSection}
                disabled={generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más detalles técnicos sobre la implementación del sistema. Incluye diagramas de flujo adicionales. Fortalece la descripción de los componentes.'"
                  rows={5}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={editSection}
                    disabled={generating || !editInstructions.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finalization (only for section 13) */}
          {sectionNumber === 13 && !editMode && (
            <div className="mt-6">
              <Button
                onClick={finalizePatent}
                disabled={generating}
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    {drawingsGenerated ? 'Finalizando...' : 'Generando dibujos y finalizando...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" size={18} />
                    Generar Dibujos y Finalizar Patente
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-500 text-center mt-2">
                Se generarán automáticamente 7 dibujos técnicos (FIG. 1-7) antes de finalizar
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="create-container">
      <div className="loading-state">
        <Loader2 className="animate-spin" size={48} />
        <p className="mt-4">Generando especificación USPTO...</p>
      </div>
    </div>
  );
};



export default CreatePatentInteractive;
