import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, Copy, Sparkles, Languages, Play, Edit, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

const CreateWhitepaperInteractive = () => {
  const [step, setStep] = useState('details'); // details, generating, review, generation-started
  const [formData, setFormData] = useState({
    project_title: '',
    author_name: '',
    author_credentials: '',
    project_description: '',
    target_audience: '',
    technical_domain: '',
    language: 'es',
    client_id: null
  });
  const [whitepaperId, setWhitepaperId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingProject, setUploadingProject] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('upload'); // 'text' or 'upload'
  const [projectInputMode, setProjectInputMode] = useState('upload'); // 'text' or 'upload'
  const [cvUploaded, setCvUploaded] = useState(false);
  const [projectUploaded, setProjectUploaded] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(10);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Update formData with client_id when component mounts
  React.useEffect(() => {
    console.log('🔍 WhitePaper - clientId from URL:', clientId);
    
    if (clientId) {
      // Load client data to prefill author fields
      const loadClientData = async () => {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          console.log('📡 Loading client data from:', `${BACKEND_URL}/api/clients/${clientId}`);
          
          const response = await fetch(`${BACKEND_URL}/api/clients/${clientId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const client = await response.json();
            console.log('✅ Client data loaded:', client);
            console.log('👤 Setting author name to:', client.name); // Changed from full_name to name
            
            // Prefill author name and client_id from client
            setFormData(prev => ({
              ...prev,
              client_id: clientId,
              author_name: client.name || prev.author_name // Changed from full_name to name
            }));
          } else {
            console.error('❌ Failed to load client:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('❌ Error loading client data:', error);
        }
      };
      
      loadClientData();
    } else {
      console.log('⚠️ No clientId found in URL');
    }
  }, []); // Empty dependency array - run once on mount
  
  // Load in-progress document on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/whitepapers/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setWhitepaperId(doc.id);
            setFormData({
              project_title: doc.project_title || '',
              author_name: doc.author_name || '',
              author_credentials: doc.author_credentials || '',
              project_description: doc.project_description || '',
              target_audience: doc.target_audience || '',
              technical_domain: doc.technical_domain || '',
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
              toast.success(`White Paper cargado - ${doc.sections.length} secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('White Paper cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar white paper');
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);

  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };
  
  // ⭐ Handle CV upload and extract author information + technical domain
  const handleCVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadingCV(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      
      const token = localStorage.getItem('token');
      const API = window.location.origin;
      const response = await axios.post(
        `${API}/api/whitepapers/extract-cv-info`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // If response has task_id, poll for completion (background task)
      if (response.data.task_id) {
        const taskId = response.data.task_id;
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(
              `${API}/api/whitepapers/extraction-status/${taskId}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (statusRes.data.status === 'completed' && statusRes.data.result) {
              clearInterval(pollInterval);
              setFormData(prev => ({
                ...prev,
                author_credentials: statusRes.data.result.author_credentials || prev.author_credentials,
                technical_domain: statusRes.data.result.technical_domain || prev.technical_domain
              }));
              setCvUploaded(true);
              setUploadingCV(false);
              toast.success('CV procesado exitosamente');
            } else if (statusRes.data.status === 'failed') {
              clearInterval(pollInterval);
              setUploadingCV(false);
              toast.error('Error al procesar el CV: ' + (statusRes.data.error || 'Error desconocido'));
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
          }
        }, 3000);
      } else {
        // Direct response (backward compatibility)
        setFormData(prev => ({
          ...prev,
          author_credentials: response.data.author_credentials || prev.author_credentials,
          technical_domain: response.data.technical_domain || prev.technical_domain
        }));
        setCvUploaded(true);
        setUploadingCV(false);
        toast.success('CV procesado exitosamente');
      }
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast.error('Error al procesar el CV');
      setUploadingCV(false);
    }
  };
  
  // ⭐ Handle project document upload and extract project information
  const handleProjectUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadingProject(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      
      const token = localStorage.getItem('token');
      const API = window.location.origin;
      const response = await axios.post(
        `${API}/api/whitepapers/extract-project-info`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // If response has task_id, poll for completion (background task)
      if (response.data.task_id) {
        const taskId = response.data.task_id;
        let pollCount = 0;
        const MAX_POLLS = 30; // 30 × 3s = 90 seconds max
        const pollInterval = setInterval(async () => {
          pollCount++;
          // Timeout after 90 seconds — switch to manual text mode
          if (pollCount > MAX_POLLS) {
            clearInterval(pollInterval);
            setUploadingProject(false);
            setProjectInputMode('text');
            toast.error('El procesamiento tardó demasiado. Por favor, escribe la descripción del proyecto manualmente.');
            return;
          }
          try {
            const statusRes = await axios.get(
              `${API}/api/whitepapers/extraction-status/${taskId}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (statusRes.data.status === 'completed' && statusRes.data.result) {
              clearInterval(pollInterval);
              const extractedDesc = statusRes.data.result.project_description;
              if (!extractedDesc || extractedDesc.trim().length < 10) {
                // Extraction failed to get description - switch to text mode so user can type manually
                setProjectInputMode('text');
                setUploadingProject(false);
                toast.error('No se pudo extraer automáticamente la descripción. Por favor, escríbela manualmente en el campo de texto.');
                return;
              }
              setFormData(prev => ({
                ...prev,
                project_title: statusRes.data.result.project_title || prev.project_title,
                project_description: extractedDesc,
                target_audience: statusRes.data.result.target_audience || prev.target_audience
              }));
              setProjectUploaded(true);
              setUploadingProject(false);
              toast.success('Documento del proyecto procesado exitosamente');
            } else if (statusRes.data.status === 'failed') {
              clearInterval(pollInterval);
              setUploadingProject(false);
              toast.error('Error al procesar el documento: ' + (statusRes.data.error || 'Error desconocido'));
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
          }
        }, 3000);
      } else {
        // Direct response (backward compatibility)
        const extractedDesc = response.data.project_description;
        if (!extractedDesc || extractedDesc.trim().length < 10) {
          setProjectInputMode('text');
          setUploadingProject(false);
          toast.error('No se pudo extraer automáticamente la descripción. Por favor, escríbela manualmente.');
          return;
        }
        setFormData(prev => ({
          ...prev,
          project_title: response.data.project_title || prev.project_title,
          project_description: extractedDesc,
          target_audience: response.data.target_audience || prev.target_audience
        }));
        setProjectUploaded(true);
        setUploadingProject(false);
        toast.success('Documento del proyecto procesado exitosamente');
      }
    } catch (error) {
      console.error('Error uploading project document:', error);
      toast.error('Error al procesar el documento del proyecto');
      setUploadingProject(false);
    }
  };

  const WHITEPAPER_SECTIONS_EN = [
    "Executive Summary",
    "Context and Problem",
    "Target Audience and Use Cases",
    "State of the Art and Gap Analysis",
    "Requirements and Assumptions",
    "Architecture / Solution Design",
    "Implementation Methodology",
    "Evaluation and Metrics",
    "Results and Analysis",
    "Security, Privacy and Compliance",
    "Reliability, Scalability and Costs",
    "Risks, Limitations and Mitigation",
    "Roadmap",
    "Conclusions and Recommendations",
    "References",
    "Appendices"
  ];

  const WHITEPAPER_SECTIONS_ES = [
    "Resumen Ejecutivo",
    "Contexto y Problema",
    "Audiencia Objetivo y Casos de Uso",
    "Estado del Arte y Análisis de Brechas",
    "Requisitos y Supuestos",
    "Arquitectura / Diseño de Solución",
    "Metodología de Implementación",
    "Evaluación y Métricas",
    "Resultados y Análisis",
    "Seguridad, Privacidad y Cumplimiento",
    "Confiabilidad, Escalabilidad y Costos",
    "Riesgos, Limitaciones y Mitigación",
    "Hoja de Ruta",
    "Conclusiones y Recomendaciones",
    "Referencias",
    "Apéndices"
  ];

  const WHITEPAPER_SECTIONS = i18n.language === 'es' ? WHITEPAPER_SECTIONS_ES : WHITEPAPER_SECTIONS_EN;

  const handleStartWhitepaper = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (generating) {
      return;
    }

    // Validate project description is filled — only when user is in manual text mode.
    // In upload mode, `projectUploaded=true` confirms the document was processed
    // by the backend (even if the LLM extraction produced a short/empty preview,
    // the full document text is stored server-side via the extraction task).
    if (projectInputMode === 'text') {
      if (!formData.project_description || formData.project_description.trim().length < 10) {
        toast.error('La descripción del proyecto es requerida. Por favor sube el documento del proyecto o escríbela manualmente.');
        return;
      }
    } else if (projectInputMode === 'upload' && !projectUploaded) {
      toast.error('Por favor espera a que termine de subirse y procesarse el documento del proyecto.');
      return;
    }

    // Validate author credentials — same logic
    if (cvInputMode === 'text') {
      if (!formData.author_credentials || formData.author_credentials.trim().length < 10) {
        toast.error('La hoja de vida / credenciales del autor son requeridas. Por favor sube el CV o escríbelas manualmente.');
        return;
      }
    } else if (cvInputMode === 'upload' && !cvUploaded) {
      toast.error('Por favor espera a que termine de subirse y procesarse el CV.');
      return;
    }
    
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      
      // Step 1: Create whitepaper
      const createResponse = await axios.post(`${API}/whitepapers/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const whitepaperId = createResponse.data.whitepaper_id;
      setWhitepaperId(whitepaperId);
      
      // Step 2: Start complete generation in background
      const generateResponse = await axios.post(
        `${API}/whitepapers/${whitepaperId}/generate-complete`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // Step 3: Show generation started screen for 10 seconds
      setStep('generation-started');
      setGenerating(false);
      
      // Start countdown and redirect after 10 seconds
      let countdown = 10;
      const countdownInterval = setInterval(() => {
        countdown -= 1;
        setRedirectCountdown(countdown);
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          // Redirect to client dashboard
          if (formData.client_id) {
            navigate(`/client-dashboard/${formData.client_id}`);
          } else {
            navigate('/dashboard');
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al iniciar el white paper');
      setGenerating(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/generate-section/${id}`,
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

  const regenerateSection = async () => {
    if (!whitepaperId || !currentSection) {
      toast.error('No hay sección para regenerar');
      return;
    }
    
    setGenerating(true);
    
    // Show appropriate toast based on validation status
    if (currentSection.validation_warning) {
      toast.info('🔄 Regenerando sección con correcciones del evaluador IA...');
    } else {
      toast.info('🔄 Regenerando sección...');
    }
    
    try {
      const token = localStorage.getItem('token');
      
      // Call backend endpoint to regenerate the section
      // The backend will automatically use evaluation feedback if available
      const response = await axios.post(
        `${API}/whitepapers/regenerate-section/${whitepaperId}`,
        { 
          section_number: currentSection.number,
          previous_evaluation: currentSection.evaluation_history || []
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // Update current section with the regenerated content
      setCurrentSection(response.data.section);
      
      // Show success message based on evaluation result
      if (response.data.section.validation_warning) {
        toast.warning('⚠️ Sección regenerada, pero aún requiere mejoras. Revisa la evaluación.');
      } else {
        toast.success('✅ Sección regenerada exitosamente y aprobada por el evaluador IA');
      }
    } catch (error) {
      console.error('Error regenerating section:', error);
      toast.error('Error al regenerar la sección');
    } finally {
      setGenerating(false);
    }
  };

  const approveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/approve-section/${whitepaperId}`,
        currentSection,
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
      
      // Check if backend auto-finalized the whitepaper
      if (response.data.finalized && response.data.finalized_id) {
        toast.success('🎉 ¡White Paper técnico generado exitosamente!');
        // Navigate to the finalized whitepaper view
        navigate(`/view-whitepaper/${response.data.finalized_id}`);
        return;
      }
      
      if (sectionNumber < 16) {
        // Generate next section
        await generateSection(whitepaperId, sectionNumber + 1);
      } else {
        toast.success('✅ Todas las 9 secciones completadas.');
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
        `${API}/whitepapers/edit-section/${whitepaperId}`,
        {
          section_number: currentSection.number,
          current_section_title: currentSection.title,
          current_section_content: currentSection.content,
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
    if (secNum < 1 || secNum > 16) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(whitepaperId, secNum);
    }
  };

  const finalizeWhitepaper = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/finalize/${whitepaperId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡White Paper técnico generado exitosamente!');
      
      // Navigate to the finalized whitepaper view
      const finalizedId = response.data.id;
      navigate(`/view-whitepaper/${finalizedId}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar white paper');
    } finally {
      setGenerating(false);
    }
  };

  // Step 1: Project Details
  if (step === 'details') {
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Technical White Paper</h1>
            <p className="form-subtitle">
              Crea un documento técnico profesional de 9 secciones con estructura legal NIW (Dhanasar 3-prong)
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartWhitepaper} className="form-grid">
                {/* 1. Author Name - Pre-filled from Client */}
                <div className="form-field full-width">
                  <Label htmlFor="author_name">
                    Nombre del Autor * 
                    {clientId && formData.author_name && (
                      <span style={{ marginLeft: '8px', fontSize: '0.875rem', color: '#28a745', fontWeight: 'normal' }}>
                        ✓ Pre-cargado del cliente
                      </span>
                    )}
                  </Label>
                  <Input
                    id="author_name"
                    value={formData.author_name}
                    onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                    required
                    placeholder="Nombre del autor"
                    readOnly={clientId && formData.author_name}
                    style={clientId && formData.author_name ? { backgroundColor: '#d4edda', borderColor: '#28a745', cursor: 'not-allowed' } : {}}
                  />
                  {clientId && formData.author_name && (
                    <p style={{ fontSize: '0.875rem', color: '#28a745', marginTop: '4px' }}>
                      Este campo se precarga automáticamente con el nombre del cliente
                    </p>
                  )}
                </div>

                {/* 2. CV / Technical Experience - REQUIRED */}
                <div className="form-field full-width">
                  <Label>Hoja de Vida / Experiencia Técnica *</Label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '12px' }}>
                    <Button
                      type="button"
                      variant={cvInputMode === 'text' ? 'default' : 'outline'}
                      onClick={() => setCvInputMode('text')}
                      style={{ flex: 1 }}
                    >
                      <Edit size={16} style={{ marginRight: '8px' }} />
                      Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={cvInputMode === 'upload' ? 'default' : 'outline'}
                      onClick={() => setCvInputMode('upload')}
                      style={{ flex: 1 }}
                    >
                      <Upload size={16} style={{ marginRight: '8px' }} />
                      Subir Documento
                    </Button>
                  </div>

                  {cvInputMode === 'text' && (
                    <Textarea
                      value={formData.author_credentials}
                      onChange={(e) => setFormData({ ...formData, author_credentials: e.target.value })}
                      placeholder="Incluye: educación, experiencia técnica, investigación, publicaciones, proyectos relevantes..."
                      rows={6}
                      required
                    />
                  )}

                  {cvInputMode === 'upload' && (
                    <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px dashed #dee2e6', textAlign: 'center' }}>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleCVUpload}
                        style={{ display: 'none' }}
                        id="cv-upload-input"
                        required={!cvUploaded}
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('cv-upload-input').click()}
                        disabled={uploadingCV}
                        variant="outline"
                        size="lg"
                      >
                        {uploadingCV ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={20} />
                            Procesando CV...
                          </>
                        ) : cvUploaded ? (
                          <>
                            <Check className="mr-2" size={20} style={{ color: '#28a745' }} />
                            CV Subido Exitosamente
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2" size={20} />
                            Seleccionar Archivo CV
                          </>
                        )}
                      </Button>
                      <p style={{ marginTop: '12px', fontSize: '0.875rem', color: '#6c757d' }}>
                        Formatos aceptados: PDF, DOC, DOCX, TXT
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Project / Investigation - REQUIRED */}
                <div className="form-field full-width">
                  <Label>Proyecto o Investigación *</Label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '12px' }}>
                    <Button
                      type="button"
                      variant={projectInputMode === 'text' ? 'default' : 'outline'}
                      onClick={() => setProjectInputMode('text')}
                      style={{ flex: 1 }}
                    >
                      <Edit size={16} style={{ marginRight: '8px' }} />
                      Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={projectInputMode === 'upload' ? 'default' : 'outline'}
                      onClick={() => setProjectInputMode('upload')}
                      style={{ flex: 1 }}
                    >
                      <Upload size={16} style={{ marginRight: '8px' }} />
                      Subir Documento
                    </Button>
                  </div>

                  {projectInputMode === 'text' && (
                    <Textarea
                      value={formData.project_description}
                      onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                      placeholder="Describe tu proyecto de investigación, innovación o tecnología que deseas documentar en el white paper..."
                      rows={8}
                      required
                    />
                  )}

                  {projectInputMode === 'upload' && (
                    <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px dashed #dee2e6', textAlign: 'center' }}>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleProjectUpload}
                        style={{ display: 'none' }}
                        id="project-upload-input"
                        required={!projectUploaded}
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('project-upload-input').click()}
                        disabled={uploadingProject}
                        variant="outline"
                        size="lg"
                      >
                        {uploadingProject ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={20} />
                            Procesando Documento...
                          </>
                        ) : projectUploaded ? (
                          <>
                            <Check className="mr-2" size={20} style={{ color: '#28a745' }} />
                            Documento Subido Exitosamente
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2" size={20} />
                            Seleccionar Documento del Proyecto
                          </>
                        )}
                      </Button>
                      <p style={{ marginTop: '12px', fontSize: '0.875rem', color: '#6c757d' }}>
                        Formatos aceptados: PDF, DOC, DOCX, TXT
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={generating || (cvInputMode === 'upload' && !cvUploaded) || (projectInputMode === 'upload' && !projectUploaded)} 
                  className="submit-button"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Iniciando Generación...
                    </>
                  ) : (
                    <>
                      Generar White Paper Técnico →
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

  // Step: Generation Started - Show intermediate screen
  if (step === 'generation-started') {
    return (
      <div className="dashboard-container">
        <main className="dashboard-main" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          backgroundColor: '#f8f9fa'
        }}>
          <Card style={{ 
            maxWidth: '700px', 
            width: '100%', 
            textAlign: 'center', 
            padding: '4rem 3rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                margin: '0 auto 1.5rem',
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Check size={48} style={{ color: 'white' }} />
              </div>
              <h2 style={{ 
                fontSize: '2rem', 
                fontWeight: '700', 
                marginBottom: '1rem',
                color: '#1f2937'
              }}>
                ✅ White Paper en Proceso
              </h2>
              <p style={{ 
                color: '#4b5563', 
                fontSize: '1.2rem', 
                lineHeight: '1.8',
                marginBottom: '2rem'
              }}>
                Tu white paper se está generando en segundo plano.<br />
                Este proceso puede tomar de <strong>10 a 15 minutos</strong>.
              </p>
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem'
              }}>
                <p style={{ 
                  color: '#1e40af', 
                  fontSize: '1.1rem',
                  fontWeight: '500',
                  margin: 0
                }}>
                  💡 Puedes continuar redactando otros documentos mientras esperas
                </p>
              </div>
              <div style={{ 
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <p style={{ 
                  fontSize: '1rem', 
                  color: '#6b7280',
                  marginBottom: '0.5rem'
                }}>
                  Redirigiendo al dashboard en:
                </p>
                <div style={{ 
                  fontSize: '3rem', 
                  fontWeight: '700',
                  color: '#3b82f6',
                  lineHeight: '1'
                }}>
                  {redirectCountdown}
                </div>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#9ca3af',
                  marginTop: '0.5rem'
                }}>
                  segundos
                </p>
              </div>
              <Button 
                onClick={() => {
                  if (formData.client_id) {
                    navigate(`/client-dashboard/${formData.client_id}`);
                  } else {
                    navigate('/dashboard');
                  }
                }}
                style={{ marginTop: '1.5rem' }}
                size="lg"
              >
                Ir al Dashboard Ahora
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Step 2: Generating Section (Loading State)
  if (step === 'generating') {
    return (
      <div className="create-container">
        <div className="create-content">
          <Card className="text-center py-12">
            <CardContent>
              <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={64} />
              <h2 className="text-2xl font-bold mb-2">
                Generando Sección {sectionNumber} de 16
              </h2>
              <p className="text-gray-600 mb-4">
                {WHITEPAPER_SECTIONS[sectionNumber - 1]}
              </p>
              <p className="text-sm text-gray-500">
                Esto puede tomar 30-90 segundos por sección...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Review Section
  if (step === 'review' && currentSection) {
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">{formData.project_title}</h1>
            <p className="form-subtitle">
              Sección {sectionNumber} de 16: {currentSection.title}
            </p>
          </div>

          {/* Section Navigation Bar */}
          <div className="mb-6 flex flex-wrap gap-2">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => {
              const isCompleted = sections.some(s => s.number === num);
              const isCurrent = num === sectionNumber;
              return (
                <button
                  key={num}
                  onClick={() => goToSection(num)}
                  disabled={!isCompleted && num !== sections.length + 1}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Evaluation Warning Card */}
          {currentSection.validation_warning && (
            <Card className="mb-6" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertCircle className="text-orange-600" size={24} />
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
                    {currentSection.validation_warning.issues && currentSection.validation_warning.issues.map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                {currentSection.validation_warning.feedback && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                    <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                  </div>
                )}
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentSection.validation_warning.metrics.character_count} (requerido: {currentSection.validation_warning.metrics.required_range})</li>
                      <li style={{ color: '#5d4037' }}>📝 Profundidad técnica: {currentSection.validation_warning.metrics.has_technical_depth ? '✓ Adecuada' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Estructura: {currentSection.validation_warning.metrics.has_proper_structure ? '✓ Correcta' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>📚 Evidencia: {currentSection.validation_warning.metrics.has_evidence ? '✓ Presente' : '❌ Falta'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Evaluation Card - show when section passed evaluation */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-6" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle className="text-green-600" size={24} />
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
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                  <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                    <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentSection.content.length} (cumple estándares técnicos)</li>
                    <li style={{ color: '#4caf50' }}>📝 Profundidad técnica: ✓ Adecuada para white paper profesional</li>
                    <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                  </ul>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Esta sección está lista para continuar o puedes editarla para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="pt-6">
              {/* Section Content */}
              <div className="prose max-w-none">
                <h2 className="text-2xl font-bold mb-4">{currentSection.title}</h2>
                <div 
                  className="text-gray-700 leading-relaxed"
                  style={{
                    overflowX: 'auto',
                    overflowY: 'visible'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: currentSection.content.replace(/\n/g, '<br />') 
                  }}
                />
              </div>

              {/* Edit Mode */}
              {editMode && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                  <Label htmlFor="edit_instructions" className="font-semibold mb-2 block">
                    Editar Sección {sectionNumber}
                  </Label>
                  
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
                    id="edit_instructions"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="Ej: Agrega más métricas específicas y referencias técnicas..."
                    rows={4}
                    className="mb-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMode(false);
                        setEditInstructions('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={editSection}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          Aplicando Cambios...
                        </>
                      ) : (
                        'Aplicar Cambios'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!editMode && (
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(true)}
                      disabled={generating}
                    >
                      <Edit className="mr-2" size={16} />
                      Editar Sección
                    </Button>
                    <Button
                      variant="outline"
                      onClick={regenerateSection}
                      disabled={generating}
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          Regenerando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2" size={16} />
                          Regenerar Sección
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={approveSection}
                      disabled={generating}
                      className="flex-1"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          {sectionNumber < 16 ? 'Generando siguiente...' : 'Procesando...'}
                        </>
                      ) : (
                        <>
                          {sectionNumber < 16 ? 'Aprobar y Continuar →' : 'Aprobar Sección Final'}
                        </>
                      )}
                    </Button>
                  </div>
                  {/* Show regeneration hint when validation warning present */}
                  {currentSection.validation_warning && (
                    <div className="text-sm text-orange-600 bg-orange-50 px-4 py-2 rounded border border-orange-200">
                      <strong>💡 Sugerencia:</strong> Esta sección no pasó la evaluación de calidad. Usa el botón "Regenerar Sección" para que el evaluador IA intente mejorarla automáticamente.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================================
// END CREATE WHITEPAPER INTERACTIVE COMPONENT
// ============================================================================

// View Patent Component

export default CreateWhitepaperInteractive;
 CreateWhitepaperInteractive;
