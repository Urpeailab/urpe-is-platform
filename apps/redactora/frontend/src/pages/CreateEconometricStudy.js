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
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, Copy, Sparkles, Languages, Play, TrendingUp, Edit, File, Info, Search, Star, User, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

const CreateEconometricStudy = () => {
  const [step, setStep] = useState('input'); // input, generating, review
  const [projectDescription, setProjectDescription] = useState('');
  const [inputMode, setInputMode] = useState('text'); // text or file
  const [uploading, setUploading] = useState(false);
  const [studyId, setStudyId] = useState(null);
  const [studyTitle, setStudyTitle] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [redirecting, setRedirecting] = useState(false); // NEW: Track redirection state
  const [redirectCountdown, setRedirectCountdown] = useState(10); // NEW: Countdown timer (10 seconds)
  const [generationProgress, setGenerationProgress] = useState(0); // NEW: Real progress from backend
  const [generationStatus, setGenerationStatus] = useState(''); // NEW: Status message
  const [coherenceEvaluation, setCoherenceEvaluation] = useState(null); // NEW: Coherence evaluation result
  const [generationComplete, setGenerationComplete] = useState(false); // NEW: Track if generation is complete
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Get resume_id and client_id from URL params BEFORE useEffect
  const searchParams = new URLSearchParams(window.location.search);
  const resumeId = searchParams.get('resume_id');
  const clientId = searchParams.get('client_id');

  // Simple effect to handle countdown and redirect
  React.useEffect(() => {
    if (!redirecting) return;
    
    let timeLeft = 10;
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      setRedirectCountdown(timeLeft);
      
      // When countdown reaches 0, redirect using window.location
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        // Use window.location instead of navigate() - avoids React router conflicts
        window.location.href = `/client-dashboard/${clientId}`;
      }
    }, 1000);
    
    // Cleanup
    return () => clearInterval(countdownInterval);
  }, [redirecting, clientId]);

  const ECONOMETRIC_SECTIONS_EN = [
    "Cover Page & Executive Summary",
    "Introduction & Research Questions",
    "Conceptual Framework & Mechanisms",
    "National Context & Relevance",
    "Data & Sources",
    "Empirical Design & Identification",
    "Specifications & Estimation Methods",
    "Robustness & Validation",
    "Main Results",
    "Simulations & Projections",
    "Cost–Benefit Analysis (CBA)",
    "Policy Implications",
    "Limitations",
    "Conclusions",
    "Phases & Deliverables Plan",
    "Technical Appendices"
  ];

  const ECONOMETRIC_SECTIONS_ES = [
    "Portada y Resumen Ejecutivo",
    "Introducción y Preguntas de Investigación",
    "Fundamento Conceptual y Mecanismos",
    "Contexto Nacional y Relevancia",
    "Datos y Fuentes",
    "Diseño Empírico e Identificación",
    "Especificaciones y Métodos de Estimación",
    "Validaciones y Robustez",
    "Resultados Principales",
    "Simulación y Proyecciones",
    "Análisis Costo–Beneficio (CBA)",
    "Implicaciones de Política",
    "Limitaciones",
    "Conclusiones",
    "Plan de Fases y Entregables",
    "Apéndices Técnicos"
  ];

  const ECONOMETRIC_SECTIONS = i18n.language === 'es' ? ECONOMETRIC_SECTIONS_ES : ECONOMETRIC_SECTIONS_EN;

  // Validate client_id is present (required for creating studies)
  if (!clientId && !resumeId) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2" size={18} />
            {t('back_to_dashboard') || 'Volver al Dashboard'}
          </Button>
        </div>
        <div className="create-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-red-600">
                <AlertCircle className="inline mr-2" size={28} />
                {i18n.language === 'es' ? 'Error: Cliente Requerido' : 'Error: Client Required'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                {i18n.language === 'es' 
                  ? 'Los estudios econométricos deben ser creados desde la página de un cliente específico.'
                  : 'Econometric studies must be created from a specific client page.'}
              </p>
              <p className="text-gray-600 mb-6">
                {i18n.language === 'es'
                  ? 'Por favor, navega al cliente para el cual deseas crear el estudio y selecciona "Estudios Econométricos".'
                  : 'Please navigate to the client for which you want to create the study and select "Econometric Studies".'}
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                {i18n.language === 'es' ? 'Ir al Dashboard' : 'Go to Dashboard'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/econometric-studies/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setStudyId(doc.id);
            setStudyTitle(doc.study_title || '');
            setApplicantName(doc.applicant_name || '');
            setProjectDescription(doc.project_description || '');
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Estudio cargado - ${doc.sections.length}/16 secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Estudio cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar estudio');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'econometric_study' && draft.content) {
            // Load draft data into form
            if (draft.content.projectDescription) setProjectDescription(draft.content.projectDescription);
            if (draft.content.studyTitle) setStudyTitle(draft.content.studyTitle);
            if (draft.content.applicantName) setApplicantName(draft.content.applicantName);
            if (draft.content.inputMode) setInputMode(draft.content.inputMode);
            if (draft.content.step) setStep(draft.content.step);
            if (draft.content.sectionNumber) setSectionNumber(draft.content.sectionNumber);
            if (draft.content.sections) setSections(draft.content.sections);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedExtensions = ['.pdf', '.docx', '.doc'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      e.target.value = '';
      return;
    }

    // Validar tamaño (20MB max)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('El archivo es demasiado grande. Máximo 20MB.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    toast.info('📄 Extrayendo texto del documento con código...');
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/econometric-studies/upload-document`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const extractedText = response.data.extracted_text || '';
        const method = response.data.extraction_method;
        
        setProjectDescription(extractedText);
        
        const methodText = method === 'code_extraction' 
          ? '✅ Extracción directa con código' 
          : '⚠️ Extracción con IA (fallback)';
        
        toast.success(
          `${methodText}\n${response.data.text_length.toLocaleString()} caracteres extraídos`,
          { duration: 5000 }
        );
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(
        error.response?.data?.detail || 
        'Error al cargar el archivo. Verifica que contenga texto seleccionable.'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleStartStudy = async (e) => {
    e.preventDefault();
    
    // Validate client_id is present
    if (!clientId) {
      toast.error(i18n.language === 'es' 
        ? 'Error: Debe crear el estudio desde la página de un cliente específico' 
        : 'Error: Study must be created from a specific client page');
      return;
    }
    
    setGenerating(true);
    setStep('generating');

    try {
      const token = localStorage.getItem('token');
      const studyData = {
        project_description: projectDescription,
        language: i18n.language,
        client_id: clientId  // Required client association
      };
      
      // Step 1: Create the study
      const createResponse = await axios.post(`${API}/econometric-studies/start`, studyData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const newStudyId = createResponse.data.study_id;
      setStudyId(newStudyId);
      setStudyTitle(createResponse.data.study_title || 'Estudio Econométrico');
      setApplicantName(createResponse.data.applicant_name || 'Investigador');
      
      // Show initial message
      toast.info(i18n.language === 'es' 
        ? '🚀 Iniciando generación del estudio... (5-10 minutos)' 
        : '🚀 Starting study generation... (5-10 minutes)', 
        { duration: 5000 }
      );
      
      // Step 2: Start generation (returns immediately, runs in background)
      const generateResponse = await axios.post(
        `${API}/econometric-studies/${newStudyId}/generate-complete-v2`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (generateResponse.data.success) {
        // Start polling for progress
        setGenerationStatus('Iniciando generación...');
        
        // Poll for progress every 3 seconds
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await axios.get(
              `${API}/econometric-studies/${newStudyId}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            const studyData = statusResponse.data;
            const progress = studyData.progress || 0;
            const currentSec = studyData.current_section || 1;
            const status = studyData.status || 'generating';
            
            setGenerationProgress(progress);
            setSectionNumber(currentSec);
            
            // Update status message
            if (progress < 10) {
              setGenerationStatus('Analizando datos del proyecto...');
            } else if (progress < 30) {
              setGenerationStatus('Generando marco conceptual...');
            } else if (progress < 50) {
              setGenerationStatus('Desarrollando modelos econométricos...');
            } else if (progress < 70) {
              setGenerationStatus('Calculando proyecciones...');
            } else if (progress < 90) {
              setGenerationStatus('Finalizando análisis...');
            } else {
              setGenerationStatus('Preparando documento final...');
            }
            
            // Check if generation is complete
            if (status === 'generation_complete' || progress >= 100 || studyData.sections?.length >= 16) {
              clearInterval(pollInterval);
              setGenerationProgress(100);
              setGenerationStatus('¡Generación completada!');
              setGenerating(false);
              setGenerationComplete(true);
              
              // Store coherence evaluation if available
              if (studyData.coherence_evaluation) {
                setCoherenceEvaluation(studyData.coherence_evaluation);
              }
              
              // Store sections for display
              if (studyData.sections) {
                setSections(studyData.sections);
              }
              
              toast.success(i18n.language === 'es' 
                ? '✅ ¡Estudio generado exitosamente!' 
                : '✅ Study generated successfully!');
              
              // Change step to show completion screen instead of auto-redirecting
              setStep('completed');
            }
          } catch (pollError) {
            console.error('Polling error:', pollError);
          }
        }, 3000); // Poll every 3 seconds
        
        // Clean up interval after 15 minutes (safety timeout)
        setTimeout(() => {
          clearInterval(pollInterval);
          if (generationProgress < 100) {
            setRedirecting(true);
            setRedirectCountdown(10);
          }
        }, 15 * 60 * 1000);
        
        return; // Exit function after setting up polling
      } else {
        throw new Error('Failed to start generation');
      }
    } catch (err) {
      console.error('Error starting econometric study generation:', err);
      setGenerating(false);
      
      toast.error(
        i18n.language === 'es'
          ? `❌ Error al iniciar la generación: ${err.response?.data?.detail || err.message}`
          : `❌ Error starting generation: ${err.response?.data?.detail || err.message}`,
        { duration: 7000 }
      );
    }
  };

  // Handle failed generation - LEGACY CODE (kept for error cases that may still reach here)
  const handleFailedGeneration = (status) => {
    if (status === 'generation_failed') {
      toast.error(
        i18n.language === 'es'
          ? `❌ Error en la generación. Por favor intente nuevamente.`
          : `❌ Generation failed. Please try again.`,
        { duration: 10000 }
      );
      
      setStep('input');
      setGenerating(false);
    }
  };

  const generateSection = async (study_id, section_num) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/${study_id}/generate-section/${section_num}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const sectionData = {
        ...response.data.section,
        validation_warning: response.data.validation_warning
      };

      setCurrentSection(sectionData);
      setSectionNumber(section_num);
      setStep('review');
      
      if (response.data.validation_passed === false) {
        toast.warning(`Sección ${section_num} generada con advertencias de validación`);
      } else if (response.data.validation_passed) {
        toast.success(`Sección ${section_num} generada y validada ✓`);
      } else {
        toast.success(`Sección ${section_num} generada`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/edit-section/${studyId}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          current_section_content: currentSection.content,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setCurrentSection(response.data.section);
      setEditInstructions('');
      setEditMode(false);
      toast.success('Sección editada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/${studyId}/approve-section/${sectionNumber}`,
        currentSection,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const newSections = [...sections, currentSection];
      setSections(newSections);

      if (sectionNumber < 16) {
        toast.success(`Sección ${sectionNumber} aprobada. Generando siguiente...`);
        setStep('generating');
        await generateSection(studyId, sectionNumber + 1);
      } else {
        toast.success('¡Estudio completado! Redirigiendo a la vista del estudio...');
        // Redirigir a la vista del estudio completado
        navigate(`/view-econometric-study/${studyId}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
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
      setStep('generating');
      await generateSection(studyId, secNum);
    }
  };

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = window.location.origin;
      
      // Calculate completion percentage
      let completion = 0;
      if (projectDescription && projectDescription.trim()) completion += 25;
      if (studyTitle) completion += 20;
      if (applicantName) completion += 15;
      if (inputMode) completion += 10;
      if (sections.length > 0) completion += 30;
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'econometric_study',
          title: studyTitle || applicantName || 'Borrador Estudio Econométrico sin título',
          content: {
            projectDescription,
            studyTitle,
            applicantName,
            inputMode,
            step,
            sectionNumber,
            sections
          },
          client_id: null,
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

  // Step 1: Input
  if (step === 'input') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => {
            if (clientId) {
              navigate(`/client-documents/${clientId}/study`);
            } else {
              navigate('/dashboard');
            }
          }}>
            <ArrowLeft className="mr-2" size={18} />
            {clientId ? 'Volver a Estudios' : (t('back_to_dashboard') || 'Volver al Dashboard')}
          </Button>
        </div>

        <div className="create-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                <TrendingUp className="inline mr-2" size={28} />
                Crear Estudio Econométrico
              </CardTitle>
              <CardDescription>
                Genera un estudio econométrico profesional para reforzar Prong 1 del EB-2 NIW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartStudy} className="space-y-6">
                {/* Input Mode Selector */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <Button
                    type="button"
                    variant={inputMode === 'text' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setInputMode('text')}
                  >
                    <FileText className="mr-2" size={16} />
                    Escribir Texto
                  </Button>
                  <Button
                    type="button"
                    variant={inputMode === 'file' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setInputMode('file')}
                  >
                    <Upload className="mr-2" size={16} />
                    Subir Archivo
                  </Button>
                </div>

                {inputMode === 'text' ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Descripción del Proyecto de Interés Nacional
                    </label>
                    <Textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Describe detalladamente tu proyecto de interés nacional:&#10;&#10;• Título o nombre del proyecto&#10;• Tu nombre completo&#10;• Objetivos y alcance&#10;• Metodología&#10;• Impacto esperado a nivel nacional&#10;• Beneficios cuantificables&#10;• Sector y problema que resuelve&#10;• Innovación tecnológica o metodológica&#10;&#10;Proporciona la máxima información posible para un análisis econométrico riguroso."
                      rows={16}
                      required
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Incluye datos cuantitativos, métricas esperadas, población objetivo, y cualquier información que ayude a demostrar el mérito e importancia nacional (Prong 1)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Cargar Documento del Proyecto (PDF o Word)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                            <p className="text-sm text-gray-600">Procesando archivo...</p>
                          </>
                        ) : projectDescription ? (
                          <>
                            <CheckCircle className="text-green-600 mb-3" size={40} />
                            <p className="text-sm font-medium text-gray-700 mb-2">✅ Archivo cargado exitosamente</p>
                            <div className="w-full max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3 mb-3">
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                {projectDescription.slice(0, 500)}
                                {projectDescription.length > 500 && '...'}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                              📄 {projectDescription.length} caracteres extraídos
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setProjectDescription('');
                              }}
                            >
                              <Upload className="mr-2" size={14} />
                              Cambiar archivo
                            </Button>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 mb-2" size={32} />
                            <p className="text-sm font-medium text-gray-700">
                              Click para subir archivo PDF o Word
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Sube un documento con la descripción completa de tu proyecto
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Button 
                    type="button"
                    onClick={saveDraft}
                    variant="outline"
                    disabled={generating || !projectDescription || !projectDescription.trim()}
                    style={{ flex: 1 }}
                  >
                    <Save className="mr-2" size={18} />
                    Guardar Borrador
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generating || !projectDescription || !projectDescription.trim()}
                    style={{ flex: 1 }}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Iniciando Análisis...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2" size={18} />
                        Iniciar Estudio Econométrico
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

  // Step 2: Generating (loading screen)
  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        {/* Back button */}
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <Button variant="ghost" onClick={() => {
            if (clientId) {
              navigate(`/client-documents/${clientId}/study`);
            } else {
              navigate('/dashboard');
            }
          }}>
            <ArrowLeft className="mr-2" size={18} />
            {clientId ? 'Volver a Estudios' : 'Volver al Dashboard'}
          </Button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo Monica con animación */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 30px',
            backgroundColor: '#000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '48px', color: '#fff', fontWeight: 'bold' }}>M</span>
          </div>

          {redirecting ? (
            /* PANTALLA DE REDIRECCIÓN - Reemplaza el contenido de carga */
            <>
              <div style={{ 
                backgroundColor: '#f0fdf4', 
                border: '2px solid #86efac',
                borderRadius: '12px',
                padding: '30px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', color: '#166534' }}>
                  {i18n.language === 'es' ? '¡Generación Iniciada!' : 'Generation Started!'}
                </h2>
                <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8', marginBottom: '20px' }}>
                  {i18n.language === 'es' 
                    ? 'Su estudio econométrico se está generando en segundo plano.'
                    : 'Your econometric study is being generated in the background.'}
                </p>
                <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8', marginBottom: '20px' }}>
                  {i18n.language === 'es'
                    ? '⏱️ Será notificado en aproximadamente 10 minutos cuando su estudio esté listo.'
                    : '⏱️ You will be notified in approximately 10 minutes when your study is ready.'}
                </p>
                <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8' }}>
                  {i18n.language === 'es'
                    ? '💼 Mientras tanto, puede continuar trabajando en otros documentos.'
                    : '💼 Meanwhile, you can continue working on other documents.'}
                </p>
              </div>
              
              <div style={{ 
                marginTop: '30px',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  {i18n.language === 'es'
                    ? `Redirigiendo al dashboard en ${redirectCountdown} segundo${redirectCountdown !== 1 ? 's' : ''}...`
                    : `Redirecting to dashboard in ${redirectCountdown} second${redirectCountdown !== 1 ? 's' : ''}...`}
                </p>
                <div style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${((10 - redirectCountdown) / 10) * 100}%`,
                    height: '100%',
                    backgroundColor: '#22c55e',
                    transition: 'width 1s linear'
                  }}></div>
                </div>
              </div>
            </>
          ) : (
            /* PANTALLA DE CARGA NORMAL - Con progreso real */
            <>
              {/* Barra de progreso */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${generationProgress || Math.min(100, (sectionNumber / 16) * 100)}%`,
                    height: '100%',
                    backgroundColor: '#000',
                    transition: 'width 0.5s ease',
                    animation: generationProgress < 100 ? 'shimmer 1.5s infinite' : 'none'
                  }}></div>
                </div>
                <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                  {generationProgress || Math.round((sectionNumber / 16) * 100)}%
                </p>
              </div>

              {/* Información de progreso */}
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
                {generationStatus || `Generando Sección ${sectionNumber} de 16`}
              </h2>
              <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
                {ECONOMETRIC_SECTIONS[sectionNumber - 1] || 'Preparando documento...'}
              </p>
              <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
                <p>✨ Generando contenido con IA...</p>
                <p>🔍 Analizando datos econométricos...</p>
                <p>⏱️ Esto puede tomar 5-10 minutos</p>
              </div>
              
              {/* Indicador de actividad */}
              <div style={{ 
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                  animation: 'blink 1s infinite'
                }}></div>
                <span style={{ fontSize: '12px', color: '#22c55e' }}>
                  Generación en progreso
                </span>
              </div>
              
              {/* Botón para ir al dashboard mientras se genera */}
              <div style={{ marginTop: '30px' }}>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (clientId) {
                      navigate(`/client-documents/${clientId}/study`);
                    } else {
                      navigate('/dashboard');
                    }
                  }}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    borderColor: '#d1d5db',
                    color: '#374151'
                  }}
                >
                  <ArrowLeft className="mr-2" size={16} />
                  {i18n.language === 'es' 
                    ? 'Continuar en el Dashboard (la generación seguirá en segundo plano)' 
                    : 'Continue in Dashboard (generation will continue in background)'}
                </Button>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '10px' }}>
                  {i18n.language === 'es'
                    ? 'Podrás ver el progreso en la lista de documentos'
                    : 'You can see the progress in the documents list'}
                </p>
              </div>
            </>
          )}
        </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // Step: Completed - Show coherence evaluation and options
  if (step === 'completed') {
    const coherenceScore = coherenceEvaluation?.coherence_score || 0;
    const coherenceColor = coherenceScore >= 70 ? '#16a34a' : coherenceScore >= 50 ? '#ca8a04' : '#dc2626';
    const coherenceLabel = coherenceScore >= 70 ? 'Buena' : coherenceScore >= 50 ? 'Moderada' : 'Baja';
    
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Success Header */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '2rem',
            padding: '2rem',
            backgroundColor: '#f0fdf4',
            borderRadius: '16px',
            border: '2px solid #86efac'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>✅</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#166534', marginBottom: '0.5rem' }}>
              {i18n.language === 'es' ? '¡Estudio Generado Exitosamente!' : 'Study Generated Successfully!'}
            </h1>
            <p style={{ color: '#15803d', fontSize: '1.1rem' }}>
              {studyTitle || 'Estudio Econométrico'}
            </p>
          </div>

          {/* Coherence Evaluation Card */}
          {coherenceEvaluation && (
            <Card style={{ marginBottom: '1.5rem', border: `2px solid ${coherenceColor}20` }}>
              <CardHeader style={{ backgroundColor: `${coherenceColor}10` }}>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Star size={24} style={{ color: coherenceColor }} />
                  {i18n.language === 'es' ? 'Evaluación de Coherencia' : 'Coherence Evaluation'}
                </CardTitle>
                <CardDescription>
                  {i18n.language === 'es' 
                    ? 'Análisis de coherencia entre el estudio generado y el proyecto adjunto'
                    : 'Coherence analysis between the generated study and the attached project'}
                </CardDescription>
              </CardHeader>
              <CardContent style={{ padding: '1.5rem' }}>
                {/* Score Display */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  padding: '1.5rem',
                  backgroundColor: `${coherenceColor}10`,
                  borderRadius: '12px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: '4rem', 
                      fontWeight: 'bold', 
                      color: coherenceColor,
                      lineHeight: 1
                    }}>
                      {coherenceScore}
                    </div>
                    <div style={{ fontSize: '1.25rem', color: coherenceColor, fontWeight: '600' }}>
                      / 100 - {coherenceLabel}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {coherenceEvaluation.summary && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                      {i18n.language === 'es' ? 'Resumen' : 'Summary'}
                    </h4>
                    <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
                      {coherenceEvaluation.summary}
                    </p>
                  </div>
                )}

                {/* Metrics */}
                {coherenceEvaluation.metrics && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>
                      {i18n.language === 'es' ? 'Métricas Detalladas' : 'Detailed Metrics'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {Object.entries(coherenceEvaluation.metrics).map(([key, value]) => (
                        <div key={key} style={{ 
                          padding: '0.75rem', 
                          backgroundColor: '#f9fafb', 
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                            {typeof value === 'number' ? `${value}/100` : value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues Found */}
                {coherenceEvaluation.issues_found && coherenceEvaluation.issues_found.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                      {i18n.language === 'es' ? 'Observaciones' : 'Observations'}
                    </h4>
                    <ul style={{ paddingLeft: '1.25rem', color: '#4b5563' }}>
                      {coherenceEvaluation.issues_found.map((issue, idx) => (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{typeof issue === 'string' ? issue : (issue.issue || issue.document_text || JSON.stringify(issue))}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Study Info Card */}
          <Card style={{ marginBottom: '1.5rem' }}>
            <CardContent style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {i18n.language === 'es' ? 'Secciones Generadas' : 'Sections Generated'}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                    {sections.length || 16} / 16
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {i18n.language === 'es' ? 'Estado' : 'Status'}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#16a34a' }}>
                    {i18n.language === 'es' ? 'Completado' : 'Completed'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              onClick={() => navigate(`/view-econometric-study/${studyId}`)}
              style={{ 
                backgroundColor: '#000', 
                color: '#fff',
                padding: '0.75rem 2rem',
                fontSize: '1rem'
              }}
            >
              <FileText className="mr-2" size={20} />
              {i18n.language === 'es' ? 'Ver Estudio Completo' : 'View Complete Study'}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                if (clientId) {
                  navigate(`/client-documents/${clientId}/study`);
                } else {
                  navigate('/dashboard');
                }
              }}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            >
              <ArrowLeft className="mr-2" size={20} />
              {i18n.language === 'es' ? 'Volver al Dashboard' : 'Back to Dashboard'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Review
  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => {
            if (studyId) {
              navigate(`/view-econometric-study/${studyId}`);
            } else if (clientId) {
              navigate(`/client-documents/${clientId}/study`);
            } else {
              navigate('/dashboard');
            }
          }}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 16
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {/* Navigation numbers */}
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => goToSection(num)}
                disabled={num > sections.length + 1}
                title={ECONOMETRIC_SECTIONS[num - 1]}
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

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Sección {sectionNumber} de 16</CardTitle>
              <CardDescription>{studyTitle} - {applicantName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="econometric-content"
                dangerouslySetInnerHTML={{ __html: currentSection.content }}
              />
            </CardContent>
          </Card>

          {/* Validation Warning */}
          {currentSection.validation_warning && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <h4 style={{ margin: 0, color: '#856404', fontSize: '16px', fontWeight: '600' }}>
                  {currentSection.validation_warning.title}
                </h4>
              </div>
              <p style={{ color: '#856404', marginBottom: '12px', fontSize: '14px' }}>
                {currentSection.validation_warning.summary}
              </p>
              
              {currentSection.validation_warning.issues && currentSection.validation_warning.issues.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#856404', display: 'block', marginBottom: '8px' }}>🔍 Problemas detectados:</strong>
                  <ul style={{ marginLeft: '20px', color: '#856404' }}>
                    {(currentSection.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p style={{ color: '#856404', marginTop: '8px', fontSize: '14px' }}>
                <strong>Feedback:</strong> {currentSection.validation_warning.feedback}
              </p>
              
              {currentSection.validation_warning.metrics && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                  <strong style={{ color: '#856404', display: 'block', marginBottom: '8px' }}>📊 Métricas de Validación:</strong>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#856404' }}>
                    <li>🔄 Intentos de generación: {currentSection.validation_warning.metrics.attempts}</li>
                    <li>📈 Puntuación final: {currentSection.validation_warning.metrics.final_score}/10</li>
                    <li>⚠️ Problemas críticos: {currentSection.validation_warning.metrics.critical_issues}</li>
                  </ul>
                </div>
              )}
              
              <p style={{ 
                marginTop: '16px', 
                padding: '12px', 
                backgroundColor: '#fff', 
                borderLeft: '4px solid #ffc107', 
                color: '#856404',
                fontSize: '13px'
              }}>
                <strong>💡 Recomendación:</strong> Considera usar "Editar Sección" para mejorar los aspectos señalados antes de aprobar.
              </p>
            </div>
          )}

          {!editMode ? (
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={handleApproveSection}
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
                  placeholder="Ejemplo: 'Añade más evidencia cuantitativa del impacto nacional. Incluye referencias a estudios académicos recientes. Fortalece la argumentación sobre substantial merit con datos específicos de U.S. Census o BLS.'"
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
                    onClick={handleEditSection}
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
        </div>
      </div>
    );
  }

  return null;
};


export default CreateEconometricStudy;
