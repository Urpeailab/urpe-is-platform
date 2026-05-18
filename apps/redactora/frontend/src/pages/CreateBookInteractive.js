import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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
import { Book, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, Copy, Sparkles, Languages, Play, Edit, FileText, Lightbulb, ImageIcon, Plus, Check, Info, List, Search, Star, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

const CreateBookInteractive = () => {
  const [step, setStep] = useState('profile'); // profile, ideas, titles, details, generating, review
  const [profileData, setProfileData] = useState({
    author_name: '',
    profile_summary: '',
    project_description: '',  // NEW: Optional project context
    patent_content: '',  // NEW: Optional patent context
    custom_book_idea: ''  // NEW: User's own book idea
  });
  const [profileInputMode, setProfileInputMode] = useState('text'); // 'text' or 'document'
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingProject, setUploadingProject] = useState(false);  // NEW
  const [uploadingPatent, setUploadingPatent] = useState(false);  // NEW
  const [uploadingBookIdea, setUploadingBookIdea] = useState(false);  // NEW: For book idea file upload
  const [useCustomIdea, setUseCustomIdea] = useState(false);  // NEW: Flag to use custom idea
  const [bookIdeas, setBookIdeas] = useState([]);
  const [bookIdeasEvaluation, setBookIdeasEvaluation] = useState(null);
  const [bookRecommendation, setBookRecommendation] = useState(null); // ⭐ Recomendación del evaluador
  const [selectedIdea, setSelectedIdea] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [titlesEvaluation, setTitlesEvaluation] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    synopsis: '',
    num_chapters: 10,
    writing_style: 'profesional'
  });
  const [bookId, setBookId] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapters, setChapters] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Only validate if we're actually on the create book page
  React.useEffect(() => {
    // Check if we're on the create book route
    const isCreateBookRoute = location.pathname.includes('create-book');
    
    if (isCreateBookRoute && !clientId && !resumeId) {
      console.warn('⚠️ No client_id or resume_id in URL on create book page.');
      // Give time for navigation to complete before showing error
      const timer = setTimeout(() => {
        if (!clientId && !resumeId) {
          toast.error('Se requiere seleccionar un cliente para crear un libro');
          navigate('/dashboard');
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [clientId, resumeId, navigate, location.pathname]);
  
  // Load client data and preload author name

  // ⭐ NEW: Guardar estado en localStorage cuando cambia
  React.useEffect(() => {
    if (bookId) {
      const bookState = {
        bookId,
        step,
        profileData,
        selectedIdea,
        selectedTitle,
        formData,
        chapters,
        chapterNumber,
        currentChapter
      };
      localStorage.setItem('book_in_progress', JSON.stringify(bookState));
    }
  }, [bookId, step, profileData, selectedIdea, selectedTitle, formData, chapters, chapterNumber, currentChapter]);

  // ⭐ NEW: Recuperar estado al montar el componente
  React.useEffect(() => {
    // Si NO hay resumeId en la URL, significa que queremos crear un libro NUEVO
    // En ese caso, limpiar el localStorage para empezar desde cero
    if (!resumeId && !bookId) {
      localStorage.removeItem('book_in_progress');
      console.log('🆕 Starting fresh book creation - localStorage cleared');
      return;
    }
    
    const savedState = localStorage.getItem('book_in_progress');
    if (savedState && !bookId) {
      try {
        const state = JSON.parse(savedState);
        // Solo recuperar si hay un bookId guardado y no estamos en profile
        if (state.bookId && state.step !== 'profile') {
          setBookId(state.bookId);
          setStep(state.step);
          setProfileData(state.profileData || profileData);
          setSelectedIdea(state.selectedIdea || '');
          setSelectedTitle(state.selectedTitle || '');
          setFormData(state.formData || formData);
          setChapters(state.chapters || []);
          setChapterNumber(state.chapterNumber || 1);
          setCurrentChapter(state.currentChapter);
          toast.info('📚 Recuperando tu libro en progreso...');
        }
      } catch (e) {
        console.error('Error recovering book state:', e);
      }
    }
  }, []);

  // Limpiar localStorage cuando se finaliza el libro
  const clearBookProgress = () => {
    localStorage.removeItem('book_in_progress');
  };

  React.useEffect(() => {
    const loadClientData = async () => {
      if (clientId && !resumeId) {
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
            // Preload author name with client name
            setProfileData(prev => ({
              ...prev,
              author_name: client.name || ''
            }));
          }
        } catch (error) {
          console.error('Error loading client data:', error);
        }
      }
    };
    
    loadClientData();
  }, [clientId, resumeId]);
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/books/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setBookId(doc.id);
            setFormData({
              title: doc.title || '',
              genre: doc.genre || '',
              synopsis: doc.synopsis || '',
              num_chapters: doc.num_chapters || 10,
              client_id: doc.client_id || ''
            });
            
            setProfileData({
              author_name: doc.author_name || '',
              profile_summary: doc.profile_summary || ''
            });
            
            // Check if this is a draft (book with draft_data and no chapters yet)
            if (doc.status === 'draft' && doc.draft_data) {
              // Load draft data to restore exact state
              const draftData = doc.draft_data;
              
              if (draftData.profileData) setProfileData(draftData.profileData);
              if (draftData.bookIdeas) setBookIdeas(draftData.bookIdeas);
              if (draftData.selectedIdea) setSelectedIdea(draftData.selectedIdea);
              if (draftData.titleSuggestions) setTitleSuggestions(draftData.titleSuggestions);
              if (draftData.selectedTitle) setSelectedTitle(draftData.selectedTitle);
              
              // Load form data from the document itself (saved in DB)
              setFormData(prev => ({
                ...prev,
                title: doc.title || '',
                genre: doc.genre || '',
                synopsis: doc.synopsis || '',
                num_chapters: doc.num_chapters || 10,
                writing_style: doc.writing_style || 'profesional',
                author_name: doc.author_name || '',
                language: 'es',
                client_id: clientId
              }));
              
              // Restore the step where user left off
              const savedStep = draftData.step || 'details';
              setStep(savedStep);
              
              toast.success(`📝 Borrador cargado - Continúa donde lo dejaste (${doc.completion_percentage || 0}% completo)`);
            }
            // Load chapters if they exist (book in progress with chapters)
            else if (doc.chapters && doc.chapters.length > 0) {
              setChapters(doc.chapters);
              const nextChapter = doc.current_chapter || doc.chapters.length + 1;
              setChapterNumber(nextChapter);
              
              // Set current chapter to the last completed one for review
              const lastChapter = doc.chapters[doc.chapters.length - 1];
              setCurrentChapter(lastChapter);
              setStep('review');
              toast.success(`Libro cargado - ${doc.chapters.length}/${doc.num_chapters} capítulos completados`);
            } 
            // Book without chapters but with complete info - show "ready to generate" view
            else if (doc.title && doc.synopsis && doc.synopsis.length > 20 && doc.author_name) {
              // Book has complete info, no chapters - show generating view with button to start
              setStep('ready_to_generate');
              toast.success('📚 Libro listo para comenzar generación');
            }
            // Book without enough info - go to details step to complete
            else {
              setStep('details');
              toast.info('📝 Completa los detalles del libro antes de generar');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar libro');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'book' && draft.content) {
            // Load draft data into form
            if (draft.content.profileData) setProfileData(draft.content.profileData);
            if (draft.content.bookIdeas) setBookIdeas(draft.content.bookIdeas);
            if (draft.content.selectedIdea) setSelectedIdea(draft.content.selectedIdea);
            if (draft.content.titleSuggestions) setTitleSuggestions(draft.content.titleSuggestions);
            if (draft.content.selectedTitle) setSelectedTitle(draft.content.selectedTitle);
            if (draft.content.formData) setFormData(draft.content.formData);
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
  
  const handleBack = () => {
    if (clientId) {
      navigate(`/client-documents/${clientId}/books`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleCVUpload = async (e) => {
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
        const analyzedCV = response.data.analyzed_cv;
        
        // Set the profile summary with the analyzed CV
        setProfileData(prev => ({
          ...prev,
          profile_summary: analyzedCV
        }));
        
        toast.success('✅ CV analizado y cargado en el perfil');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingCV(false);
      e.target.value = '';
    }
  };

  const handleProjectUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC, DOCX o TXT');
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
        const analyzedProject = response.data.analyzed_content;
        
        setProfileData(prev => ({
          ...prev,
          project_description: analyzedProject
        }));
        
        toast.success('✅ Proyecto analizado y cargado');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingProject(false);
      e.target.value = '';
    }
  };

  const handlePatentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC, DOCX o TXT');
      return;
    }

    setUploadingPatent(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-patent`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const analyzedPatent = response.data.analyzed_content;
        
        setProfileData(prev => ({
          ...prev,
          patent_content: analyzedPatent
        }));
        
        toast.success('✅ Patente analizada y cargada');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingPatent(false);
      e.target.value = '';
    }
  };


  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      
      // Si el usuario tiene su propia idea, saltar directamente a títulos
      if (profileData.custom_book_idea && profileData.custom_book_idea.trim().length > 50) {
        setUseCustomIdea(true);
        setSelectedIdea(profileData.custom_book_idea);
        
        // Generar títulos basados en la idea del usuario
        const response = await axios.post(`${API}/books/suggest-titles`, {
          selected_idea: profileData.custom_book_idea,
          profile_summary: profileData.profile_summary,
          language: profileData.language,
          is_custom_idea: true
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setTitleSuggestions(response.data.suggestions);
        setTitlesEvaluation(response.data.evaluation);
        toast.success('✅ Generando títulos basados en tu idea...');
        setStep('titles');
      } else {
        // Flujo normal: generar sugerencias de ideas
        const response = await axios.post(`${API}/books/suggest-ideas`, profileData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setBookIdeas(response.data.suggestions || []);
        setBookIdeasEvaluation(response.data.evaluation);
        setBookRecommendation(null);
        setStep('ideas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar ideas');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleIdeaSelection = async (idea) => {
    setSelectedIdea(idea);
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/books/suggest-titles`, {
        selected_idea: idea,
        profile_summary: profileData.profile_summary,
        language: profileData.language
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTitleSuggestions(response.data.suggestions);
      setTitlesEvaluation(response.data.evaluation); // Guardar evaluación
      setStep('titles');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar títulos');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleTitleSelection = (title) => {
    setSelectedTitle(title);
    // Extract genre from idea. Accepted shapes (LLM may emit any of these):
    //   "[Genre]: idea text"
    //   "<p>1. [Genre]: idea text"
    //   "Genre: idea text"
    // Strip HTML tags and any leading numbering/bullet/star noise first.
    const cleanIdea = selectedIdea
      .replace(/<[^>]+>/g, '')
      .replace(/^[\s\d.)\-•⭐]+/, '')
      .trim();
    const bracketMatch = cleanIdea.match(/^\[([^\]]+)\]/);
    const colonMatch = cleanIdea.match(/^([^:]+):/);
    const genre = (bracketMatch ? bracketMatch[1] : (colonMatch ? colonMatch[1] : 'General')).trim();
    
    setFormData({
      ...formData,
      title: title,
      genre: genre,
      synopsis: selectedIdea,
      language: profileData.language
    });
    setStep('details');
  };

  const handleStartBook = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      
      // Validate client_id is present
      if (!clientId) {
        toast.error('Se requiere un cliente para crear el libro');
        setGenerating(false);
        return;
      }
      
      const bookData = {
        ...formData,
        client_id: clientId,
        author_name: profileData.author_name || '',
        profile_summary: profileData.profile_summary || '',
        project_description: profileData.project_description || '',
        patent_content: profileData.patent_content || ''
      };
      const response = await axios.post(`${API}/books/start-interactive`, bookData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBookId(response.data.id);
      // ✅ FIX: Ir a ready_to_generate en lugar de comenzar generación inmediatamente
      setStep('ready_to_generate');
      toast.success('📚 Libro configurado. Elige el modo de generación.');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar el libro');
    } finally {
      setGenerating(false);
    }
  };

  const generateChapter = async (id, chapterNum) => {
    setGenerating(true);
    setEditMode(false);
    setEditInstructions('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/generate-chapter/${id}?chapter_number=${chapterNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newChapter = {
        ...response.data.chapter,
        validation_warning: response.data.validation_warning
      };
      
      setCurrentChapter(newChapter);
      setChapterNumber(chapterNum);
      
      // Add chapter to chapters array temporarily (will be replaced when approved)
      const updatedChapters = chapters.filter(ch => ch.number !== chapterNum);
      updatedChapters.push(newChapter);
      updatedChapters.sort((a, b) => a.number - b.number);
      setChapters(updatedChapters);
      
      // Show validation info if available
      if (response.data.validation_passed === false) {
        toast.error('⚠️ Capítulo generado pero NO pasó validación automática. Revisa los detalles.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Capítulo validado automáticamente por IA');
      }
      
      setStep('review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditChapter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/edit-chapter/${bookId}`,
        {
          chapter_number: chapterNumber,
          edit_instructions: editInstructions,
          current_chapter_content: currentChapter.content,
          current_chapter_title: currentChapter.title,
          edit_history: currentChapter.edit_history || []
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const editedChapter = {
        ...response.data.chapter,
        validation_warning: response.data.validation_warning
      };
      
      setCurrentChapter(editedChapter);
      
      // Update the chapter in the chapters array too
      const updatedChapters = chapters.map(ch => 
        ch.number === chapterNumber ? editedChapter : ch
      );
      setChapters(updatedChapters);
      
      setEditInstructions('');
      setEditMode(false);
      
      // Show validation info
      if (response.data.validation_passed === false) {
        toast.error('⚠️ Capítulo editado pero NO pasó validación automática. Revisa los detalles.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Capítulo editado y validado automáticamente por IA');
      } else {
        toast.success('Capítulo editado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/books/approve-chapter/${bookId}`,
        currentChapter,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newChapters = [...chapters, currentChapter];
      setChapters(newChapters);
      
      if (chapterNumber < formData.num_chapters) {
        toast.success(`Capítulo ${chapterNumber} aprobado. Generando siguiente...`);
        await generateChapter(bookId, chapterNumber + 1);
      } else {
        toast.success('¡Todos los capítulos completados! Finalizando libro...');
        await finalizeBook();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar capítulo');
      setGenerating(false);
    }
  };

  const finalizeBook = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/finalize/${bookId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡Libro completo generado exitosamente!');
      navigate(`/view-book/${response.data.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar libro');
      setGenerating(false);
    }
  };

  const goToChapter = async (chapterNum) => {
    if (chapterNum < 1 || chapterNum > formData.num_chapters) return;
    
    const existingChapter = chapters.find(ch => ch.number === chapterNum);
    if (existingChapter) {
      setCurrentChapter(existingChapter);
      setChapterNumber(chapterNum);
      setStep('review');
    } else if (chapterNum === chapters.length + 1) {
      await generateChapter(bookId, chapterNum);
    }
  };

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = window.location.origin;
      
      // Calculate completion percentage
      let completion = 0;
      if (profileData.author_name) completion += 15;
      if (profileData.profile_summary) completion += 15;
      if (selectedIdea) completion += 20;
      if (selectedTitle || formData.title) completion += 20;
      if (formData.synopsis) completion += 15;
      if (formData.num_chapters) completion += 15;
      
      // Save as book in progress instead of draft
      const bookData = {
        title: formData.title || selectedTitle || 'Libro sin título',
        genre: formData.genre || selectedIdea || 'Sin género',
        synopsis: formData.synopsis || '',
        num_chapters: formData.num_chapters || 10,
        writing_style: formData.writing_style || 'profesional',
        author_name: profileData.author_name || '',
        profile_summary: profileData.profile_summary || '',
        client_id: clientId,
        status: 'draft', // Mark as draft status
        completion_percentage: completion,
        draft_data: {
          profileData,
          bookIdeas,
          selectedIdea,
          titleSuggestions,
          selectedTitle,
          step
        }
      };
      
      let response;
      if (bookId) {
        // Update existing book
        response = await fetch(`${BACKEND_URL}/api/books/${bookId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookData)
        });
      } else {
        // Create new book in progress
        response = await fetch(`${BACKEND_URL}/api/books/start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookData)
        });
      }
      
      const data = await response.json();
      if (data.success || data.book_id) {
        const savedBookId = data.book_id || bookId;
        setBookId(savedBookId);
        toast.success('✅ Borrador guardado en la lista de libros del cliente');
        
        // Optionally navigate to client's books list
        setTimeout(() => {
          if (clientId) {
            navigate(`/client-documents/${clientId}/books`);
          }
        }, 1500);
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Error al guardar borrador');
    }
  };

  // Step 1: Profile
  if (step === 'profile') {
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
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 1: Perfil del Autor</h1>
            <p className="form-subtitle">
              Proporciona tu perfil para generar ideas de libro personalizadas
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleProfileSubmit} className="form-grid">
                <div className="form-field">
                  <Label htmlFor="author_name">Nombre del Autor *</Label>
                  <Input
                    id="author_name"
                    value={profileData.author_name}
                    onChange={(e) => setProfileData({ ...profileData, author_name: e.target.value })}
                    required
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="profile_summary">Resumen de Perfil / Experiencia *</Label>
                  
                  {/* Toggle between text and document upload */}
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={profileInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProfileInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={profileInputMode === 'document' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProfileInputMode('document')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {profileInputMode === 'text' ? (
                    <Textarea
                      id="profile_summary"
                      value={profileData.profile_summary}
                      onChange={(e) => setProfileData({ ...profileData, profile_summary: e.target.value })}
                      required
                      placeholder="Describe tu experiencia, intereses, especialización, temas que dominas, estilo de escritura preferido..."
                      rows={8}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVUpload}
                          className="hidden"
                          id="cv-upload-book"
                          disabled={uploadingCV}
                        />
                        <label 
                          htmlFor="cv-upload-book" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingCV ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Analizando documento...</p>
                              <p className="text-xs text-gray-500">Extrayendo experiencia y perfil del autor...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir tu documento (PDF, DOC o DOCX)
                              </p>
                              <p className="text-xs text-gray-500">
                                Extraeremos automáticamente tu experiencia y perfil profesional
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {profileData.profile_summary && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ Documento Procesado
                          </p>
                          <Textarea
                            value={profileData.profile_summary}
                            onChange={(e) => setProfileData({ ...profileData, profile_summary: e.target.value })}
                            rows={8}
                            className="text-sm"
                          />
                          <p className="text-xs text-gray-600 mt-2">
                            💡 El contenido ha sido extraído automáticamente. Puedes editarlo si lo deseas.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* NEW: Optional Project Upload */}
                <div className="form-field full-width">
                  <Label htmlFor="project_description">Descripción del Proyecto (Opcional)</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Sube un documento con la descripción de tu proyecto para incluirlo como contexto
                  </p>
                  
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleProjectUpload}
                        className="hidden"
                        id="project-upload-book"
                        disabled={uploadingProject}
                      />
                      <label 
                        htmlFor="project-upload-book" 
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {uploadingProject ? (
                          <>
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                            <p className="text-sm text-gray-600">Analizando proyecto...</p>
                          </>
                        ) : (
                          <>
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm font-medium text-gray-700">
                              Click para subir proyecto (PDF, DOC, DOCX o TXT)
                            </p>
                            <p className="text-xs text-gray-500">Opcional</p>
                          </>
                        )}
                      </label>
                    </div>
                    
                    {profileData.project_description && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-800 mb-2">
                          ✅ Proyecto Cargado
                        </p>
                        <p className="text-xs text-gray-700">{profileData.project_description.slice(0, 200)}...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* NEW: Optional Patent Upload */}
                <div className="form-field full-width">
                  <Label htmlFor="patent_content">Patente (Opcional)</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Sube una patente relacionada para incluirla como contexto
                  </p>
                  
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handlePatentUpload}
                        className="hidden"
                        id="patent-upload-book"
                        disabled={uploadingPatent}
                      />
                      <label 
                        htmlFor="patent-upload-book" 
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {uploadingPatent ? (
                          <>
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                            <p className="text-sm text-gray-600">Analizando patente...</p>
                          </>
                        ) : (
                          <>
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm font-medium text-gray-700">
                              Click para subir patente (PDF, DOC, DOCX o TXT)
                            </p>
                            <p className="text-xs text-gray-500">Opcional</p>
                          </>
                        )}
                      </label>
                    </div>
                    
                    {profileData.patent_content && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-purple-800 mb-2">
                          ✅ Patente Cargada
                        </p>
                        <p className="text-xs text-gray-700">{profileData.patent_content.slice(0, 200)}...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* NEW: Custom Book Idea Section */}
                <div className="form-field full-width">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={20} className="text-amber-600" />
                      <Label className="text-amber-800 font-semibold">¿Ya tienes tu propia idea para el libro?</Label>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">
                      Si ya sabes sobre qué quieres escribir, describe tu idea aquí y saltaremos directamente a generar títulos.
                      Debe tener al menos 50 caracteres para ser válida.
                    </p>
                    
                    <Textarea
                      id="custom_book_idea"
                      value={profileData.custom_book_idea}
                      onChange={(e) => setProfileData({ ...profileData, custom_book_idea: e.target.value })}
                      placeholder="Ej: Quiero escribir un libro sobre inteligencia artificial aplicada a la medicina, específicamente sobre cómo los algoritmos de machine learning pueden ayudar en el diagnóstico temprano de enfermedades..."
                      rows={4}
                      className="mb-3"
                    />
                    
                    {/* File upload for book idea */}
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          
                          setUploadingBookIdea(true);
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
                              setProfileData(prev => ({
                                ...prev,
                                custom_book_idea: response.data.analyzed_content
                              }));
                              toast.success('✅ Documento analizado. Tu idea ha sido cargada.');
                            }
                          } catch (error) {
                            toast.error('Error al procesar el archivo');
                          } finally {
                            setUploadingBookIdea(false);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                        id="book-idea-upload"
                        disabled={uploadingBookIdea}
                      />
                      <label 
                        htmlFor="book-idea-upload" 
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        {uploadingBookIdea ? (
                          <Loader2 className="animate-spin text-amber-600" size={16} />
                        ) : (
                          <Upload size={16} className="text-amber-600" />
                        )}
                        <span className="text-sm text-amber-700">
                          {uploadingBookIdea ? 'Analizando...' : 'Subir documento con idea'}
                        </span>
                      </label>
                      
                      {profileData.custom_book_idea && profileData.custom_book_idea.length >= 50 && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check size={14} />
                          Idea válida ({profileData.custom_book_idea.length} caracteres)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Idioma removido - ahora siempre genera en inglés y traduce a español automáticamente */}

                <Button 
                  type="submit" 
                  disabled={loadingSuggestions} 
                  className="submit-button"
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      {profileData.custom_book_idea && profileData.custom_book_idea.length >= 50 
                        ? 'Generando Títulos...' 
                        : 'Generando Ideas...'}
                    </>
                  ) : (
                    <>
                      {profileData.custom_book_idea && profileData.custom_book_idea.length >= 50 
                        ? '🚀 Usar Mi Idea y Continuar →' 
                        : 'Continuar →'}
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

  // Step 2: Book Ideas
  if (step === 'ideas') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('profile')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 2: Selecciona una Idea</h1>
            <p className="form-subtitle">
              Basándonos en tu perfil, te sugerimos estas ideas. Debes seleccionar una.
            </p>
          </div>

          {/* Loading overlay cuando se está procesando */}
          {loadingSuggestions && (
            <div className="max-w-3xl mx-auto mb-6">
              <Card className="border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
                    <div>
                      <p className="text-lg font-semibold text-blue-900">Generando títulos para tu libro...</p>
                      <p className="text-sm text-blue-700">Esto puede tomar unos segundos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* ⭐ Mostrar recomendación del evaluador - Estilo similar a patentes */}
            {bookIdeasEvaluation && bookIdeasEvaluation.why_this_idea && (
              <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">⭐</span>
                    Recomendación del Experto
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-green-800">
                    💡 Te recomendamos la Idea #{bookIdeasEvaluation.best_idea_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="font-semibold text-sm text-green-700 mb-2">¿Por qué esta idea?</p>
                    <p className="text-gray-700 text-sm">{bookIdeasEvaluation.why_this_idea}</p>
                  </div>
                  
                  {bookIdeasEvaluation.strengths && (
                    <div className="bg-white p-3 rounded-lg border border-green-200">
                      <p className="font-semibold text-sm text-green-700 mb-2">✨ Fortalezas clave:</p>
                      <p className="text-gray-700 text-sm">{bookIdeasEvaluation.strengths}</p>
                    </div>
                  )}
                  
                  {bookIdeasEvaluation.quick_tips && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <p className="font-semibold text-sm text-blue-700 mb-2">🚀 Tips rápidos:</p>
                      <p className="text-gray-700 text-sm">{bookIdeasEvaluation.quick_tips}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs text-gray-600 italic">
                      💡 Puedes elegir cualquier idea, pero la Idea #{bookIdeasEvaluation.best_idea_number} tiene el mayor potencial según nuestro análisis.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ⭐ Mostrar recomendación del evaluador */}
            {bookRecommendation && (
              <Card className="border-2 border-purple-300 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <span className="text-2xl">💡</span>
                    Recomendación de Mónica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 italic">"{bookRecommendation.reason}"</p>
                </CardContent>
              </Card>
            )}

            {bookIdeas.map((idea, index) => {
              // ⭐ Verificar si esta es la opción recomendada (usando nuevo formato)
              const recommendedNumber = bookIdeasEvaluation?.best_idea_number;
              const isRecommended = recommendedNumber && parseInt(recommendedNumber) === (index + 1);
              const isThisIdeaSelected = loadingSuggestions && selectedIdea === idea;
              
              return (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isRecommended ? 'border-2 border-green-400 bg-green-50 shadow-lg' : 'hover:border-black'
                  } ${loadingSuggestions ? 'pointer-events-none opacity-50' : ''}`}
                  onClick={() => !loadingSuggestions && handleIdeaSelection(idea)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Idea {index + 1}
                      {/* ⭐ Badge de recomendado */}
                      {isRecommended && (
                        <span className="ml-auto text-xs font-semibold px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full flex items-center gap-1">
                          ⭐ Mejor Opción
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base">{idea}</p>
                    {/* Loading indicator cuando se selecciona esta idea */}
                    {isThisIdeaSelected && (
                      <div className="flex items-center justify-center mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Loader2 className="animate-spin mr-2" size={20} style={{ color: '#3b82f6' }} />
                        <span className="text-blue-700 font-medium">Generando títulos...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Title Selection
  if (step === 'titles') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('ideas')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 3: Selecciona un Título</h1>
            <p className="form-subtitle">
              Idea seleccionada: <strong>{selectedIdea.substring(0, 100)}...</strong>
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* ⭐ Recomendación del mejor título - Estilo similar a ideas */}
            {titlesEvaluation && titlesEvaluation.why_this_title && (
              <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">⭐</span>
                    Recomendación del Experto
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-green-800">
                    💡 Te recomendamos el Título #{titlesEvaluation.best_title_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="font-semibold text-sm text-green-700 mb-2">¿Por qué este título?</p>
                    <p className="text-gray-700 text-sm">{titlesEvaluation.why_this_title}</p>
                  </div>
                  
                  {titlesEvaluation.issues && titlesEvaluation.issues.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <p className="font-semibold text-sm text-orange-700 mb-2">⚠️ Aspectos a considerar:</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {titlesEvaluation.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {titlesEvaluation.feedback && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <p className="font-semibold text-sm text-blue-700 mb-2">💡 Sugerencia:</p>
                      <p className="text-gray-700 text-sm">{titlesEvaluation.feedback}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs text-gray-600 italic">
                      💡 Puedes elegir cualquier título, pero el Título #{titlesEvaluation.best_title_number} tiene mayor potencial comercial.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {titleSuggestions.map((title, index) => {
              // Verificar si este es el título recomendado
              const recommendedNumber = titlesEvaluation?.best_title_number;
              const isRecommended = recommendedNumber && parseInt(recommendedNumber) === (index + 1);
              
              return (
                <Card 
                key={index}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isRecommended ? 'border-2 border-green-400 bg-green-50 shadow-lg' : 
                  selectedTitle === title ? 'border-2 border-black' : 'hover:border-black'
                }`}
                onClick={() => handleTitleSelection(title)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Título {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {isRecommended && (
                        <span className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full flex items-center gap-1">
                          ⭐ Mejor Opción
                        </span>
                      )}
                      {selectedTitle === title && (
                        <span className="text-green-600">✓ Seleccionado</span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold">{title}</p>
                </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Details
  if (step === 'details') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => {
            // If there are title suggestions, go back to titles
            // Otherwise, go back to client dashboard
            if (titleSuggestions && titleSuggestions.length > 0) {
              setStep('titles');
            } else if (clientId) {
              navigate(`/client-documents/${clientId}/books`);
            } else {
              navigate('/dashboard');
            }
          }}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 4: Detalles del Libro</h1>
            <p className="form-subtitle">
              Título seleccionado: <strong>{selectedTitle}</strong>
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartBook} className="form-grid">
                <div className="form-field full-width">
                  <Label>Título del Libro</Label>
                  <Input
                    value={formData.title}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="synopsis">Sinopsis / Detalles Adicionales</Label>
                  <Textarea
                    id="synopsis"
                    value={formData.synopsis}
                    onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                    placeholder="Puedes agregar detalles adicionales sobre la trama, personajes, estructura..."
                    rows={6}
                  />
                </div>

              <div className="form-field">
                <Label htmlFor="num_chapters">Número de Capítulos</Label>
                <Input
                  id="num_chapters"
                  type="number"
                  data-testid="chapters-input"
                  value={formData.num_chapters}
                  onChange={(e) => setFormData({ ...formData, num_chapters: parseInt(e.target.value) })}
                  min="3"
                  max="30"
                  required
                />
              </div>

              <div className="form-field">
                <Label htmlFor="writing_style">Estilo de Escritura</Label>
                <Select
                  value={formData.writing_style}
                  onValueChange={(value) => setFormData({ ...formData, writing_style: value })}
                >
                  <SelectTrigger data-testid="style-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profesional">Profesional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="académico">Académico</SelectItem>
                    <SelectItem value="narrativo">Narrativo</SelectItem>
                    <SelectItem value="poético">Poético</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Opción de Gamma removida */}

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
                  data-testid="generate-book-btn"
                  style={{ flex: 1 }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2" size={18} />
                      Comenzar Libro
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

  // Step: Ready to Generate (book has all info, ready to start)
  if (step === 'ready_to_generate') {
    return (
      <div className="create-container">
        {/* Loading Overlay */}
        {generating && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '50px',
              borderRadius: '20px',
              maxWidth: '600px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <Loader2 className="animate-spin" size={64} style={{ margin: '0 auto 30px', color: '#3b82f6' }} />
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px', color: '#1f2937' }}>
                📚 Generando Tu Libro
              </h2>
              <p style={{ fontSize: '18px', color: '#4b5563', lineHeight: '1.8', marginBottom: '20px' }}>
                Su libro se está generando en segundo plano.
              </p>
              <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '10px' }}>
                <strong>⏱️ Tiempo estimado:</strong> 15 minutos
              </p>
              <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6' }}>
                Puede continuar redactando otros documentos mientras tanto.
              </p>
              <div style={{ 
                marginTop: '30px', 
                padding: '15px', 
                backgroundColor: '#f0f9ff', 
                borderRadius: '10px',
                border: '1px solid #bfdbfe'
              }}>
                <p style={{ fontSize: '14px', color: '#1e40af' }}>
                  Será redirigido al dashboard en unos segundos...
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="create-header">
          <Button variant="ghost" onClick={() => {
            if (clientId) {
              navigate(`/client-documents/${clientId}/books`);
            } else {
              navigate('/dashboard');
            }
          }}>
            <ArrowLeft className="mr-2" size={18} />
            Volver a Lista
          </Button>
          <h1>Listo para Generar</h1>
        </div>
        
        <Card className="form-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <CardContent style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>
                📚 {formData.title || 'Tu Libro'}
              </h2>
              <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
                <strong>Autor:</strong> {profileData.author_name}
              </p>
              <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
                <strong>Género:</strong> {formData.genre}
              </p>
              <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
                <strong>Capítulos:</strong> {formData.num_chapters}
              </p>
              <p style={{ fontSize: '16px', color: '#888', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
                {formData.synopsis}
              </p>
            </div>
            
            <div style={{ 
              padding: '30px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '12px',
              marginBottom: '30px'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
                ¿Listo para comenzar?
              </h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                Se generará tu libro completo en {formData.num_chapters} capítulos usando inteligencia artificial.
                <br />
                Tiempo estimado: <strong>8-9 minutos</strong>
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button 
                variant="outline"
                onClick={() => setStep('details')}
                style={{ minWidth: '180px' }}
              >
                <Edit className="mr-2" size={18} />
                Editar Detalles
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    setGenerating(true);
                    const token = localStorage.getItem('token');
                    
                    // Start generation (returns immediately with 202)
                    const response = await axios.post(`${API}/books/${bookId}/generate-fast`, {}, {
                      headers: { 'Authorization': `Bearer ${token}` },
                      timeout: 30000  // Short timeout since it returns immediately
                    });
                    
                    // Wait 10 seconds (showing overlay), then navigate to client dashboard
                    setTimeout(() => {
                      setGenerating(false);
                      navigate(`/client-dashboard/${clientId}`);
                    }, 10000);
                    
                  } catch (error) {
                    console.error('Error al iniciar generación:', error);
                    
                    if (error.response?.status === 202) {
                      // 202 is success, treat as above
                      setTimeout(() => {
                        setGenerating(false);
                        navigate(`/client-dashboard/${clientId}`);
                      }, 10000);
                    } else {
                      toast.error(error.response?.data?.detail || 'Error al iniciar la generación del libro');
                      setGenerating(false);
                    }
                  }
                }}
                disabled={generating}
                style={{ 
                  minWidth: '200px', 
                  backgroundColor: '#4caf50', 
                  color: '#fff',
                  border: 'none'
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Generando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" size={18} />
                    Generar Libro
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
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
                width: `${Math.min(100, (chapterNumber / formData.num_chapters) * 100)}%`,
                height: '100%',
                backgroundColor: '#000',
                transition: 'width 0.3s ease',
                animation: 'shimmer 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
              {Math.round((chapterNumber / formData.num_chapters) * 100)}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
            Generando Capítulo {chapterNumber} de {formData.num_chapters}
          </h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
            {formData.title}
          </p>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
            <p>✨ Escribiendo capítulo con IA...</p>
            <p>🔍 Validando calidad automáticamente...</p>
            <p>⏱️ Esto puede tomar 30-90 segundos</p>
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
        `}</style>
      </div>
    );
  }

  if (step === 'review' && currentChapter) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Capítulo {chapterNumber} de {formData.num_chapters}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: formData.num_chapters }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => goToChapter(num)}
                  disabled={num > chapters.length + 1}
                  className={`w-8 h-8 rounded text-xs ${
                    num === chapterNumber 
                      ? 'bg-black text-white' 
                      : num <= chapters.length 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {currentChapter.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentChapter.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentChapter.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Problemas detectados:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {(currentChapter.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentChapter.validation_warning.feedback}</p>
                </div>
                {currentChapter.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentChapter.validation_warning.metrics.character_count || 'N/A'} (requerido: {currentChapter.validation_warning.metrics.required_range || '2500-3000'})</li>
                      <li style={{ color: '#5d4037' }}>📝 Tiene conclusión: {currentChapter.validation_warning.metrics.has_conclusion ? '❌ Sí (debe eliminarse)' : '✓ No'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Tiene repetición: {currentChapter.validation_warning.metrics.has_repetition ? '❌ Sí (debe evitarse)' : '✓ No'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentChapter.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentChapter.validation_warning && currentChapter.evaluation_history && currentChapter.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Este capítulo pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Capítulo aprobado en intento {currentChapter.evaluation_history.length}
                  </p>
                </div>
                {currentChapter.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentChapter.content.length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura: ✓ Adecuada</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Este capítulo está listo para continuar o puedes editarlo para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Capítulo {chapterNumber} de {formData.num_chapters}</CardTitle>
              <CardDescription>{formData.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentChapter.content }}
                style={{
                  lineHeight: '1.8',
                  color: '#333'
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
                data-testid="edit-section-btn"
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setGenerating(true);
                    toast.info('🔄 Regenerando capítulo...');
                    const token = localStorage.getItem('token');
                    
                    const response = await axios.post(
                      `${API}/books/${bookId}/regenerate-chapter/${chapterNumber}`,
                      null,
                      { headers: { 'Authorization': `Bearer ${token}` } }
                    );
                    
                    if (response.data.success) {
                      toast.success('✅ Capítulo regenerado exitosamente');
                      
                      // Update BOTH currentChapter AND chapters array
                      const regeneratedChapter = response.data.chapter;
                      setCurrentChapter(regeneratedChapter);
                      
                      // Update chapters array
                      const updatedChapters = [...chapters];
                      const existingIndex = updatedChapters.findIndex(ch => ch.number === chapterNumber);
                      
                      if (existingIndex >= 0) {
                        updatedChapters[existingIndex] = regeneratedChapter;
                        setChapters(updatedChapters);
                      }
                      
                      // Force re-render by updating the view
                      setCurrentLanguage('es');
                    }
                  } catch (error) {
                    console.error('Error:', error);
                    toast.error('Error al regenerar el capítulo');
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={generating}
                className="bg-orange-50 hover:bg-orange-100 border-orange-300"
              >
                <RefreshCw className="mr-2" size={18} />
                Regenerar Capítulo
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                data-testid="approve-section-btn"
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
                  placeholder="Ejemplo: 'Haz el diálogo más natural y añade más descripción del ambiente. El protagonista debe mostrar más emoción en la escena final.'"
                  rows={5}
                  className="mb-4"
                  data-testid="edit-instructions-input"
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
                    onClick={handleEditChapter}
                    disabled={generating || !editInstructions.trim()}
                    data-testid="apply-edit-btn"
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


// Patent Interactive Creation Component

export default CreateBookInteractive;
