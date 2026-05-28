import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, Edit, RefreshCw, CheckCircle, Copy, Globe, Sparkles, Languages, History, Scale, AlertCircle, X, AlertTriangle, Lightbulb, XCircle, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
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

const ViewPatent = () => {
  const [patent, setPatent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('es');
  const [editingSpec, setEditingSpec] = useState(false);
  const [editingDrawings, setEditingDrawings] = useState(false);
  const [editedSpecContent, setEditedSpecContent] = useState('');
  const [editedDrawingsContent, setEditedDrawingsContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluating, setEvaluating] = useState(false); // loading indicator for diagram generation
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [generatingTranslation, setGeneratingTranslation] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadPatent();
    loadCommentStats();
    loadExistingEvaluation();
  }, [id]);

  // Auto-generate translation in background when patent loads
  useEffect(() => {
    if (patent) {
      checkAndGenerateTranslation();
    }
  }, [patent?.id]); // Only run when patent is loaded

  const checkAndGenerateTranslation = async () => {
    if (!patent || generatingTranslation) return;
    
    // Check if translation is needed
    const needsTranslation = 
      (patent.sections?.some(s => !s.content_en)) || 
      (!patent.specification_content_en && patent.specification_content) ||
      (!patent.drawings_content_en && patent.drawings_content) ||
      !patent.invention_title_en ||
      !patent.technical_field_en ||
      !patent.invention_description_en;
    
    if (needsTranslation) {
      console.log('🔄 Auto-generating English translation in background...');
      generateTranslation();
    } else {
      console.log('✅ English translation already available');
    }
  };

  const generateTranslation = async () => {
    setGeneratingTranslation(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⚠️ NOTE: Patents V2 already generate bilingual content, no separate translation needed
      // Skip translation generation for V2 patents
      console.log('Patent generated with bilingual content (V2)');
      
      // Show success message directly
      toast.success('✅ ¡Patente generada en inglés! Ahora puedes descargar el PDF completo.', {
        autoClose: 8000,
        position: 'top-center',
        style: {
          fontSize: '16px',
          padding: '20px',
          fontWeight: 'bold'
        }
      });
      
      await loadPatent(); // Reload to show completed patent
    } catch (error) {
      console.error('Error loading patent:', error);
      toast.error('Error al cargar la patente. Por favor refresca la página.');
    } finally {
      setGeneratingTranslation(false);
    }
  };

  const loadPatent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/patents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPatent(response.data);
      setEditedSpecContent(response.data.specification_content || '');
      setEditedDrawingsContent(response.data.drawings_content || '');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la patente');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadCommentStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/comments/${id}/stats?document_type=patent`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setCommentStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading comment stats:', error);
    }
  };


  const loadExistingEvaluation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/patents/${id}/evaluation`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setEvaluationResult(response.data);
    } catch (error) {
      // No evaluation exists yet, which is fine
      console.log('No existing evaluation found');
    }
  };


  const saveSpecification = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Update all sections with the edited content
      // If editing sections, need to update each one
      if (patent.sections && patent.sections.length > 0) {
        // Split content by double newlines or page breaks to match sections
        const contentParts = editedSpecContent.split(/\n\n+/);
        
        // Update each section
        for (let i = 0; i < patent.sections.length && i < contentParts.length; i++) {
          const section = patent.sections[i];
          const updateField = currentLanguage === 'en' ? 'content_en' : 'content_es';
          
          await axios.post(
            `${API}/patents/edit-section/${id}`,
            {
              section_number: section.number,
              content: contentParts[i].trim(),
              language: currentLanguage
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
        }
      } else {
        // Update specification_content
        await axios.post(
          `${API}/patents/edit-section/${id}`,
          {
            section_number: 1,
            content: editedSpecContent,
            language: currentLanguage
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      setEditingSpec(false);
      toast.success(`✅ Contenido actualizado en ${currentLanguage === 'en' ? 'inglés' : 'español'}`);
      
      // If editing Spanish, automatically re-translate to English
      if (currentLanguage === 'es') {
        toast.info('🔄 Re-traduciendo automáticamente al inglés...', {
          autoClose: false
        });
        
        // Trigger re-translation
        await axios.post(
          `${API}/patents/${id}/generate-translation`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        toast.dismiss();
        toast.success('✅ Versión en inglés actualizada automáticamente');
      }
      
      // Reload patent to get updated content
      await loadPatent();
      
    } catch (error) {
      console.error('Error:', error);
      toast.dismiss();
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const saveDrawings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/patents/edit-section/${id}`,
        {
          section_number: 2,
          content: editedDrawingsContent
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPatent({ ...patent, drawings_content: editedDrawingsContent });
      setEditingDrawings(false);
      toast.success('Dibujos actualizados');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const downloadDraft = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-draft?language=${language}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_draft${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Borrador descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar borrador');
    }
  };

  const downloadDrawings = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-drawings?language=${language}`,
        {
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_drawings${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Dibujos descargados en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar dibujos');
    }
  };


  const downloadComplete = async (language = 'es') => {
    setDownloadingPDF(true);
    
    // Show loading toast with progress info
    const loadingToastId = toast.info(
      '⏳ Generando PDF completo... Esto puede tardar 30-60 segundos mientras se generan los diagramas técnicos.',
      {
        autoClose: false,
        position: 'top-center',
        style: {
          fontSize: '15px',
          padding: '20px',
          maxWidth: '600px',
          fontWeight: '500'
        }
      }
    );
    
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-complete?language=${language}`,
        { 
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      // Dismiss loading toast
      toast.dismiss(loadingToastId);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_complete${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`✅ PDF completo descargado exitosamente en ${language === 'es' ? 'español' : 'inglés'}!`, {
        autoClose: 3000
      });
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToastId);
      
      // Check if it's a translation error (400 status)
      if (error.response?.status === 400 && language === 'en') {
        toast.warning(
          '⏳ La traducción al inglés aún está en proceso. Por favor espera 1 minuto y vuelve a intentarlo. Verás el mensaje "✅ Versión en inglés lista para descargar" cuando esté completa.',
          {
            autoClose: 8000,
            position: 'top-center',
            style: {
              fontSize: '15px',
              padding: '20px',
              maxWidth: '500px'
            }
          }
        );
      } else {
        toast.error('❌ Error al descargar documento completo. Por favor intenta de nuevo.');
      }
    } finally {
      setDownloadingPDF(false);
    }
  };

  const downloadNumbered = async (language = 'en') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-numbered?language=${language}`,
        {
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_numbered${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Documento con líneas numeradas descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar documento numerado');
    }
  };

  const downloadDocx = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-docx?language=${language}`,
        {
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}${langSuffix}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Documento Word descargado en ${language === 'es' ? 'español' : 'inglés'} (editable)`);
    } catch (error) {
      toast.error('Error al descargar el documento Word');
    }
  };

  const reEvaluateCoherence = async () => {
    setReEvaluating(true);
    try {
      const response = await axios.post(
        `${API}/patents/${id}/evaluate-coherence`,
        {},
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      const evaluation = response.data?.coherence_evaluation;
      if (evaluation) {
        setPatent((prev) => ({ ...prev, coherence_evaluation: evaluation }));
        toast.success(`Coherencia evaluada: ${evaluation.coherence_score}/100`);
      } else {
        await loadPatent();
        toast.success('Evaluación de coherencia actualizada');
      }
    } catch (error) {
      toast.error('No se pudo re-evaluar la coherencia');
    } finally {
      setReEvaluating(false);
    }
  };

  const generateDrawings = async () => {
    setEvaluating(true); // Using evaluating state as loading indicator
    try {
      const token = localStorage.getItem('token');
      const authHeader = { headers: { 'Authorization': `Bearer ${token}` } };

      // 1) Fire the background job — returns immediately. The 6 figures are
      //    generated in parallel (one LLM call per figure), so a single bad
      //    figure no longer blocks the others.
      await axios.post(
        `${API}/patents/${id}/regenerate-diagrams`,
        {},
        authHeader
      );
      toast.info('Generando las 6 figuras en paralelo... puede tardar 1-3 minutos.');

      // 2) Poll the patent until diagrams_status resolves (~up to 5 min).
      let final = null;
      for (let i = 0; i < 75; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          const resp = await axios.get(`${API}/patents/${id}`, authHeader);
          const st = resp.data.diagrams_status;
          if (st === 'generating') continue;
          if (st === 'completed' || st === 'partial' || st === 'error') {
            final = resp.data;
            break;
          }
        } catch (e) {
          // transient error — keep polling
        }
      }

      if (final) {
        const st = final.diagrams_status;
        const msg = final.diagrams_message || '';
        if (st === 'completed') {
          toast.success('¡Figuras generadas! ' + msg);
        } else if (st === 'partial') {
          toast.warning('Algunas figuras fallaron: ' + msg);
        } else {
          toast.error('Error generando figuras: ' + msg);
        }
        await loadPatent();
      } else {
        toast.warning('La generación sigue en curso. Refresca en un momento para ver las figuras.');
      }
    } catch (error) {
      console.error('Error generating drawings:', error);
      toast.error('Error al iniciar generación: ' + (error.response?.data?.detail || error.message));
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="create-container">
        <div className="loading-state">
          <Loader2 className="animate-spin" size={48} />
          <p>Cargando patente...</p>
        </div>
      </div>
    );
  }

  if (!patent) {
    return null;
  }

  const handleBack = () => {
    // If patent has client_id, go back to client dashboard
    if (patent.client_id) {
      navigate(`/client-dashboard/${patent.client_id}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="view-container">
      <div className="view-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2" size={18} />
          {patent.client_id ? 'Volver al Cliente' : 'Volver al Dashboard'}
        </Button>
        <div className="view-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Button 
            onClick={() => downloadComplete('es')} 
            variant="outline" 
            size="sm" 
            className="bg-purple-50 border-purple-300"
            disabled={downloadingPDF}
          >
            {downloadingPDF ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-1" size={14} />
                📦 Completo (ES)
              </>
            )}
          </Button>
          <Button 
            onClick={() => downloadComplete('en')} 
            variant="outline" 
            size="sm" 
            className={generatingTranslation ? "bg-yellow-50 border-yellow-300" : downloadingPDF ? "bg-yellow-50 border-yellow-300" : "bg-blue-50 border-blue-300"}
            disabled={generatingTranslation || downloadingPDF}
          >
            {downloadingPDF ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Generando PDF...
              </>
            ) : generatingTranslation ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Traduciendo...
              </>
            ) : (
              <>
                <Download className="mr-1" size={14} />
                📦 Completo (EN)
              </>
            )}
          </Button>

          {/* ── Descargas por documento separado ───────────────────────── */}
          {/* Diagramas y Numerado solo en inglés (formato de presentación USPTO). */}
          <Button onClick={() => downloadDrawings('en')} variant="outline" size="sm" className="bg-gray-50">
            <Download className="mr-1" size={14} />🖼️ Diagramas (EN)
          </Button>
          <Button onClick={() => downloadNumbered('en')} variant="outline" size="sm" className="bg-gray-50">
            <Download className="mr-1" size={14} />🔢 Numerado (EN)
          </Button>

          {/* ── Word editable (mismo contenido que el PDF Completo) ────────── */}
          <Button onClick={() => downloadDocx('en')} variant="outline" size="sm" className="bg-indigo-50 border-indigo-300">
            <Download className="mr-1" size={14} />📝 Word (EN)
          </Button>

          {/* TODO: Botón temporalmente deshabilitado - se incluye automáticamente en descarga completa
          <Button onClick={() => downloadNumbered('en')} variant="outline" size="sm" className="bg-green-50 border-green-300">
            <Download className="mr-1" size={14} />
            📋 Con Líneas Numeradas (EN)
          </Button>
          */}
          <Button
            onClick={generateDrawings}
            variant="outline"
            size="sm"
            className="bg-purple-50 border-purple-300"
            disabled={evaluating}
          >
            {evaluating ? (
              <><Loader2 className="mr-1 animate-spin" size={14} />Generando diagramas...</>
            ) : patent.drawings_content ? (
              <><RefreshCw className="mr-1" size={14} />Regenerar Diagramas</>
            ) : (
              <><Sparkles className="mr-1" size={14} />Generar Diagramas</>
            )}
          </Button>
          <Button 
            onClick={() => {
              let contentToEdit = '';
              
              if (patent.sections && patent.sections.length > 0) {
                contentToEdit = patent.sections
                  .map(section => {
                    return currentLanguage === 'es' 
                      ? (section.content_es || section.content || '')
                      : (section.content_en || section.content || '');
                  })
                  .join('\n\n');
              } else {
                contentToEdit = currentLanguage === 'en' 
                  ? (patent.specification_content_en || patent.specification_content || '')
                  : (patent.specification_content_es || patent.specification_content || '');
              }
              
              setEditedSpecContent(contentToEdit);
              setEditingSpec(true);
              
              setTimeout(() => {
                document.getElementById('patent-content')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            variant="outline" 
            size="sm" 
            className="bg-orange-50 border-orange-300"
          >
            <Edit className="mr-1" size={14} />
            ✏️ Editar
          </Button>
        </div>
      </div>

      <div className="view-content">
        <div className="document-header">
          <h1 className="document-title">
            <Scale className="inline mr-2" size={28} />
            {patent.invention_title}
          </h1>
          <p className="document-meta">
            {patent.inventor_name} • {patent.technical_field} • 
            {new Date(patent.created_at).toLocaleDateString('es', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })} • {new Date(patent.created_at).toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })}
          </p>
        </div>
        
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>
                <div className="space-y-1">
                  <p><strong>Inventor:</strong> {patent.inventor_name}</p>
                  <p><strong>Campo Técnico:</strong> {patent.technical_field}</p>
                </div>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* ✅ Mostrar evaluación de coherencia si existe */}
        {patent.coherence_evaluation && (
          <div className={`mb-4 p-4 rounded-lg border ${
            patent.coherence_evaluation.coherence_score >= 80 
              ? 'bg-green-50 border-green-200' 
              : patent.coherence_evaluation.coherence_score >= 50 
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                patent.coherence_evaluation.coherence_score >= 80 
                  ? 'bg-green-100' 
                  : patent.coherence_evaluation.coherence_score >= 50 
                    ? 'bg-yellow-100'
                    : 'bg-red-100'
              }`}>
                {patent.coherence_evaluation.coherence_score >= 80 ? (
                  <CheckCircle className="text-green-600" size={24} />
                ) : patent.coherence_evaluation.coherence_score >= 50 ? (
                  <AlertCircle className="text-yellow-600" size={24} />
                ) : (
                  <AlertCircle className="text-red-600" size={24} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold ${
                    patent.coherence_evaluation.coherence_score >= 80 
                      ? 'text-green-900' 
                      : patent.coherence_evaluation.coherence_score >= 50 
                        ? 'text-yellow-900'
                        : 'text-red-900'
                  }`}>
                    📊 Evaluación de Coherencia de Patente
                  </h3>
                  <span className={`text-2xl font-bold ${
                    patent.coherence_evaluation.coherence_score >= 80 
                      ? 'text-green-600' 
                      : patent.coherence_evaluation.coherence_score >= 50 
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}>
                    {patent.coherence_evaluation.coherence_score}/100
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">
                  {patent.coherence_evaluation.summary || 'Evaluación completada'}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Refleja CV:</span>
                    <span className={`ml-1 font-medium ${
                      patent.coherence_evaluation.reflects_cv === 'Sí' ? 'text-green-600' : 'text-red-600'
                    }`}>{patent.coherence_evaluation.reflects_cv || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Proyecto integrado:</span>
                    <span className={`ml-1 font-medium ${
                      patent.coherence_evaluation.project_integrated === 'Sí' ? 'text-green-600' : 
                      patent.coherence_evaluation.project_integrated === 'N/A' ? 'text-gray-600' : 'text-red-600'
                    }`}>{patent.coherence_evaluation.project_integrated || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Años experiencia:</span>
                    <span className={`ml-1 font-medium ${
                      patent.coherence_evaluation.correct_experience_years === 'Sí' ? 'text-green-600' : 
                      patent.coherence_evaluation.correct_experience_years === 'N/A' ? 'text-gray-600' : 'text-red-600'
                    }`}>{patent.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded">
                    <span className="text-gray-500">Info inventada:</span>
                    <span className={`ml-1 font-medium ${
                      patent.coherence_evaluation.invented_info === 'No' ? 'text-green-600' : 'text-red-600'
                    }`}>{patent.coherence_evaluation.invented_info || 'N/A'}</span>
                  </div>
                </div>

                {patent.coherence_evaluation.recommendation && (
                  <div className="bg-white/70 p-2 rounded text-xs">
                    <span className="font-medium text-gray-700">💡 Recomendación: </span>
                    <span className="text-gray-600">{patent.coherence_evaluation.recommendation}</span>
                  </div>
                )}

                <div className="mt-3">
                  <Button
                    onClick={reEvaluateCoherence}
                    variant="outline"
                    size="sm"
                    className="bg-white/70"
                    disabled={reEvaluating}
                  >
                    {reEvaluating ? (
                      <><Loader2 className="mr-1 animate-spin" size={14} />Re-evaluando coherencia...</>
                    ) : (
                      <><RefreshCw className="mr-1" size={14} />Re-evaluar coherencia</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alert for in-progress documents */}
        {patent.status === 'in_progress' && patent.current_section && patent.total_sections && patent.current_section <= patent.total_sections && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Patente en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Esta patente tiene {patent.current_section - 1} de {patent.total_sections} secciones completadas. 
                  Puedes continuar generando las secciones restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((patent.current_section - 1) / patent.total_sections) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-patent?resume_id=${patent.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        {/* Evaluation Feedback Card */}
        {patent.evaluation_feedback && (
          <Card className="mb-4 border-2" style={{
            borderColor: patent.quality_score >= 7 ? '#10b981' : '#f97316'
          }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className={patent.quality_score >= 7 ? 'text-green-600' : 'text-orange-600'} size={24} />
                  {currentLanguage === 'es' ? 'Evaluación de Calidad' : 'Quality Assessment'} - {patent.quality_score}/10
                </CardTitle>
                <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                  patent.quality_score >= 7 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {patent.quality_score >= 7 ? '✅ Aprobada' : '⚠️ Requiere Revisión'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    let feedback = patent.evaluation_feedback || '';
                    
                    // Simple translation for common patent evaluation terms if in English mode
                    if (currentLanguage === 'en' && feedback) {
                      // For now, show original feedback. In future, could implement translation
                      // This would require backend translation similar to NIW module
                      return feedback;
                    }
                    
                    return feedback;
                  })()
                }}
                style={{
                  lineHeight: '1.6',
                  color: '#374151'
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card id="patent-content">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Definición USPTO (35 U.S.C. §111(b))</CardTitle>
                {!editingSpec && (
                  <p className="text-sm text-gray-500 mt-1">
                    {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!editingSpec && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    marginBottom: '0.5rem',
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
                {!editingSpec ? (
                  <Button onClick={() => {
                    // Initialize content based on current language
                    let contentToEdit = '';
                    
                    // If patent has sections, compile them
                    if (patent.sections && patent.sections.length > 0) {
                      contentToEdit = patent.sections
                        .map(section => {
                          return currentLanguage === 'es' 
                            ? (section.content_es || section.content || '')
                            : (section.content_en || section.content || '');
                        })
                        .join('\n\n');
                    } else {
                      // Use specification_content field
                      contentToEdit = currentLanguage === 'en' 
                        ? (patent.specification_content_en || patent.specification_content || '')
                        : (patent.specification_content_es || patent.specification_content || '');
                    }
                    
                    setEditedSpecContent(contentToEdit);
                    setEditingSpec(true);
                  }} variant="outline" size="sm">
                    <Edit className="mr-2" size={16} />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={saveSpecification} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />Guardar</>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingSpec(false);
                        setEditedSpecContent(patent.specification_content);
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editingSpec ? (
              <Textarea
                value={editedSpecContent}
                onChange={(e) => setEditedSpecContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                style={{ fontFamily: 'monospace' }}
              />
            ) : generatingTranslation && currentLanguage === 'en' ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                <p className="text-lg font-semibold text-gray-700 mb-2">Generando traducción al inglés...</p>
                <p className="text-sm text-gray-500">Este proceso puede tomar entre 30-60 segundos</p>
              </div>
            ) : (
              <div 
                className="patent-content prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    // Si hay secciones, compilar el contenido del idioma seleccionado
                    if (patent.sections && patent.sections.length > 0) {
                      return patent.sections
                        .map(section => {
                          const sectionContent = currentLanguage === 'es' 
                            ? (section.content_es || section.content || '')
                            : (section.content_en || section.content || '');
                          return sectionContent;
                        })
                        .join('<div style="page-break-after: always;"></div>');
                    }
                    // Si no hay secciones, usar el campo specification_content
                    return currentLanguage === 'es'
                      ? (patent.specification_content_es || patent.specification_content || '')
                      : (patent.specification_content_en || patent.specification_content || '');
                  })()
                }}
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              />
            )}
          </CardContent>
        </Card>

        {!patent.drawings_content && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Diagramas de Patente (FIG. 1-6)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-gray-600 max-w-md">
                  Esta patente aún no tiene diagramas. Usa el botón
                  <span className="font-semibold text-purple-700"> “Generar Diagramas” </span>
                  de la barra superior. Las 6 figuras (FIG. 1-6) se generan en paralelo;
                  si alguna falla, las demás igual se incluyen. El PDF se puede descargar
                  sin diagramas mientras tanto.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {patent.drawings_content && (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dibujos de Patente (FIG. 1-6)</CardTitle>
                  {!editingDrawings && (
                    <p className="text-sm text-gray-500 mt-1">
                      {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                    </p>
                  )}
                </div>
                {!editingDrawings ? (
                  <div className="flex gap-2">
                    <Button onClick={() => setEditingDrawings(true)} variant="outline" size="sm">
                      <Edit className="mr-2" size={16} />
                      Editar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      onClick={saveDrawings} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />Guardar</>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingDrawings(false);
                        setEditedDrawingsContent(patent.drawings_content);
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingDrawings ? (
                <Textarea
                  value={editedDrawingsContent}
                  onChange={(e) => setEditedDrawingsContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  style={{ fontFamily: 'monospace' }}
                />
              ) : generatingTranslation && currentLanguage === 'en' ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                  <p className="text-lg font-semibold text-gray-700 mb-2">Traduciendo dibujos al inglés...</p>
                  <p className="text-sm text-gray-500">Por favor espera...</p>
                </div>
              ) : (
                <div 
                  className="drawings-content prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: currentLanguage === 'es'
                      ? (patent.drawings_content_es || patent.drawings_content || '')
                      : (patent.drawings_content_en || patent.drawings_content || '')
                  }}
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    fontFamily: 'Georgia, serif'
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version History Modal - TODO: Implementar componente compartido */}
      {/* Comments Panel - TODO: Implementar componente compartido */}

      {/* Patent Evaluation Modal */}
      {showEvaluationModal && evaluationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowEvaluationModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="text-green-600" size={32} />
                <span className="text-green-700">Evaluación USPTO Completa</span>
              </h2>
              <Button variant="ghost" onClick={() => setShowEvaluationModal(false)}>
                <X size={24} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Score Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Puntuación General</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Estructura</div>
                    <div className="text-2xl font-bold text-blue-600">{evaluationResult.puntuacion.estructura_formato}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Descripción Técnica</div>
                    <div className="text-2xl font-bold text-indigo-600">{evaluationResult.puntuacion.descripcion_tecnica}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Novedad</div>
                    <div className="text-2xl font-bold text-green-600">{evaluationResult.puntuacion.novedad_no_obviedad}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Claridad Legal</div>
                    <div className="text-2xl font-bold text-cyan-600">{evaluationResult.puntuacion.claridad_legal}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Completitud</div>
                    <div className="text-2xl font-bold text-teal-600">{evaluationResult.puntuacion.completitud}/10</div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                  <div className="text-sm text-gray-600 mb-1">Puntuación Total</div>
                  <div className="text-4xl font-bold text-blue-700">{evaluationResult.puntuacion.score_total.toFixed(2)}/10</div>
                </div>
              </div>

              {/* Critical Problems */}
              {evaluationResult.problemas_criticos && evaluationResult.problemas_criticos.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-red-900 flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={20} />
                    Problemas Críticos ({evaluationResult.problemas_criticos.length})
                  </h3>
                  <div className="space-y-3">
                    {evaluationResult.problemas_criticos.map((problem, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-red-200">
                        <div className="text-xs font-semibold text-red-600 uppercase mb-1">{problem.category}</div>
                        <div className="text-sm font-medium text-gray-900 mb-1">{problem.description}</div>
                        <div className="text-xs text-gray-600 mb-2">📍 {problem.location}</div>
                        <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
                          <span className="font-semibold">Corrección sugerida:</span> {problem.suggested_fix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minor Problems */}
              {evaluationResult.problemas_menores && evaluationResult.problemas_menores.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-yellow-900 flex items-center gap-2">
                    <AlertTriangle className="text-yellow-600" size={20} />
                    Problemas Menores ({evaluationResult.problemas_menores.length})
                  </h3>
                  <div className="space-y-2">
                    {evaluationResult.problemas_menores.map((problem, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                        <div className="text-xs font-semibold text-yellow-600 uppercase mb-1">{problem.category}</div>
                        <div className="text-sm text-gray-900">{problem.description}</div>
                        <div className="text-xs text-gray-600">📍 {problem.location}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Corrections Applied */}
              {evaluationResult.correcciones_aplicadas && evaluationResult.correcciones_aplicadas.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-blue-900 flex items-center gap-2">
                    <CheckCircle className="text-blue-600" size={20} />
                    Correcciones Aplicadas ({evaluationResult.correcciones_aplicadas.length})
                  </h3>
                  <ul className="space-y-2">
                    {evaluationResult.correcciones_aplicadas.map((correction, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 mt-1">✓</span>
                        <span className="text-gray-700">{correction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {evaluationResult.recomendaciones && evaluationResult.recomendaciones.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-purple-900 flex items-center gap-2">
                    <Lightbulb className="text-purple-600" size={20} />
                    Recomendaciones
                  </h3>
                  <ul className="space-y-2">
                    {evaluationResult.recomendaciones.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-600 mt-1">💡</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* USPTO Checklist */}
              {evaluationResult.checklist_uspto && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-green-900 flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    Checklist USPTO
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(evaluationResult.checklist_uspto).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {value ? (
                          <CheckCircle className="text-green-600" size={16} />
                        ) : (
                          <XCircle className="text-red-600" size={16} />
                        )}
                        <span className={value ? 'text-gray-700' : 'text-red-700'}>
                          {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Iteraciones: {evaluationResult.iteracion}</span>
                  <span>Evaluación: {new Date(evaluationResult.created_at).toLocaleString('es-ES')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowEvaluationModal(false)}>
                  Cerrar
                </Button>
                {evaluationResult.estado === 'APROBADA' && (
                  <Button onClick={() => downloadComplete('en')} className="bg-green-600 hover:bg-green-700">
                    <Download className="mr-2" size={16} />
                    Descargar Patente Aprobada
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default ViewPatent;
