import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Book, Download, Loader2, ArrowLeft, ArrowRight, Save, Edit, RefreshCw, CheckCircle, Copy, Globe, AlertCircle, Sparkles, Languages, Play, FileText, ImageIcon, History, MessageSquare, Reply, Send, X, Check, Trash2 } from 'lucide-react';
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
import { WordDownloadButton } from '../components/WordDownloadButton';

const ViewBook = () => {
  const [book, setBook] = useState(null);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState('full'); // full, chapters
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false); // ✅ Fix: Variable faltante
  const [generatingTranslation, setGeneratingTranslation] = useState(false); // Para traducción
  const [downloading, setDownloading] = useState(false); // Estado para descarga de PDF
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('es'); // ⭐ Estado para idioma

  // 🤖 AI Edit with Before/After preview (new feature, same UX as Business Plans)
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditProgressMsg, setAiEditProgressMsg] = useState('');
  const [aiEditScope, setAiEditScope] = useState('current'); // 'current' | 'all'
  const [showAIEditResults, setShowAIEditResults] = useState(false);
  const [aiEditResults, setAiEditResults] = useState(null);
  const pathParts = window.location.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    loadBook();
    loadCommentStats();
  }, []);

  // Auto-generate translation in background when book loads
  useEffect(() => {
    if (book && book.language === 'es') {
      checkAndGenerateTranslation();
    }
  }, [book?.id]);

  const checkAndGenerateTranslation = async () => {
    if (!book || generatingTranslation) return;
    
    // ✅ FIX: Only generate translation if the book was created WITHOUT English content
    // Check if chapters have English content
    const hasAnyEnglishContent = book.chapters?.some(ch => 
      ch.content_en && ch.content_en.length > 100
    );
    
    // If book already has English content, don't translate
    if (hasAnyEnglishContent) {
      console.log('✅ Book already has English content, skipping translation');
      return;
    }
    
    // Check if translation is needed (for old books without English)
    const needsTranslation = 
      book.language === 'es' &&
      book.chapters?.length > 0 &&
      !hasAnyEnglishContent;
    
    if (needsTranslation) {
      console.log('🔄 Auto-generating English translation in background...');
      generateTranslation();
    } else {
      console.log('✅ Translation not needed or already available');
    }
  };

  const generateTranslation = async () => {
    setGeneratingTranslation(true);
    try {
      const token = localStorage.getItem('token');
      
      toast.info('🔄 Preparando versión en inglés en segundo plano...', {
        autoClose: 3000
      });
      
      await axios.post(
        `${API}/books/${id}/generate-translation`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('✅ Versión en inglés lista para descargar');
      await loadBook();
    } catch (error) {
      console.error('Error generating translation:', error);
      console.log('Translation will be generated on-demand when needed');
    } finally {
      setGeneratingTranslation(false);
    }
  };

  const loadBook = async () => {
    try {
      // First try to fetch from in-progress collection
      let response;
      let isInProgress = false;
      try {
        response = await axios.get(`${API}/books/in-progress/${id}`);
        console.log('✓ Loaded book from in-progress collection');
        isInProgress = true;
      } catch (inProgressError) {
        // If not found in in-progress, try completed collection
        console.log('Book not in progress, trying completed collection...');
        response = await axios.get(`${API}/books/${id}`);
        console.log('✓ Loaded book from completed collection');
      }
      
      const bookData = response.data;
      setBook(bookData);
      
      // ✅ FIX: Build content from chapters if main content is empty or has error message
      const hasValidContent = bookData.content && 
                              bookData.content.length > 100 && 
                              !bookData.content.includes("can't assist");
      
      if (!hasValidContent && bookData.chapters && bookData.chapters.length > 0) {
        console.log('📝 Building content from chapters...');
        
        // ✅ Get client name for author
        let authorName = 'Autor';
        if (bookData.client_id) {
          try {
            const clientResponse = await axios.get(`${API}/clients/${bookData.client_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            authorName = clientResponse.data.name || 'Autor';
          } catch (error) {
            console.error('Error fetching client:', error);
          }
        }
        
        // ✅ Build professional book format with cover page
        const coverPage = `
          <div style="text-align: center; padding: 100px 50px; min-height: 80vh; display: flex; flex-direction: column; justify-content: center;">
            <h1 style="font-size: 3em; font-style: italic; margin-bottom: 30px; font-family: Georgia, serif;">
              ${bookData.title.replace('(RECOMMENDED)', '').trim()}
            </h1>
            ${bookData.synopsis ? `
              <p style="font-size: 1.2em; margin: 30px auto; max-width: 600px; color: #555;">
                ${bookData.synopsis}
              </p>
            ` : ''}
            <p style="font-size: 1.3em; margin-top: 50px; text-align: right; padding-right: 100px;">
              ${authorName}
            </p>
          </div>
          <div style="page-break-after: always;"></div>
        `;
        
        // ✅ Build chapters WITHOUT duplicating h2 tags
        const chaptersContent = bookData.chapters
          .map(ch => {
            let chapterContent = ch.content_es || ch.content || '';
            
            // Remove the first <h2> tag if it exists (to avoid duplication)
            chapterContent = chapterContent.replace(/^<h2>.*?<\/h2>\s*/i, '');
            
            const chapterTitle = ch.title || `Capítulo ${ch.number}`;
            const chapterNum = ch.number;
            
            return `
              <div style="page-break-before: always; padding-top: 50px;">
                <h2 style="text-align: center; font-size: 2em; margin-bottom: 40px; font-family: Georgia, serif;">
                  Capítulo ${chapterNum} — ${chapterTitle}
                </h2>
                ${chapterContent}
              </div>
            `;
          })
          .join('\n\n');
        
        const builtContent = coverPage + chaptersContent;
        setContent(builtContent);
      } else {
        setContent(bookData.content || '');
      }
    } catch (error) {
      console.error('Error loading book:', error);
      toast.error('Error al cargar el libro');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSection = async () => {
    if (!currentChapter) return;
    
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/books/approve-chapter/${id}/${currentChapter.number}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('✓ Capítulo aprobado');
      
      // Reload chapters to update status
      await loadChapters();
    } catch (error) {
      console.error('Error approving chapter:', error);
      toast.error('Error al aprobar el capítulo');
    } finally {
      setGenerating(false);
    }
  };

  // 🤖 AI Edit with Before/After preview — async job + polling
  const submitAIEdit = async () => {
    if (!aiEditInstructions.trim() || !id) {
      toast.error('Proporciona instrucciones de edición.');
      return;
    }
    setAiEditLoading(true);
    setAiEditProgressMsg('Iniciando edición con IA…');
    try {
      const token = localStorage.getItem('token');
      const body = {
        edit_instructions: aiEditInstructions,
        language: currentLanguage,
      };
      if (aiEditScope === 'current' && currentChapter?.number) {
        body.chapter_number = currentChapter.number;
      }
      const startRes = await axios.post(
        `${API}/books/${id}/ai-edit-async`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { job_id } = startRes.data;
      // Poll every 3s, up to 5 minutes
      const maxAttempts = 100;
      let attempt = 0;
      const pollIntervalMs = 3000;
      const poll = async () => {
        attempt += 1;
        try {
          const jobRes = await axios.get(
            `${API}/books/ai-edit-job/${job_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const job = jobRes.data;
          setAiEditProgressMsg(job.progress_message || 'Procesando…');
          if (job.status === 'completed') {
            setAiEditResults(job.result);
            setShowAIEditModal(false);
            setShowAIEditResults(true);
            setAiEditInstructions('');
            setAiEditLoading(false);
            toast.success(`✓ Edición completada: ${job.result?.edited_chapter_count || 0} capítulo(s) actualizado(s)`);
            await loadBook();
            return;
          }
          if (job.status === 'failed') {
            toast.error(`Error: ${job.error || 'Falló la edición'}`);
            setAiEditLoading(false);
            return;
          }
          if (attempt >= maxAttempts) {
            toast.error('La edición está tomando mucho tiempo. Revisa más tarde.');
            setAiEditLoading(false);
            return;
          }
          setTimeout(poll, pollIntervalMs);
        } catch (err) {
          console.error('Polling error:', err);
          toast.error('Error al consultar el estado del trabajo');
          setAiEditLoading(false);
        }
      };
      setTimeout(poll, pollIntervalMs);
    } catch (err) {
      console.error('AI edit start error:', err);
      toast.error(err.response?.data?.detail || 'Error al iniciar la edición');
      setAiEditLoading(false);
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
        `${API}/books/edit-chapter/${id}/${currentChapter.number}`,
        {
          edit_instructions: editInstructions
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentChapter(response.data.chapter);
      
      // Update chapters array
      const updatedChapters = [...chapters];
      const existingIndex = updatedChapters.findIndex(ch => ch.number === currentChapter.number);
      
      if (existingIndex >= 0) {
        updatedChapters[existingIndex] = response.data.chapter;
        setChapters(updatedChapters);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Capítulo actualizado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const loadChapters = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/books/${id}/chapters`);
      setChapters(response.data.chapters);
      if (response.data.chapters.length > 0) {
        setCurrentChapter(response.data.chapters[0]);
        setChapterNumber(1);
      }
      setViewMode('chapters');
    } catch (error) {
      toast.error('Error al cargar capítulos');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/books/${id}`,
        { content },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      toast.success('Cambios guardados exitosamente');
      await loadBook(); // Reload to see updated content
    } catch (error) {
      console.error('Error saving book:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleEditChapter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/books/${id}/chapters/${chapterNumber}`,
        {
          chapter_number: chapterNumber,
          edit_instructions: editInstructions,
          current_chapter_content: currentChapter.content,
          current_chapter_title: currentChapter.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Capítulo actualizado exitosamente');
      setEditInstructions('');
      setEditMode(false);
      
      // Reload chapters to get updated content
      await loadChapters();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar capítulo');
    } finally {
      setSaving(false);
    }
  };

  const goToChapter = (chapNum) => {
    const chapter = chapters.find(ch => ch.number === chapNum);
    if (chapter) {
      setCurrentChapter(chapter);
      setChapterNumber(chapNum);
      setEditMode(false);
      setEditInstructions('');
    }
  };

  const downloadPDF = async (language = 'es') => {
    setDownloading(true);
    try {
      toast.info(`⏳ Generando PDF en ${language === 'es' ? 'español' : 'inglés'}...`);
      
      const response = await axios.get(`${API}/books/${id}/download?language=${language}`, {
        responseType: 'blob',
        validateStatus: (status) => status < 500 // Accept 2xx and 4xx responses
      });
      
      // CRITICAL FIX: When responseType='blob', response.data is ALWAYS a Blob.
      // Check content-type to detect JSON responses (202 translation-in-progress) vs real PDFs.
      const contentType = response.headers['content-type'] || '';
      if (response.status === 202 || contentType.includes('application/json')) {
        // Read blob as text, then parse JSON
        try {
          const text = await response.data.text();
          const jsonData = JSON.parse(text);
          if (jsonData.status === 'translating' || jsonData.message) {
            toast.warning(
              `🌐 ${jsonData.message || 'La traducción al español está en progreso. Intenta descargar de nuevo en 1-2 minutos.'}`,
              { duration: 12000 }
            );
            setDownloading(false);
            return;
          }
        } catch (_) {
          // Not valid JSON — fall through to download as PDF
        }
      }
      
      // Validate that it's actually a PDF (should start with %PDF)
      const firstBytes = await response.data.slice(0, 4).text();
      if (!firstBytes.startsWith('%PDF')) {
        // Try to read as JSON to get error message
        try {
          const text = await response.data.text();
          const json = JSON.parse(text);
          toast.error(`❌ ${json.message || json.detail || 'Error al generar el PDF'}`);
        } catch (_) {
          toast.error('❌ El archivo descargado no es un PDF válido. Intenta de nuevo.');
        }
        setDownloading(false);
        return;
      }
      
      // It's a real PDF blob - download it
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      
      // Use server-provided filename (includes client name) from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
      const serverFilename = contentDisposition.match(/filename[^;=\n]*=['"]?([^'";\n]*)['"]?/)?.[1];
      const langSuffix = language === 'en' ? '_EN' : '_ES';
      const fallbackFilename = `${(book.title || 'libro').replace(/[^a-zA-Z0-9\s-_]/g, '')}${langSuffix}.pdf`;
      link.setAttribute('download', serverFilename || fallbackFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`✅ Descarga completada en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      // Check if it's a translation in progress response
      if (error.response && error.response.status === 202) {
        const data = error.response.data;
        if (data && data.status === 'translating') {
          toast.warning(`🌐 ${data.message}`, { duration: 8000 });
          return;
        }
      }
      toast.error('❌ Error al descargar PDF. Intenta de nuevo en unos segundos.');
    } finally {
      setDownloading(false);
    }
  };

  const regenerateCurrentChapter = async () => {
    try {
      setGenerating(true);
      toast.info('🔄 Regenerando capítulo...');
      const token = localStorage.getItem('token');
      
      const chapterNum = currentChapter?.number || chapterNumber;
      
      const response = await axios.post(
        `${API}/books/${id}/regenerate-chapter/${chapterNum}`,
        null,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('✅ Capítulo regenerado exitosamente');
        
        // Update current chapter
        setCurrentChapter(response.data.chapter);
        
        // Update chapters array
        const updatedChapters = [...chapters];
        const existingIndex = updatedChapters.findIndex(ch => ch.number === chapterNum);
        
        if (existingIndex >= 0) {
          updatedChapters[existingIndex] = response.data.chapter;
          setChapters(updatedChapters);
        }
        
        // If in full view, reload book
        if (viewMode === 'full') {
          const bookResponse = await axios.get(`${API}/books/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setBook(bookResponse.data);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al regenerar el capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const loadCommentStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/comments/${id}/stats?document_type=book`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setCommentStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading comment stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Cargando libro...</p>
      </div>
    );
  }

  if (viewMode === 'chapters' && currentChapter && book) {
    return (
      <div className="view-container">
        <div className="view-header">
          <Button variant="ghost" onClick={() => setViewMode('full')} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Vista Completa
          </Button>
          <div className="flex items-center gap-4">
            {/* ⭐ Toggle de idioma */}
            <button
              onClick={() => {
                const newLang = currentLanguage === 'es' ? 'en' : 'es';
                setCurrentLanguage(newLang);
                toast.success(newLang === 'es' ? '🇪🇸 Cambiado a Español' : '🇺🇸 Switched to English', {
                  autoClose: 1500
                });
              }}
              style={{
                background: currentLanguage === 'es' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                borderRadius: '20px',
                padding: '0.4rem 1.2rem',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              {currentLanguage === 'es' ? '🇺🇸 Switch to English' : '🇪🇸 Cambiar a Español'}
            </button>
            {/* ⭐ Botones Anterior/Siguiente */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => goToChapter(chapterNumber - 1)}
                disabled={chapterNumber === 1}
              >
                <ArrowLeft size={16} className="mr-1" />
                Anterior
              </Button>
              <span className="text-sm font-medium px-3">
                Capítulo {chapterNumber} de {chapters.length}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => goToChapter(chapterNumber + 1)}
                disabled={chapterNumber === chapters.length}
              >
                Siguiente
                <ArrowLeft size={16} className="ml-1" style={{transform: 'rotate(180deg)'}} />
              </Button>
            </div>
            <div className="flex gap-1">
              {chapters.map(ch => {
                // ✅ Fix: Determinar estado real del capítulo
                const isApproved = ch.approved === true;
                const hasContent = (ch.content_es && ch.content_es.length > 100) || 
                                 (ch.content && ch.content.length > 100);
                const isCurrent = ch.number === chapterNumber;
                
                let bgColor = 'bg-gray-200 hover:bg-gray-300'; // Pendiente/no generado
                let textColor = 'text-gray-600';
                
                if (isCurrent) {
                  bgColor = 'bg-black text-white'; // Capítulo actual
                  textColor = 'text-white';
                } else if (isApproved) {
                  bgColor = 'bg-green-500 hover:bg-green-600'; // Aprobado y completo
                  textColor = 'text-white';
                } else if (hasContent) {
                  bgColor = 'bg-yellow-400 hover:bg-yellow-500'; // Generado pero no aprobado
                  textColor = 'text-black';
                }
                
                return (
                  <button
                    key={ch.number}
                    onClick={() => goToChapter(ch.number)}
                    className={`w-8 h-8 rounded text-xs font-medium ${bgColor} ${textColor}`}
                    title={
                      isApproved ? 'Capítulo aprobado' : 
                      hasContent ? 'Capítulo generado' : 
                      'Pendiente de generar'
                    }
                  >
                    {ch.number}
                  </button>
                );
              })}
            </div>
            
            {/* ⭐ Leyenda de estados */}
            <div className="flex items-center gap-3 text-xs text-gray-600 ml-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Aprobado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-400"></div>
                <span>Generado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-200"></div>
                <span>Pendiente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-black"></div>
                <span>Actual</span>
              </div>
            </div>
          </div>
        </div>

        <div className="view-content max-w-4xl mx-auto">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{currentChapter.title || 'Sin título'}</CardTitle>
              <CardDescription>Capítulo {chapterNumber} - {book.title || 'Libro'}</CardDescription>
            </CardHeader>
            <CardContent>
              {currentLanguage === 'en' && !currentChapter.content_en && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffc107', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: 0, color: '#856404' }}>
                    ⚠️ Contenido en inglés no disponible aún. Mostrando versión en español.
                  </p>
                </div>
              )}
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: currentLanguage === 'es'
                    ? (currentChapter.content_es || currentChapter.content || '')
                    : (currentChapter.content_en || currentChapter.content_es || currentChapter.content || '<p>Contenido no disponible</p>')
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.75rem;
                  font-weight: bold;
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                  color: #000;
                  text-align: center;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                  text-indent: 2em;
                }
                .prose em, .prose i {
                  font-style: italic;
                  color: #555;
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
                variant="outline"
                onClick={regenerateCurrentChapter}
                disabled={generating}
                className="bg-orange-50 hover:bg-orange-100 border-orange-300"
              >
                <RefreshCw className="mr-2" size={18} />
                Regenerar Capítulo
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
                <CardTitle>Editar Sección {chapterNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en este capítulo
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
          if (book?.client_id) {
            navigate(`/client-documents/${book.client_id}/books`);
          } else {
            navigate('/dashboard');
          }
        }} data-testid="back-button">
          <ArrowLeft className="mr-2" size={18} />
          {t('form.back')}
        </Button>
        <div className="view-actions">
          <Button
            onClick={() => setShowAIEditModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="ai-edit-book-btn"
            title="Pide a la IA que edite tu libro con instrucciones en lenguaje natural"
          >
            <Sparkles className="mr-2" size={18} />
            Editar con IA
          </Button>
          <Button onClick={() => setEditMode(!editMode)} variant="outline">
            <Edit className="mr-2" size={18} />
            {editMode ? 'Vista Previa' : 'Editar'}
          </Button>
          <Button onClick={saveContent} disabled={saving || !editMode} data-testid="save-btn">
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
            url={`${API}/books/${id}/download-docx`}
            testId="download-word-en-book"
          />
          <Button 
            onClick={async () => {
              try {
                setDownloading(true);
                const token = localStorage.getItem('token');
                toast.loading('Generando imagen de portada con IA...', { id: 'cover-image' });
                
                // Start async generation
                await axios.post(
                  `${API}/books/${id}/generate-cover-image`,
                  {},
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Poll for completion
                let attempts = 0;
                const maxAttempts = 60; // 2 minutes max
                const pollInterval = 2000; // 2 seconds
                
                const checkStatus = async () => {
                  attempts++;
                  const statusResponse = await axios.get(
                    `${API}/books/${id}/cover-status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  
                  const { status, image_url, error } = statusResponse.data;
                  
                  if (status === 'completed' && image_url) {
                    toast.success('¡Imagen de portada generada! Descargando...', { id: 'cover-image' });
                    
                    // Use the download endpoint through the API
                    const downloadUrl = `${API}/books/${id}/download-cover`;
                    
                    // Create a link and trigger download
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = `portada_${id}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    setDownloading(false);
                    return;
                  } else if (status === 'error') {
                    toast.error('Error generando imagen: ' + (error || 'Error desconocido'), { id: 'cover-image' });
                    setDownloading(false);
                    return;
                  } else if (attempts >= maxAttempts) {
                    toast.error('Timeout: La generación tardó demasiado', { id: 'cover-image' });
                    setDownloading(false);
                    return;
                  }
                  
                  // Continue polling
                  setTimeout(checkStatus, pollInterval);
                };
                
                // Start polling after 2 seconds
                setTimeout(checkStatus, pollInterval);
                
              } catch (error) {
                toast.error('Error generando imagen: ' + (error.response?.data?.detail || error.message), { id: 'cover-image' });
                setDownloading(false);
              }
            }} 
            variant="outline" 
            className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200"
            disabled={downloading}
          >
            {downloading ? <Loader2 className="mr-2 animate-spin" size={18} /> : <ImageIcon className="mr-2" size={18} />}
            🎨 Generar Portada
          </Button>
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
        {book && (
          <>
            <div className="document-header">
              <h1 className="document-title">{book.title}</h1>
              <p className="document-meta">{book.genre} • {book.num_chapters} capítulos • {new Date(book.created_at).toLocaleDateString('es', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              })}</p>
            </div>

            {/* ✅ NUEVO: Mostrar evaluación de coherencia si existe */}
            {book.coherence_evaluation && (
              <div className={`mb-4 p-4 rounded-lg border ${
                book.coherence_evaluation.coherence_score >= 80 
                  ? 'bg-green-50 border-green-200' 
                  : book.coherence_evaluation.coherence_score >= 50 
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    book.coherence_evaluation.coherence_score >= 80 
                      ? 'bg-green-100' 
                      : book.coherence_evaluation.coherence_score >= 50 
                        ? 'bg-yellow-100'
                        : 'bg-red-100'
                  }`}>
                    {book.coherence_evaluation.coherence_score >= 80 ? (
                      <CheckCircle className="text-green-600" size={24} />
                    ) : book.coherence_evaluation.coherence_score >= 50 ? (
                      <AlertCircle className="text-yellow-600" size={24} />
                    ) : (
                      <AlertCircle className="text-red-600" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${
                        book.coherence_evaluation.coherence_score >= 80 
                          ? 'text-green-900' 
                          : book.coherence_evaluation.coherence_score >= 50 
                            ? 'text-yellow-900'
                            : 'text-red-900'
                      }`}>
                        📊 Evaluación de Coherencia del Libro
                      </h3>
                      <span className={`text-2xl font-bold ${
                        book.coherence_evaluation.coherence_score >= 80 
                          ? 'text-green-600' 
                          : book.coherence_evaluation.coherence_score >= 50 
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}>
                        {book.coherence_evaluation.coherence_score}/100
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-3">
                      {book.coherence_evaluation.summary || 'Evaluación completada'}
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                      <div className="bg-white/50 p-2 rounded">
                        <span className="text-gray-500">Refleja CV:</span>
                        <span className={`ml-1 font-medium ${
                          book.coherence_evaluation.reflects_cv === 'Sí' ? 'text-green-600' : 'text-red-600'
                        }`}>{book.coherence_evaluation.reflects_cv || 'N/A'}</span>
                      </div>
                      <div className="bg-white/50 p-2 rounded">
                        <span className="text-gray-500">Empresas correctas:</span>
                        <span className={`ml-1 font-medium ${
                          book.coherence_evaluation.correct_companies === 'Sí' ? 'text-green-600' : 
                          book.coherence_evaluation.correct_companies === 'N/A' ? 'text-gray-600' : 'text-red-600'
                        }`}>{book.coherence_evaluation.correct_companies || 'N/A'}</span>
                      </div>
                      <div className="bg-white/50 p-2 rounded">
                        <span className="text-gray-500">Años experiencia:</span>
                        <span className={`ml-1 font-medium ${
                          book.coherence_evaluation.correct_experience_years === 'Sí' ? 'text-green-600' : 
                          book.coherence_evaluation.correct_experience_years === 'N/A' ? 'text-gray-600' : 'text-red-600'
                        }`}>{book.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                      </div>
                      <div className="bg-white/50 p-2 rounded">
                        <span className="text-gray-500">Info inventada:</span>
                        <span className={`ml-1 font-medium ${
                          book.coherence_evaluation.invented_info === 'No' ? 'text-green-600' : 'text-red-600'
                        }`}>{book.coherence_evaluation.invented_info || 'N/A'}</span>
                      </div>
                    </div>

                    {book.coherence_evaluation.issues_found && book.coherence_evaluation.issues_found.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">Problemas encontrados:</p>
                        <ul className="text-xs text-gray-600 list-disc list-inside">
                          {book.coherence_evaluation.issues_found.slice(0, 3).map((issue, idx) => (
                            <li key={idx}>{typeof issue === 'string' ? issue : (issue.issue || issue.document_text || JSON.stringify(issue))}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {book.coherence_evaluation.recommendation && (
                      <div className="bg-white/70 p-2 rounded text-xs">
                        <span className="font-medium text-gray-700">💡 Recomendación: </span>
                        <span className="text-gray-600">{book.coherence_evaluation.recommendation}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alert for in-progress documents */}
            {book.status === 'in_progress' && book.current_chapter && book.num_chapters && book.current_chapter <= book.num_chapters && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Libro en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Este libro tiene {book.current_chapter - 1} de {book.num_chapters} capítulos completados. 
                  Puedes continuar generando los capítulos restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((book.current_chapter - 1) / book.num_chapters) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-book?resume_id=${book.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
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
                    // Recargar contenido en el nuevo idioma
                    loadBook();
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
                dangerouslySetInnerHTML={{ __html: content }}
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
          </>
        )}
      </div>

      {/* Version History Modal */}
      <VersionHistory
        documentId={id}
        documentType="book"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => {
          setShowHistory(false);
          loadBook();
        }}
      />

      {/* Comments Panel */}
      <CommentsPanel
        documentId={id}
        documentType="book"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />

      {/* =============================================================== */}
      {/* AI EDIT MODAL — natural-language editing with Claude Sonnet       */}
      {/* =============================================================== */}
      <Dialog open={showAIEditModal} onOpenChange={(open) => { if (!aiEditLoading) setShowAIEditModal(open); }}>
        <DialogContent className="max-w-2xl" data-testid="ai-edit-book-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-purple-600" size={22} />
              Editar con IA
            </DialogTitle>
            <DialogDescription>
              Describe en lenguaje natural los cambios que quieres. Claude Sonnet aplicará la edición
              al libro y te mostrará una vista <strong>Antes/Después</strong> para que la aprueves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Alcance de la edición</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={aiEditScope === 'current' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAiEditScope('current')}
                  disabled={!currentChapter}
                  data-testid="ai-edit-scope-current"
                >
                  Sólo capítulo actual{currentChapter ? ` (${currentChapter.number})` : ''}
                </Button>
                <Button
                  type="button"
                  variant={aiEditScope === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAiEditScope('all')}
                  data-testid="ai-edit-scope-all"
                >
                  Todos los capítulos
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="ai-edit-instructions" className="text-sm font-medium">
                Instrucciones para la IA
              </Label>
              <Textarea
                id="ai-edit-instructions"
                value={aiEditInstructions}
                onChange={(e) => setAiEditInstructions(e.target.value)}
                placeholder="Ej: cambia el tono a más formal; agrega un caso real en cada capítulo; acorta la introducción a 3 párrafos; elimina repeticiones…"
                rows={6}
                className="mt-2"
                disabled={aiEditLoading}
                data-testid="ai-edit-instructions-textarea"
              />
              <p className="text-xs text-gray-500 mt-1">
                Idioma actual: <strong>{currentLanguage === 'es' ? 'Español' : 'English'}</strong>. La IA editará el contenido en ese idioma.
              </p>
            </div>
            {aiEditLoading && (
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-md p-3">
                <Loader2 className="animate-spin text-purple-600" size={20} />
                <span className="text-sm text-purple-900">{aiEditProgressMsg}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAIEditModal(false)}
              disabled={aiEditLoading}
              data-testid="ai-edit-cancel-btn"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitAIEdit}
              disabled={aiEditLoading || !aiEditInstructions.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="ai-edit-submit-btn"
            >
              {aiEditLoading ? (
                <><Loader2 className="mr-2 animate-spin" size={16} /> Editando…</>
              ) : (
                <><Sparkles className="mr-2" size={16} /> Aplicar con IA</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============================================================== */}
      {/* AI EDIT RESULTS — Before/After preview                           */}
      {/* =============================================================== */}
      <Dialog open={showAIEditResults} onOpenChange={setShowAIEditResults}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="ai-edit-results-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={22} />
              Edición aplicada — Vista Antes / Después
            </DialogTitle>
            <DialogDescription>
              {aiEditResults?.edited_chapter_count || 0} de {aiEditResults?.total_chapters_considered || 0} capítulo(s) editado(s). Los cambios ya quedaron guardados en el libro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {aiEditResults?.changes?.map((change, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-white" data-testid={`ai-edit-change-${change.chapter_number}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-base">
                    Capítulo {change.chapter_number}: {change.chapter_title}
                  </h4>
                  <span className={`text-xs font-medium ${(change.chars_after - change.chars_before) >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {change.chars_before} → {change.chars_after} chars
                    {change.chars_after !== change.chars_before && (
                      <> ({(change.chars_after - change.chars_before) > 0 ? '+' : ''}{change.chars_after - change.chars_before})</>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Antes</div>
                    <div
                      className="prose prose-sm max-w-none border rounded p-3 bg-red-50 max-h-80 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: change.original_content || '<em>(vacío)</em>' }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Después</div>
                    <div
                      className="prose prose-sm max-w-none border rounded p-3 bg-green-50 max-h-80 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: change.new_content || '<em>(vacío)</em>' }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {(!aiEditResults?.changes || aiEditResults.changes.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                No se aplicaron cambios.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowAIEditResults(false)}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="ai-edit-results-close-btn"
            >
              <Check className="mr-2" size={16} /> Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Protected Route Component

// ============================================================================
// VERSION HISTORY COMPONENT - Sistema de Historial y Rollback
// ============================================================================

const VersionHistory = ({ documentId, documentType, onRestore, open, onClose }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [comparison, setComparison] = useState(null);
  const { t, i18n } = useTranslation();
  const BACKEND_URL = window.location.origin;

  useEffect(() => {
    if (open && documentId) {
      loadVersionHistory();
    }
  }, [open, documentId]);

  const loadVersionHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/history?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
      alert(t('error_loading_versions') || 'Error cargando historial de versiones');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) {
      alert(t('select_two_versions') || 'Selecciona exactamente 2 versiones para comparar');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/compare?version_from=${v1}&version_to=${v2}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setComparison(data.comparison);
      }
    } catch (error) {
      console.error('Error comparing versions:', error);
      alert(t('error_comparing') || 'Error comparando versiones');
    }
  };

  const handleRollback = async (versionNumber) => {
    const confirmMsg = i18n.language === 'es' 
      ? `¿Restaurar documento a versión ${versionNumber}?`
      : `Restore document to version ${versionNumber}?`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            document_type: documentType,
            version_number: versionNumber
          })
        }
      );
      
      const data = await response.json();
      alert(data.message);
      if (onRestore) onRestore();
      loadVersionHistory();
    } catch (error) {
      console.error('Error during rollback:', error);
      alert(t('error_rollback') || 'Error durante rollback');
    }
  };

  const toggleVersionSelection = (versionNumber) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionNumber)) {
        return prev.filter(v => v !== versionNumber);
      } else if (prev.length < 2) {
        return [...prev, versionNumber];
      } else {
        return [prev[1], versionNumber];
      }
    });
  };

  const getChangeTypeIcon = (changeType) => {
    const icons = {
      'manual_edit': '✏️',
      'ai_regeneration': '🤖',
      'section_approval': '✅',
      'rollback': '⏪',
      'finalize': '🎯'
    };
    return icons[changeType] || '📝';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            📜 {i18n.language === 'es' ? 'Historial de Versiones' : 'Version History'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex gap-2 p-4 border-b">
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  setSelectedVersions([]);
                  setComparison(null);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                {compareMode 
                  ? (i18n.language === 'es' ? 'Cancelar Comparación' : 'Cancel Comparison')
                  : (i18n.language === 'es' ? 'Comparar Versiones' : 'Compare Versions')}
              </button>
              {compareMode && selectedVersions.length === 2 && (
                <button
                  onClick={handleCompare}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  {i18n.language === 'es' ? 'Ver Diferencias' : 'View Differences'}
                </button>
              )}
              <div className="ml-auto text-sm text-gray-600">
                {i18n.language === 'es' ? `${versions.length} versiones` : `${versions.length} versions`}
              </div>
            </div>

            {/* Version List */}
            {!comparison ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.version_number}
                    className={`border rounded-lg p-4 hover:shadow-md transition ${
                      compareMode && selectedVersions.includes(version.version_number)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={selectedVersions.includes(version.version_number)}
                              onChange={() => toggleVersionSelection(version.version_number)}
                              className="w-4 h-4"
                            />
                          )}
                          <span className="text-lg font-semibold">
                            {i18n.language === 'es' ? 'Versión' : 'Version'} #{version.version_number}
                          </span>
                          {version.is_snapshot && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                              Snapshot
                            </span>
                          )}
                          {version.version_number === versions[0].version_number && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              {i18n.language === 'es' ? 'Actual' : 'Current'}
                            </span>
                          )}
                          <span className="text-xl">{getChangeTypeIcon(version.change_type)}</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          {formatDate(version.created_at)}
                        </p>

                        {version.change_description && (
                          <p className="text-gray-700 mb-2 text-sm">
                            {version.change_description}
                          </p>
                        )}

                        <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                          {version.sections_changed && version.sections_changed.length > 0 && (
                            <span>
                              📍 {i18n.language === 'es' ? 'Secciones' : 'Sections'}: {version.sections_changed.join(', ')}
                            </span>
                          )}
                          {version.characters_added > 0 && (
                            <span className="text-green-600">
                              +{version.characters_added} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                            </span>
                          )}
                          {version.characters_removed > 0 && (
                            <span className="text-red-600">
                              -{version.characters_removed} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                            </span>
                          )}
                          {version.quality_score && (
                            <span>⭐ {version.quality_score}/10</span>
                          )}
                        </div>
                      </div>

                      {!compareMode && version.version_number < versions[0].version_number && (
                        <button
                          onClick={() => handleRollback(version.version_number)}
                          className="ml-4 px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          ⏪ {i18n.language === 'es' ? 'Restaurar' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Comparison View */
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                  <button
                    onClick={() => setComparison(null)}
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    ← {i18n.language === 'es' ? 'Volver a la lista' : 'Back to list'}
                  </button>
                </div>

                <h3 className="text-xl font-bold mb-2">
                  {i18n.language === 'es' ? 'Comparación' : 'Comparison'}: v{comparison.version_from} → v{comparison.version_to}
                </h3>
                <div className="flex gap-4 mb-4 text-sm">
                  <span className="text-green-600">
                    +{comparison.summary.added} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                  </span>
                  <span className="text-red-600">
                    -{comparison.summary.removed} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                  </span>
                  <span className="text-gray-600">
                    {comparison.summary.modified_sections} {i18n.language === 'es' ? 'secciones modificadas' : 'modified sections'}
                  </span>
                </div>

                {(comparison.sections_modified || []).map((section) => (
                  <div key={section.section_number} className="mb-6 border-b pb-6">
                    <h4 className="font-semibold text-lg mb-3">
                      {i18n.language === 'es' ? 'Sección' : 'Section'} {section.section_number}: {section.section_title}
                    </h4>
                    
                    {/* Side by side view */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">
                          {i18n.language === 'es' ? 'Versión' : 'Version'} {comparison.version_from}
                        </p>
                        <div className="bg-red-50 p-3 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {section.old_text}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">
                          {i18n.language === 'es' ? 'Versión' : 'Version'} {comparison.version_to}
                        </p>
                        <div className="bg-green-50 p-3 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {section.new_text}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <DialogFooter className="border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            {i18n.language === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// END VERSION HISTORY COMPONENT
// ============================================================================

// ============================================================================
// COMMENTS SYSTEM COMPONENT - Sistema de Comentarios Colaborativos
// ============================================================================

const CommentsPanel = ({ documentId, documentType, sectionNumber = null, open, onClose }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [stats, setStats] = useState(null);
  const { t, i18n } = useTranslation();
  const BACKEND_URL = window.location.origin;
  const textareaRef = useRef(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);

  useEffect(() => {
    if (open && documentId) {
      loadComments();
      loadStats();
    }
  }, [open, documentId, sectionNumber, filter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${BACKEND_URL}/api/comments/${documentId}`;
      const params = [`document_type=${documentType}`];
      if (sectionNumber !== null) params.push(`section_number=${sectionNumber}`);
      if (filter !== 'all') params.push(`status=${filter}`);
      if (params.length > 0) url += '?' + params.join('&');

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error(t('error_loading_comments') || 'Error cargando comentarios');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${documentId}/stats?document_type=${documentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: documentId,
          document_type: documentType,
          content: newComment,
          section_number: sectionNumber,
          parent_comment_id: replyingTo
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewComment('');
        setReplyingTo(null);
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario agregado' : 'Comment added');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error(t('error_submitting') || 'Error al enviar comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario resuelto' : 'Comment resolved');
      }
    } catch (error) {
      console.error('Error resolving comment:', error);
      toast.error(t('error_resolving') || 'Error al resolver');
    }
  };

  const handleReopen = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}/reopen`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario reabierto' : 'Comment reopened');
      }
    } catch (error) {
      console.error('Error reopening comment:', error);
      toast.error(t('error_reopening') || 'Error al reabrir');
    }
  };

  const handleEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editContent })
      });

      const data = await response.json();
      if (data.success) {
        setEditingComment(null);
        setEditContent('');
        loadComments();
        toast.success(i18n.language === 'es' ? 'Comentario actualizado' : 'Comment updated');
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error(t('error_editing') || 'Error al editar');
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm(i18n.language === 'es' ? '¿Eliminar comentario?' : 'Delete comment?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario eliminado' : 'Comment deleted');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(t('error_deleting') || 'Error al eliminar');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return i18n.language === 'es' ? 'Justo ahora' : 'Just now';
    if (diffMins < 60) return i18n.language === 'es' ? `Hace ${diffMins} min` : `${diffMins} min ago`;
    if (diffHours < 24) return i18n.language === 'es' ? `Hace ${diffHours}h` : `${diffHours}h ago`;
    if (diffDays < 7) return i18n.language === 'es' ? `Hace ${diffDays} días` : `${diffDays} days ago`;
    
    return date.toLocaleDateString(i18n.language);
  };

  const renderComment = (comment, isReply = false) => {
    const isEditing = editingComment === comment.comment_id;
    const isDeleted = comment.deleted;

    return (
      <div key={comment.comment_id} className={`${isReply ? 'ml-8 mt-2' : 'mt-4'} ${comment.status === 'resolved' ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
            {comment.author_name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{comment.author_name}</span>
                <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                {comment.edited && (
                  <span className="text-xs text-gray-400">
                    ({i18n.language === 'es' ? 'editado' : 'edited'})
                  </span>
                )}
                {comment.status === 'resolved' && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                    <Check size={12} />
                    {i18n.language === 'es' ? 'Resuelto' : 'Resolved'}
                  </span>
                )}
              </div>
              
              {comment.status === 'open' && !isDeleted && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingComment(comment.comment_id);
                      setEditContent(comment.content);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Editar' : 'Edit'}
                  >
                    <Edit size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(comment.comment_id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Eliminar' : 'Delete'}
                  >
                    <Trash2 size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleResolve(comment.comment_id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Resolver' : 'Resolve'}
                  >
                    <Check size={14} className="text-green-600" />
                  </button>
                </div>
              )}
              
              {comment.status === 'resolved' && (
                <button
                  onClick={() => handleReopen(comment.comment_id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {i18n.language === 'es' ? 'Reabrir' : 'Reopen'}
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="mt-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(comment.comment_id)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {i18n.language === 'es' ? 'Guardar' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingComment(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                {!isReply && comment.status === 'open' && !isDeleted && (
                  <button
                    onClick={() => setReplyingTo(comment.comment_id)}
                    className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Reply size={12} />
                    {i18n.language === 'es' ? 'Responder' : 'Reply'}
                  </button>
                )}
              </>
            )}
            
            {/* Replies */}
            {comment.replies_data && comment.replies_data.length > 0 && (
              <div className="mt-2">
                {comment.replies_data.map(reply => renderComment(reply, true))}
              </div>
            )}
            
            {/* Reply form */}
            {replyingTo === comment.comment_id && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={i18n.language === 'es' ? 'Escribe tu respuesta...' : 'Write your reply...'}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSubmitComment}
                    disabled={submitting || !newComment.trim()}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {i18n.language === 'es' ? 'Enviar' : 'Send'}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setNewComment('');
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={20} />
            {i18n.language === 'es' ? 'Comentarios' : 'Comments'}
            {sectionNumber && ` - ${i18n.language === 'es' ? 'Sección' : 'Section'} ${sectionNumber}`}
          </DialogTitle>
          
          {stats && (
            <div className="flex gap-4 text-sm text-gray-600 mt-2">
              <span>{i18n.language === 'es' ? 'Total' : 'Total'}: {stats.total}</span>
              <span className="text-orange-600">{i18n.language === 'es' ? 'Abiertos' : 'Open'}: {stats.open}</span>
              <span className="text-green-600">{i18n.language === 'es' ? 'Resueltos' : 'Resolved'}: {stats.resolved}</span>
            </div>
          )}
        </DialogHeader>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Todos' : 'All'}
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-3 py-1 text-sm rounded ${filter === 'open' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Abiertos' : 'Open'}
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1 text-sm rounded ${filter === 'resolved' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Resueltos' : 'Resolved'}
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-2 text-gray-300" />
              <p>{i18n.language === 'es' ? 'No hay comentarios aún' : 'No comments yet'}</p>
              <p className="text-sm">{i18n.language === 'es' ? 'Sé el primero en comentar' : 'Be the first to comment'}</p>
            </div>
          ) : (
            <div className="pb-4">
              {comments.map(comment => renderComment(comment))}
            </div>
          )}
        </div>

        {/* New comment form */}
        {!replyingTo && (
          <div className="border-t pt-4">
            <form onSubmit={handleSubmitComment}>
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={i18n.language === 'es' ? 'Escribe un comentario... (usa @usuario para mencionar)' : 'Write a comment... (use @user to mention)'}
                rows={3}
                className="mb-2"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {i18n.language === 'es' ? 'Tip: Usa @usuario para mencionar' : 'Tip: Use @user to mention'}
                </span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {i18n.language === 'es' ? 'Comentar' : 'Comment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// END COMMENTS SYSTEM COMPONENT
// ============================================================================

// ============================================================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================================================


export default ViewBook;
