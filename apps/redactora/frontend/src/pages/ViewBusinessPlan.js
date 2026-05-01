import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, Save, Edit, RefreshCw, CheckCircle, Copy, Sparkles, Languages, History, MessageSquare, Briefcase, Wand2, AlertTriangle, Play, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { API, BACKEND_URL } from '../utils/constants';
import { WordDownloadButton } from '../components/WordDownloadButton';

// Función para encontrar y resaltar diferencias entre dos textos
const highlightDifferences = (oldText, newText) => {
  if (!oldText || !newText) return { before: oldText || '', after: newText || '' };
  
  // Dividir en palabras preservando espacios y puntuación
  const splitText = (text) => text.split(/(\s+)/);
  
  const oldWords = splitText(oldText);
  const newWords = splitText(newText);
  
  // Encontrar la secuencia común más larga al inicio
  let commonStart = 0;
  while (commonStart < oldWords.length && commonStart < newWords.length && oldWords[commonStart] === newWords[commonStart]) {
    commonStart++;
  }
  
  // Encontrar la secuencia común más larga al final
  let commonEndOld = oldWords.length;
  let commonEndNew = newWords.length;
  while (commonEndOld > commonStart && commonEndNew > commonStart && oldWords[commonEndOld - 1] === newWords[commonEndNew - 1]) {
    commonEndOld--;
    commonEndNew--;
  }
  
  // Construir texto con resaltado
  const beforeParts = [];
  const afterParts = [];
  
  // Parte común al inicio (mostrar últimas 10 palabras como contexto)
  const contextWords = 15;
  const startContext = Math.max(0, commonStart - contextWords);
  if (startContext > 0) {
    beforeParts.push('...');
    afterParts.push('...');
  }
  beforeParts.push(oldWords.slice(startContext, commonStart).join(''));
  afterParts.push(newWords.slice(startContext, commonStart).join(''));
  
  // Parte diferente (resaltada)
  const oldDiff = oldWords.slice(commonStart, commonEndOld).join('');
  const newDiff = newWords.slice(commonStart, commonEndNew).join('');
  
  if (oldDiff) {
    beforeParts.push(`<mark class="bg-red-200 text-red-800 px-0.5 rounded">${oldDiff}</mark>`);
  }
  if (newDiff) {
    afterParts.push(`<mark class="bg-green-200 text-green-800 px-0.5 rounded">${newDiff}</mark>`);
  }
  
  // Parte común al final (mostrar primeras 10 palabras como contexto)
  const endContextOld = Math.min(oldWords.length, commonEndOld + contextWords);
  const endContextNew = Math.min(newWords.length, commonEndNew + contextWords);
  beforeParts.push(oldWords.slice(commonEndOld, endContextOld).join(''));
  afterParts.push(newWords.slice(commonEndNew, endContextNew).join(''));
  if (endContextOld < oldWords.length) {
    beforeParts.push('...');
  }
  if (endContextNew < newWords.length) {
    afterParts.push('...');
  }
  
  return {
    before: beforeParts.join(''),
    after: afterParts.join(''),
    hasChanges: oldDiff !== newDiff
  };
};

const ViewBusinessPlan = () => {
  const [plan, setPlan] = useState(null);
  const [content, setContent] = useState('');
  const [fullContent, setFullContent] = useState({ es: '', en: '' }); // ⭐ Contenido compilado bilingüe
  const [viewMode, setViewMode] = useState('full'); // full, sections
  const [sections, setSections] = useState([]);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false); // ⭐ FIX: Estado faltante
  const [regeneratingTranslations, setRegeneratingTranslations] = useState(false); // 🌐 Estado para regenerar traducciones
  const [translationStatus, setTranslationStatus] = useState(null); // 🌐 Estado de las traducciones
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('es'); // ⭐ Estado para idioma
  
  // ⭐ NUEVO: Estados para Edición Global con IA
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditProgressMsg, setAiEditProgressMsg] = useState('');
  const [showAIEditResults, setShowAIEditResults] = useState(false);
  const [aiEditResults, setAiEditResults] = useState(null);
  
  const pathParts = window.location.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // 🌐 Función para verificar estado de traducciones
  const checkTranslationStatus = async (planData) => {
    if (!planData.sections || planData.sections.length === 0) return;
    
    const sectionsWithEs = planData.sections.filter(s => s.content_es && s.content_es.length > 10).length;
    const totalSections = planData.sections.length;
    
    setTranslationStatus({
      hasAllTranslations: sectionsWithEs === totalSections,
      sectionsWithEs,
      totalSections,
      percentage: Math.round((sectionsWithEs / totalSections) * 100)
    });
  };

  // 🌐 Función para regenerar traducciones
  const regenerateTranslations = async () => {
    setRegeneratingTranslations(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/${id}/regenerate-translations`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success(`🌐 ${response.data.message}. ${response.data.sections_to_translate} secciones se traducirán.`);
      
      // Iniciar verificación periódica del estado
      const checkInterval = setInterval(async () => {
        try {
          const debugResponse = await axios.get(`${API}/business-plans/${id}/debug`);
          const sectionsWithEs = debugResponse.data.sections_with_content_es;
          const totalSections = debugResponse.data.total_sections;
          
          setTranslationStatus({
            hasAllTranslations: sectionsWithEs === totalSections,
            sectionsWithEs,
            totalSections,
            percentage: Math.round((sectionsWithEs / totalSections) * 100)
          });
          
          if (sectionsWithEs === totalSections) {
            clearInterval(checkInterval);
            setRegeneratingTranslations(false);
            toast.success('✅ ¡Todas las traducciones completadas! Recarga la página para ver los cambios.');
            // Recargar el plan
            await loadPlan();
          }
        } catch (e) {
          console.error('Error checking translation status:', e);
        }
      }, 5000); // Verificar cada 5 segundos
      
      // Detener después de 5 minutos máximo
      setTimeout(() => {
        clearInterval(checkInterval);
        setRegeneratingTranslations(false);
      }, 300000);
      
    } catch (error) {
      console.error('Error regenerating translations:', error);
      toast.error(error.response?.data?.detail || 'Error al regenerar traducciones');
      setRegeneratingTranslations(false);
    }
  };

  useEffect(() => {
    loadPlan();
    loadCommentStats();
  }, []);

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // Determinar el idioma actual basándose en el contenido que se muestra
      const editedLanguage = currentLanguage || 'es';
      const editedContent = editedLanguage === 'es' 
        ? (currentSection.content_es || currentSection.content || '')
        : (currentSection.content_en || currentSection.content || '');
      
      const response = await axios.post(
        `${API}/business-plans/edit-section-bilingual/${id}`,
        {
          section_number: currentSection.number,
          edit_instructions: editInstructions,
          edited_content: editedContent,
          edited_language: editedLanguage,
          current_section_title: currentSection.title || ''
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
      
      // Mensaje de éxito con info de regeneración bilingüe
      const otherLang = editedLanguage === 'es' ? 'inglés' : 'español';
      toast.success(`✅ Sección editada y versión en ${otherLang} regenerada automáticamente`);
      
      // Reload plan to refresh compiled content
      await loadPlan();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  // ⭐ Edición global con IA — ASYNC con polling para evitar error 524
  const handleAIGlobalEdit = async () => {
    if (!aiEditInstructions.trim() || !id) return;
    
    setAiEditLoading(true);
    setAiEditProgressMsg('Iniciando edición con IA...');
    try {
      const token = localStorage.getItem('token');
      
      // 1. Enviar solicitud async — retorna job_id inmediatamente (sin esperar IA)
      const startResponse = await axios.post(
        `${API}/business-plans/ai-edit-async/${id}`,
        { edit_instructions: aiEditInstructions, language: currentLanguage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { job_id } = startResponse.data;
      if (!job_id) throw new Error('No se obtuvo job_id del servidor');
      
      // 2. Polling hasta completar (cada 4 segundos, máx. 8 minutos para ediciones estructurales)
      const MAX_POLLS = 120; // 120 × 4s = 8 minutos
      let polls = 0;
      while (polls < MAX_POLLS) {
        await new Promise(resolve => setTimeout(resolve, 4000));
        polls++;
        
        const statusResponse = await axios.get(
          `${API}/business-plans/ai-edit-job/${job_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const job = statusResponse.data;
        
        // Actualizar mensaje de progreso con tiempo estimado
        const elapsed = Math.round(polls * 4);
        const progressText = job.progress_message || 'Procesando...';
        setAiEditProgressMsg(`${progressText} (${elapsed}s)`);
        
        if (job.status === 'completed') {
          const result = job.result;
          setAiEditResults(result);
          setShowAIEditModal(false);
          setShowAIEditResults(true);
          
          if (result?.total_sections_modified > 0) {
            await loadPlan();
            toast.success(`✅ ${result.total_sections_modified} secciones modificadas exitosamente`);
            // Re-evaluar automáticamente para verificar que las correcciones se aplicaron
            const tkn = localStorage.getItem('token');
            if (tkn) {
              axios.post(`${API}/business-plans/${id}/evaluate-uscis`, {}, {
                headers: { 'Authorization': `Bearer ${tkn}` }
              }).then(() => {
                toast.info('🔄 Re-evaluación iniciada para verificar correcciones...', { duration: 5000 });
              }).catch(err => console.warn('Re-evaluación falló:', err.message));
            }
          } else {
            toast.warning('⚠️ El asistente analizó el documento pero no aplicó cambios. Intenta instrucciones más específicas o usa el modo de edición de sección individual.');
          }
          break;
        } else if (job.status === 'failed') {
          throw new Error(job.error || 'La edición falló en el servidor');
        }
        // status === 'processing' o 'pending' → seguir esperando
      }
      
      if (polls >= MAX_POLLS) {
        throw new Error('La edición tardó más de 8 minutos. El proceso puede continuar en el servidor — espera unos minutos y recarga el documento.');
      }
    } catch (error) {
      console.error('Error en edición con IA:', error);
      toast.error(error.response?.data?.detail || error.message || 'Error al procesar la edición con IA');
    } finally {
      setAiEditLoading(false);
      setAiEditProgressMsg('');
    }
  };

  const loadPlan = async () => {
    try {
      const response = await axios.get(`${API}/business-plans/${id}`);
      const planData = response.data;
      setPlan(planData);
      
      // 🌐 Verificar estado de traducciones
      checkTranslationStatus(planData);
      
      // 🔍 Auto-trigger USCIS evaluation in background if plan is completed and has no evaluation
      const isCompleted = planData.status === 'completed' || planData.status === 'review_needed';
      const hasEvaluation = planData.evaluation_report && Object.keys(planData.evaluation_report).length > 0;
      const isAlreadyEvaluating = planData.is_evaluating;
      if (isCompleted && !hasEvaluation && !isAlreadyEvaluating) {
        const token = localStorage.getItem('token');
        if (token) {
          axios.post(`${API}/business-plans/${id}/evaluate-uscis`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(() => {
            console.log('🔍 Auto-evaluation triggered for plan', id);
          }).catch(err => {
            console.warn('⚠️ Auto-evaluation trigger failed:', err.message);
          });
        }
      }
      
      // Si el plan tiene secciones con contenido bilingüe, compilar el contenido completo
      if (planData.sections && planData.sections.length > 0) {
        // Compilar contenido en ambos idiomas
        const contentEs = planData.sections
          .map(section => section.content_es || section.content || '')
          .join('<div style="page-break-after: always;"></div>');
        
        const contentEn = planData.sections
          .map(section => section.content_en || section.content || '')
          .join('<div style="page-break-after: always;"></div>');
        
        setFullContent({ es: contentEs, en: contentEn });
        setContent(contentEs); // Establecer contenido inicial en español
      } else {
        // Usar el campo content si no hay sections
        const plainContent = planData.content || '';
        setContent(plainContent);
        setFullContent({ es: plainContent, en: plainContent });
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      toast.error('Error al cargar el plan');
    } finally {
      setLoading(false);
    }
  };

  const loadCommentStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/comments/${id}/stats?document_type=niw`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setCommentStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading comment stats:', error);
    }
  };

  const loadSections = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/business-plans/${id}/sections`);
      console.log('📄 Secciones cargadas:', response.data.sections);
      setSections(response.data.sections);
      if (response.data.sections.length > 0) {
        const firstSection = response.data.sections[0];
        console.log('📄 Primera sección:', firstSection);
        console.log('📄 Contenido ES:', firstSection.content_es ? `${firstSection.content_es.substring(0, 100)}...` : 'NO EXISTE');
        console.log('📄 Contenido EN:', firstSection.content_en ? `${firstSection.content_en.substring(0, 100)}...` : 'NO EXISTE');
        setCurrentSection(firstSection);
        setSectionNumber(1);
        toast.success(`✓ ${response.data.sections.length} secciones cargadas`);
      }
      setViewMode('sections');
    } catch (error) {
      console.error('Error al cargar secciones:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/business-plans/${id}?content=${encodeURIComponent(content)}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cambios guardados');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/business-plans/${id}/sections/${sectionNumber}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          current_section_content: currentSection.content,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Sección actualizada exitosamente');
      setEditInstructions('');
      setEditMode(false);
      
      // Reload sections to get updated content
      await loadSections();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar sección');
    } finally {
      setSaving(false);
    }
  };

  const goToSection = (secNum) => {
    const section = sections.find(s => s.number === secNum);
    if (section) {
      setCurrentSection(section);
      setSectionNumber(secNum);
      setEditMode(false);
      setEditInstructions('');
    }
  };

  const downloadPDF = async (language = 'es') => {
    setDownloading(true);
    try {
      toast.info(`📥 Generando PDF en ${language === 'es' ? 'español' : 'inglés'}...`);
      const response = await axios.get(`${API}/business-plans/${id}/download?language=${language}`, {
        responseType: 'blob'
      });

      // Try to use the filename from the Content-Disposition header (includes applicant name)
      const disposition = response.headers['content-disposition'];
      let filename = '';
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) filename = match[1].trim();
      }
      // Fallback: build filename from plan data if header not available
      if (!filename) {
        const langSuffix = language === 'es' ? '_ES' : '_EN';
        const applicantPart = plan.applicant_name
          ? plan.applicant_name.replace(/\s+/g, '_') + '_'
          : '';
        const titlePart = (plan.project_title || plan.business_name || 'NIW_Proposal').replace(/\s+/g, '_');
        filename = `${applicantPart}${titlePart}${langSuffix}_niw_proposal.pdf`;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`✅ PDF descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar PDF');
    } finally {
      setDownloading(false);
    }
  };

  // ⭐ FIX: Función approveSection faltante
  const approveSection = async () => {
    try {
      setGenerating(true);
      
      // Avanzar a la siguiente sección
      const nextSectionNumber = sectionNumber + 1;
      
      if (nextSectionNumber <= sections.length) {
        // Cargar siguiente sección
        const nextSection = sections.find(s => s.number === nextSectionNumber);
        if (nextSection) {
          setCurrentSection(nextSection);
          setSectionNumber(nextSectionNumber);
          toast.success(`✓ Sección ${sectionNumber} aprobada. Mostrando sección ${nextSectionNumber}`);
        }
      } else {
        // No hay más secciones
        toast.success('¡Todas las secciones completadas!');
        setViewMode('full');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Cargando plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="loading-container">
        <p>No se pudo cargar el plan. Por favor, intenta de nuevo.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (viewMode === 'sections' && currentSection) {
    return (
      <div className="view-container">
        <div className="view-header">
          <Button variant="ghost" onClick={() => setViewMode('full')} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Vista Completa
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de {sections.length}
            </span>
          </div>
        </div>

        <div className="view-content max-w-4xl mx-auto">
          <div className="mb-4 flex gap-1 flex-wrap">
            {sections.map(sec => (
              <button
                key={sec.number}
                onClick={() => goToSection(sec.number)}
                title={sec.title}
                className={`px-3 py-2 rounded text-xs ${
                  sec.number === sectionNumber 
                    ? 'bg-black text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {sec.number}
              </button>
            ))}
          </div>

          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{currentSection.title}</CardTitle>
                  <CardDescription>Sección {sectionNumber} - {plan.project_title || plan.business_name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Vista PDF</span>
                  <button
                    onClick={() => setCurrentLanguage(currentLanguage === 'es' ? 'en' : 'es')}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                  >
                    {currentLanguage === 'es' ? '🇺🇸 English' : '🇪🇸 Español'}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const contentToShow = currentLanguage === 'es' 
                  ? (currentSection.content_es || currentSection.content || '') 
                  : (currentSection.content_en || currentSection.content || '');
                
                // Compute the display section title exactly as the PDF does
                // Cover page (number=1) is front matter; Executive Summary (number=2) = Section I
                const NIW_SECTIONS_ES_DISPLAY = [
                  "I. Resumen Ejecutivo",
                  "II. Antecedentes y Calificaciones del Solicitante",
                  "III. Planteamiento del Problema: Crisis Nacional y Contexto",
                  "IV. Importancia Nacional e Impacto Económico",
                  "V. Solución Propuesta: Marco y Metodología",
                  "VI. Análisis de Mercado y Contexto de la Industria",
                  "VII. Plan de Implementación y Cronograma",
                  "VIII. Proyecciones Financieras",
                  "IX. Creación de Empleo y Beneficios Económicos",
                  "X. Justificación de Exención por Interés Nacional (3 Criterios)",
                  "XI. Análisis de Riesgos y Mitigación",
                  "XII. Métricas de Éxito y Evaluación",
                  "XIII. Gobernanza, Ética y Cumplimiento",
                  "XIV. Monitoreo y Evaluación (M&E)",
                  "XV. Bibliografía Integral",
                  "XVI. Anexos y Documentos de Apoyo"
                ];
                const sectionNum = currentSection.number || sectionNumber;
                const isCoverPage = sectionNum === 1 || (currentSection.title || '').toLowerCase().includes('portada') || (currentSection.title || '').toLowerCase().includes('cover');
                const bodyIndex = sectionNum - 2;
                const displayTitle = currentLanguage === 'es'
                  ? (isCoverPage ? null : (bodyIndex >= 0 && bodyIndex < NIW_SECTIONS_ES_DISPLAY.length ? NIW_SECTIONS_ES_DISPLAY[bodyIndex] : currentSection.title))
                  : currentSection.title;
                
                console.log(`📄 Mostrando contenido (${currentLanguage}):`, contentToShow ? `${contentToShow.substring(0, 100)}...` : 'VACÍO');
                
                if (!contentToShow) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <p className="text-lg mb-2">⚠️ No hay contenido disponible para esta sección</p>
                      <p className="text-sm">
                        {currentLanguage === 'es' 
                          ? 'La sección puede estar en proceso de generación o no tener contenido en español.'
                          : 'The section may be in the generation process or have no English content.'
                        }
                      </p>
                      <button 
                        onClick={() => setCurrentLanguage(currentLanguage === 'es' ? 'en' : 'es')}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        {currentLanguage === 'es' ? 'Try English version' : 'Probar versión en español'}
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div className="pdf-page-preview">
                    {displayTitle && (
                      <div className="pdf-section-heading">{displayTitle}</div>
                    )}
                    <div 
                      className="pdf-prose"
                      dangerouslySetInnerHTML={{ __html: contentToShow }}
                    />
                  </div>
                );
              })()}
              <style>{`
                /* ====== PDF PAGE PREVIEW - mirrors ReportLab PDF output ====== */
                .pdf-page-preview {
                  background: #fff;
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 12pt;
                  line-height: 1.6;
                  color: #000;
                  padding: 48px 56px;
                  border: 1px solid #d0d0d0;
                  border-radius: 2px;
                  box-shadow: 0 2px 12px rgba(0,0,0,0.10);
                  max-width: 820px;
                  margin: 0 auto;
                }
                /* Section heading that mirrors the PDF's section title bar */
                .pdf-section-heading {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 15pt;
                  font-weight: bold;
                  color: #000;
                  border-bottom: 2px solid #000;
                  padding-bottom: 8px;
                  margin-bottom: 24px;
                  text-transform: uppercase;
                  letter-spacing: 0.03em;
                }
                /* H2 — major sub-headers inside content */
                .pdf-prose h2 {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 14pt;
                  font-weight: bold;
                  margin-top: 28px;
                  margin-bottom: 10px;
                  color: #000;
                  border-bottom: 1px solid #ccc;
                  padding-bottom: 4px;
                }
                /* H3 */
                .pdf-prose h3 {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 13pt;
                  font-weight: bold;
                  margin-top: 22px;
                  margin-bottom: 8px;
                  color: #111;
                }
                /* H4 — letter subsections (A., B., C.) and numbered (3.1, 4.2) */
                .pdf-prose h4 {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 12pt;
                  font-weight: bold;
                  margin-top: 18px;
                  margin-bottom: 6px;
                  color: #000;
                }
                /* H5 — deeper sub-subsections */
                .pdf-prose h5 {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 11.5pt;
                  font-weight: bold;
                  font-style: italic;
                  margin-top: 14px;
                  margin-bottom: 4px;
                  color: #222;
                }
                .pdf-prose p {
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 12pt;
                  margin-bottom: 10px;
                  text-align: justify;
                  color: #000;
                }
                .pdf-prose table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 16px 0;
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 11pt;
                }
                .pdf-prose th {
                  background-color: #000;
                  color: #fff;
                  padding: 8px 10px;
                  text-align: left;
                  font-weight: bold;
                  border: 1px solid #000;
                }
                .pdf-prose td {
                  padding: 7px 10px;
                  border: 1px solid #bbb;
                  vertical-align: top;
                }
                .pdf-prose tr:nth-child(even) td {
                  background-color: #f5f5f5;
                }
                .pdf-prose ul, .pdf-prose ol {
                  margin: 8px 0 10px 0;
                  padding-left: 28px;
                }
                .pdf-prose li {
                  margin-bottom: 4px;
                  font-family: 'Georgia', 'Times New Roman', Times, serif;
                  font-size: 12pt;
                }
                .pdf-prose strong, .pdf-prose b {
                  font-weight: bold;
                  color: #000;
                }
                .pdf-prose em, .pdf-prose i {
                  font-style: italic;
                }
                .pdf-prose blockquote {
                  border-left: 3px solid #333;
                  margin: 12px 0;
                  padding: 6px 16px;
                  font-style: italic;
                  color: #333;
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
                  placeholder="Ejemplo: 'Añade más detalles técnicos sobre la invención. Incluye especificaciones más precisas. Fortalece la descripción de ventajas competitivas.'"
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
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <Button variant="ghost" onClick={() => {
          // ⭐ FIX: Navegar al dashboard del cliente si existe, sino al dashboard principal
          if (plan && plan.client_id) {
            navigate(`/client-dashboard/${plan.client_id}`);
          } else {
            navigate('/dashboard');
          }
        }} data-testid="back-button">
          <ArrowLeft className="mr-2" size={18} />
          {t('form.back')}
        </Button>
        <div className="view-actions">
          <Button onClick={loadSections} variant="outline">
            <FileText className="mr-2" size={18} />
            Ver por Secciones
          </Button>
          {/* ⭐ NUEVO: Botón Editar con IA */}
          <Button 
            onClick={() => setShowAIEditModal(true)} 
            variant="outline" 
            className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
            data-testid="ai-global-edit-btn"
          >
            <Wand2 className="mr-2" size={18} />
            ✨ Editar con IA
          </Button>
          <Button onClick={saveContent} disabled={saving} data-testid="save-btn">
            {saving ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Save className="mr-2" size={18} />}
            Guardar
          </Button>
          <Button onClick={() => downloadPDF('es')} variant="outline" data-testid="download-pdf-es-btn" disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Download className="mr-2" size={18} />}
            📄 Descargar PDF (ES)
          </Button>
          <Button onClick={() => downloadPDF('en')} variant="outline" data-testid="download-pdf-en-btn" disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Download className="mr-2" size={18} />}
            📄 Descargar PDF (EN)
          </Button>
          <WordDownloadButton
            url={`${API}/business-plans/${id}/download-docx`}
            testId="download-word-en-businessplan"
          />
          <Button onClick={() => setShowHistory(true)} variant="outline" className="bg-purple-50">
            <History className="mr-2" size={18} />
            Ver Historial
          </Button>
          <Button onClick={() => setShowComments(true)} variant="outline" className="bg-blue-50 relative">
            <MessageSquare className="mr-2" size={18} />
            Comentarios
            {commentStats && commentStats.open > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {commentStats.open}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="view-content">
        <div className="document-header">
          <h1 className="document-title">{plan.project_title || plan.business_name || 'Documento'}</h1>
          <p className="document-meta">
            {plan.applicant_name || plan.industry || ''} • 
            {plan.language === 'en' ? ' English' : ' Español'} • 
            {new Date(plan.created_at).toLocaleDateString('es', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })}
          </p>
        </div>

        {/* ✅ Mostrar evaluación de coherencia si existe */}
        {plan.coherence_evaluation && (
          <div className={`mb-4 p-4 rounded-lg border ${
            plan.coherence_evaluation.coherence_score >= 80 
              ? 'bg-green-50 border-green-200' 
              : plan.coherence_evaluation.coherence_score >= 50 
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                plan.coherence_evaluation.coherence_score >= 80 
                  ? 'bg-green-100' 
                  : plan.coherence_evaluation.coherence_score >= 50 
                    ? 'bg-yellow-100'
                    : 'bg-red-100'
              }`}>
                {plan.coherence_evaluation.coherence_score >= 80 ? (
                  <CheckCircle className="text-green-600" size={24} />
                ) : plan.coherence_evaluation.coherence_score >= 50 ? (
                  <AlertCircle className="text-yellow-600" size={24} />
                ) : (
                  <AlertCircle className="text-red-600" size={24} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold ${
                    plan.coherence_evaluation.coherence_score >= 80 
                      ? 'text-green-900' 
                      : plan.coherence_evaluation.coherence_score >= 50 
                        ? 'text-yellow-900'
                        : 'text-red-900'
                  }`}>
                    📊 Evaluación de Coherencia
                  </h3>
                  <span className={`text-2xl font-bold ${
                    plan.coherence_evaluation.coherence_score >= 80 
                      ? 'text-green-600' 
                      : plan.coherence_evaluation.coherence_score >= 50 
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}>
                    {plan.coherence_evaluation.coherence_score}/100
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">
                  {plan.coherence_evaluation.summary || plan.coherence_evaluation.cv_summary || 'Evaluación completada'}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Refleja CV:</span>
                    <span className={`ml-1 font-medium ${
                      plan.coherence_evaluation.reflects_cv === 'Sí' ? 'text-green-600' : 'text-red-600'
                    }`}>{plan.coherence_evaluation.reflects_cv || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Empresas correctas:</span>
                    <span className={`ml-1 font-medium ${
                      plan.coherence_evaluation.correct_companies === 'Sí' ? 'text-green-600' : 
                      plan.coherence_evaluation.correct_companies === 'N/A' ? 'text-gray-600' : 'text-red-600'
                    }`}>{plan.coherence_evaluation.correct_companies || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Años experiencia:</span>
                    <span className={`ml-1 font-medium ${
                      plan.coherence_evaluation.correct_experience_years === 'Sí' ? 'text-green-600' : 
                      plan.coherence_evaluation.correct_experience_years === 'N/A' ? 'text-gray-600' : 'text-red-600'
                    }`}>{plan.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Info inventada:</span>
                    <span className={`ml-1 font-medium ${
                      plan.coherence_evaluation.invented_info === 'No' ? 'text-green-600' : 'text-red-600'
                    }`}>{plan.coherence_evaluation.invented_info || 'N/A'}</span>
                  </div>
                </div>

                {plan.coherence_evaluation.issues_found && plan.coherence_evaluation.issues_found.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Problemas encontrados:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {plan.coherence_evaluation.issues_found.slice(0, 3).map((issue, idx) => (
                        <li key={idx}>{typeof issue === 'string' ? issue : (issue.issue || issue.document_text || JSON.stringify(issue))}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(plan.coherence_evaluation.recommendation || plan.coherence_evaluation.recommendations) && (
                  <div className="bg-white/70 p-2 rounded text-xs">
                    <span className="font-medium text-gray-700">Recomendacion: </span>
                    <span className="text-gray-600">
                      {typeof plan.coherence_evaluation.recommendation === 'string' 
                        ? plan.coherence_evaluation.recommendation 
                        : Array.isArray(plan.coherence_evaluation.recommendations) 
                          ? plan.coherence_evaluation.recommendations.slice(0, 2).join(' | ')
                          : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alert for in-progress documents */}
        {plan.status === 'in_progress' && plan.current_section && plan.total_sections && plan.current_section < plan.total_sections && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Documento en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Este documento tiene {plan.current_section - 1} de {plan.total_sections} secciones completadas. 
                  Puedes continuar generando las secciones restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((plan.current_section - 1) / plan.total_sections) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-business-plan?resume_id=${plan.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        {/* 🌐 Banner de traducciones incompletas */}
        {translationStatus && !translationStatus.hasAllTranslations && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🌐</span>
                  <h3 className="font-semibold text-blue-900">Traducciones al Español Pendientes</h3>
                </div>
                <p className="text-sm text-blue-800 mb-3">
                  Este documento tiene {translationStatus.sectionsWithEs} de {translationStatus.totalSections} secciones traducidas al español ({translationStatus.percentage}%). 
                  {regeneratingTranslations 
                    ? ' Regenerando traducciones en segundo plano...'
                    : ' Haz clic en "Regenerar Traducciones" para generar las versiones en español.'}
                </p>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${translationStatus.percentage}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={regenerateTranslations}
                disabled={regeneratingTranslations}
                className="ml-4 bg-blue-600 hover:bg-blue-700"
                data-testid="regenerate-translations-btn"
              >
                {regeneratingTranslations ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Traduciendo...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🌐</span>
                    Regenerar Traducciones
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Evaluation Report Card - Show for auto-generated documents */}
        {plan.evaluation_report && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">Evaluación de Calidad USCIS</h3>
                <p className="text-sm text-green-800 mb-2">
                  Este documento fue generado automáticamente y pasó la evaluación de calidad.
                </p>
                {plan.evaluation_report.summary && (
                  <div className="text-sm text-green-700 bg-green-100 p-3 rounded mt-2">
                    <strong>Resumen:</strong> {plan.evaluation_report.summary}
                  </div>
                )}
                {plan.evaluation_report.score && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-green-800">Puntuación:</span>
                    <span className="px-2 py-1 bg-green-200 rounded text-green-900 font-bold">
                      {plan.evaluation_report.score}/100
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Needed Alert */}
        {plan.status === 'review_needed' && !plan.evaluation_report && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Requiere Revisión</h3>
                <p className="text-sm text-yellow-800">
                  Este documento fue generado automáticamente pero requiere una revisión manual. 
                  Por favor revisa el contenido y realiza los ajustes necesarios.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card className="editor-card">
          <CardContent className="p-6">
            {/* Toggle de idioma para vista completa */}
            {!editMode && (
              <div className="mb-6 flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {currentLanguage === 'es' ? '📄 Versión en Español' : '📄 English Version'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {currentLanguage === 'es' 
                      ? 'Visualizando documento completo en español' 
                      : 'Viewing complete document in English'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newLang = currentLanguage === 'es' ? 'en' : 'es';
                    setCurrentLanguage(newLang);
                    console.log('🌐 Idioma cambiado a:', newLang);
                  }}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  {currentLanguage === 'es' ? '🇺🇸 Switch to English' : '🇪🇸 Cambiar a Español'}
                </button>
              </div>
            )}
            
            {!editMode ? (
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    // ⭐ FIX: Usar fullContent compilado según el idioma actual
                    const contentToDisplay = currentLanguage === 'es' ? fullContent.es : fullContent.en;
                    return contentToDisplay || '<p style="color: #999;">No hay contenido disponible</p>';
                  })()
                }}
                style={{
                  minHeight: '500px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="editor-textarea"
                data-testid="content-editor"
                rows={30}
              />
            )}
            <style>{`
              .prose h1, .prose h2, .prose h3 {
                font-weight: 600;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                color: #000;
              }
              .prose h1 {
                font-size: 2rem;
                border-bottom: 2px solid #000;
                padding-bottom: 0.5rem;
              }
              .prose h2 {
                font-size: 1.5rem;
                border-bottom: 1px solid #ddd;
                padding-bottom: 0.25rem;
              }
              .prose h3 {
                font-size: 1.25rem;
              }
              .prose p {
                margin-bottom: 1rem;
                text-align: justify;
              }
              .prose table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
              }
              .prose th {
                background-color: #f3f4f6;
                padding: 10px 12px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #000;
              }
              .prose td {
                padding: 10px 12px;
                border: 1px solid #ddd;
              }
              .prose tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .prose ul, .prose ol {
                margin: 1rem 0;
                padding-left: 2rem;
              }
              .prose li {
                margin-bottom: 0.5rem;
              }
              .prose strong, .prose b {
                font-weight: 600;
                color: #000;
              }
            `}</style>
          </CardContent>
        </Card>
      </div>

      {/* Version History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <History size={24} />
              Historial de Cambios
            </DialogTitle>
            <DialogDescription>
              Haz clic en cada cambio para ver el contenido antes y después. Puedes deshacer cambios individuales.
            </DialogDescription>
          </DialogHeader>
          
          {/* Botón para restaurar todo al estado inicial */}
          {plan?.sections?.some(s => s.change_history && s.change_history.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600" />
                  <span className="text-sm text-amber-800">¿Deseas restaurar todo el documento a su versión inicial?</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={async () => {
                    if (!window.confirm('¿Estás seguro de restaurar TODO el documento a su versión inicial? Esta acción no se puede deshacer.')) return;
                    
                    try {
                      const token = localStorage.getItem('token');
                      const response = await axios.post(
                        `${API}/business-plans/${id}/restore-initial`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      
                      if (response.data.success) {
                        toast.success(`✅ ${response.data.message}`);
                        setShowHistory(false);
                        // Recargar el plan
                        window.location.reload();
                      }
                    } catch (error) {
                      toast.error('Error al restaurar: ' + (error.response?.data?.detail || error.message));
                    }
                  }}
                >
                  <RefreshCw size={14} className="mr-1" />
                  Restaurar Versión Inicial
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-4 py-4">
            {/* Mostrar historial de cada sección */}
            {plan?.sections && plan.sections.length > 0 ? (
              <div className="space-y-4">
                {plan.sections
                  .filter(section => section.ai_edited || (section.change_history && section.change_history.length > 0))
                  .map((section, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div className="bg-purple-50 px-4 py-3 border-b">
                        <h4 className="font-medium text-purple-800">
                          Sección {section.number}: {section.title}
                        </h4>
                        {section.ai_edit_timestamp && (
                          <p className="text-xs text-purple-600 mt-1">
                            Última edición: {new Date(section.ai_edit_timestamp).toLocaleString('es-ES')}
                          </p>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        {section.ai_edited && (
                          <div className="flex items-center gap-2 text-sm text-green-600 mb-2">
                            <CheckCircle size={16} />
                            <span>Editado con IA</span>
                          </div>
                        )}
                        
                        {/* Historial de cambios con acordeón */}
                        {section.change_history && section.change_history.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">Cambios realizados:</p>
                            {section.change_history.map((change, i) => (
                              <details key={i} className="group border rounded-lg">
                                <summary className="cursor-pointer p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-purple-600 font-medium">#{section.change_history.length - i}</span>
                                    <span className="text-sm text-gray-700">{change.change_summary || change.instructions || 'Edición con IA'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {change.timestamp ? new Date(change.timestamp).toLocaleString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : ''}
                                    </span>
                                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                                  </div>
                                </summary>
                                <div className="p-4 border-t bg-white">
                                  {/* Botón para deshacer este cambio */}
                                  <div className="flex justify-end mb-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                      onClick={async () => {
                                        if (!window.confirm(`¿Restaurar esta sección al estado ANTES de este cambio?`)) return;
                                        
                                        try {
                                          const token = localStorage.getItem('token');
                                          const response = await axios.post(
                                            `${API}/business-plans/${id}/undo-change`,
                                            {
                                              section_number: section.number,
                                              history_index: i
                                            },
                                            { headers: { Authorization: `Bearer ${token}` } }
                                          );
                                          
                                          if (response.data.success) {
                                            toast.success(`✅ ${response.data.message}`);
                                            setShowHistory(false);
                                            window.location.reload();
                                          }
                                        } catch (error) {
                                          toast.error('Error: ' + (error.response?.data?.detail || error.message));
                                        }
                                      }}
                                    >
                                      <RefreshCw size={14} className="mr-1" />
                                      Deshacer este cambio
                                    </Button>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Vista resumida con diferencias resaltadas */}
                                    {(() => {
                                      const diff = highlightDifferences(
                                        change.original_content || '',
                                        change.new_content || ''
                                      );
                                      return (
                                        <>
                                          {/* Antes */}
                                          <div>
                                            <h6 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                                              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                              Antes
                                              <span className="text-xs text-gray-500 ml-2">
                                                ({change.chars_before || change.original_content?.length || 0} caracteres)
                                              </span>
                                            </h6>
                                            <div 
                                              className="text-xs text-gray-700 bg-red-50 p-3 rounded max-h-48 overflow-y-auto border border-red-100"
                                              dangerouslySetInnerHTML={{ __html: diff.before || '(Sin contenido previo)' }}
                                            />
                                          </div>
                                          
                                          {/* Después */}
                                          <div>
                                            <h6 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                                              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                              Después
                                              <span className="text-xs text-gray-500 ml-2">
                                                ({change.chars_after || change.new_content?.length || 0} caracteres)
                                                {(change.chars_after || change.new_content?.length || 0) !== (change.chars_before || change.original_content?.length || 0) && (
                                                  <span className={`ml-1 font-semibold ${(change.chars_after || change.new_content?.length || 0) < (change.chars_before || change.original_content?.length || 0) ? 'text-orange-600' : 'text-green-600'}`}>
                                                    ({(change.chars_after || change.new_content?.length || 0) > (change.chars_before || change.original_content?.length || 0) ? '+' : ''}
                                                    {(change.chars_after || change.new_content?.length || 0) - (change.chars_before || change.original_content?.length || 0)})
                                                  </span>
                                                )}
                                              </span>
                                            </h6>
                                            <div 
                                              className="text-xs text-gray-700 bg-green-50 p-3 rounded max-h-48 overflow-y-auto border border-green-100"
                                              dangerouslySetInnerHTML={{ __html: diff.after || '(Sin contenido)' }}
                                            />
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                  
                                  {/* Botón para ver contenido completo */}
                                  <details className="mt-3">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                      Ver contenido completo...
                                    </summary>
                                    <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t">
                                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                                        {change.original_content || '(Sin contenido)'}
                                      </div>
                                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                                        {change.new_content || '(Sin contenido)'}
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              </details>
                            )).reverse()}
                          </div>
                        ) : section.edit_history && section.edit_history.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Instrucciones aplicadas:</p>
                            <ul className="space-y-2">
                              {section.edit_history.map((instruction, i) => (
                                <li key={i} className="text-sm bg-gray-50 p-2 rounded border-l-4 border-purple-300">
                                  {typeof instruction === 'string' ? instruction : instruction.instructions || JSON.stringify(instruction)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">Sin detalles de cambios disponibles</p>
                        )}
                      </div>
                    </div>
                  ))}
                
                {plan.sections.filter(s => s.ai_edited || (s.change_history && s.change_history.length > 0)).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No hay cambios registrados todavía.</p>
                    <p className="text-sm mt-2">Las ediciones con IA se mostrarán aquí.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p>No hay historial disponible.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowHistory(false)} variant="outline">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Panel - TODO: Implementar componente compartido */}
      
      {/* ⭐ MODAL: Edición Global con IA */}
      <Dialog open={showAIEditModal} onOpenChange={setShowAIEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="text-purple-600" size={24} />
              Edición Global con IA
            </DialogTitle>
            <DialogDescription>
              Describe los cambios que deseas aplicar a todo el documento. La IA analizará todas las secciones y aplicará las modificaciones necesarias.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 mb-2">💡 Ejemplos de instrucciones:</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• "Agrega más estadísticas y datos cuantitativos sobre el impacto económico"</li>
                <li>• "Reduce el contenido de todas las secciones en un 20%"</li>
                <li>• "Fortalece la argumentación sobre importancia nacional con referencias a políticas federales"</li>
                <li>• "Cambia el tono a más formal y académico"</li>
                <li>• "Añade más evidencia de las calificaciones del peticionario"</li>
              </ul>
            </div>
            
            <div>
              <Label htmlFor="ai-instructions-vbp" className="text-base font-medium">
                Instrucciones de edición
              </Label>
              <Textarea
                id="ai-instructions-vbp"
                value={aiEditInstructions}
                onChange={(e) => setAiEditInstructions(e.target.value)}
                placeholder="Describe qué cambios quieres aplicar al documento..."
                rows={6}
                className="mt-2"
                data-testid="ai-edit-instructions-textarea"
              />
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-amber-800">
                La IA modificará las secciones relevantes según tus instrucciones. Los cambios se guardarán automáticamente.
              </p>
            </div>
          </div>
          
          {aiEditLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3" data-testid="ai-edit-progress">
              <div className="flex items-start gap-3">
                <Loader2 className="animate-spin text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900">Editando con IA...</p>
                  <p className="text-xs text-blue-700 mt-0.5 break-words">{aiEditProgressMsg || 'Iniciando proceso...'}</p>
                  <p className="text-xs text-blue-500 mt-1">Las ediciones estructurales pueden tomar 2-5 minutos. No cierres esta ventana.</p>
                </div>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ 
                    width: aiEditProgressMsg?.includes('Guardando') ? '90%' : 
                           aiEditProgressMsg?.includes('Claude') ? '70%' : 
                           aiEditProgressMsg?.includes('Analizando') ? '20%' :
                           aiEditProgressMsg?.includes('Enviando') ? '45%' : '35%',
                    animation: 'pulse 2s ease-in-out infinite'
                  }} 
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAIEditModal(false);
                setAiEditInstructions('');
              }}
              disabled={aiEditLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAIGlobalEdit}
              disabled={aiEditLoading || !aiEditInstructions.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="apply-ai-edit-btn"
            >
              {aiEditLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  {aiEditProgressMsg || 'Procesando con IA...'}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2" size={18} />
                  Aplicar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* ⭐ MODAL: Resultados de Edición con IA (Antes/Después) */}
      <Dialog open={showAIEditResults} onOpenChange={setShowAIEditResults}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${aiEditResults?.total_sections_modified > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
              {aiEditResults?.total_sections_modified > 0 ? <CheckCircle size={24} /> : <span>⚠️</span>}
              {aiEditResults?.total_sections_modified > 0 ? 'Cambios Aplicados Exitosamente' : 'Sin Cambios Aplicados'}
            </DialogTitle>
            <DialogDescription>
              {aiEditResults?.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {aiEditResults?.total_sections_modified > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✅ Se modificaron {aiEditResults?.total_sections_modified} sección(es)
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">
                  ⚠️ El asistente analizó el documento pero no detectó cambios que aplicar.
                </p>
                <p className="text-yellow-700 text-sm mt-2">
                  Intenta instrucciones más específicas. Por ejemplo: "En la sección 2, elimina todos los textos entre paréntesis".
                </p>
              </div>
            )}
            
            {/* Lista de cambios con antes/después */}
            <div className="space-y-6">
              {aiEditResults?.changes?.map((change, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <h4 className="font-medium">
                      Sección {change.section_number}: {change.section_title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      📝 {change.change_summary}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 divide-x">
                    {/* Vista con diferencias resaltadas */}
                    {(() => {
                      const origContent = change.original_content || '';
                      const newContent = change.new_content || '';
                      const charsBefore = change.chars_before || origContent.length || 0;
                      const charsAfter = change.chars_after || newContent.length || 0;
                      const diff = highlightDifferences(origContent, newContent);
                      return (
                        <>
                          {/* Antes */}
                          <div className="p-4">
                            <h5 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                              <span className="w-3 h-3 bg-red-200 rounded-full"></span>
                              Antes
                              <span className="text-xs text-gray-500 ml-2">
                                ({charsBefore} caracteres)
                              </span>
                            </h5>
                            <div 
                              className="text-sm text-gray-700 bg-red-50 p-3 rounded max-h-48 overflow-y-auto border border-red-100"
                              dangerouslySetInnerHTML={{ __html: origContent ? (diff.before || origContent.substring(0, 500)) : `(${charsBefore > 0 ? charsBefore + ' caracteres - contenido no disponible en vista previa' : 'Sin contenido previo'})` }}
                            />
                          </div>
                          
                          {/* Después */}
                          <div className="p-4">
                            <h5 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                              <span className="w-3 h-3 bg-green-200 rounded-full"></span>
                              Después
                              <span className="text-xs text-gray-500 ml-2">
                                ({charsAfter} caracteres)
                                {charsAfter !== charsBefore && (
                                  <span className={`ml-1 font-semibold ${charsAfter < charsBefore ? 'text-orange-600' : 'text-green-600'}`}>
                                    ({charsAfter > charsBefore ? '+' : ''}{charsAfter - charsBefore})
                                  </span>
                                )}
                              </span>
                            </h5>
                            <div 
                              className="text-sm text-gray-700 bg-green-50 p-3 rounded max-h-48 overflow-y-auto border border-green-100"
                              dangerouslySetInnerHTML={{ __html: newContent ? (diff.after || newContent.substring(0, 500)) : `(${charsAfter > 0 ? charsAfter + ' caracteres - contenido no disponible en vista previa' : 'Sin contenido'})` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Opción para ver contenido completo */}
                  <details className="px-4 pb-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Ver contenido completo...
                    </summary>
                    <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t">
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {change.original_content || '(Sin contenido)'}
                      </div>
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {change.new_content || '(Sin contenido)'}
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                setShowAIEditResults(false);
                const tkn = localStorage.getItem('token');
                if (tkn) {
                  try {
                    await axios.post(`${API}/business-plans/${id}/evaluate-uscis`, {}, {
                      headers: { 'Authorization': `Bearer ${tkn}` }
                    });
                    toast.success('🔄 Re-evaluación iniciada. Los resultados aparecerán en la página del documento.');
                  } catch (err) {
                    toast.error('Error al iniciar re-evaluación');
                  }
                }
              }}
              data-testid="reevaluate-after-edit-btn"
            >
              🔄 Re-evaluar documento
            </Button>
            <Button
              onClick={() => {
                setShowAIEditResults(false);
                setAiEditResults(null);
                setAiEditInstructions('');
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="close-ai-results-btn"
            >
              <CheckCircle className="mr-2" size={18} />
              Entendido, Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default ViewBusinessPlan;
