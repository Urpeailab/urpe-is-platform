import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  CheckCircle, 
  Lock, 
  Clock, 
  FileText, 
  Upload, 
  Download,
  Calendar,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  XCircle,
  Trash2,
  Plus,
  File,
  Loader2,
  X,
  MessageSquare,
  BookOpen,
  Lightbulb,
  Type,
  RotateCcw,
  Sparkles,
  PenLine
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Coerce a value to a renderable string. Migrated rows store bilingual fields as
// `{ es, en }` jsonb — if both are empty, the previous `v?.es || v?.en || v`
// chain fell through to the raw object and crashed React (error #31).
const toText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.es || v.en || '';
  return '';
};

export const StageDetailPage = () => {
  const { stageNumber } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [stageData, setStageData] = useState(null);
  const [stageDeliverables, setStageDeliverables] = useState([]);
  const [stageDocuments, setStageDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingRoadMap, setDownloadingRoadMap] = useState(false);
  const [userCvs, setUserCvs] = useState([]);

  // Book preparation wizard state
  const [bookPrep, setBookPrep] = useState(null);
  const [bookIdeas, setBookIdeas] = useState([]);
  const [bookTitles, setBookTitles] = useState([]);
  const [bookLoadingIdeas, setBookLoadingIdeas] = useState(false);
  const [bookLoadingTitles, setBookLoadingTitles] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [customIdea, setCustomIdea] = useState('');
  const [showCustomIdea, setShowCustomIdea] = useState(false);
  const [ideasEvaluation, setIdeasEvaluation] = useState(null);
  const [titlesEvaluation, setTitlesEvaluation] = useState(null);

  // File note thread reply UI: which file is being replied to + draft text
  const [replyingFileId, setReplyingFileId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Deliverable file thread reply UI (separate state so client docs + deliverables
  // can have independent open editors)
  const [replyingDeliverableFileId, setReplyingDeliverableFileId] = useState(null);
  const [deliverableReplyDraft, setDeliverableReplyDraft] = useState('');
  const [sendingDeliverableReply, setSendingDeliverableReply] = useState(false);

  // Build the bidirectional thread for a deliverable file, folding legacy
  // `noteEntries` (staff-only) and the single `note` field into uniform shape.
  const buildDeliverableThread = (file) => {
    if (Array.isArray(file?.noteThread) && file.noteThread.length > 0) {
      return file.noteThread;
    }
    if (Array.isArray(file?.noteEntries) && file.noteEntries.length > 0) {
      // Legacy staff entries: only show those marked visible to the client so
      // internal `visibleToClient=false` notes stay hidden.
      return file.noteEntries
        .filter((e) => e?.text && e?.visibleToClient !== false)
        .map((e) => ({
          id: e.id || `legacy-${Math.random()}`,
          text: e.text,
          authorId: e.createdBy || e.authorId,
          authorName: e.createdByName || e.authorName || 'Equipo',
          authorRole: e.authorRole || 'advisor',
          createdAt: e.createdAt,
        }));
    }
    const legacyText = file?.note || file?.notes || '';
    if (legacyText) {
      return [{
        id: 'legacy',
        text: legacyText,
        authorName: file?.uploadedByName || 'Equipo',
        authorRole: 'advisor',
        createdAt: file?.noteUpdatedAt || file?.uploadedAt,
      }];
    }
    return [];
  };

  const handleSendDeliverableReply = async (deliverableId, fileId) => {
    const text = deliverableReplyDraft.trim();
    if (!text) return;
    setSendingDeliverableReply(true);
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      await axios.post(
        `${BACKEND_URL}/api/client/deliverables/${deliverableId}/files/${fileId}/notes`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Respuesta enviada');
      setReplyingDeliverableFileId(null);
      setDeliverableReplyDraft('');
      fetchStageData();
    } catch (error) {
      console.error('Error sending deliverable reply:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar la respuesta');
    } finally {
      setSendingDeliverableReply(false);
    }
  };

  // Fold legacy `clientNote` into a thread so the new UI renders both old and
  // new uploads uniformly.
  const buildNoteThread = (file) => {
    if (Array.isArray(file?.noteThread) && file.noteThread.length > 0) {
      return file.noteThread;
    }
    if (file?.clientNote?.text) {
      return [{
        id: file.clientNote.id || 'legacy-client-note',
        text: file.clientNote.text,
        authorId: file.clientNote.authorId,
        authorName: file.clientNote.authorName || 'Cliente',
        authorRole: file.clientNote.authorRole || 'client',
        createdAt: file.clientNote.createdAt,
      }];
    }
    return [];
  };

  const handleSendFileReply = async (documentId, fileId) => {
    const text = replyDraft.trim();
    if (!text) return;
    setSendingReply(true);
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      await axios.post(
        `${BACKEND_URL}/api/client/documents/${documentId}/files/${fileId}/notes`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Respuesta enviada');
      setReplyingFileId(null);
      setReplyDraft('');
      fetchStageData();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar la respuesta');
    } finally {
      setSendingReply(false);
    }
  };


  useEffect(() => {
    fetchStageData();
  }, [stageNumber]);

  const fetchStageData = async () => {
    try {
      setLoading(true);
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      if (!token) {
        toast.error('Por favor inicia sesión');
        navigate('/auth');
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/client/my-case`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      setCaseData(data);

      const stage = data.stages.find(s => s.stageNumber === parseInt(stageNumber));
      if (!stage) {
        toast.error('Etapa no encontrada');
        navigate('/dashboard/my-case');
        return;
      }

      setStageData(stage);
      setStageDeliverables(data.deliverables?.filter(d => d.stageNumber === parseInt(stageNumber)) || []);
      setStageDocuments(data.documents?.filter(d => d.stageNumber === parseInt(stageNumber)) || []);

      // Fetch user CVs
      try {
        const cvResponse = await axios.get(`${BACKEND_URL}/api/client/my-cvs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserCvs(cvResponse.data.cvs || []);
      } catch { /* user might not have CVs */ }
    } catch (error) {
      console.error('Error fetching stage data:', error);
      toast.error('Error al cargar los datos de la etapa');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (documentId, file, note = '') => {
    setUploading(true);
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      const formData = new FormData();
      formData.append('file', file);
      if (note && note.trim()) {
        formData.append('note', note.trim());
      }

      await axios.post(
        `${BACKEND_URL}/api/client/documents/${documentId}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Documento subido exitosamente');
      setShowUploadModal(false);
      setSelectedDocument(null);
      setUploadNote('');
      setPendingFile(null);
      fetchStageData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (documentId, fileId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este archivo?')) return;
    
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;

      await axios.delete(
        `${BACKEND_URL}/api/client/documents/${documentId}/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Archivo eliminado');
      fetchStageData();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Error al eliminar el archivo');
    }
  };

  // Function to download Eligibility Report PDF (same as SuccessCalculatorPage)
  const handleDownloadEligibilityPDF = async () => {
    setDownloadingPDF(true);
    toast.info('Generando PDF del Reporte de Elegibilidad...');
    
    try {
      // First fetch the calculator data
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      let calculatorData = user?.report || {};
      
      // Try to fetch fresh data from API
      try {
        const response = await axios.get(`${BACKEND_URL}/api/client/success-calculator`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        calculatorData = response.data || calculatorData;
      } catch (fetchError) {
        console.log('Using cached report data');
      }
      
      const mergedData = {
        ...user?.report,
        ...calculatorData,
        nombreCompleto: user?.name || user?.report?.nombreCompleto || calculatorData?.nombreCompleto,
        ocupacion: user?.report?.ocupacion || calculatorData?.ocupacion,
        oportunidadesCrecimiento: calculatorData?.oportunidadesCrecimiento || user?.report?.oportunidadesCrecimiento,
      };
      
      const { generateCompletePDF } = await import('../../utils/completePdfGenerator');
      const result = generateCompletePDF(mergedData, user);
      
      if (result.success) {
        toast.success(result.message || 'Reporte descargado');
      } else {
        toast.error(result.message || 'Error al descargar');
      }
    } catch (error) {
      console.error('PDF error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Function to download RoadMap PDF
  const handleDownloadRoadMapPDF = async () => {
    setDownloadingRoadMap(true);
    toast.info('Generando PDF de Ruta Personalizada...');
    
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      
      if (!userData?.phone) {
        toast.error('No se encontró el teléfono del usuario');
        setDownloadingRoadMap(false);
        return;
      }

      // Fetch roadmap data from N8N webhook
      const response = await axios.post(
        'https://n8n.urpeailab.com/webhook/road-map',
        { telefono: userData.phone },
        { timeout: 45000 }
      );

      let roadMapData = null;
      
      if (response.data) {
        if (response.data.data && typeof response.data.data === 'string') {
          const parsedData = JSON.parse(response.data.data);
          roadMapData = parsedData.roadmap_servicios || parsedData;
        } else if (Array.isArray(response.data)) {
          roadMapData = response.data;
        } else if (response.data.roadmap_servicios) {
          roadMapData = response.data.roadmap_servicios;
        }
      }

      if (!roadMapData || roadMapData.length === 0) {
        toast.error('No hay datos de ruta personalizada disponibles');
        setDownloadingRoadMap(false);
        return;
      }

      // Generate PDF using jspdf
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      const encodeText = (text) => {
        if (!text) return '';
        return text
          .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
          .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
          .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
          .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N')
          .replace(/ü/g, 'u').replace(/Ü/g, 'U')
          .replace(/¿/g, '').replace(/¡/g, '');
      };
      
      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(201, 169, 106);
      doc.setFontSize(20);
      doc.text('RUTA PERSONALIZADA', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(148, 163, 184);
      doc.text(encodeText(userData.name || 'Usuario'), 105, 30, { align: 'center' });

      let yPos = 50;
      const pageHeight = 297;
      const margin = 15;
      const maxWidth = 180;
      
      // Calculate summary stats
      const totalItems = roadMapData.length;
      const requiredItems = roadMapData.filter(s => s.requerido !== false).length;
      const totalDiasUrpe = roadMapData.reduce((sum, s) => sum + (s.dias_urpe || 0), 0);
      const totalDiasProspecto = roadMapData.reduce((sum, s) => sum + (s.dias_prospecto_estimado || 0), 0);

      // Summary section
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, yPos, maxWidth, 20, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(margin, yPos, maxWidth, 20, 3, 3, 'S');
      
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('RESUMEN DE TU RUTA', margin + 5, yPos + 7);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${totalItems} servicios  |  Requeridos: ${requiredItems}`, margin + 5, yPos + 13);
      doc.text(`Con URPE: ${totalDiasUrpe} dias  |  Sin URPE: ${totalDiasProspecto} dias  |  Ahorro: ${totalDiasProspecto - totalDiasUrpe} dias`, margin + 5, yPos + 18);
      
      yPos += 28;
      
      doc.setTextColor(30, 41, 59);

      // Group by category
      const groupedByCategory = roadMapData.reduce((acc, service) => {
        const category = service.categoria || 'Sin categoria';
        if (!acc[category]) acc[category] = [];
        acc[category].push(service);
        return acc;
      }, {});

      Object.entries(groupedByCategory).forEach(([category, services]) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        // Category header
        doc.setFillColor(0, 102, 153);
        doc.roundedRect(margin, yPos, maxWidth, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(encodeText(category.toUpperCase()), margin + 5, yPos + 7);
        yPos += 15;

        services.forEach((service, idx) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
          }

          const itemName = service.item || service.servicio || service.nombre || 'Servicio';
          const itemDesc = service.ejemplo_urpe || service.descripcion || '';
          const isRequired = service.requerido !== false;
          const diasUrpe = service.dias_urpe || 0;
          const diasProspecto = service.dias_prospecto_estimado || 0;
          
          const boxHeight = itemDesc ? 32 : 18;
          
          // Service box
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(margin, yPos, maxWidth, boxHeight, 2, 2, 'F');
          
          // Item name
          doc.setTextColor(30, 41, 59);
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(`${idx + 1}. ${encodeText(itemName)}`, margin + 5, yPos + 6);
          
          // Required badge
          if (isRequired) {
            doc.setFillColor(220, 38, 38);
            doc.roundedRect(margin + maxWidth - 28, yPos + 2, 23, 5, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.text('REQUERIDO', margin + maxWidth - 26, yPos + 5.5);
          } else {
            doc.setFillColor(34, 197, 94);
            doc.roundedRect(margin + maxWidth - 20, yPos + 2, 15, 5, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.text('LISTO', margin + maxWidth - 18, yPos + 5.5);
          }
          
          // Time comparison
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`URPE: ${diasUrpe} dias  |  Sin URPE: ${diasProspecto} dias  |  Ahorro: ${diasProspecto - diasUrpe} dias`, margin + 5, yPos + 12);
          
          // Description/Example
          if (itemDesc) {
            doc.setFont(undefined, 'italic');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            const descLines = doc.splitTextToSize(encodeText(itemDesc), maxWidth - 10);
            doc.text(descLines.slice(0, 2), margin + 5, yPos + 18);
          }
          
          yPos += boxHeight + 5;
        });
        yPos += 5;
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado por URPE Integral Services - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      }

      doc.save(`Ruta_Personalizada_${userData.name || 'Cliente'}.pdf`);
      toast.success('Ruta Personalizada descargada');
      
    } catch (error) {
      console.error('RoadMap PDF error:', error);
      toast.error(`Error al generar el PDF: ${error.message}`);
    } finally {
      setDownloadingRoadMap(false);
    }
  };

  // =========================================================================
  // BOOK PREPARATION WIZARD FUNCTIONS
  // =========================================================================

  const getToken = () => {
    const userDataStr = localStorage.getItem('urpe_user');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    return userData?.token;
  };

  // Fetch existing book preparation on mount
  useEffect(() => {
    const fetchBookPrep = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/client/book/preparation`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const prep = data.preparation;
        if (prep) {
          setBookPrep(prep);
          if (prep.suggestedIdeas) setBookIdeas(prep.suggestedIdeas);
          if (prep.ideasEvaluation) setIdeasEvaluation(prep.ideasEvaluation);
          if (prep.suggestedTitles) setBookTitles(prep.suggestedTitles);
          if (prep.titlesEvaluation) setTitlesEvaluation(prep.titlesEvaluation);
        }
      } catch (e) {
        console.error('Error fetching book preparation:', e);
      }
    };
    fetchBookPrep();
  }, [caseData]);

  const handleShowBookIdeas = async () => {
    const token = getToken();
    if (!token) return;
    setBookLoadingIdeas(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/client/book/suggest-ideas`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookIdeas(data.suggestions || []);
      setIdeasEvaluation(data.evaluation || null);
      setBookPrep(prev => ({ ...prev, step: 'ideas_shown', suggestedIdeas: data.suggestions }));
      toast.success('Ideas generadas exitosamente');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al generar ideas');
    } finally {
      setBookLoadingIdeas(false);
    }
  };

  const handleSelectIdea = async (idea, isCustom = false) => {
    const token = getToken();
    if (!token) return;
    setBookSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/client/book/select-idea`,
        { selectedIdea: idea, isCustom },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookPrep(prev => ({ ...prev, step: 'idea_selected', selectedIdea: idea, isCustomIdea: isCustom }));
      toast.success('Idea seleccionada');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar idea');
    } finally {
      setBookSaving(false);
    }
  };

  const handleShowBookTitles = async () => {
    const token = getToken();
    if (!token) return;
    setBookLoadingTitles(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/client/book/suggest-titles`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookTitles(data.suggestions || []);
      setTitlesEvaluation(data.evaluation || null);
      setBookPrep(prev => ({ ...prev, step: 'titles_shown', suggestedTitles: data.suggestions }));
      toast.success('Titulos generados');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al generar titulos');
    } finally {
      setBookLoadingTitles(false);
    }
  };

  const handleSelectTitle = async (title) => {
    const token = getToken();
    if (!token) return;
    setBookSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/client/book/select-title`,
        { selectedTitle: title },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookPrep(prev => ({ ...prev, step: 'ready', selectedTitle: title }));
      toast.success('Titulo seleccionado. La generacion del libro ha iniciado automaticamente.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar titulo');
    } finally {
      setBookSaving(false);
    }
  };

  const handleResetBookPrep = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.post(`${BACKEND_URL}/api/client/book/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookPrep(null);
      setBookIdeas([]);
      setBookTitles([]);
      setIdeasEvaluation(null);
      setTitlesEvaluation(null);
      setCustomIdea('');
      setShowCustomIdea(false);
      toast.success('Preparacion reiniciada');
    } catch (error) {
      toast.error('Error al reiniciar');
    }
  };

  const getStageStatus = () => {
    if (!stageData || !caseData) return { isPaid: false, isCompleted: false, isCurrent: false, isLocked: true, isFree: false };
    
    const stageAmount = stageData.amount || 0;
    const isFree = stageAmount === 0;
    const isPaid = caseData.progress.paidStages.includes(stageData.stageNumber) || isFree;
    const isCompleted = caseData.progress.completedStages?.includes(stageData.stageNumber) || stageData.status === 'completed';
    const isCurrent = stageData.stageNumber === caseData.case.currentStage;
    // If stage is free (amount = 0), it's automatically unlocked
    const isLocked = !isPaid && !isFree && !isCompleted && stageData.status !== 'unlocked';
    
    return { isPaid, isCompleted, isCurrent, isLocked, isFree };
  };

  const getDocumentStatus = (status) => {
    switch(status) {
      case 'validated':
      case 'approved':
        return { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Aprobado', icon: CheckCircle };
      case 'uploaded':
      case 'pending_review':
        return { bg: 'bg-[#C9A96A]/10', text: 'text-[#C9A96A]', label: 'En revisión', icon: Clock };
      case 'rejected':
        return { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'Rechazado', icon: XCircle };
      default:
        return { bg: 'bg-[#334155]', text: 'text-[#64748B]', label: 'Pendiente', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#C9A96A] border-t-transparent" />
      </div>
    );
  }

  if (!stageData) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-[#64748B] mx-auto mb-4" />
          <p className="text-[#94A3B8]">Etapa no encontrada</p>
          <Button 
            onClick={() => navigate('/dashboard/my-case')}
            className="mt-4 bg-[#1E293B] text-[#F8FAFC]"
          >
            Volver a Mi Caso
          </Button>
        </div>
      </div>
    );
  }

  const { isPaid, isCompleted, isCurrent, isLocked, isFree } = getStageStatus();
  const stageName = toText(stageData.name) || `Etapa ${stageData.stageNumber}`;
  const stageDescription = toText(stageData.description);
  const isFinalStage = stageData.stageNumber === (caseData?.stages?.length || 12) || stageData.stageNumber === 12;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24 sm:pb-8">
      {/* ========== HEADER - Fixed ========== */}
      <div className="sticky top-0 z-40 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-3xl mx-auto">
            {/* Back Button */}
            <button
              onClick={() => navigate('/dashboard/my-case')}
              className="flex items-center gap-2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors mb-4 min-h-[44px] -ml-2 px-2"
              data-testid="back-to-case"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Mi Caso</span>
            </button>
            
            {/* Stage Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[#C9A96A] bg-[#C9A96A]/10 px-2 py-0.5 rounded">
                    ETAPA {stageData.stageNumber}
                  </span>
                  {isCompleted && (
                    <span className="text-xs font-medium text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Completada
                    </span>
                  )}
                  {isCurrent && !isCompleted && (
                    <span className="text-xs font-medium text-[#C9A96A] bg-[#C9A96A]/10 px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      En progreso
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-xs font-medium text-[#64748B] bg-[#334155] px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Bloqueada
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold text-[#F8FAFC] truncate">
                  {stageName}
                </h1>
              </div>
              
              {/* Price Badge - Hidden from client view */}
              {/* Stage price is intentionally not shown to clients */}
            </div>
          </div>
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* ========== QUICK SUMMARY CARD ========== */}
          {isFinalStage ? (
            /* ========== ETAPA 12 - BLINDAJE MIGRATORIO ========== */
            <div className="space-y-4">
              {/* Hero card */}
              <div className="bg-gradient-to-br from-sky-900/50 via-indigo-900/40 to-purple-900/30 rounded-2xl border border-sky-400/30 p-5 sm:p-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-sky-400/20 mb-2">
                    <svg className="h-6 w-6 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">Blindaje Migratorio y Ajuste Concurrente</h2>
                  <p className="text-sky-200/70 text-xs mt-1">Categoria EB-2 NIW <em>Current</em> segun Visa Bulletin</p>
                </div>
              </div>

              {/* Incluye */}
              <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
                <h3 className="text-sm font-semibold text-[#C9A96A] mb-3">Incluye</h3>
                <div className="space-y-2.5">
                  {[
                    { form: 'I-485', desc: 'Solicitud de Ajuste de Estatus', color: 'text-blue-400 bg-blue-500/20' },
                    { form: 'I-765', desc: 'Permiso de Trabajo (EAD)', color: 'text-emerald-400 bg-emerald-500/20' },
                    { form: 'I-131', desc: 'Permiso de Viaje (Advance Parole)', color: 'text-sky-400 bg-sky-500/20' },
                  ].map((item) => (
                    <div key={item.form} className="flex items-center gap-3 bg-[#0F172A] rounded-lg p-2.5">
                      <div className={`h-7 w-7 rounded-lg ${item.color.split(' ')[1]} flex items-center justify-center flex-shrink-0`}>
                        <FileText className={`h-3.5 w-3.5 ${item.color.split(' ')[0]}`} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#F8FAFC]">Form {item.form}</span>
                        <span className="text-xs text-[#64748B] ml-1.5">— {item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resultado Estrategico */}
              <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
                <h3 className="text-sm font-semibold text-[#C9A96A] mb-3">Resultado Estrategico</h3>
                <ul className="space-y-2.5">
                  {[
                    'Activacion formal del proceso de residencia',
                    'Proteccion migratoria mientras el caso esta pendiente',
                    'Permiso legal para trabajar',
                    'Autorizacion para viajar y reingresar a EE.UU.'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-[#E2E8F0]">
                      <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ajuste Pendiente + Combo Card */}
              <div className="bg-[#1E293B] rounded-xl border border-emerald-500/30 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-300 mb-1">Estatus de "Ajuste Pendiente"</h3>
                    <p className="text-[#CBD5E1] text-xs leading-relaxed">
                      Te permite permanecer legalmente en el pais incluso si tu visa actual (ej. turista o estudiante) llegara a vencerse despues de la entrega.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1E293B] rounded-xl border border-sky-500/30 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-sky-300 mb-1">Combo Card</h3>
                    <p className="text-[#CBD5E1] text-xs leading-relaxed">
                      En unos meses recibiras tu permiso de trabajo y el Advance Parole (permiso de viaje), lo que te permitira trabajar con cualquier empleador y viajar fuera de EE.UU.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-5 sm:p-6">
            <h2 className="text-lg font-medium text-[#F8FAFC] mb-4">Resumen</h2>
            
            {/* What is this stage */}
            {stageDescription && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[#94A3B8] mb-2">¿Qué es esta etapa?</h3>
                <p className="text-sm text-[#E2E8F0] leading-relaxed">{stageDescription}</p>
              </div>
            )}
            
            {/* What's included */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[#94A3B8] mb-2">¿Qué incluye?</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0F172A] rounded-lg p-3 border border-[#334155]">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-sm font-medium text-[#F8FAFC]">{stageDeliverables.length}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">Entregables</p>
                </div>
                <div className="bg-[#0F172A] rounded-lg p-3 border border-[#334155]">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-sm font-medium text-[#F8FAFC]">{stageDocuments.length}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">Documentos</p>
                </div>
              </div>
            </div>
            
            {/* What's expected from client */}
            {stageDocuments.filter(d => d.required || d.isRequired).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#94A3B8] mb-2">¿Qué se espera de ti?</h3>
                <p className="text-sm text-[#E2E8F0]">
                  Debes subir {stageDocuments.filter(d => d.required || d.isRequired).length} documento(s) requerido(s) para avanzar.
                </p>
              </div>
            )}
          </div>
          )}

          {/* ========== DELIVERABLES SECTION ========== */}
          {/* ========== DELIVERABLES SECTION ========== */}
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#334155]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#C9A96A]" />
                  <h2 className="text-lg font-medium text-[#F8FAFC]">Entregables</h2>
                </div>
                <span className="text-sm text-[#64748B] bg-[#0F172A] px-2.5 py-1 rounded-full">
                  {stageDeliverables.length}
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-[#334155]">
              {stageDeliverables.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="h-10 w-10 text-[#334155] mx-auto mb-3" />
                  <p className="text-[#64748B]">No hay entregables en esta etapa</p>
                </div>
              ) : (
                stageDeliverables.map((deliverable) => {
                  const deliverableName = toText(deliverable.deliverableName) || toText(deliverable.name) || 'Entregable';
                  
                  // Check deliverable types
                  const isManualDIY = deliverableName.toLowerCase().includes('manual diy') || 
                                      deliverableName.toLowerCase().includes('guía completa') ||
                                      deliverableName.toLowerCase().includes('guia completa');
                  
                  const isEligibilityReport = deliverableName.toLowerCase().includes('reporte de elegibilidad') ||
                                              deliverableName.toLowerCase().includes('eligibility report') ||
                                              deliverableName.toLowerCase().includes('análisis detallado');
                  
                  const isRoadMap = deliverableName.toLowerCase().includes('ruta personalizada') ||
                                    deliverableName.toLowerCase().includes('personalized roadmap') ||
                                    deliverableName.toLowerCase().includes('plan estratégico');
                  
                  // Check if this is a "Hoja de vida" deliverable
                  const isHojaDeVida = deliverableName.toLowerCase().includes('hoja de vida') ||
                                       deliverableName.toLowerCase().includes('curriculum') ||
                                       deliverableName.toLowerCase().includes('resume');
                  const latestCv = isHojaDeVida && userCvs.length > 0 ? userCvs[0] : null;
                  
                  // Check if this is a Libro Técnico deliverable
                  const isLibro = deliverableName.toLowerCase().includes('libro') ||
                                  (deliverableName.toLowerCase().includes('book') && !deliverableName.toLowerCase().includes('facebook'));


                  // If stage is paid/free/completed/unlocked → all deliverables can be downloaded
                  // isLocked is false when stage is paid, free, completed, or unlocked
                  const stageIsOpen = !isLocked;
                  const isSpecialType = isManualDIY || isEligibilityReport || isRoadMap || (isHojaDeVida && latestCv);
                  const canDownload = stageIsOpen || isSpecialType;
                  
                  // Get files array (with backward compatibility for single fileUrl)
                  let delFiles = deliverable.files?.length > 0 
                    ? deliverable.files 
                    : deliverable.fileUrl 
                      ? [{ id: 'legacy', fileName: deliverable.fileName || 'Archivo', fileUrl: deliverable.fileUrl }]
                      : [];
                  
                  // For Manual DIY, add the fixed PDF if no files uploaded and stage is free/unlocked
                  if (isManualDIY && delFiles.length === 0 && (isFree || !isLocked)) {
                    delFiles = [{
                      id: 'fixed-manual-diy',
                      fileName: 'EB-2 NIW Guía Completa.pdf',
                      fileUrl: `${BACKEND_URL}/api/static/manual-diy-completo.pdf`
                    }];
                  }

                  // For Hoja de vida with existing CV, add it as a file
                  if (isHojaDeVida && latestCv && delFiles.length === 0) {
                    delFiles = [{
                      id: 'user-cv',
                      fileName: latestCv.fileName || 'Hoja de Vida',
                      fileUrl: latestCv.url
                    }];
                  }
                  
                  // Check if this deliverable has a special download button (no file list)
                  const hasSpecialDownload = isEligibilityReport || isRoadMap;
                  
                  return (
                    <div
                      key={deliverable._id}
                      className="p-4 sm:p-5 hover:bg-[#0F172A]/50 transition-colors"
                    >
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        {(delFiles.length > 0 || hasSpecialDownload) && canDownload ? (
                          <CheckCircle className="h-4 w-4 text-[#22C55E] flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-[#64748B] flex-shrink-0" />
                        )}
                        <h3 className="text-sm font-medium text-[#F8FAFC] truncate">{deliverableName}</h3>
                        {delFiles.length > 1 && !hasSpecialDownload && (
                          <span className="text-[10px] text-[#C9A96A] bg-[#C9A96A]/10 px-1.5 py-0.5 rounded">
                            {delFiles.length} archivos
                          </span>
                        )}
                      </div>
                      
                      {/* Description */}
                      {toText(deliverable.description) && (
                        <p className="text-xs text-[#64748B] mt-1 line-clamp-2 ml-6">
                          {toText(deliverable.description)}
                        </p>
                      )}
                      
                      {/* Eligibility Report - special download */}
                      {isEligibilityReport && canDownload && (
                        <div className="ml-6 mt-3">
                          <div className="flex items-center justify-between bg-[#0F172A] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <File className="h-4 w-4 text-[#22C55E] flex-shrink-0" />
                              <span className="text-sm text-[#F8FAFC] truncate">
                                Reporte de Elegibilidad.pdf
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleDownloadEligibilityPDF}
                              disabled={downloadingPDF}
                              className="h-8 px-2 text-[#64748B] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
                            >
                              {downloadingPDF ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* RoadMap - special download */}
                      {isRoadMap && canDownload && (
                        <div className="ml-6 mt-3">
                          <div className="flex items-center justify-between bg-[#0F172A] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <File className="h-4 w-4 text-[#22C55E] flex-shrink-0" />
                              <span className="text-sm text-[#F8FAFC] truncate">
                                Ruta Personalizada.pdf
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleDownloadRoadMapPDF}
                              disabled={downloadingRoadMap}
                              className="h-8 px-2 text-[#64748B] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
                            >
                              {downloadingRoadMap ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Regular files list — show filenames always (with Lock icon
                          when stage is blocked). BP and Libro use their own wizards
                          when unlocked, but when locked they fall through here so the
                          client can preview the filenames without downloading. */}
                      {delFiles.length > 0 && !hasSpecialDownload && (!canDownload || !isLibro) && (
                        <div className="ml-6 mt-3 space-y-2">
                          {delFiles.map((file, index) => {
                            const fileNote = file.note || file.notes || '';
                            return (
                            <div key={file.id || index} className="space-y-1">
                              <div className="flex items-center justify-between bg-[#0F172A] rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <File className={`h-4 w-4 flex-shrink-0 ${canDownload ? 'text-[#22C55E]' : 'text-[#475569]'}`} />
                                  <span className={`text-sm truncate ${canDownload ? 'text-[#F8FAFC]' : 'text-[#64748B]'}`}>
                                    {file.fileName || `Archivo ${index + 1}`}
                                  </span>
                                </div>
                                {canDownload ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const fullUrl = file.fileUrl?.startsWith('http')
                                        ? file.fileUrl
                                        : `${BACKEND_URL}${file.fileUrl}`;
                                      window.open(fullUrl, '_blank');
                                    }}
                                    className="h-8 px-2 text-[#64748B] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Lock className="h-4 w-4 text-[#475569]" />
                                )}
                              </div>
                              {(() => {
                                const thread = buildDeliverableThread(file);
                                const isReplying = replyingDeliverableFileId === file.id;
                                if (thread.length === 0 && !isReplying) {
                                  return canDownload ? (
                                    <button
                                      onClick={() => { setReplyingDeliverableFileId(file.id); setDeliverableReplyDraft(''); }}
                                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#C9A96A] transition-colors"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      Agregar nota
                                    </button>
                                  ) : null;
                                }
                                return (
                                  <div className="mt-2 space-y-2">
                                    {thread.map((entry) => {
                                      const fromClient = entry.authorRole === 'client';
                                      return (
                                        <div
                                          key={entry.id}
                                          className={`px-2.5 py-2 rounded-md border-l-2 ${
                                            fromClient
                                              ? 'bg-[#1E293B] border-[#C9A96A]'
                                              : 'bg-[#0F2540] border-[#3B82F6]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] mb-1">
                                            <MessageSquare className="h-3 w-3" />
                                            <span className="font-medium">{entry.authorName || (fromClient ? 'Cliente' : 'Equipo')}</span>
                                            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                              fromClient ? 'bg-[#C9A96A]/20 text-[#C9A96A]' : 'bg-[#3B82F6]/20 text-[#60A5FA]'
                                            }`}>
                                              {fromClient ? 'Tú' : 'Equipo'}
                                            </span>
                                            {entry.createdAt && (
                                              <>
                                                <span>·</span>
                                                <span>{new Date(entry.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                              </>
                                            )}
                                          </div>
                                          <p className="text-xs text-[#E2E8F0] whitespace-pre-wrap">{entry.text}</p>
                                        </div>
                                      );
                                    })}
                                    {canDownload && !isReplying && (
                                      <button
                                        onClick={() => { setReplyingDeliverableFileId(file.id); setDeliverableReplyDraft(''); }}
                                        className="inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#C9A96A] transition-colors"
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                        Responder
                                      </button>
                                    )}
                                    {isReplying && (
                                      <div className="bg-[#0F172A] border border-[#334155] rounded-md p-2 space-y-2">
                                        <textarea
                                          value={deliverableReplyDraft}
                                          onChange={(e) => setDeliverableReplyDraft(e.target.value)}
                                          placeholder="Escribe tu respuesta..."
                                          rows={3}
                                          maxLength={1000}
                                          disabled={sendingDeliverableReply}
                                          className="w-full bg-[#1E293B] border border-[#334155] text-[#F8FAFC] rounded px-2 py-1.5 text-xs focus:border-[#C9A96A] focus:outline-none resize-none"
                                        />
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-[#64748B]">{deliverableReplyDraft.length}/1000</span>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => { setReplyingDeliverableFileId(null); setDeliverableReplyDraft(''); }}
                                              disabled={sendingDeliverableReply}
                                              className="text-[11px] text-[#94A3B8] hover:text-[#F8FAFC] px-2 py-1"
                                            >Cancelar</button>
                                            <button
                                              onClick={() => handleSendDeliverableReply(deliverable._id || deliverable.id, file.id)}
                                              disabled={sendingDeliverableReply || !deliverableReplyDraft.trim()}
                                              className="text-[11px] bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold px-3 py-1 rounded disabled:opacity-50"
                                            >
                                              {sendingDeliverableReply ? 'Enviando...' : 'Enviar'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ========== BOOK PREPARATION WIZARD ========== */}
                      {isLibro && canDownload && (
                        <div className="ml-6 mt-4" data-testid="book-wizard">
                          {/* Step indicator */}
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              bookPrep?.step ? 'bg-[#C9A96A] text-[#0F172A]' : 'bg-[#334155] text-[#94A3B8]'
                            }`}>1</div>
                            <div className={`h-px flex-1 ${bookPrep?.selectedIdea ? 'bg-[#C9A96A]' : 'bg-[#334155]'}`} />
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              bookPrep?.selectedIdea ? 'bg-[#C9A96A] text-[#0F172A]' : 'bg-[#334155] text-[#94A3B8]'
                            }`}>2</div>
                            <div className={`h-px flex-1 ${bookPrep?.step === 'ready' ? 'bg-[#22C55E]' : 'bg-[#334155]'}`} />
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              bookPrep?.step === 'ready' ? 'bg-[#22C55E] text-[#0F172A]' : 'bg-[#334155] text-[#94A3B8]'
                            }`}>3</div>
                          </div>

                          {/* STEP 1: Show Ideas */}
                          {(!bookPrep || !bookPrep.selectedIdea) && (
                            <div className="bg-[#0F172A] rounded-xl p-4 border border-[#334155]">
                              <div className="flex items-center gap-2 mb-3">
                                <Lightbulb className="h-4 w-4 text-[#C9A96A]" />
                                <h4 className="text-sm font-medium text-[#F8FAFC]">Paso 1: Elige la idea de tu libro</h4>
                              </div>

                              {bookIdeas.length === 0 ? (
                                <div className="text-center py-4">
                                  <p className="text-xs text-[#94A3B8] mb-3">
                                    Analizaremos tu CV y proyecto para sugerirte 3 ideas de libro personalizadas
                                  </p>
                                  <Button
                                    onClick={handleShowBookIdeas}
                                    disabled={bookLoadingIdeas}
                                    data-testid="show-book-ideas-btn"
                                    className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold px-6"
                                  >
                                    {bookLoadingIdeas ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Analizando tu perfil...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Mostrar Ideas para el Libro
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {bookIdeas.map((idea, idx) => {
                                    const isRecommended = ideasEvaluation?.best_idea_number === String(idx);
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleSelectIdea(idea)}
                                        disabled={bookSaving}
                                        data-testid={`book-idea-${idx}`}
                                        className={`w-full text-left p-3 rounded-lg border transition-all hover:border-[#C9A96A] hover:bg-[#C9A96A]/5 ${
                                          isRecommended ? 'border-[#C9A96A]/50 bg-[#C9A96A]/5' : 'border-[#334155] bg-[#1E293B]'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <span className="text-xs font-bold text-[#C9A96A] mt-0.5">{idx + 1}.</span>
                                          <div className="flex-1">
                                            <p className="text-sm text-[#E2E8F0] leading-relaxed">{idea}</p>
                                            {isRecommended && (
                                              <span className="inline-block mt-1 text-[10px] bg-[#C9A96A]/20 text-[#C9A96A] px-2 py-0.5 rounded-full font-medium">
                                                Recomendada
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}

                                  {/* Custom idea option */}
                                  {!showCustomIdea ? (
                                    <button
                                      onClick={() => setShowCustomIdea(true)}
                                      className="w-full text-left p-3 rounded-lg border border-dashed border-[#475569] hover:border-[#C9A96A] transition-all"
                                    >
                                      <div className="flex items-center gap-2">
                                        <PenLine className="h-4 w-4 text-[#64748B]" />
                                        <span className="text-sm text-[#94A3B8]">Escribir mi propia idea</span>
                                      </div>
                                    </button>
                                  ) : (
                                    <div className="p-3 rounded-lg border border-[#C9A96A]/30 bg-[#1E293B]">
                                      <textarea
                                        value={customIdea}
                                        onChange={(e) => setCustomIdea(e.target.value)}
                                        placeholder="Describe tu idea para el libro..."
                                        className="w-full bg-[#0F172A] border border-[#334155] rounded-lg p-3 text-sm text-[#F8FAFC] placeholder-[#64748B] resize-none focus:outline-none focus:border-[#C9A96A] min-h-[80px]"
                                      />
                                      <div className="flex gap-2 mt-2 justify-end">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => { setShowCustomIdea(false); setCustomIdea(''); }}
                                          className="text-[#64748B]"
                                        >Cancelar</Button>
                                        <Button
                                          size="sm"
                                          onClick={() => { if (customIdea.trim()) handleSelectIdea(customIdea.trim(), true); }}
                                          disabled={!customIdea.trim() || bookSaving}
                                          className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A]"
                                        >
                                          {bookSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Usar esta idea'}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* STEP 2: Show Titles (after idea selected) */}
                          {bookPrep?.selectedIdea && bookPrep?.step === 'idea_selected' && (
                            <div className="bg-[#0F172A] rounded-xl p-4 border border-[#334155]">
                              <div className="mb-3 p-2 bg-[#1E293B] rounded-lg border border-[#C9A96A]/20">
                                <p className="text-[10px] text-[#C9A96A] font-medium uppercase tracking-wider mb-1">Idea seleccionada</p>
                                <p className="text-xs text-[#E2E8F0] line-clamp-2">{bookPrep.selectedIdea}</p>
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <Type className="h-4 w-4 text-[#C9A96A]" />
                                <h4 className="text-sm font-medium text-[#F8FAFC]">Paso 2: Elige el titulo de tu libro</h4>
                              </div>

                              {bookTitles.length === 0 ? (
                                <div className="text-center py-4">
                                  <p className="text-xs text-[#94A3B8] mb-3">
                                    Generaremos 3 opciones de titulo basadas en tu idea
                                  </p>
                                  <Button
                                    onClick={handleShowBookTitles}
                                    disabled={bookLoadingTitles}
                                    data-testid="show-book-titles-btn"
                                    className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold px-6"
                                  >
                                    {bookLoadingTitles ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generando titulos...
                                      </>
                                    ) : (
                                      <>
                                        <Type className="h-4 w-4 mr-2" />
                                        Mostrar Titulos
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {bookTitles.map((title, idx) => {
                                    const isRecommended = titlesEvaluation?.best_title_number === String(idx);
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleSelectTitle(title)}
                                        disabled={bookSaving}
                                        data-testid={`book-title-${idx}`}
                                        className={`w-full text-left p-3 rounded-lg border transition-all hover:border-[#C9A96A] hover:bg-[#C9A96A]/5 ${
                                          isRecommended ? 'border-[#C9A96A]/50 bg-[#C9A96A]/5' : 'border-[#334155] bg-[#1E293B]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <BookOpen className="h-4 w-4 text-[#C9A96A] flex-shrink-0" />
                                          <span className="text-sm font-medium text-[#F8FAFC]">{title}</span>
                                          {isRecommended && (
                                            <span className="text-[10px] bg-[#C9A96A]/20 text-[#C9A96A] px-2 py-0.5 rounded-full font-medium ml-auto flex-shrink-0">
                                              Recomendado
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              <button
                                onClick={handleResetBookPrep}
                                className="flex items-center gap-1 mt-3 text-xs text-[#64748B] hover:text-[#C9A96A] transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Empezar de nuevo
                              </button>
                            </div>
                          )}

                          {/* STEP 3: Ready state — book generating automatically */}
                          {bookPrep?.step === 'ready' && (
                            <div className="bg-[#0F172A] rounded-xl p-4 border border-[#22C55E]/30">
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="h-5 w-5 text-[#22C55E]" />
                                <h4 className="text-sm font-medium text-[#22C55E]">Libro en generacion</h4>
                              </div>
                              <div className="space-y-2">
                                <div className="p-2 bg-[#1E293B] rounded-lg">
                                  <p className="text-[10px] text-[#C9A96A] font-medium uppercase tracking-wider mb-1">Idea seleccionada</p>
                                  <p className="text-xs text-[#E2E8F0] line-clamp-2">{bookPrep.selectedIdea}</p>
                                </div>
                                <div className="p-2 bg-[#1E293B] rounded-lg">
                                  <p className="text-[10px] text-[#C9A96A] font-medium uppercase tracking-wider mb-1">Titulo</p>
                                  <p className="text-sm font-medium text-[#F8FAFC]">{bookPrep.selectedTitle}</p>
                                </div>
                              </div>
                              <p className="text-xs text-[#94A3B8] mt-3">Nuestro equipo legal generara el libro con la idea y titulo que elegiste.</p>
                              <button
                                onClick={handleResetBookPrep}
                                className="flex items-center gap-1 mt-2 text-xs text-[#64748B] hover:text-[#C9A96A] transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Cambiar seleccion
                              </button>
                            </div>
                          )}

                          {/* Show uploaded files if any */}
                          {delFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {delFiles.map((file, index) => {
                                const fileNote = file.note || file.notes || '';
                                return (
                                <div key={file.id || index} className="space-y-1">
                                  <div className="flex items-center justify-between bg-[#0F172A] rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <File className="h-4 w-4 flex-shrink-0 text-[#22C55E]" />
                                      <span className="text-sm truncate text-[#F8FAFC]">
                                        {file.fileName || `Archivo ${index + 1}`}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        const fullUrl = file.fileUrl?.startsWith('http')
                                          ? file.fileUrl
                                          : `${BACKEND_URL}${file.fileUrl}`;
                                        window.open(fullUrl, '_blank');
                                      }}
                                      className="h-8 px-2 text-[#64748B] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {fileNote && (
                                    <div className="px-3 py-2 bg-[#1E293B] rounded-lg border border-[#C9A96A]/30">
                                      <p className="text-[10px] uppercase tracking-wider text-[#C9A96A] font-medium mb-1">Nota del equipo</p>
                                      <p className="text-xs text-[#E2E8F0] whitespace-pre-wrap">{fileNote}</p>
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========== DOCUMENTS SECTION ========== */}
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#334155]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-[#C9A96A]" />
                  <h2 className="text-lg font-medium text-[#F8FAFC]">Documentos Requeridos</h2>
                </div>
                <span className="text-sm text-[#64748B] bg-[#0F172A] px-2.5 py-1 rounded-full">
                  {stageDocuments.length}
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-[#334155]">
              {stageDocuments.length === 0 ? (
                <div className="p-8 text-center">
                  <Upload className="h-10 w-10 text-[#334155] mx-auto mb-3" />
                  <p className="text-[#64748B]">No hay documentos requeridos</p>
                </div>
              ) : (
                stageDocuments.map((document) => {
                  const docName = toText(document.documentName) || toText(document.name) || 'Documento';
                  const isRequired = document.required || document.isRequired;
                  
                  // Auto-attach the client's CV ONLY for their own "Hoja de vida"
                  // doc. Stages 8/9 ask for "Hoja de vida de quien va a firmar..."
                  // (a third party's CV) — those must stay empty until uploaded.
                  const _docNameLc = docName.toLowerCase();
                  const _matchesCvName = _docNameLc.includes('hoja de vida') || _docNameLc.includes('curriculum') || _docNameLc.includes('resume');
                  const _refersToOther = /\b(de\s+quien|del\s+firmante|del\s+experto|del\s+recomendador|del\s+autor|de\s+experto|tercero)\b/.test(_docNameLc);
                  const isDocCV = _matchesCvName && !_refersToOther;
                  const cvForDoc = isDocCV && userCvs.length > 0 ? userCvs[0] : null;
                  
                  // Override status if CV exists
                  const effectiveStatus = (isDocCV && cvForDoc && document.status === 'pending') ? 'uploaded' : document.status;
                  const statusStyle = getDocumentStatus(effectiveStatus);
                  const StatusIcon = statusStyle.icon;
                  
                  // Get files array (with backward compatibility for single fileUrl)
                  const docFiles = document.files?.length > 0 
                    ? document.files 
                    : document.fileUrl 
                      ? [{ id: 'legacy', fileName: document.fileName || 'Archivo', fileUrl: document.fileUrl }]
                      : isDocCV && cvForDoc
                        ? [{ id: 'cv-auto', fileName: cvForDoc.fileName || 'Hoja de vida', fileUrl: cvForDoc.url }]
                        : [];
                  
                  return (
                    <div
                      key={document._id}
                      className="p-4 sm:p-5 hover:bg-[#0F172A]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-[#F8FAFC]">{docName}</h3>
                            {isRequired && (
                              <span className="text-[10px] text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded">
                                Requerido
                              </span>
                            )}
                          </div>
                          <div className={`inline-flex items-center gap-1 text-xs ${statusStyle.text} ${statusStyle.bg} px-2 py-0.5 rounded mt-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusStyle.label}
                          </div>
                        </div>
                        
                        {/* Upload button - always show to allow multiple files */}
                        {!isLocked && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDocument(document);
                              setShowUploadModal(true);
                            }}
                            className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] text-xs min-h-[40px]"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {docFiles.length > 0 ? 'Agregar' : 'Subir'}
                          </Button>
                        )}
                      </div>
                      
                      {/* Files list */}
                      {docFiles.length > 0 && (
                        <div className="ml-0 mt-3 space-y-2">
                          {docFiles.map((file, index) => (
                            <div
                              key={file.id || index}
                              className="bg-[#0F172A] rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <File className="h-4 w-4 text-[#64748B] flex-shrink-0" />
                                  <span className="text-sm text-[#F8FAFC] truncate">
                                    {file.fileName || `Archivo ${index + 1}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const fullUrl = file.fileUrl?.startsWith('http')
                                        ? file.fileUrl
                                        : `${BACKEND_URL}${file.fileUrl}`;
                                      window.open(fullUrl, '_blank');
                                    }}
                                    className="h-8 px-2 text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#334155]"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {!isLocked && file.id !== 'legacy' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteFile(document._id || document.id, file.id)}
                                      className="h-8 px-2 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {(() => {
                                const thread = buildNoteThread(file);
                                const isReplying = replyingFileId === file.id;
                                if (thread.length === 0 && !isReplying) {
                                  return !isLocked ? (
                                    <button
                                      onClick={() => { setReplyingFileId(file.id); setReplyDraft(''); }}
                                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#C9A96A] transition-colors"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      Agregar nota
                                    </button>
                                  ) : null;
                                }
                                return (
                                  <div className="mt-2 space-y-2">
                                    {thread.map((entry) => {
                                      const fromClient = entry.authorRole === 'client';
                                      return (
                                        <div
                                          key={entry.id}
                                          className={`px-2.5 py-2 rounded-md border-l-2 ${
                                            fromClient
                                              ? 'bg-[#1E293B] border-[#C9A96A]'
                                              : 'bg-[#0F2540] border-[#3B82F6]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] mb-1">
                                            <MessageSquare className="h-3 w-3" />
                                            <span className="font-medium">{entry.authorName || (fromClient ? 'Cliente' : 'Equipo')}</span>
                                            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                              fromClient ? 'bg-[#C9A96A]/20 text-[#C9A96A]' : 'bg-[#3B82F6]/20 text-[#60A5FA]'
                                            }`}>
                                              {fromClient ? 'Tú' : 'Equipo'}
                                            </span>
                                            {entry.createdAt && (
                                              <>
                                                <span>·</span>
                                                <span>{new Date(entry.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                              </>
                                            )}
                                          </div>
                                          <p className="text-xs text-[#E2E8F0] whitespace-pre-wrap">{entry.text}</p>
                                        </div>
                                      );
                                    })}
                                    {!isLocked && !isReplying && (
                                      <button
                                        onClick={() => { setReplyingFileId(file.id); setReplyDraft(''); }}
                                        className="inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#C9A96A] transition-colors"
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                        Responder
                                      </button>
                                    )}
                                    {isReplying && (
                                      <div className="bg-[#0F172A] border border-[#334155] rounded-md p-2 space-y-2">
                                        <textarea
                                          value={replyDraft}
                                          onChange={(e) => setReplyDraft(e.target.value)}
                                          placeholder="Escribe tu respuesta..."
                                          rows={3}
                                          maxLength={1000}
                                          disabled={sendingReply}
                                          className="w-full bg-[#1E293B] border border-[#334155] text-[#F8FAFC] rounded px-2 py-1.5 text-xs focus:border-[#C9A96A] focus:outline-none resize-none"
                                        />
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-[#64748B]">{replyDraft.length}/1000</span>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => { setReplyingFileId(null); setReplyDraft(''); }}
                                              disabled={sendingReply}
                                              className="text-[11px] text-[#94A3B8] hover:text-[#F8FAFC] px-2 py-1"
                                            >Cancelar</button>
                                            <button
                                              onClick={() => handleSendFileReply(document._id || document.id, file.id)}
                                              disabled={sendingReply || !replyDraft.trim()}
                                              className="text-[11px] bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold px-3 py-1 rounded disabled:opacity-50"
                                            >
                                              {sendingReply ? 'Enviando...' : 'Enviar'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Staff notes thread (only entries marked visible to client) */}
                      {(document.notes && document.notes.length > 0
                        ? document.notes
                        : document.note
                          ? [{ id: 'legacy', text: document.note, createdAt: null }]
                          : []
                      ).map((noteEntry) => (
                        <div key={noteEntry.id} className="mt-3 px-3 py-2 bg-[#1E293B] rounded-lg border border-[#C9A96A]/30">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] uppercase tracking-wider text-[#C9A96A] font-medium">Nota del equipo</p>
                            {noteEntry.createdAt && (
                              <p className="text-[10px] text-[#94A3B8]">{new Date(noteEntry.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            )}
                          </div>
                          <p className="text-xs text-[#E2E8F0] whitespace-pre-wrap">{noteEntry.text}</p>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========== STAGE NAVIGATION ========== */}
          {(() => {
            const totalStages = caseData?.stages?.length || 0;
            const currentNum = parseInt(stageNumber);
            const hasPrev = currentNum > 1;
            const hasNext = currentNum < totalStages;
            if (!hasPrev && !hasNext) return null;
            return (
              <div className="flex items-center justify-between gap-3 pt-2">
                {hasPrev ? (
                  <button
                    onClick={() => navigate(`/dashboard/my-case/stage/${currentNum - 1}`)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] border border-[#334155] text-[#E2E8F0] hover:border-[#C9A96A] hover:text-[#F8FAFC] transition-colors min-h-[44px]"
                    data-testid="prev-stage"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm font-medium">Etapa {currentNum - 1}</span>
                  </button>
                ) : <div />}
                {hasNext ? (
                  <button
                    onClick={() => navigate(`/dashboard/my-case/stage/${currentNum + 1}`)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A96A] text-[#0F172A] hover:bg-[#B8956A] font-semibold transition-colors min-h-[44px]"
                    data-testid="next-stage"
                  >
                    <span className="text-sm">Siguiente etapa</span>
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </button>
                ) : <div />}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ========== UPLOAD MODAL ========== */}
      {showUploadModal && selectedDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-1">
              Subir {toText(selectedDocument.documentName) || toText(selectedDocument.name) || 'Documento'}
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">Adjunta el archivo y, si quieres, deja una nota para tu equipo.</p>

            {/* File picker / preview */}
            {!pendingFile ? (
              <div
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4
                  ${isDragging ? 'border-[#C9A96A] bg-[#C9A96A]/10' : 'border-[#334155] hover:border-[#475569]'}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) setPendingFile(file);
                }}
              >
                <Upload className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
                <p className="text-[#F8FAFC] text-sm font-medium mb-1">Arrastra tu archivo aquí</p>
                <p className="text-[#64748B] text-xs mb-3">o</p>
                <label className="cursor-pointer">
                  <span className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-medium px-4 py-2 rounded-lg transition-colors inline-block text-sm">
                    Seleccionar archivo
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) setPendingFile(file);
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="bg-[#0F172A] border border-[#334155] rounded-lg p-3 mb-4 flex items-center gap-3">
                <File className="h-5 w-5 text-[#C9A96A] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#F8FAFC] truncate">{pendingFile.name}</p>
                  <p className="text-xs text-[#64748B]">{(pendingFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  disabled={uploading}
                  className="text-[#64748B] hover:text-[#F8FAFC] p-1 disabled:opacity-40"
                  title="Cambiar archivo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Note textarea — always visible */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wider">
                Nota u observación <span className="text-[#64748B] normal-case">(opcional)</span>
              </label>
              <textarea
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                placeholder="¿Algo que tu equipo deba saber sobre este archivo?"
                rows={4}
                maxLength={1000}
                disabled={uploading}
                className="w-full bg-[#0F172A] border border-[#334155] text-[#F8FAFC] rounded-lg px-3 py-2 text-sm focus:border-[#C9A96A] focus:outline-none resize-none"
              />
              <p className="text-[10px] text-[#64748B] mt-1">{uploadNote.length}/1000 · la nota quedará junto al archivo y no podrá editarse después</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedDocument(null);
                  setUploadNote('');
                  setPendingFile(null);
                }}
                className="text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]"
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleDocumentUpload(selectedDocument._id || selectedDocument.id, pendingFile, uploadNote)}
                disabled={uploading || !pendingFile}
                className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
                ) : 'Subir documento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
