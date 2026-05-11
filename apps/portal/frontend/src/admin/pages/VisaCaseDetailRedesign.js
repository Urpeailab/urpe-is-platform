import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { 
  Loader2, User, Mail, MailX, Phone, Briefcase,
  Calendar, DollarSign, Upload, Download, CheckCircle, 
  XCircle, Clock, FileText, AlertCircle, Edit, Trash2,
  ChevronsUpDown, Check, Link as LinkIcon, Copy, AlertTriangle,
  MoveRight, ArrowRight, History, Eye, LayoutGrid, CreditCard,
  FolderOpen, Settings, ChevronRight, RefreshCw, Lock, ArrowRightLeft,
  ExternalLink
} from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DeliverableUploadModal } from '../components/DeliverableUploadModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
// CaseAuditLog removed — audit data now shown in Timeline de Actividades
import { ActionHeader } from '../components/visa-case/ActionHeader';
import { StatCard } from '../components/visa-case/StatCard';
import { VisaTimeline } from '../components/visa-case/VisaTimeline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to extract text from multilingual objects
const getText = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    // Detect serialized Python dicts like "{'es': '...', 'en': '...'}"
    if (value.startsWith('{') && (value.includes("'es'") || value.includes('"es"'))) {
      try {
        const parsed = JSON.parse(value);
        return parsed.es || parsed.en || fallback;
      } catch (_) {
        try {
          const parsed = JSON.parse(value.replace(/'/g, '"'));
          return parsed.es || parsed.en || fallback;
        } catch (__) {
          const m = value.match(/['"]es['"]\s*:\s*['"]([^'"]+)['"]/);
          if (m) return m[1];
        }
      }
    }
    return value;
  }
  if (typeof value === 'object') {
    return value.es || value.en || value.name || fallback;
  }
  return String(value);
};

// Status configurations
const STAGE_STATUS_CONFIG = {
  'pending': { label: 'Pendiente', color: 'bg-slate-500/20 text-slate-400', icon: Clock },
  'in_progress': { label: 'En Progreso', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
  'completed': { label: 'Completada', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  'blocked': { label: 'Bloqueada', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
  'locked': { label: 'Bloqueada', color: 'bg-slate-500/20 text-slate-400', icon: Clock },
  'unlocked': { label: 'Desbloqueada', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle }
};

const DOCUMENT_STATUS_CONFIG = {
  'pending': { label: 'Pendiente', color: 'bg-slate-500/20 text-slate-400', icon: Clock },
  'uploaded': { label: 'Subido', color: 'bg-blue-500/20 text-blue-400', icon: FileText },
  'in_review': { label: 'En Revisión', color: 'bg-amber-500/20 text-amber-400', icon: AlertCircle },
  'validated': { label: 'Validado', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  'rejected': { label: 'Rechazado', color: 'bg-red-500/20 text-red-400', icon: XCircle }
};

export const VisaCaseDetailRedesign = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('admin_token');
  
  // Decode token to get user role
  const getUserRole = () => {
    try {
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || payload.type;
    } catch {
      return null;
    }
  };
  const userRole = getUserRole();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isAcreditador = userRole === 'acreditador';
  const currentUserId = (() => { try { return JSON.parse(atob(token.split('.')[1])).id; } catch { return null; } })();
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [stages, setStages] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [manualPayments, setManualPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deliverableToDelete, setDeliverableToDelete] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  // Delete file from deliverable states
  const [deleteFileModalOpen, setDeleteFileModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null); // { deliverableId, fileId, fileName }

  // Per-file note thread (deliverables) - "add new" dialog
  const [editingFileNote, setEditingFileNote] = useState(null); // { deliverableId, fileId, fileLabel }
  const [fileNoteDraft, setFileNoteDraft] = useState('');
  const [fileNoteVisibleDraft, setFileNoteVisibleDraft] = useState(false);
  const [savingFileNote, setSavingFileNote] = useState(false);

  // Per-document note thread (client documents) - "add new" dialog
  const [editingDocNote, setEditingDocNote] = useState(null); // { documentId, documentLabel }
  const [docNoteDraft, setDocNoteDraft] = useState('');
  const [docNoteVisibleDraft, setDocNoteVisibleDraft] = useState(false);
  const [savingDocNote, setSavingDocNote] = useState(false);

  // ZIP download selection state for the Documentos tab.
  // Map keyed by `${type}::${itemId}::${fileId}` → true.
  const [zipSelection, setZipSelection] = useState({});
  const [downloadingZip, setDownloadingZip] = useState(false);

  const selectionKey = (type, itemId, fileId) => `${type}::${itemId}::${fileId || 'legacy'}`;

  const toggleSelection = (type, itemId, fileId) => {
    const key = selectionKey(type, itemId, fileId);
    setZipSelection((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const setBulkSelection = (entries, value) => {
    setZipSelection((prev) => {
      const next = { ...prev };
      entries.forEach(({ type, itemId, fileId }) => {
        const key = selectionKey(type, itemId, fileId);
        if (value) next[key] = true;
        else delete next[key];
      });
      return next;
    });
  };

  const collectAllDownloadable = () => {
    const entries = [];
    deliverables.forEach((del) => {
      const files = del.files?.length > 0
        ? del.files
        : del.fileUrl ? [{ id: 'legacy', fileUrl: del.fileUrl, fileName: del.fileName }] : [];
      files.forEach((f) => {
        if (f.fileUrl) entries.push({ type: 'deliverable', itemId: del.id, fileId: f.id || 'legacy' });
      });
    });
    documents.forEach((doc) => {
      const files = doc.files?.length > 0
        ? doc.files
        : doc.fileUrl ? [{ id: 'legacy', fileUrl: doc.fileUrl, fileName: doc.fileName }] : [];
      files.forEach((f) => {
        if (f.fileUrl) entries.push({ type: 'document', itemId: doc.id, fileId: f.id || 'legacy' });
      });
    });
    return entries;
  };

  const handleDownloadZip = async () => {
    const items = Object.keys(zipSelection).map((k) => {
      const [type, itemId, fileId] = k.split('::');
      return { type, itemId, fileId: fileId === 'legacy' ? null : fileId };
    });
    if (items.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }
    try {
      setDownloadingZip(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/download-zip`,
        { items },
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      link.download = match ? match[1] : `caso_${caseId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Descarga lista');
    } catch (error) {
      const msg = error.response?.data instanceof Blob
        ? 'No se pudo construir el ZIP'
        : (error.response?.data?.detail || 'No se pudo construir el ZIP');
      toast.error(msg);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Add deliverable / add document dialogs (per case + stage)
  const [addingDeliverable, setAddingDeliverable] = useState(null); // { stageNumber, stageLabel }
  const [newDeliverableName, setNewDeliverableName] = useState('');
  const [newDeliverableDescription, setNewDeliverableDescription] = useState('');
  const [savingNewDeliverable, setSavingNewDeliverable] = useState(false);

  const [addingDocument, setAddingDocument] = useState(null); // { stageNumber, stageLabel }
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentDescription, setNewDocumentDescription] = useState('');
  const [newDocumentRequired, setNewDocumentRequired] = useState(true);
  const [newDocumentPhysical, setNewDocumentPhysical] = useState(false);
  const [savingNewDocument, setSavingNewDocument] = useState(false);

  // Expanded notes thread per file/document (accordion state)
  const [expandedNoteThreads, setExpandedNoteThreads] = useState({}); // { [threadKey]: bool }
  const toggleNoteThread = (key) => setExpandedNoteThreads((prev) => ({ ...prev, [key]: !prev[key] }));
  
  // Document validation states
  const [validatingDocId, setValidatingDocId] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [documentToReject, setDocumentToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectNotifyClient, setRejectNotifyClient] = useState(true);
  const [documentToValidate, setDocumentToValidate] = useState(null);
  const [validateNotifyClient, setValidateNotifyClient] = useState(true);
  
  // Magic links states
  const [magicLinks, setMagicLinks] = useState([]);
  const [generateLinkModalOpen, setGenerateLinkModalOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  
  // Whitepaper generation state
  const [wpJob, setWpJob] = useState(null);
  const [wpGenerating, setWpGenerating] = useState(false);
  
  // Policy Paper generation state
  const [ppJob, setPpJob] = useState(null);
  const [ppGenerating, setPpGenerating] = useState(false);
  
  // Econometric Study generation state
  const [ecJob, setEcJob] = useState(null);
  const [ecGenerating, setEcGenerating] = useState(false);
  
  // Book generation state
  const [bkJob, setBkJob] = useState(null);
  const [bkGenerating, setBkGenerating] = useState(false);
  const [bkPrep, setBkPrep] = useState(null);
  
  // Case Study (Harvard) generation state
  const [csJob, setCsJob] = useState(null);
  const [csGenerating, setCsGenerating] = useState(false);
  
  // Business Plan NIW generation state
  const [bpJob, setBpJob] = useState(null);
  const [bpPrep, setBpPrep] = useState(null);
  
  // CV states
  const [userCvs, setUserCvs] = useState([]);
  const [uploadingCv, setUploadingCv] = useState(false);
  
  // Activity states
  const [activities, setActivities] = useState([]);

  // Case Notes states
  const [caseNotes, setCaseNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Appointments states
  const [caseAppointments, setCaseAppointments] = useState([]);
  const [rejectApptId, setRejectApptId] = useState(null);
  const [rejectApptReason, setRejectApptReason] = useState('');

  // USCIS Tracker states
  const [uscisCases, setUscisCases] = useState([]);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [newReceipt, setNewReceipt] = useState('');
  const [newReceiptForm, setNewReceiptForm] = useState('I-140');
  const [addingReceipt, setAddingReceipt] = useState(false);
  
  // Payment states
  const [deletePaymentModalOpen, setDeletePaymentModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  
  // Edit payment states
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editPaymentData, setEditPaymentData] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStagesForPayment, setSelectedStagesForPayment] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('fanbasis');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [registeringPayment, setRegisteringPayment] = useState(false);
  
  // Edit stage price states
  const [editPriceModalOpen, setEditPriceModalOpen] = useState(false);
  const [stageToEditPrice, setStageToEditPrice] = useState(null);
  const [newStagePrice, setNewStagePrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);
  
  // Edit stage states (full edit)
  const [editStageModalOpen, setEditStageModalOpen] = useState(false);
  const [stageToEdit, setStageToEdit] = useState(null);
  const [editStageData, setEditStageData] = useState({
    name: '',
    description: '',
    amount: '',
    status: '',
    isPaid: false,
    isUnlocked: false
  });
  const [savingStage, setSavingStage] = useState(false);
  
  // Eligibility Report and Ruta Personalizada states
  const [eligibilityReport, setEligibilityReport] = useState(null);
  const [loadingEligibilityReport, setLoadingEligibilityReport] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [uploadingEligibility, setUploadingEligibility] = useState(false);
  const [downloadingEligibilityPDF, setDownloadingEligibilityPDF] = useState(false);
  
  const [rutaPersonalizada, setRutaPersonalizada] = useState(null);
  const [loadingRutaPersonalizada, setLoadingRutaPersonalizada] = useState(false);
  const [showRutaPersonalizadaModal, setShowRutaPersonalizadaModal] = useState(false);
  const [cvFileRuta, setCvFileRuta] = useState(null);
  const [uploadingRutaPersonalizada, setUploadingRutaPersonalizada] = useState(false);
  const [downloadingRutaPDF, setDownloadingRutaPDF] = useState(false);
  
  // Edit Case states
  const [editCaseModalOpen, setEditCaseModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    visaType: '',
    status: 'active'
  });
  const [savingCase, setSavingCase] = useState(false);
  
  // Change Stage Modal for deliverables/documents
  const [changeStageModalOpen, setChangeStageModalOpen] = useState(false);
  const [itemToChangeStage, setItemToChangeStage] = useState(null); // { type: 'deliverable' | 'document', item: object }
  const [newStageNumber, setNewStageNumber] = useState('');
  const [changingStage, setChangingStage] = useState(false);
  
  // Stage selection
  const [selectedStage, setSelectedStage] = useState(null);
  const [viewAllStages, setViewAllStages] = useState(true);
  
  // Coordinator/Seller assignment
  const [coordinatorPopoverOpen, setCoordinatorPopoverOpen] = useState(false);
  const [sellerPopoverOpen, setSellerPopoverOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Fetch case data
  const fetchCaseData = useCallback(async () => {
    if (!caseId || !token) return;
    
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCaseData(data.case);
      setStages(data.stages || []);
      setDeliverables(data.deliverables || []);
      setDocuments(data.documents || []);
      setPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching case:', error);
      toast.error('Error al cargar el caso');
    } finally {
      setLoading(false);
    }
  }, [caseId, token]);

  // Fetch manual payments
  const fetchManualPayments = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/payments?caseId=${caseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setManualPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching manual payments:', error);
    }
  }, [caseId, token]);

  // Fetch user CVs
  const fetchUserCvs = useCallback(async (userId) => {
    if (!userId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/users/${userId}/cvs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserCvs(data.cvs || []);
    } catch (error) {
      console.error('Error fetching CVs:', error);
    }
  }, [token]);

  // Fetch whitepaper job status
  const fetchWpJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/whitepaper-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWpJob(data.job);
    } catch (e) {
      console.error('Error fetching wp job:', e);
    }
  }, [caseId, token]);

  // Start whitepaper generation
  const handleGenerateWhitepaper = async () => {
    try {
      setWpGenerating(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/generate-whitepaper`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Generacion de White Paper iniciada');
      fetchWpJob();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar generacion');
    } finally {
      setWpGenerating(false);
    }
  };

  // Fetch policy paper job status
  const fetchPpJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/policy-paper-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPpJob(data.job);
    } catch (e) {
      console.error('Error fetching pp job:', e);
    }
  }, [caseId, token]);

  // Start policy paper generation
  const handleGeneratePolicyPaper = async () => {
    try {
      setPpGenerating(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/generate-policy-paper`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Generacion de Policy Paper iniciada');
      fetchPpJob();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar generacion');
    } finally {
      setPpGenerating(false);
    }
  };

  // Fetch econometric job status
  const fetchEcJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/econometric-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEcJob(data.job);
    } catch (e) {
      console.error('Error fetching ec job:', e);
    }
  }, [caseId, token]);

  // Start econometric study generation
  const handleGenerateEconometric = async () => {
    try {
      setEcGenerating(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/generate-econometric`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Generacion de Estudio Econometrico iniciada');
      fetchEcJob();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar generacion');
    } finally {
      setEcGenerating(false);
    }
  };

  // Fetch book job status
  const fetchBkJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/book-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBkJob(data.job);
      // Also fetch book preparation status
      const { data: prepData } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/book-preparation`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBkPrep(prepData.preparation);
    } catch (e) {
      console.error('Error fetching bk job:', e);
    }
  }, [caseId, token]);

  // Start book generation
  const handleGenerateBook = async () => {
    try {
      setBkGenerating(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/generate-book`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Generacion de Libro iniciada');
      fetchBkJob();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar generacion');
    } finally {
      setBkGenerating(false);
    }
  };

  // Fetch case study job status
  const fetchCsJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/case-study-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCsJob(data.job);
    } catch (e) {
      console.error('Error fetching cs job:', e);
    }
  }, [caseId, token]);

  // Start case study generation
  const handleGenerateCaseStudy = async () => {
    try {
      setCsGenerating(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/generate-case-study`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Generacion de Caso de Estudio iniciada');
      fetchCsJob();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar generacion');
    } finally {
      setCsGenerating(false);
    }
  };

  // Fetch BP job and preparation
  const fetchBpJob = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/bp-job`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBpJob(data.job);
    } catch (e) {
      console.error('Error fetching bp job:', e);
    }
  }, [caseId, token]);

  const fetchBpPrep = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/bp-preparation`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBpPrep(data.preparation);
    } catch (e) {
      console.error('Error fetching bp prep:', e);
    }
  }, [caseId, token]);

  // Fetch case activities
  const fetchActivities = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/cases/${caseId}/activities?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [caseId, token]);

  // Fetch case notes
  const fetchCaseNotes = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/cases/${caseId}/notes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCaseNotes(data.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  }, [caseId, token]);

  // Fetch case appointments
  const fetchAppointments = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/appointments?caseId=${caseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCaseAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [caseId, token]);

  // Fetch USCIS cases for this visa case
  const fetchUscisCases = useCallback(async () => {
    if (!caseId || !token) return;
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/uscis-cases/by-visa-case/${caseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUscisCases(data.cases || []);
    } catch (error) {
      console.error('Error fetching USCIS cases:', error);
    }
  }, [caseId, token]);

  // Fetch Eligibility Report
  const fetchEligibilityReport = useCallback(async (phone) => {
    if (!phone) return;
    try {
      setLoadingEligibilityReport(true);
      const { data } = await axios.get(
        `${BACKEND_URL}/api/eligibility/report/${encodeURIComponent(phone)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEligibilityReport(data);
    } catch (error) {
      console.error('Error fetching eligibility report:', error);
      setEligibilityReport({ has_report: false });
    } finally {
      setLoadingEligibilityReport(false);
    }
  }, [token]);

  // Fetch Ruta Personalizada
  const fetchRutaPersonalizada = useCallback(async (phone) => {
    if (!phone) return;
    try {
      setLoadingRutaPersonalizada(true);
      const { data } = await axios.get(
        `${BACKEND_URL}/api/ruta-personalizada/report/${encodeURIComponent(phone)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRutaPersonalizada(data);
    } catch (error) {
      console.error('Error fetching ruta personalizada:', error);
      setRutaPersonalizada({ has_report: false });
    } finally {
      setLoadingRutaPersonalizada(false);
    }
  }, [token]);

  // Download Eligibility Report PDF
  const handleDownloadEligibilityPDF = async () => {
    if (!caseData?.user?.phone) {
      toast.error('No hay teléfono del usuario disponible');
      return;
    }

    setDownloadingEligibilityPDF(true);
    toast.info('Generando PDF del reporte de elegibilidad...');
    
    try {
      // Fetch complete data from n8n webhook (same as user dashboard)
      let completeData = null;
      const response = await axios.post(
        'https://n8n.urpeailab.com/webhook/ae8c88b1-3c08-49d8-b365-8e65fe96a291',
        { telefono: caseData.user.phone },
        { timeout: 30000 }
      );

      if (response.data) {
        if (Array.isArray(response.data)) {
          completeData = response.data[0];
        } else if (response.data.data && typeof response.data.data === 'string') {
          completeData = JSON.parse(response.data.data);
        } else {
          completeData = response.data;
        }
      }

      if (!completeData) {
        toast.error('No hay datos disponibles para generar el reporte');
        setDownloadingEligibilityPDF(false);
        return;
      }

      // Merge data
      const mergedData = {
        ...completeData,
        nombreCompleto: caseData.user?.name || completeData?.nombreCompleto,
      };
      
      // Use the same PDF generator as user dashboard
      const { generateCompletePDF } = await import('../../utils/completePdfGenerator');
      const result = generateCompletePDF(mergedData, caseData.user);
      
      if (result.success) {
        toast.success('Reporte de elegibilidad descargado exitosamente');
      } else {
        toast.error(result.message || 'Error al descargar el reporte');
      }
    } catch (error) {
      console.error('Error downloading eligibility PDF:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingEligibilityPDF(false);
    }
  };

  // Download Ruta Personalizada PDF
  const handleDownloadRutaPDF = async () => {
    if (!caseData?.user?.phone) {
      toast.error('No hay teléfono del usuario disponible');
      return;
    }

    setDownloadingRutaPDF(true);
    toast.info('Generando PDF de la ruta personalizada...');
    
    try {
      // Fetch roadmap data from n8n webhook
      const response = await axios.post(
        'https://n8n.urpeailab.com/webhook/road-map',
        { telefono: caseData.user.phone },
        { timeout: 45000 }
      );

      let roadMapData = [];
      if (response.data) {
        if (response.data.data && typeof response.data.data === 'string') {
          const parsedData = JSON.parse(response.data.data);
          if (parsedData.roadmap_servicios) {
            roadMapData = parsedData.roadmap_servicios;
          }
        } else if (Array.isArray(response.data)) {
          roadMapData = response.data;
        } else if (response.data.roadmap_servicios) {
          roadMapData = response.data.roadmap_servicios;
        }
      }

      if (!roadMapData || roadMapData.length === 0) {
        toast.error('No hay datos de ruta personalizada disponibles');
        setDownloadingRutaPDF(false);
        return;
      }

      // Generate PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        compress: true,
        unit: 'mm',
        format: 'a4'
      });

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

      // Colors
      const primaryColor = [0, 51, 102];
      const secondaryColor = [0, 102, 153];
      const lightBg = [245, 247, 250];

      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('RUTA PERSONALIZADA', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(encodeText(caseData.user?.name || 'Usuario'), 105, 30, { align: 'center' });

      let yPos = 50;
      const pageHeight = 297;
      const margin = 15;
      const maxWidth = 180;

      // Calculate summary stats
      const totalItems = roadMapData.length;
      const requiredItems = roadMapData.filter(s => s.requerido !== false).length;
      const completedItems = roadMapData.filter(s => s.requerido === false).length;
      const totalDiasUrpe = roadMapData.reduce((sum, s) => sum + (s.dias_urpe || 0), 0);
      const totalDiasProspecto = roadMapData.reduce((sum, s) => sum + (s.dias_prospecto_estimado || 0), 0);

      // Summary section
      doc.setFillColor(240, 253, 244); // Light green
      doc.roundedRect(margin, yPos, maxWidth, 25, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(margin, yPos, maxWidth, 25, 3, 3, 'S');
      
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN DE TU RUTA', margin + 5, yPos + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total servicios: ${totalItems}  |  Requeridos: ${requiredItems}  |  Completados: ${completedItems}`, margin + 5, yPos + 14);
      doc.text(`Tiempo con URPE: ${totalDiasUrpe} dias  |  Tiempo sin URPE: ${totalDiasProspecto} dias  |  Ahorro: ${totalDiasProspecto - totalDiasUrpe} dias`, margin + 5, yPos + 21);
      
      yPos += 35;

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
        doc.setFillColor(...secondaryColor);
        doc.roundedRect(margin, yPos, maxWidth, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(encodeText(category.toUpperCase()), margin + 5, yPos + 7);
        yPos += 15;

        services.forEach((service, idx) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
          }

          // Service box - altura dinámica según contenido
          const itemName = service.item || service.servicio || service.nombre || 'Servicio';
          const itemDesc = service.ejemplo_urpe || service.descripcion || '';
          const isRequired = service.requerido !== false;
          const diasUrpe = service.dias_urpe || 0;
          const diasProspecto = service.dias_prospecto_estimado || 0;
          
          // Box height based on content
          const boxHeight = itemDesc ? 35 : 20;
          
          doc.setFillColor(...lightBg);
          doc.roundedRect(margin, yPos, maxWidth, boxHeight, 2, 2, 'F');
          
          // Item name
          doc.setTextColor(...primaryColor);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`${idx + 1}. ${encodeText(itemName)}`, margin + 5, yPos + 7);
          
          // Required badge
          if (isRequired) {
            doc.setFillColor(220, 38, 38); // Red
            doc.roundedRect(margin + maxWidth - 30, yPos + 2, 25, 6, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.text('REQUERIDO', margin + maxWidth - 28, yPos + 6);
          } else {
            doc.setFillColor(34, 197, 94); // Green
            doc.roundedRect(margin + maxWidth - 25, yPos + 2, 20, 6, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.text('LISTO', margin + maxWidth - 23, yPos + 6);
          }
          
          // Time comparison
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`URPE: ${diasUrpe} dias  |  Sin URPE: ${diasProspecto} dias`, margin + 5, yPos + 14);
          
          // Description/Example
          if (itemDesc) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            const descLines = doc.splitTextToSize(encodeText(itemDesc), maxWidth - 10);
            doc.text(descLines.slice(0, 2), margin + 5, yPos + 22);
          }
          
          yPos += boxHeight + 5;
        });
        yPos += 5;
      });

      // Footer on last page
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 105, pageHeight - 10, { align: 'center' });

      doc.save(`Ruta_Personalizada_${encodeText(caseData.user?.name || 'Usuario').replace(/\s+/g, '_')}.pdf`);
      toast.success('Ruta personalizada descargada exitosamente');
    } catch (error) {
      console.error('Error downloading ruta PDF:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingRutaPDF(false);
    }
  };

  useEffect(() => {
    fetchCaseData();
    fetchManualPayments();
    fetchActivities();
    fetchAppointments();
    fetchUscisCases();
    fetchCaseNotes();
  }, [fetchCaseData, fetchManualPayments, fetchActivities, fetchAppointments, fetchUscisCases, fetchCaseNotes]);

  // Fetch reports when caseData is available
  useEffect(() => {
    if (caseData?.user?.phone) {
      fetchEligibilityReport(caseData.user.phone);
      fetchRutaPersonalizada(caseData.user.phone);
    }
    if (caseData?.userId || caseData?.user?.id) {
      fetchUserCvs(caseData.userId || caseData.user.id);
    }
    fetchWpJob();
    fetchPpJob();
    fetchEcJob();
    fetchBkJob();
    fetchCsJob();
    fetchBpJob();
    fetchBpPrep();
  }, [caseData, fetchEligibilityReport, fetchRutaPersonalizada, fetchUserCvs, fetchWpJob, fetchPpJob, fetchEcJob, fetchBkJob, fetchCsJob, fetchBpJob, fetchBpPrep]);

  // Poll whitepaper job while generating
  useEffect(() => {
    if (!wpJob || !['processing', 'generating'].includes(wpJob.status)) return;
    const interval = setInterval(fetchWpJob, 5000);
    return () => clearInterval(interval);
  }, [wpJob, fetchWpJob]);

  // Poll policy paper job while generating
  useEffect(() => {
    if (!ppJob || !['processing', 'generating'].includes(ppJob.status)) return;
    const interval = setInterval(fetchPpJob, 5000);
    return () => clearInterval(interval);
  }, [ppJob, fetchPpJob]);

  // Poll econometric job while generating
  useEffect(() => {
    if (!ecJob || !['processing', 'generating'].includes(ecJob.status)) return;
    const interval = setInterval(fetchEcJob, 5000);
    return () => clearInterval(interval);
  }, [ecJob, fetchEcJob]);

  // Poll book job while generating
  useEffect(() => {
    if (!bkJob || !['processing', 'generating'].includes(bkJob.status)) return;
    const interval = setInterval(fetchBkJob, 5000);
    return () => clearInterval(interval);
  }, [bkJob, fetchBkJob]);

  // Poll case study job while generating
  useEffect(() => {
    if (!csJob || !['processing', 'generating'].includes(csJob.status)) return;
    const interval = setInterval(fetchCsJob, 5000);
    return () => clearInterval(interval);
  }, [csJob, fetchCsJob]);

  // Poll BP job while generating
  useEffect(() => {
    if (!bpJob || !['processing', 'generating', 'queued'].includes(bpJob.status)) return;
    const interval = setInterval(fetchBpJob, 5000);
    return () => clearInterval(interval);
  }, [bpJob, fetchBpJob]);

  // Create Eligibility Report
  const handleCreateEligibilityReport = async () => {
    if (!cvFile) {
      toast.error('Por favor selecciona un archivo CV');
      return;
    }
    
    if (!caseData?.user?.phone) {
      toast.error('No se puede crear el reporte: usuario sin teléfono');
      return;
    }

    try {
      setUploadingEligibility(true);

      // Upload CV file
      const formData = new FormData();
      formData.append('file', cvFile);
      formData.append('documentType', 'cv');

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/storage/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const cvUrl = uploadResponse.data.publicUrl || uploadResponse.data.fileUrl || uploadResponse.data.url;
      
      if (!cvUrl) {
        throw new Error('No se obtuvo URL del CV subido');
      }

      // Create eligibility report
      const reportRequest = {
        userId: caseData.user.id || caseData.userId,
        userName: caseData.user.name || 'Usuario sin nombre',
        userEmail: caseData.user.email || '',
        userPhone: caseData.user.phone,
        cvUrl: cvUrl,
        userState: caseData.user.userState || 'U1',
        caseId: caseData.id || caseData._id,
        visaType: caseData.visaType || 'EB-2 NIW'
      };

      await axios.post(
        `${BACKEND_URL}/api/eligibility/create-report`,
        reportRequest,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success('Reporte de elegibilidad creado exitosamente');
      setShowEligibilityModal(false);
      setCvFile(null);
      
      // Refresh eligibility report status
      setTimeout(() => {
        fetchEligibilityReport(caseData.user.phone);
      }, 2000);

    } catch (error) {
      console.error('Error creating eligibility report:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error al crear el reporte de elegibilidad';
      toast.error(errorMessage);
    } finally {
      setUploadingEligibility(false);
    }
  };

  // Create Ruta Personalizada
  const handleCreateRutaPersonalizada = async () => {
    if (!cvFileRuta) {
      toast.error('Por favor selecciona un archivo CV');
      return;
    }
    
    if (!caseData?.user?.phone) {
      toast.error('No se puede crear la ruta personalizada: usuario sin teléfono');
      return;
    }

    try {
      setUploadingRutaPersonalizada(true);

      // Upload CV file
      const formData = new FormData();
      formData.append('file', cvFileRuta);
      formData.append('documentType', 'cv');

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/storage/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const cvUrl = uploadResponse.data.publicUrl || uploadResponse.data.fileUrl || uploadResponse.data.url;
      
      if (!cvUrl) {
        throw new Error('No se obtuvo URL del CV subido');
      }

      // Create ruta personalizada via N8N webhook
      const rutaData = {
        phone: caseData.user.phone,
        name: caseData.user.name || 'Usuario sin nombre',
        email: caseData.user.email || '',
        cvUrl: cvUrl,
        userState: caseData.user.userState || 'U1',
        caseId: caseData.id || caseData._id,
        visaType: caseData.visaType || 'EB-2 NIW'
      };

      await axios.post(
        'https://n8n.urpeailab.com/webhook/3198544c-d830-4e81-b71d-54fceb5ab9f16',
        rutaData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success('Ruta Personalizada creada exitosamente');
      setShowRutaPersonalizadaModal(false);
      setCvFileRuta(null);
      
      // Refresh ruta personalizada status
      setTimeout(() => {
        fetchRutaPersonalizada(caseData.user.phone);
      }, 2000);

    } catch (error) {
      console.error('Error creating ruta personalizada:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Error al crear la ruta personalizada';
      toast.error(errorMessage);
    } finally {
      setUploadingRutaPersonalizada(false);
    }
  };

  // Open Edit Case Modal
  const handleOpenEditCaseModal = () => {
    setEditFormData({
      visaType: caseData?.visaType || '',
      status: caseData?.status || 'active'
    });
    setEditCaseModalOpen(true);
  };

  // Save Case
  const handleSaveCase = async () => {
    try {
      setSavingCase(true);
      
      const payload = {
        visaType: editFormData.visaType,
        status: editFormData.status
      };

      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Caso actualizado exitosamente');
      setEditCaseModalOpen(false);
      fetchCaseData();
    } catch (error) {
      console.error('Error updating case:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el caso');
    } finally {
      setSavingCase(false);
    }
  };

  // Delete payment handler
  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    
    try {
      setDeletingPayment(true);
      await axios.delete(
        `${BACKEND_URL}/api/admin/payments/${paymentToDelete.id || paymentToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Pago eliminado correctamente');
      setDeletePaymentModalOpen(false);
      setPaymentToDelete(null);
      fetchManualPayments();
      fetchCaseData(); // Refresh case data to update totals
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Error al eliminar el pago');
    } finally {
      setDeletingPayment(false);
    }
  };

  // Register payment handler
  const handleRegisterPayment = async () => {
    if (selectedStagesForPayment.length === 0) {
      toast.error('Por favor selecciona al menos una etapa');
      return;
    }

    try {
      setRegisteringPayment(true);

      const payload = {
        caseId: caseId,
        stageNumbers: selectedStagesForPayment,
        amount: parseFloat(paymentAmount),
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null
      };

      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/payments/register-multiple`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        const stageCount = selectedStagesForPayment.length;
        toast.success(`¡Pago registrado para ${stageCount} etapa${stageCount > 1 ? 's' : ''}!`);
        
        // Reset form
        setPaymentModalOpen(false);
        setSelectedStagesForPayment([]);
        setPaymentAmount('');
        setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
        setPaymentMethod('fanbasis');
        setPaymentReference('');
        setPaymentNotes('');
        
        // Refresh data
        fetchCaseData();
        fetchManualPayments();
      }
    } catch (error) {
      console.error('Error registering payment:', error);
      const errorMessage = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : error.response?.data?.message || 'Error al registrar el pago';
      toast.error(errorMessage);
    } finally {
      setRegisteringPayment(false);
    }
  };

  // Update stage price handler
  const handleUpdateStagePrice = async () => {
    if (!stageToEditPrice || !newStagePrice) return;
    
    try {
      setUpdatingPrice(true);
      
      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/stages/${stageToEditPrice.stageNumber}/price`,
        { amount: parseFloat(newStagePrice) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Precio de Etapa ${stageToEditPrice.stageNumber} actualizado a $${parseFloat(newStagePrice).toLocaleString()}`);
      setEditPriceModalOpen(false);
      setStageToEditPrice(null);
      setNewStagePrice('');
      fetchCaseData();
    } catch (error) {
      console.error('Error updating stage price:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el precio');
    } finally {
      setUpdatingPrice(false);
    }
  };

  // Open edit stage modal
  const handleOpenEditStageModal = (stage) => {
    setStageToEdit(stage);
    // Check if stage is unlocked based on status OR isUnlocked field
    const isCurrentlyUnlocked = stage.status === 'unlocked' || stage.isUnlocked === true;
    setEditStageData({
      name: typeof stage.name === 'object' ? (stage.name.es || stage.name.en || '') : (stage.name || ''),
      description: typeof stage.description === 'object' ? (stage.description.es || stage.description.en || '') : (stage.description || ''),
      amount: (stage.amount !== undefined && stage.amount !== null) ? stage.amount.toString() : '0',
      status: stage.status || '',
      isPaid: stage.isPaid || false,
      isUnlocked: isCurrentlyUnlocked
    });
    setEditStageModalOpen(true);
  };

  // Save stage changes
  const handleSaveStage = async () => {
    if (!stageToEdit) return;
    
    try {
      setSavingStage(true);
      
      const payload = {
        name: editStageData.name,
        description: editStageData.description,
        amount: parseFloat(editStageData.amount) || 0,
        isUnlocked: editStageData.isUnlocked,
        // Set status based on unlock toggle - this is what the client view checks
        status: editStageData.isUnlocked ? 'unlocked' : (editStageData.status === 'unlocked' ? 'locked' : editStageData.status)
      };
      
      // Only admins can change isPaid status
      if (isAdmin) {
        payload.isPaid = editStageData.isPaid;
      }

      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/stages/${stageToEdit.stageNumber}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Etapa ${stageToEdit.stageNumber} actualizada exitosamente`);
      setEditStageModalOpen(false);
      setStageToEdit(null);
      fetchCaseData();
      fetchManualPayments(); // Refresh payments in case isPaid changed
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar la etapa');
    } finally {
      setSavingStage(false);
    }
  };

  // Set default selected stage to last paid stage
  useEffect(() => {
    if (stages.length > 0 && !selectedStage) {
      // Find the last paid stage
      const paidStages = stages.filter(s => s.paidAmount > 0);
      if (paidStages.length > 0) {
        const lastPaidStage = paidStages[paidStages.length - 1];
        setSelectedStage(lastPaidStage);
        setViewAllStages(false);
      }
    }
  }, [stages, selectedStage]);

  // Helper function to copy text to clipboard with fallback
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          toast.success('Link copiado al portapapeles');
          return true;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed, trying fallback:', clipboardErr);
        }
      }
      
      // Fallback: Create a temporary textarea
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      
      try {
        const successful = document.execCommand('copy');
        if (textArea.parentNode === document.body) {
          document.body.removeChild(textArea);
        }
        if (successful) {
          toast.success('Link copiado al portapapeles');
          return true;
        } else {
          throw new Error('execCommand returned false');
        }
      } catch (execErr) {
        if (textArea.parentNode === document.body) {
          document.body.removeChild(textArea);
        }
        throw execErr;
      }
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast.error('No se pudo copiar el link. Por favor, cópialo manualmente.');
      return false;
    }
  };

  // Fetch magic links
  const fetchMagicLinks = useCallback(async () => {
    try {
      if (caseData?.user?.id) {
        setLoadingLinks(true);
        const { data } = await axios.get(
          `${BACKEND_URL}/api/admin/users/${caseData.user.id}/magic-links`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMagicLinks(data.magicLinks || []);
      }
    } catch (error) {
      console.error('Error fetching magic links:', error);
    } finally {
      setLoadingLinks(false);
    }
  }, [caseData, token]);

  // Generate new magic link
  const handleGenerateNewLink = async () => {
    try {
      setGeneratingLink(true);
      
      if (!token) {
        toast.error('No se encontró el token de autenticación. Por favor, inicia sesión nuevamente.');
        setGeneratingLink(false);
        return;
      }
      
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/users/${caseData.user.id}/generate-magic-link`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        toast.success('Nuevo link de acceso generado exitosamente');
        fetchMagicLinks();
        setGenerateLinkModalOpen(false);
      }
    } catch (error) {
      console.error('Error generating magic link:', error);
      toast.error(error.response?.data?.detail || 'Error al generar nuevo link de acceso');
    } finally {
      setGeneratingLink(false);
    }
  };

  // Fetch magic links when caseData is available
  useEffect(() => {
    if (caseData?.user?.phone) {
      fetchMagicLinks();
    }
  }, [caseData, fetchMagicLinks]);

  // Fetch staff for assignment
  const fetchStaff = useCallback(async () => {
    if (!token || staffList.length > 0) return;

    try {
      setLoadingStaff(true);
      const { data } = await axios.get(
        `${BACKEND_URL}/api/admin/staff?limit=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStaffList(data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  }, [token, staffList.length]);

  // Load staff list on mount so we can resolve uploader names from staff IDs.
  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Computed values
  const financialSummary = useMemo(() => {
    const totalAmount = stages.reduce((sum, s) => sum + (s.amount || 0), 0);
    // Use manual payments as source of truth for paid amount
    const paidAmount = manualPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingAmount = totalAmount - paidAmount;
    const progress = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
    const paidStages = stages.filter(s => s.paidAmount > 0).length;
    
    return { totalAmount, paidAmount, pendingAmount, progress, paidStages };
  }, [stages, manualPayments]);

  const currentStage = useMemo(() => {
    return caseData?.currentStage || 1;
  }, [caseData]);

  // Document actions
  const handleValidateDocument = (documentId) => {
    const doc = documents.find(d => d.id === documentId);
    setDocumentToValidate(doc || { id: documentId });
    setValidateNotifyClient(true);
  };

  const handleConfirmValidate = async () => {
    if (!documentToValidate) return;
    const documentId = documentToValidate.id;
    try {
      setValidatingDocId(documentId);
      await axios.put(
        `${BACKEND_URL}/api/admin/client-documents/${documentId}/validate`,
        { notifyClient: validateNotifyClient },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Documento validado');
      setDocumentToValidate(null);
      fetchCaseData();
    } catch (error) {
      toast.error('Error al validar documento');
    } finally {
      setValidatingDocId(null);
    }
  };

  const handleRejectDocument = async () => {
    if (!documentToReject || !rejectionReason.trim()) return;

    try {
      setIsRejecting(true);
      await axios.put(
        `${BACKEND_URL}/api/admin/client-documents/${documentToReject.id || documentToReject._id}/reject`,
        { rejectionReason, notifyClient: rejectNotifyClient },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Documento rechazado');
      setRejectModalOpen(false);
      setDocumentToReject(null);
      setRejectionReason('');
      setRejectNotifyClient(true);
      fetchCaseData();
    } catch (error) {
      toast.error('Error al rechazar documento');
    } finally {
      setIsRejecting(false);
    }
  };

  // Assignment handlers
  const handleAssignCoordinator = async (staffId) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}`,
        { coordinatorId: staffId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Coordinador asignado');
      setCoordinatorPopoverOpen(false);
      fetchCaseData();
    } catch (error) {
      console.error('Error assigning coordinator:', error);
      toast.error('Error al asignar coordinador');
    }
  };

  const handleAssignSeller = async (staffId) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}`,
        { salesRepId: staffId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Vendedor asignado');
      setSellerPopoverOpen(false);
      fetchCaseData();
    } catch (error) {
      console.error('Error assigning seller:', error);
      toast.error('Error al asignar vendedor');
    }
  };

  // Change stage for deliverable or document
  const handleOpenChangeStageModal = (type, item) => {
    setItemToChangeStage({ type, item });
    setNewStageNumber(item.stageNumber?.toString() || '1');
    setChangeStageModalOpen(true);
  };

  const handleChangeStage = async () => {
    if (!itemToChangeStage || !newStageNumber) return;
    
    const { type, item } = itemToChangeStage;
    const endpoint = type === 'deliverable' 
      ? `${BACKEND_URL}/api/admin/deliverables/${item.id || item._id}/change-stage`
      : `${BACKEND_URL}/api/admin/client-documents/${item.id || item._id}/change-stage`;
    
    try {
      setChangingStage(true);
      await axios.put(
        endpoint,
        { stageNumber: parseInt(newStageNumber) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${type === 'deliverable' ? 'Entregable' : 'Documento'} movido a la etapa ${newStageNumber}`);
      setChangeStageModalOpen(false);
      setItemToChangeStage(null);
      fetchCaseData();
      fetchDeliverables();
      fetchDocuments();
    } catch (error) {
      console.error('Error changing stage:', error);
      toast.error('Error al cambiar la etapa');
    } finally {
      setChangingStage(false);
    }
  };

  // PDF download
  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/roadmap-pdf`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `roadmap-${caseId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch (error) {
      toast.error('Error al descargar PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Deliverable handlers
  const handleOpenUploadModal = (deliverable) => {
    setSelectedDeliverable(deliverable);
    setUploadModalOpen(true);
  };

  // File note (deliverable file) handlers - thread mode
  const handleOpenFileNoteEditor = (deliverableId, file) => {
    setEditingFileNote({
      deliverableId,
      fileId: file.id || 'legacy',
      fileLabel: file.fileName || 'Archivo',
    });
    setFileNoteDraft('');
    setFileNoteVisibleDraft(false);
  };

  const handleCloseFileNoteEditor = () => {
    setEditingFileNote(null);
    setFileNoteDraft('');
    setFileNoteVisibleDraft(false);
  };

  const handleSaveFileNote = async () => {
    if (!editingFileNote) return;
    if (!fileNoteDraft.trim()) {
      toast.error('La nota no puede estar vacía');
      return;
    }
    try {
      setSavingFileNote(true);
      await axios.post(
        `${BACKEND_URL}/api/admin/deliverables/${editingFileNote.deliverableId}/files/${editingFileNote.fileId}/notes`,
        { text: fileNoteDraft, visibleToClient: fileNoteVisibleDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Nota agregada');
      handleCloseFileNoteEditor();
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar la nota');
    } finally {
      setSavingFileNote(false);
    }
  };

  const handleDeleteFileNote = async (deliverableId, fileId, noteId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/api/admin/deliverables/${deliverableId}/files/${fileId || 'legacy'}/notes/${noteId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Nota eliminada');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar la nota');
    }
  };

  const formatUploadedAt = (value) => {
    if (!value) return null;
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return format(d, "dd MMM yyyy HH:mm");
    } catch {
      return null;
    }
  };

  const resolveUploaderName = (file) => {
    if (file?.uploadedByName) return file.uploadedByName;
    if (!file?.uploadedBy) return null;
    const match = staffList.find((s) => (s.id || s._id) === file.uploadedBy);
    return match?.name || null;
  };

  // Document note (client documents) handlers - thread mode
  const handleOpenDocNoteEditor = (doc) => {
    const label = getText(doc.name || doc.documentType || doc.documentName, 'Documento');
    setEditingDocNote({ documentId: doc.id || doc._id, documentLabel: label });
    setDocNoteDraft('');
    setDocNoteVisibleDraft(false);
  };

  const handleCloseDocNoteEditor = () => {
    setEditingDocNote(null);
    setDocNoteDraft('');
    setDocNoteVisibleDraft(false);
  };

  const handleSaveDocNote = async () => {
    if (!editingDocNote) return;
    if (!docNoteDraft.trim()) {
      toast.error('La nota no puede estar vacía');
      return;
    }
    try {
      setSavingDocNote(true);
      await axios.post(
        `${BACKEND_URL}/api/admin/client-documents/${editingDocNote.documentId}/notes`,
        { text: docNoteDraft, visibleToClient: docNoteVisibleDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Nota agregada');
      handleCloseDocNoteEditor();
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar la nota');
    } finally {
      setSavingDocNote(false);
    }
  };

  const handleDeleteDocNote = async (documentId, noteId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/api/admin/client-documents/${documentId}/notes/${noteId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Nota eliminada');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar la nota');
    }
  };

  // Add deliverable / document handlers
  const handleOpenAddDeliverable = (stage) => {
    setAddingDeliverable({
      stageNumber: stage.stageNumber,
      stageLabel: getText(stage.name, `Etapa ${stage.stageNumber}`),
    });
    setNewDeliverableName('');
    setNewDeliverableDescription('');
  };

  const handleCloseAddDeliverable = () => {
    setAddingDeliverable(null);
    setNewDeliverableName('');
    setNewDeliverableDescription('');
  };

  const handleSaveNewDeliverable = async () => {
    if (!addingDeliverable) return;
    if (!newDeliverableName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      setSavingNewDeliverable(true);
      await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/deliverables`,
        {
          stageNumber: addingDeliverable.stageNumber,
          nameEs: newDeliverableName.trim(),
          descriptionEs: newDeliverableDescription.trim() || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Entregable agregado');
      handleCloseAddDeliverable();
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear el entregable');
    } finally {
      setSavingNewDeliverable(false);
    }
  };

  const handleOpenAddDocument = (stage) => {
    setAddingDocument({
      stageNumber: stage.stageNumber,
      stageLabel: getText(stage.name, `Etapa ${stage.stageNumber}`),
    });
    setNewDocumentName('');
    setNewDocumentDescription('');
    setNewDocumentRequired(true);
    setNewDocumentPhysical(false);
  };

  const handleCloseAddDocument = () => {
    setAddingDocument(null);
    setNewDocumentName('');
    setNewDocumentDescription('');
    setNewDocumentRequired(true);
    setNewDocumentPhysical(false);
  };

  const handleSaveNewDocument = async () => {
    if (!addingDocument) return;
    if (!newDocumentName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      setSavingNewDocument(true);
      await axios.post(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/documents`,
        {
          stageNumber: addingDocument.stageNumber,
          nameEs: newDocumentName.trim(),
          descriptionEs: newDocumentDescription.trim() || null,
          isRequired: newDocumentRequired,
          requiresPhysicalCopy: newDocumentPhysical,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Documento agregado');
      handleCloseAddDocument();
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear el documento');
    } finally {
      setSavingNewDocument(false);
    }
  };

  const resolveDocUploaderName = (doc) => {
    if (doc?.uploadedByName) return doc.uploadedByName;
    return caseData?.user?.name || caseData?.client?.name || null;
  };

  const renderNotesThread = ({ threadKey, notes, onAdd, onDelete }) => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const expanded = !!expandedNoteThreads[threadKey];
    const visibleSlice = expanded ? safeNotes : safeNotes.slice(-1);
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
              Notas {safeNotes.length > 0 && <span className="text-gray-500">({safeNotes.length})</span>}
            </p>
            {safeNotes.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleNoteThread(threadKey)}
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                {expanded ? 'Ocultar historial' : `Ver historial (${safeNotes.length})`}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onAdd}
            className="h-7 px-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 gap-1"
            title="Agregar nota"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Agregar</span>
          </Button>
        </div>
        {safeNotes.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Sin notas</p>
        ) : (
          <div className="space-y-2">
            {visibleSlice.map((n) => (
              <div key={n.id} className="p-2 bg-white rounded border border-gray-200">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    {n.createdByName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {n.createdByName}
                      </span>
                    )}
                    {formatUploadedAt(n.createdAt) && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatUploadedAt(n.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={n.visibleToClient ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>
                      {n.visibleToClient ? (
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />Visible al cliente</span>
                      ) : (
                        <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Solo equipo</span>
                      )}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(n.id)}
                      className="h-6 px-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar nota"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.text}</p>
              </div>
            ))}
            {!expanded && safeNotes.length > 1 && (
              <p className="text-[11px] text-gray-400 text-center">
                Mostrando la última nota · {safeNotes.length - 1} anterior{safeNotes.length - 1 === 1 ? '' : 'es'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleDeleteDeliverable = async () => {
    if (!deliverableToDelete) return;
    
    try {
      await axios.delete(
        `${BACKEND_URL}/api/admin/deliverables/${deliverableToDelete.id || deliverableToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Entregable eliminado');
      setDeleteModalOpen(false);
      setDeliverableToDelete(null);
      fetchCaseData();
    } catch (error) {
      toast.error('Error al eliminar entregable');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-500">Cargando caso...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-900 text-lg mb-2">Caso no encontrado</p>
          <Button onClick={() => navigate('/admin/visa-cases')} variant="outline">
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Action Header - Fitts' Law: Primary actions always accessible */}
      <ActionHeader
        clientName={caseData.user?.name}
        clientEmail={caseData.user?.email}
        status={caseData.status}
        userState={caseData.user?.userState}
        onBack={() => navigate('/admin/visa-cases')}
        onDownloadPDF={handleDownloadPDF}
        onEdit={handleOpenEditCaseModal}
        onStatusChange={async (newStatus) => {
          try {
            await axios.put(`${BACKEND_URL}/api/admin/visa-cases/${caseId}`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
            setCaseData(prev => ({ ...prev, status: newStatus }));
            toast.success(`Estado cambiado a: ${newStatus}`);
          } catch { toast.error('Error al cambiar estado'); }
        }}
        isDownloading={downloadingPDF}
      />

      <div className="max-w-[1600px] mx-auto p-6">
        {/* Breadcrumb - Jakob's Law: Familiar navigation pattern */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <button onClick={() => navigate('/admin')} className="hover:text-gray-900">
            Admin
          </button>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => navigate('/admin/visa-cases')} className="hover:text-gray-900">
            Casos de Visa
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900">{caseData.user?.name || 'Detalle'}</span>
        </nav>

        {/* Timeline - Visual progress indicator */}
        <div className="mb-8">
          <VisaTimeline 
            stages={stages} 
            currentStage={currentStage}
            selectedStage={selectedStage}
            onStageClick={(stage) => {
              setSelectedStage(stage);
              setViewAllStages(false);
              setActiveTab('details');
            }}
          />
        </div>

        {/* Tabs - Hick's Law: Reduce cognitive load by grouping related info */}
        <Tabs value={isAcreditador ? 'details' : activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm inline-flex min-w-max">
              {!isAcreditador && (
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <LayoutGrid className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Resumen</span>
                <span className="sm:hidden">Inicio</span>
              </TabsTrigger>
              )}
              <TabsTrigger 
                value="details"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <FolderOpen className="h-4 w-4 mr-1 sm:mr-2" />
                Etapas
              </TabsTrigger>
              {!isAcreditador && (
              <>
              <TabsTrigger 
                value="documents"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Documentos</span>
                <span className="sm:hidden">Docs</span>
                {documents.filter(d => d.status === 'uploaded').length > 0 && (
                  <Badge className="ml-1 sm:ml-2 bg-amber-100 text-amber-700 text-xs">
                    {documents.filter(d => d.status === 'uploaded').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="financials"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Finanzas</span>
                <span className="sm:hidden">$</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notes"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Notas</span>
                <span className="sm:hidden">✎</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-4 sm:px-6 whitespace-nowrap"
              >
                <History className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Historial</span>
                <span className="sm:hidden">Log</span>
              </TabsTrigger>
              </>
              )}
            </TabsList>
          </div>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid - Fitts' Law: Important metrics large and prominent */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Progreso Total"
                value={`${financialSummary.progress}%`}
                subtitle={`${financialSummary.paidStages} de ${stages.length} etapas`}
                icon={CheckCircle}
                variant="gold"
              />
              <StatCard
                title="Monto Pagado"
                value={`$${financialSummary.paidAmount.toLocaleString()}`}
                subtitle={`de $${financialSummary.totalAmount.toLocaleString()}`}
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="Pendiente"
                value={`$${financialSummary.pendingAmount.toLocaleString()}`}
                icon={Clock}
                variant={financialSummary.pendingAmount > 0 ? 'warning' : 'default'}
              />
              <StatCard
                title="Etapa Actual"
                value={currentStage}
                subtitle={getText(stages[currentStage - 1]?.name, '')}
                icon={ArrowRight}
              />
            </div>

            {/* Citas del Cliente - above Links if pending, below if not */}
            {(() => {
              const hasPending = caseAppointments.some(a => a.status === 'pending');
              const citasCard = caseAppointments.length > 0 ? (
                <Card className={`bg-white shadow-sm ${hasPending ? 'border-amber-300 border-2' : 'border-gray-200'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Clock className={`h-5 w-5 ${hasPending ? 'text-amber-500' : 'text-gray-400'}`} />
                        Citas del Cliente
                        {hasPending && <Badge className="bg-amber-100 text-amber-800 animate-pulse">Pendiente</Badge>}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {caseAppointments.map((appt) => {
                        const statusColors = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-gray-100 text-gray-600' };
                        const statusLabels = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', completed: 'Completada', cancelled: 'Cancelada' };
                        return (
                          <div key={appt.id} className={`border rounded-lg p-4 ${appt.status === 'pending' ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={statusColors[appt.status] || 'bg-gray-100'}>{statusLabels[appt.status] || appt.status}</Badge>
                              <span className="text-xs text-gray-500">{appt.proposedDate} {appt.proposedTime}</span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="text-gray-700"><strong>Con:</strong> {appt.withStaffName || 'Sin asignar'} ({appt.withRoleLabel || appt.withRole})</p>
                              <p className="text-gray-700"><strong>Motivo:</strong> {appt.reason}</p>
                              {appt.adminNotes && <p className="text-gray-500 text-xs"><strong>Nota:</strong> {appt.adminNotes}</p>}
                              {appt.meetingLink && <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Link de reunion</a>}
                            </div>
                            {appt.status === 'pending' && (
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                  onClick={async () => { try { await axios.patch(`${BACKEND_URL}/api/admin/appointments/${appt.id}`, { status: 'approved' }, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Cita aprobada'); fetchAppointments(); } catch { toast.error('Error'); } }}>
                                  <CheckCircle className="h-4 w-4 mr-1" />Aprobar
                                </Button>
                                <Button size="sm" className="bg-red-100 text-red-700 hover:bg-red-200"
                                  onClick={() => { setRejectApptId(appt.id); setRejectApptReason(''); }}>
                                  <XCircle className="h-4 w-4 mr-1" />Rechazar
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : null;

              return hasPending ? citasCard : null;
            })()}

            {/* Links de Acceso Section - Above Client Info */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-purple-600" />
                    Links de Acceso Generados
                    <Badge className="bg-purple-100 text-purple-700 ml-2">
                      {magicLinks.length}
                    </Badge>
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGenerateLinkModalOpen(true)}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50 w-full sm:w-auto"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Generar Nuevo Link
                  </Button>
                </div>

                {loadingLinks ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Loader2 className="h-8 w-8 text-purple-500 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-500">Cargando links de acceso...</p>
                  </div>
                ) : magicLinks.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">No hay links de acceso generados</p>
                    <p className="text-sm text-gray-400">Los links se generan automáticamente al crear el usuario</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {magicLinks.map((link, index) => (
                      <div 
                        key={link.magicToken} 
                        className="p-4 border-2 border-purple-200 rounded-xl bg-purple-50/30"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <LinkIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-700">
                                Link #{magicLinks.length - index}
                              </span>
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Activo
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                              <div>
                                <p className="text-gray-500 text-xs">Creado</p>
                                <p className="font-medium text-gray-900">
                                  {new Date(link.createdAt).toLocaleDateString('es', { 
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Validez</p>
                                <p className="font-medium text-gray-900">{link.expiresIn || 'Sin vencimiento'}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-gray-500 text-xs mb-1">URL del Link</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white border border-gray-200 text-gray-700 p-2 rounded text-xs break-all overflow-hidden">
                                  {link.magicLinkUrl}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(link.magicLinkUrl)}
                                  className="border-purple-300 text-purple-700 hover:bg-purple-100 flex-shrink-0"
                                  data-testid={`copy-link-${index}`}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-purple-900">
                      <p className="font-semibold mb-1">Información sobre Links de Acceso</p>
                      <p>Los links de acceso <strong>no tienen vencimiento</strong> y pueden ser utilizados múltiples veces.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Citas del Cliente - below Links if no pending */}
            {(() => {
              const hasPending = caseAppointments.some(a => a.status === 'pending');
              if (hasPending || caseAppointments.length === 0) return null;
              return (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Clock className="h-5 w-5 text-gray-400" />
                      Citas del Cliente
                      <Badge className="bg-gray-100 text-gray-600">{caseAppointments.length}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {caseAppointments.map((appt) => {
                        const statusColors = { approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-gray-100 text-gray-600' };
                        const statusLabels = { approved: 'Aprobada', rejected: 'Rechazada', completed: 'Completada', cancelled: 'Cancelada' };
                        return (
                          <div key={appt.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge className={statusColors[appt.status] || 'bg-gray-100'} style={{fontSize:'11px'}}>{statusLabels[appt.status] || appt.status}</Badge>
                                <span className="text-sm text-gray-700">{appt.proposedDate} {appt.proposedTime}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{appt.reason}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Client & Team Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Client Info Card */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Información del Cliente
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{caseData.user?.email || 'No disponible'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{caseData.user?.phone || 'No disponible'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{caseData.visaType || 'EB-1A'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* USCIS Case Tracker */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      USCIS Tracker
                      {uscisCases.length > 0 && <Badge className="bg-blue-100 text-blue-700">{uscisCases.length}</Badge>}
                    </h3>
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setShowAddReceipt(!showAddReceipt)}>
                      {showAddReceipt ? 'Cancelar' : '+ Agregar Receipt'}
                    </Button>
                  </div>

                  {/* Add receipt form */}
                  {showAddReceipt && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">Receipt Number *</label>
                          <Input value={newReceipt} onChange={(e) => setNewReceipt(e.target.value.toUpperCase())}
                            placeholder="IOE0917364825" className="border-gray-300 font-mono" autoComplete="off" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">Form Type</label>
                          <select value={newReceiptForm} onChange={(e) => setNewReceiptForm(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm">
                            <option value="I-140">I-140</option>
                            <option value="I-485">I-485</option>
                            <option value="I-765">I-765</option>
                            <option value="I-131">I-131</option>
                            <option value="I-129">I-129</option>
                          </select>
                        </div>
                      </div>
                      <Button size="sm" disabled={!newReceipt.trim() || addingReceipt}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={async () => {
                          try {
                            setAddingReceipt(true);
                            const clientName = caseData?.user?.name || '';
                            await axios.post(`${BACKEND_URL}/api/admin/uscis-cases?case_id=${caseId}`, {
                              receiptNumber: newReceipt.trim(),
                              formType: newReceiptForm,
                              clientName,
                            }, { headers: { Authorization: `Bearer ${token}` } });
                            toast.success('Caso USCIS registrado y vinculado');
                            setNewReceipt(''); setShowAddReceipt(false);
                            fetchUscisCases();
                          } catch (e) { toast.error(e.response?.data?.detail || 'Error al registrar'); }
                          finally { setAddingReceipt(false); }
                        }}
                      >
                        {addingReceipt ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Registrar y consultar USCIS
                      </Button>
                    </div>
                  )}

                  {uscisCases.length === 0 && !showAddReceipt ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No hay numeros de recibo registrados
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {uscisCases.map((uc) => {
                        const dotColors = { approved: '#34C759', processing: '#007AFF', reviewing: '#007AFF', received: '#007AFF', rfe: '#FF9500', denied: '#FF3B30' };
                        return (
                          <div key={uc.receiptNumber} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: dotColors[uc.status] || '#8E8E93' }} />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 font-mono">{uc.receiptNumber}</p>
                                <p className="text-xs text-gray-500">{uc.statusTitle} · {uc.formType}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" title="Actualizar desde USCIS"
                                onClick={async () => {
                                  try {
                                    const { data } = await axios.post(`${BACKEND_URL}/api/admin/uscis-cases/${uc.receiptNumber}/refresh`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                    toast.success(data.statusChanged ? 'Estado actualizado!' : 'Sin cambios');
                                    fetchUscisCases();
                                  } catch { toast.error('Error al consultar USCIS'); }
                                }}>
                                <RefreshCw className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500"
                                onClick={async () => {
                                  try {
                                    await axios.delete(`${BACKEND_URL}/api/admin/uscis-cases/${uc.receiptNumber}`, { headers: { Authorization: `Bearer ${token}` } });
                                    toast.success('Caso eliminado');
                                    fetchUscisCases();
                                  } catch { toast.error('Error'); }
                                }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CVs del Cliente */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-600" />
                      CVs del Cliente
                      <Badge className="bg-orange-100 text-orange-700 ml-1">{userCvs.length}</Badge>
                    </h3>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const userId = caseData?.userId || caseData?.user?.id;
                          if (!userId) return;
                          try {
                            setUploadingCv(true);
                            const formData = new FormData();
                            formData.append('file', file);
                            await axios.post(
                              `${BACKEND_URL}/api/admin/users/${userId}/cvs`,
                              formData,
                              { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
                            );
                            toast.success('CV subido');
                            fetchUserCvs(userId);
                          } catch (err) {
                            toast.error('Error al subir CV');
                          } finally {
                            setUploadingCv(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" disabled={uploadingCv} asChild>
                        <span>
                          {uploadingCv ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Subir CV
                        </span>
                      </Button>
                    </label>
                  </div>

                  {userCvs.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No hay CVs subidos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userCvs.map((cv) => (
                        <div key={cv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <FileText className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{cv.file_name || cv.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {cv.created_at || cv.uploadedAt ? new Date(cv.created_at || cv.uploadedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" asChild>
                              <a href={cv.file_url || cv.url} target="_blank" rel="noopener noreferrer" title="Ver CV">
                                <ExternalLink className="h-4 w-4 text-blue-600" />
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                              onClick={async () => {
                                const userId = caseData?.userId || caseData?.user?.id;
                                try {
                                  await axios.delete(`${BACKEND_URL}/api/admin/users/${userId}/cvs/${cv.id}`, { headers: { Authorization: `Bearer ${token}` } });
                                  toast.success('CV eliminado');
                                  fetchUserCvs(userId);
                                } catch { toast.error('Error al eliminar'); }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Assignment Card */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    Equipo Asignado
                  </h3>
                  <div className="space-y-4">
                    {/* Coordinator */}
                    <div>
                      <Label className="text-gray-500 text-sm">Coordinador(a)</Label>
                      <Popover open={coordinatorPopoverOpen} onOpenChange={(open) => {
                        setCoordinatorPopoverOpen(open);
                        if (open) fetchStaff();
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between mt-1 bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"
                          >
                            {caseData.coordinatorName || 'Sin asignar'}
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0 bg-white border-gray-200">
                          <Command className="bg-transparent">
                            <CommandInput placeholder="Buscar..." className="text-gray-900" />
                            <CommandList>
                              <CommandEmpty>No encontrado</CommandEmpty>
                              <CommandGroup>
                                {staffList.map((staff) => (
                                  <CommandItem
                                    key={staff.id}
                                    onSelect={() => handleAssignCoordinator(staff.id)}
                                    className="text-gray-700 hover:bg-gray-100"
                                  >
                                    <div className="flex flex-col">
                                      <span>{staff.name}</span>
                                      <span className="text-xs text-gray-400">{staff.role}</span>
                                    </div>
                                    {caseData.coordinatorId === staff.id && (
                                      <Check className="ml-auto h-4 w-4 text-blue-600" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Seller */}
                    <div>
                      <Label className="text-gray-500 text-sm">Vendedor(a)</Label>
                      <Popover open={sellerPopoverOpen} onOpenChange={(open) => {
                        setSellerPopoverOpen(open);
                        if (open) fetchStaff();
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between mt-1 bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"
                          >
                            {caseData.advisorName || 'Sin asignar'}
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0 bg-white border-gray-200">
                          <Command className="bg-transparent">
                            <CommandInput placeholder="Buscar..." className="text-gray-900" />
                            <CommandList>
                              <CommandEmpty>No encontrado</CommandEmpty>
                              <CommandGroup>
                                {staffList.map((staff) => (
                                  <CommandItem
                                    key={staff.id}
                                    onSelect={() => handleAssignSeller(staff.id)}
                                    className="text-gray-700 hover:bg-gray-100"
                                  >
                                    <div className="flex flex-col">
                                      <span>{staff.name}</span>
                                      <span className="text-xs text-gray-400">{staff.role}</span>
                                    </div>
                                    {(caseData.sellerId === staff.id || caseData.advisorId === staff.id) && (
                                      <Check className="ml-auto h-4 w-4 text-blue-600" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reportes AI Section */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Reportes AI
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (caseData?.user?.phone) {
                        fetchEligibilityReport(caseData.user.phone);
                        fetchRutaPersonalizada(caseData.user.phone);
                        toast.success('Verificando estado de reportes...');
                      }
                    }}
                    disabled={loadingEligibilityReport || loadingRutaPersonalizada}
                    className="text-gray-600 border-gray-300 hover:bg-gray-100"
                  >
                    {(loadingEligibilityReport || loadingRutaPersonalizada) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Actualizar</span>
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Eligibility Report */}
                  <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="font-semibold text-gray-900">Reporte de Elegibilidad</span>
                        </div>
                        
                        {loadingEligibilityReport ? (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verificando...
                          </p>
                        ) : eligibilityReport?.has_report ? (
                          <Badge className="bg-green-100 text-green-800">Generado</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Sin generar</Badge>
                        )}
                      </div>
                      
                      {eligibilityReport?.has_report ? (
                        <Button
                          size="sm"
                          onClick={handleDownloadEligibilityPDF}
                          disabled={downloadingEligibilityPDF}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                        >
                          {downloadingEligibilityPDF ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          Descargar PDF
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setShowEligibilityModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Subir CV
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ruta Personalizada */}
                  <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          <span className="font-semibold text-gray-900">Ruta Personalizada</span>
                        </div>
                        
                        {loadingRutaPersonalizada ? (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verificando...
                          </p>
                        ) : rutaPersonalizada?.has_report ? (
                          <Badge className="bg-green-100 text-green-800">Generada</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Sin generar</Badge>
                        )}
                      </div>
                      
                      {rutaPersonalizada?.has_report ? (
                        <Button
                          size="sm"
                          onClick={handleDownloadRutaPDF}
                          disabled={downloadingRutaPDF}
                          className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                        >
                          {downloadingRutaPDF ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          Descargar PDF
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setShowRutaPersonalizadaModal(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Subir CV
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Preview */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-blue-600" />
                    Actividad Reciente
                    {activities.length > 0 && <Badge className="bg-blue-100 text-blue-700">{activities.length}</Badge>}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('history')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Ver todo
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                {activities.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-4">
                    Los cambios realizados apareceran aqui
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((act, i) => {
                      const iconMap = {
                        'upload': Upload, 'file-plus': FileText, 'check-circle': CheckCircle,
                        'x-circle': XCircle, 'dollar-sign': DollarSign, 'unlock': Lock,
                        'refresh-cw': RefreshCw, 'user-plus': User
                      };
                      const colorMap = {
                        'client_uploaded_doc': 'text-blue-500 bg-blue-50',
                        'staff_uploaded_deliverable': 'text-purple-500 bg-purple-50',
                        'doc_validated': 'text-emerald-500 bg-emerald-50',
                        'doc_rejected': 'text-red-500 bg-red-50',
                        'payment_registered': 'text-green-500 bg-green-50',
                        'stage_unlocked': 'text-amber-500 bg-amber-50',
                        'case_status_changed': 'text-indigo-500 bg-indigo-50',
                        'coordinator_assigned': 'text-cyan-500 bg-cyan-50',
                      };
                      const ActIcon = iconMap[act.icon] || History;
                      const colors = colorMap[act.type] || 'text-gray-500 bg-gray-50';
                      const timeAgo = act.timestamp ? new Date(act.timestamp).toLocaleString('es', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg ${colors.split(' ')[1]}`}>
                            <ActIcon className={`h-4 w-4 ${colors.split(' ')[0]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium">{act.label}</p>
                            {act.details?.documentName && <p className="text-xs text-gray-500 truncate">{act.details.documentName}</p>}
                            {act.details?.deliverableName && <p className="text-xs text-gray-500 truncate">{act.details.deliverableName}</p>}
                            {act.details?.amount && <p className="text-xs text-gray-500">${act.details.amount.toLocaleString()}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{act.performedBy?.name} &middot; {timeAgo}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* STAGES/DETAILS TAB */}
          <TabsContent value="details" className="space-y-4">
            {/* Toggle buttons for view mode - responsive design */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* View mode buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedStage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Etapa {selectedStage.stageNumber}
                    </Button>
                  )}
                </div>
                
                {/* Navigation buttons - only show when viewing single stage */}
                {!viewAllStages && selectedStage && (
                  <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentIndex = stages.findIndex(s => s.stageNumber === selectedStage.stageNumber);
                        if (currentIndex > 0) {
                          setSelectedStage(stages[currentIndex - 1]);
                        }
                      }}
                      disabled={selectedStage.stageNumber === 1}
                      className="text-gray-600 border-gray-300"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <span className="text-sm text-gray-500 px-2">
                      {selectedStage.stageNumber} / {stages.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentIndex = stages.findIndex(s => s.stageNumber === selectedStage.stageNumber);
                        if (currentIndex < stages.length - 1) {
                          setSelectedStage(stages[currentIndex + 1]);
                        }
                      }}
                      disabled={selectedStage.stageNumber === stages.length}
                      className="text-gray-600 border-gray-300"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Stages list */}
            {(viewAllStages ? stages : stages.filter(s => s.stageNumber === selectedStage?.stageNumber)).map((stage, index) => {
              const stageDeliverables = deliverables.filter(d => d.stageNumber === stage.stageNumber);
              const stageDocuments = documents.filter(d => d.stageNumber === stage.stageNumber);
              const statusConfig = stage.status ? STAGE_STATUS_CONFIG[stage.status] : null;
              
              return (
                <Card 
                  key={stage.id || index} 
                  className={`bg-white border-gray-200 shadow-sm transition-all cursor-pointer hover:shadow-md ${
                    selectedStage?.stageNumber === stage.stageNumber && !viewAllStages ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    if (viewAllStages) {
                      setSelectedStage(stage);
                      setViewAllStages(false);
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                          ${stage.paidAmount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}
                        `}>
                          {stage.stageNumber}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            {getText(stage.name, `Etapa ${stage.stageNumber}`)}
                            {stage.status !== 'unlocked' && !stage.isPaid && (
                              <Lock className="h-4 w-4 text-slate-500" />
                            )}
                          </h3>
                          {statusConfig && (
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right flex items-start gap-2">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(stage.amount || 0).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditStageModal(stage);
                          }}
                          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                          title="Editar etapa"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Show details only when not in view all mode OR when showing single stage */}
                    {(!viewAllStages || stageDeliverables.length > 0 || stageDocuments.length > 0) && (
                      <>
                        {/* Stage Deliverables */}
                        {(stageDeliverables.length > 0 || !viewAllStages) && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm text-gray-500">Entregables ({stageDeliverables.length})</p>
                              {!viewAllStages && isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); handleOpenAddDeliverable(stage); }}
                                  className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Upload className="h-3.5 w-3.5 mr-1" />
                                  Agregar entregable
                                </Button>
                              )}
                            </div>
                            {stageDeliverables.length === 0 && !viewAllStages && (
                              <p className="text-xs text-gray-400 italic mb-3">Sin entregables en esta etapa</p>
                            )}
                            <div className="space-y-3">
                              {stageDeliverables.map((del) => {
                                // Get files array with backward compatibility
                                const delFiles = del.files?.length > 0 
                                  ? del.files 
                                  : del.fileUrl 
                                    ? [{ id: 'legacy', fileName: del.fileName || 'Archivo', fileUrl: del.fileUrl }]
                                    : [];
                                
                                // Check if this is a special AI report deliverable in Stage 1
                                const delName = getText(del.name, '').toLowerCase();
                                const isEligibilityReport = stage.stageNumber === 1 && (
                                  delName.includes('reporte de elegibilidad') ||
                                  delName.includes('eligibility report')
                                );
                                const isRutaPersonalizada = stage.stageNumber === 1 && (
                                  delName.includes('ruta personalizada') ||
                                  delName.includes('personalized route')
                                );
                                const isAIReport = isEligibilityReport || isRutaPersonalizada;

                                // Check if this is a "Hoja de vida" deliverable
                                const isHojaDeVida = (
                                  delName.includes('hoja de vida') ||
                                  delName.includes('curriculum') ||
                                  delName.includes('cv') ||
                                  delName.includes('resume')
                                );
                                const latestCv = isHojaDeVida && userCvs.length > 0 ? userCvs[0] : null;

                                // Check if this is a White Paper deliverable
                                const isWhitePaper = (
                                  delName.includes('white paper') ||
                                  delName.includes('whitepaper')
                                );

                                // Check if this is a Policy Paper deliverable
                                const isPolicyPaper = (
                                  delName.includes('policy paper') ||
                                  delName.includes('reporte de impacto social') ||
                                  delName.includes('impacto social')
                                );

                                // Check if this is an Econometric Study deliverable
                                const isEconometric = (
                                  delName.includes('estudio econom') ||
                                  delName.includes('econometrico') ||
                                  delName.includes('econométrico')
                                );

                                // Check if this is a Book deliverable
                                const isBook = (
                                  delName.includes('libro') ||
                                  (delName.includes('book') && !delName.includes('facebook'))
                                );

                                // Check if this is a Case Study deliverable
                                const isCaseStudy = (
                                  delName.includes('caso de estudio') ||
                                  delName.includes('casos de estudio') ||
                                  delName.includes('case study') ||
                                  delName.includes('case studies')
                                );

                                // Check if this is a Business Plan deliverable
                                const isBP = (
                                  delName.includes('business plan') ||
                                  delName.includes('propuesta de proyecto')
                                );
                                
                                return (
                                  <div 
                                    key={del.id}
                                    className="border border-gray-200 rounded-lg p-4 bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Deliverable header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-gray-500" />
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-gray-900">{getText(del.name, 'Entregable')}</span>
                                          {isAIReport ? (
                                            // Show AI report status based on API check
                                            isEligibilityReport ? (
                                              eligibilityReport?.has_report ? (
                                                <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                              ) : (
                                                <Badge className="bg-amber-100 text-amber-700">Sin generar</Badge>
                                              )
                                            ) : (
                                              rutaPersonalizada?.has_report ? (
                                                <Badge className="bg-green-100 text-green-700">Generada</Badge>
                                              ) : (
                                                <Badge className="bg-amber-100 text-amber-700">Sin generar</Badge>
                                              )
                                            )
                                          ) : isHojaDeVida && latestCv ? (
                                            <Badge className="bg-green-100 text-green-700">CV disponible</Badge>
                                          ) : isWhitePaper && wpJob ? (
                                            wpJob.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : wpJob.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : (
                                              <Badge className="bg-blue-100 text-blue-700">Generando... {wpJob.progress ? `${wpJob.progress}%` : ''}</Badge>
                                            )
                                          ) : isPolicyPaper && ppJob ? (
                                            ppJob.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : ppJob.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : (
                                              <Badge className="bg-blue-100 text-blue-700">Generando... {ppJob.progress ? `${ppJob.progress}%` : ''}</Badge>
                                            )
                                          ) : isEconometric && ecJob ? (
                                            ecJob.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : ecJob.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : (
                                              <Badge className="bg-blue-100 text-blue-700">Generando... {ecJob.progress ? `${ecJob.progress}%` : ''}</Badge>
                                            )
                                          ) : isBook && bkJob ? (
                                            bkJob.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : bkJob.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : (
                                              <Badge className="bg-blue-100 text-blue-700">Generando... {bkJob.progress ? `${bkJob.progress}%` : ''}</Badge>
                                            )
                                          ) : isCaseStudy && csJob ? (
                                            csJob.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : csJob.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : (
                                              <Badge className="bg-blue-100 text-blue-700">Generando...</Badge>
                                            )
                                          ) : isBP && (bpJob || bpPrep) ? (
                                            bpJob?.status === 'completed' ? (
                                              <Badge className="bg-green-100 text-green-700">Generado</Badge>
                                            ) : bpJob?.status === 'error' ? (
                                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                                            ) : bpJob ? (
                                              <Badge className="bg-blue-100 text-blue-700">Generando... {bpJob.progress ? `${bpJob.progress}%` : ''}</Badge>
                                            ) : bpPrep?.selectedName ? (
                                              <Badge className="bg-purple-100 text-purple-700">Proyecto seleccionado</Badge>
                                            ) : bpPrep?.step === 'names_shown' ? (
                                              <Badge className="bg-amber-100 text-amber-700">Esperando seleccion del cliente</Badge>
                                            ) : (
                                              <>
                                                {delFiles.length > 0 && (
                                                  <Badge className="bg-green-100 text-green-700">{delFiles.length} archivo(s)</Badge>
                                                )}
                                                {delFiles.length === 0 && (
                                                  <Badge className="bg-amber-100 text-amber-700">Sin archivos</Badge>
                                                )}
                                              </>
                                            )
                                          ) : (
                                            // Show regular file count badge
                                            <>
                                              {delFiles.length > 0 && (
                                                <Badge className="bg-green-100 text-green-700">{delFiles.length} archivo(s)</Badge>
                                              )}
                                              {delFiles.length === 0 && (
                                                <Badge className="bg-amber-100 text-amber-700">Sin archivos</Badge>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isAIReport ? (
                                          // Show download button for AI reports
                                          isEligibilityReport ? (
                                            eligibilityReport?.has_report && (
                                              <Button
                                                size="sm"
                                                onClick={handleDownloadEligibilityPDF}
                                                disabled={downloadingEligibilityPDF}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                              >
                                                {downloadingEligibilityPDF ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <Download className="h-4 w-4 mr-1" />
                                                )}
                                                Descargar PDF
                                              </Button>
                                            )
                                          ) : (
                                            rutaPersonalizada?.has_report && (
                                              <Button
                                                size="sm"
                                                onClick={handleDownloadRutaPDF}
                                                disabled={downloadingRutaPDF}
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                              >
                                                {downloadingRutaPDF ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <Download className="h-4 w-4 mr-1" />
                                                )}
                                                Descargar PDF
                                              </Button>
                                            )
                                          )
                                        ) : isHojaDeVida && latestCv ? (
                                          // Show download button for existing CV
                                          <Button
                                            size="sm"
                                            className="bg-orange-600 hover:bg-orange-700 text-white"
                                            asChild
                                          >
                                            <a href={latestCv.url} target="_blank" rel="noopener noreferrer">
                                              <Download className="h-4 w-4 mr-1" />
                                              Descargar CV
                                            </a>
                                          </Button>
                                        ) : isWhitePaper && isAdmin ? (
                                          // Show whitepaper generation button
                                          <>
                                            {(!wpJob || wpJob.status === 'error' || wpJob.status === 'completed') && (
                                              <Button
                                                size="sm"
                                                data-testid="generate-whitepaper-btn"
                                                onClick={handleGenerateWhitepaper}
                                                disabled={wpGenerating}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                              >
                                                {wpGenerating ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <FileText className="h-4 w-4 mr-1" />
                                                )}
                                                {wpJob?.status === 'completed' ? 'Regenerar' : 'Generar White Paper'}
                                              </Button>
                                            )}
                                            {wpJob && ['processing', 'generating'].includes(wpJob.status) && (
                                              <span className="text-xs text-blue-600 font-medium">{wpJob.currentStep}</span>
                                            )}
                                            {wpJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{wpJob.error}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : isPolicyPaper && isAdmin ? (
                                          <>
                                            {(!ppJob || ppJob.status === 'error' || ppJob.status === 'completed') && (
                                              <Button
                                                size="sm"
                                                data-testid="generate-policy-paper-btn"
                                                onClick={handleGeneratePolicyPaper}
                                                disabled={ppGenerating}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                              >
                                                {ppGenerating ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <FileText className="h-4 w-4 mr-1" />
                                                )}
                                                {ppJob?.status === 'completed' ? 'Regenerar' : 'Generar Policy Paper'}
                                              </Button>
                                            )}
                                            {ppJob?.status === 'completed' && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                                asChild
                                              >
                                                <a href={`${BACKEND_URL}/api/admin/visa-cases/${caseId}/policy-paper-download?language=es`}
                                                  target="_blank" rel="noopener noreferrer">
                                                  <Download className="h-4 w-4 mr-1" />
                                                  Descargar PDF
                                                </a>
                                              </Button>
                                            )}
                                            {ppJob && ['processing', 'generating'].includes(ppJob.status) && (
                                              <span className="text-xs text-emerald-600 font-medium">{ppJob.currentStep}</span>
                                            )}
                                            {ppJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{ppJob.error}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : isEconometric && isAdmin ? (
                                          <>
                                            {(!ecJob || ecJob.status === 'error' || ecJob.status === 'completed') && (
                                              <Button
                                                size="sm"
                                                data-testid="generate-econometric-btn"
                                                onClick={handleGenerateEconometric}
                                                disabled={ecGenerating}
                                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                              >
                                                {ecGenerating ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <FileText className="h-4 w-4 mr-1" />
                                                )}
                                                {ecJob?.status === 'completed' ? 'Regenerar' : 'Generar Estudio'}
                                              </Button>
                                            )}
                                            {ecJob?.status === 'completed' && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                                asChild
                                              >
                                                <a href={`${BACKEND_URL}/api/admin/visa-cases/${caseId}/econometric-download?language=es`}
                                                  target="_blank" rel="noopener noreferrer">
                                                  <Download className="h-4 w-4 mr-1" />
                                                  Descargar PDF
                                                </a>
                                              </Button>
                                            )}
                                            {ecJob && ['processing', 'generating'].includes(ecJob.status) && (
                                              <span className="text-xs text-amber-600 font-medium">{ecJob.currentStep}</span>
                                            )}
                                            {ecJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{ecJob.error}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : isBook && isAdmin ? (
                                          <>
                                            {(!bkJob || bkJob.status === 'error' || bkJob.status === 'completed') && (
                                              <Button
                                                size="sm"
                                                data-testid="generate-book-btn"
                                                onClick={handleGenerateBook}
                                                disabled={bkGenerating || (bkPrep?.step !== 'ready' && !bkJob?.status)}
                                                title={bkPrep?.step !== 'ready' && !bkJob?.status ? 'El cliente debe completar la seleccion de idea y titulo primero' : ''}
                                                className="bg-violet-600 hover:bg-violet-700 text-white"
                                              >
                                                {bkGenerating ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <FileText className="h-4 w-4 mr-1" />
                                                )}
                                                {bkJob?.status === 'completed' ? 'Regenerar' : 'Generar Libro'}
                                              </Button>
                                            )}
                                            {bkPrep && bkPrep.step === 'ready' && (
                                              <span className="text-xs text-green-600 font-medium" title={`Idea: ${bkPrep.selectedIdea?.substring(0,60)}...`}>
                                                Titulo: {bkPrep.selectedTitle}
                                              </span>
                                            )}
                                            {(!bkPrep || (bkPrep && bkPrep.step !== 'ready')) && !bkJob?.status && (
                                              <span className="text-xs text-amber-500 font-medium">
                                                Esperando seleccion del cliente
                                              </span>
                                            )}
                                            {bkJob?.status === 'completed' && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-violet-600 border-violet-300 hover:bg-violet-50"
                                                asChild
                                              >
                                                <a href={`${BACKEND_URL}/api/admin/visa-cases/${caseId}/book-download?language=es`}
                                                  target="_blank" rel="noopener noreferrer">
                                                  <Download className="h-4 w-4 mr-1" />
                                                  Descargar PDF
                                                </a>
                                              </Button>
                                            )}
                                            {bkJob && ['processing', 'generating'].includes(bkJob.status) && (
                                              <span className="text-xs text-violet-600 font-medium">{bkJob.progressMessage || bkJob.currentStep}</span>
                                            )}
                                            {bkJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{bkJob.error}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : isCaseStudy && isAdmin ? (
                                          <>
                                            {(!csJob || csJob.status === 'error' || csJob.status === 'completed') && (
                                              <Button
                                                size="sm"
                                                data-testid="generate-case-study-btn"
                                                onClick={handleGenerateCaseStudy}
                                                disabled={csGenerating}
                                                className="bg-teal-600 hover:bg-teal-700 text-white"
                                              >
                                                {csGenerating ? (
                                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                  <FileText className="h-4 w-4 mr-1" />
                                                )}
                                                {csJob?.status === 'completed' ? 'Regenerar' : 'Generar Caso de Estudio'}
                                              </Button>
                                            )}
                                            {csJob?.status === 'completed' && (
                                              <>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="text-teal-600 border-teal-300 hover:bg-teal-50"
                                                  asChild
                                                >
                                                  <a href={`${BACKEND_URL}/api/admin/visa-cases/${caseId}/case-study-download?language=es`}
                                                    target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4 mr-1" />
                                                    PDF ES
                                                  </a>
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="text-teal-600 border-teal-300 hover:bg-teal-50"
                                                  asChild
                                                >
                                                  <a href={`${BACKEND_URL}/api/admin/visa-cases/${caseId}/case-study-download?language=en`}
                                                    target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4 mr-1" />
                                                    PDF EN
                                                  </a>
                                                </Button>
                                              </>
                                            )}
                                            {csJob && ['processing', 'generating'].includes(csJob.status) && (
                                              <span className="text-xs text-teal-600 font-medium">{csJob.currentStep}</span>
                                            )}
                                            {csJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{csJob.error}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : isBP ? (
                                          <>
                                            {bpPrep?.selectedName && (
                                              <span className="text-xs text-green-600 font-medium" title={bpPrep.selectedName}>
                                                Proyecto: {bpPrep.selectedName.substring(0, 50)}{bpPrep.selectedName.length > 50 ? '...' : ''}
                                              </span>
                                            )}
                                            {(!bpPrep || !bpPrep.selectedName) && !bpJob?.status && (
                                              <span className="text-xs text-amber-500 font-medium">
                                                Esperando seleccion del cliente
                                              </span>
                                            )}
                                            {bpJob && ['processing', 'generating', 'queued'].includes(bpJob.status) && (
                                              <span className="text-xs text-blue-600 font-medium">{bpJob.currentStep || 'Generando...'}</span>
                                            )}
                                            {bpJob?.status === 'completed' && (
                                              <span className="text-xs text-green-600 font-medium">Business Plan generado</span>
                                            )}
                                            {bpJob?.status === 'error' && (
                                              <span className="text-xs text-red-500">{bpJob.error || 'Error en generacion'}</span>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenUploadModal(del)}
                                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                            >
                                              <Upload className="h-4 w-4 mr-1" />
                                              {delFiles.length > 0 ? 'Agregar' : 'Subir'}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleOpenChangeStageModal('deliverable', del)}
                                              className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                              title="Cambiar etapa"
                                            >
                                              <MoveRight className="h-4 w-4" />
                                            </Button>
                                            {isAdmin && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  e.preventDefault();
                                                  setDeliverableToDelete(del);
                                                  setDeleteModalOpen(true);
                                                }}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                title="Eliminar entregable"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Description */}
                                    {(del.description?.es || del.description?.en || del.description) && (
                                      <p className="text-sm text-gray-600 mt-2">
                                        {getText(del.description, '')}
                                      </p>
                                    )}

                                    {/* Whitepaper progress bar */}
                                    {isWhitePaper && wpJob && ['processing', 'generating'].includes(wpJob.status) && (
                                      <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {wpJob.currentStep || 'Procesando...'}
                                          </span>
                                          {wpJob.progress > 0 && (
                                            <span className="text-xs font-bold text-indigo-700">{wpJob.progress}%</span>
                                          )}
                                        </div>
                                        <div className="w-full bg-indigo-200 rounded-full h-1.5">
                                          <div className="bg-indigo-600 rounded-full h-1.5 transition-all duration-500"
                                            style={{ width: `${wpJob.progress || 5}%` }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Policy Paper progress bar */}
                                    {isPolicyPaper && ppJob && ['processing', 'generating'].includes(ppJob.status) && (
                                      <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {ppJob.progressMessage || ppJob.currentStep || 'Procesando...'}
                                          </span>
                                          {ppJob.progress > 0 && (
                                            <span className="text-xs font-bold text-emerald-700">{ppJob.progress}%</span>
                                          )}
                                        </div>
                                        <div className="w-full bg-emerald-200 rounded-full h-1.5">
                                          <div className="bg-emerald-600 rounded-full h-1.5 transition-all duration-500"
                                            style={{ width: `${ppJob.progress || 5}%` }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Econometric Study progress bar */}
                                    {isEconometric && ecJob && ['processing', 'generating'].includes(ecJob.status) && (
                                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {ecJob.currentStep || 'Procesando...'}
                                          </span>
                                          {ecJob.progress > 0 && (
                                            <span className="text-xs font-bold text-amber-700">{ecJob.progress}%</span>
                                          )}
                                        </div>
                                        <div className="w-full bg-amber-200 rounded-full h-1.5">
                                          <div className="bg-amber-600 rounded-full h-1.5 transition-all duration-500"
                                            style={{ width: `${ecJob.progress || 5}%` }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Book progress bar */}
                                    {isBook && bkJob && ['processing', 'generating'].includes(bkJob.status) && (
                                      <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {bkJob.progressMessage || bkJob.currentStep || 'Procesando...'}
                                          </span>
                                          {bkJob.progress > 0 && (
                                            <span className="text-xs font-bold text-violet-700">{bkJob.progress}%</span>
                                          )}
                                        </div>
                                        <div className="w-full bg-violet-200 rounded-full h-1.5">
                                          <div className="bg-violet-600 rounded-full h-1.5 transition-all duration-500"
                                            style={{ width: `${bkJob.progress || 5}%` }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Case Study progress bar */}
                                    {isCaseStudy && csJob && ['processing', 'generating'].includes(csJob.status) && (
                                      <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-100">
                                        <div className="flex items-center gap-1.5">
                                          <Loader2 className="h-3 w-3 animate-spin text-teal-700" />
                                          <span className="text-xs font-semibold text-teal-700">
                                            {csJob.currentStep || 'Procesando...'}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Files list - only show for non-AI reports */}
                                    {!isAIReport && delFiles.length > 0 && (
                                      <div className="space-y-2 mt-3 border-t border-gray-100 pt-3">
                                        <p className="text-xs text-gray-500 font-medium">Archivos subidos:</p>
                                        {delFiles.map((file, index) => {
                                          const uploadedAtRaw = file.uploadedAt || file.uploaded_at || del.uploadedAt || del.uploaded_at || del.updatedAt || del.updated_at || del.createdAt || del.created_at;
                                          const uploadedAtLabel = formatUploadedAt(uploadedAtRaw);
                                          const uploaderName = resolveUploaderName(file);
                                          const fileId = file.id || 'legacy';
                                          return (
                                          <div
                                            key={file.id || index}
                                            className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                <span className="text-sm text-gray-700 truncate">
                                                  {file.fileName || `Archivo ${index + 1}`}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => window.open(file.fileUrl, '_blank')}
                                                  className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                >
                                                  <Download className="h-4 w-4 mr-1" />
                                                  Ver
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => setFileToDelete({ deliverableId: del.id, fileId, fileName: file.fileName || `Archivo ${index + 1}` })}
                                                  className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                            {(uploadedAtLabel || uploaderName || file.clientNotified === false) && (
                                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                                                {uploadedAtLabel && (
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {uploadedAtLabel}
                                                  </span>
                                                )}
                                                {uploaderName && (
                                                  <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {uploaderName}
                                                  </span>
                                                )}
                                                {file.clientNotified === false && (
                                                  <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                                    <MailX className="h-3 w-3" />
                                                    No se notificó al cliente
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            {renderNotesThread({
                                              threadKey: `del-${del.id}-file-${fileId}`,
                                              notes: file.noteEntries,
                                              onAdd: () => handleOpenFileNoteEditor(del.id, file),
                                              onDelete: (noteId) => handleDeleteFileNote(del.id, fileId, noteId),
                                            })}
                                          </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Stage Documents */}
                        {(stageDocuments.length > 0 || !viewAllStages) && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm text-gray-500">Documentos del Cliente ({stageDocuments.length})</p>
                              {!viewAllStages && isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); handleOpenAddDocument(stage); }}
                                  className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Upload className="h-3.5 w-3.5 mr-1" />
                                  Agregar documento
                                </Button>
                              )}
                            </div>
                            {stageDocuments.length === 0 && !viewAllStages && (
                              <p className="text-xs text-gray-400 italic mb-3">Sin documentos en esta etapa</p>
                            )}
                            <div className="space-y-3">
                              {stageDocuments.map((doc) => {
                                const docName = getText(doc.name || doc.documentType || doc.documentName, 'Documento').toLowerCase();
                                const isDocHojaDeVida = docName.includes('hoja de vida') || docName.includes('curriculum') || docName.includes('resume');
                                const cvForDoc = isDocHojaDeVida && userCvs.length > 0 ? userCvs[0] : null;
                                
                                // Override status if Hoja de vida has CV
                                const effectiveStatus = (isDocHojaDeVida && cvForDoc && doc.status === 'pending') ? 'uploaded' : doc.status;
                                const docStatus = DOCUMENT_STATUS_CONFIG[effectiveStatus] || DOCUMENT_STATUS_CONFIG['pending'];
                                
                                // Get files array with backward compatibility
                                const docFiles = doc.files?.length > 0 
                                  ? doc.files 
                                  : doc.fileUrl 
                                    ? [{ id: 'legacy', fileName: doc.fileName || 'Archivo', fileUrl: doc.fileUrl }]
                                    : isDocHojaDeVida && cvForDoc
                                      ? [{ id: 'cv-auto', fileName: cvForDoc.fileName || 'Hoja de vida', fileUrl: cvForDoc.url }]
                                      : [];
                                
                                return (
                                  <div 
                                    key={doc.id}
                                    className="border border-gray-200 rounded-lg p-4 bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Document header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-3">
                                        <docStatus.icon className="h-5 w-5 text-gray-500" />
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-gray-900">{getText(doc.name || doc.documentType || doc.documentName, 'Documento')}</span>
                                          {docFiles.length > 1 && (
                                            <Badge className="bg-blue-100 text-blue-700">{docFiles.length} archivo(s)</Badge>
                                          )}
                                        </div>
                                        <Badge className={docStatus.color}>{docStatus.label}</Badge>
                                      </div>
                                      {doc.status === 'uploaded' && (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleValidateDocument(doc.id)}
                                            disabled={validatingDocId === doc.id}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                          >
                                            {validatingDocId === doc.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <>
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                Validar
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setDocumentToReject(doc);
                                              setRejectModalOpen(true);
                                            }}
                                            className="bg-red-100 text-red-700 hover:bg-red-200"
                                          >
                                            <XCircle className="h-4 w-4 mr-1" />
                                            Rechazar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOpenChangeStageModal('document', doc)}
                                            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                            title="Cambiar etapa"
                                          >
                                            <MoveRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                      {/* Always show change stage button */}
                                      {doc.status !== 'uploaded' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOpenChangeStageModal('document', doc)}
                                          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                          title="Cambiar etapa"
                                        >
                                          <MoveRight className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {doc.requiresPhysicalCopy && (
                                      <p className="text-xs text-orange-600 mb-2">
                                        📮 Requiere envío físico por correo
                                      </p>
                                    )}
                                    
                                    {/* Files list */}
                                    {docFiles.length > 0 && (
                                      <div className="space-y-2 mt-3">
                                        {docFiles.map((file, index) => {
                                          const docUploadedAtRaw = file.uploadedAt || file.uploaded_at || doc.uploadedAt || doc.uploaded_at || doc.updatedAt || doc.updated_at || doc.createdAt || doc.created_at;
                                          const docUploadedAtLabel = formatUploadedAt(docUploadedAtRaw);
                                          const docUploaderName = file.uploadedByName || resolveDocUploaderName(doc);
                                          return (
                                          <div
                                            key={file.id || index}
                                            className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                <span className="text-sm text-gray-700 truncate">
                                                  {file.fileName || `Archivo ${index + 1}`}
                                                </span>
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open(file.fileUrl, '_blank')}
                                                className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                              >
                                                <Download className="h-4 w-4 mr-1" />
                                                Ver
                                              </Button>
                                            </div>
                                            {(docUploadedAtLabel || docUploaderName) && (
                                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                                                {docUploadedAtLabel && (
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {docUploadedAtLabel}
                                                  </span>
                                                )}
                                                {docUploaderName && (
                                                  <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {docUploaderName}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Document notes thread (staff) */}
                                    {renderNotesThread({
                                      threadKey: `stage-doc-${doc.id || doc._id}`,
                                      notes: doc.notes,
                                      onAdd: () => handleOpenDocNoteEditor(doc),
                                      onDelete: (noteId) => handleDeleteDocNote(doc.id || doc._id, noteId),
                                    })}

                                    {/* Text value if document is text type */}
                                    {doc.type === 'text' && doc.textValue && (
                                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1 font-medium">Información enviada:</p>
                                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{doc.textValue}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Empty state for single stage view */}
                        {!viewAllStages && stageDeliverables.length === 0 && stageDocuments.length === 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 text-center py-8">
                            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500">No hay entregables ni documentos en esta etapa</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Quick preview in view all mode */}
                    {viewAllStages && (stageDeliverables.length > 0 || stageDocuments.length > 0) && (
                      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                        {stageDeliverables.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {stageDeliverables.length} entregable(s)
                          </span>
                        )}
                        {stageDocuments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Upload className="h-4 w-4" />
                            {stageDocuments.length} documento(s)
                          </span>
                        )}
                        <span className="text-blue-600 ml-auto">Click para ver detalles →</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="space-y-3">
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                {stages.length === 0 || (deliverables.length === 0 && documents.length === 0) ? (
                  <div className="text-center py-6 text-gray-500 text-sm">No hay documentos aún</div>
                ) : (
                  <>
                    {/* Selection toolbar */}
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-200">
                      <div className="text-xs text-gray-600">
                        {Object.keys(zipSelection).length === 0
                          ? 'Selecciona archivos para descargarlos en un ZIP'
                          : `${Object.keys(zipSelection).length} archivo(s) seleccionado(s)`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBulkSelection(collectAllDownloadable(), true)}
                          className="h-7 px-2 text-xs"
                        >
                          Seleccionar todo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setZipSelection({})}
                          disabled={Object.keys(zipSelection).length === 0}
                          className="h-7 px-2 text-xs"
                        >
                          Limpiar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleDownloadZip}
                          disabled={downloadingZip || Object.keys(zipSelection).length === 0}
                          className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {downloadingZip ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generando...</>
                          ) : (
                            <><Download className="h-3 w-3 mr-1" />Descargar ZIP ({Object.keys(zipSelection).length})</>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-5">
                    {stages.map((stage) => {
                      const stageDels = deliverables.filter((d) => d.stageNumber === stage.stageNumber);
                      const stageDocs = documents.filter((d) => d.stageNumber === stage.stageNumber);
                      if (stageDels.length === 0 && stageDocs.length === 0) return null;

                      const renderItemRow = (item, kind) => {
                        const dName = kind === 'doc'
                          ? getText(item.name || item.documentType || item.documentName, 'Documento')
                          : getText(item.name, 'Entregable');
                        let files = [];
                        let statusLabel = '';
                        if (kind === 'del') {
                          files = item.files?.length > 0
                            ? item.files
                            : item.fileUrl
                              ? [{ id: 'legacy', fileName: item.fileName || 'Archivo', fileUrl: item.fileUrl }]
                              : [];
                        } else {
                          const isHV = dName.toLowerCase().includes('hoja de vida') || dName.toLowerCase().includes('curriculum');
                          const cvAuto = isHV && userCvs.length > 0 ? userCvs[0] : null;
                          const effStatus = (isHV && cvAuto && item.status === 'pending') ? 'uploaded' : item.status;
                          files = item.files?.length > 0
                            ? item.files
                            : item.fileUrl
                              ? [{ id: 'legacy', fileName: item.fileName || 'Archivo', fileUrl: item.fileUrl }]
                              : isHV && cvAuto
                                ? [{ id: 'cv-auto', fileName: cvAuto.fileName || 'Hoja de vida', fileUrl: cvAuto.url }]
                                : [];
                          statusLabel = (DOCUMENT_STATUS_CONFIG[effStatus] || DOCUMENT_STATUS_CONFIG.pending).label;
                        }
                        const itemType = kind === 'del' ? 'deliverable' : 'document';
                        const itemId = item.id || item._id;
                        const downloadableFiles = files.filter((f) => !!f.fileUrl);
                        const allFileKeys = downloadableFiles.map((f) => selectionKey(itemType, itemId, f.id || 'legacy'));
                        const allSelected = allFileKeys.length > 0 && allFileKeys.every((k) => zipSelection[k]);
                        const someSelected = allFileKeys.some((k) => zipSelection[k]) && !allSelected;
                        const handleParentToggle = () => {
                          const entries = downloadableFiles.map((f) => ({ type: itemType, itemId, fileId: f.id || 'legacy' }));
                          setBulkSelection(entries, !allSelected);
                        };
                        return (
                          <div key={`${kind}-${itemId}`} className="py-1.5">
                            <div className="flex items-baseline gap-2">
                              {downloadableFiles.length > 0 && (
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                  onChange={handleParentToggle}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              )}
                              <p className="text-sm text-gray-900 truncate flex-1 min-w-0">{dName}</p>
                              <p className="text-[11px] text-gray-400 whitespace-nowrap">
                                {kind === 'doc' && statusLabel}
                                {files.length === 0 && (kind === 'del' ? ' · sin archivos' : '')}
                              </p>
                            </div>
                            {files.length > 0 && (
                              <ul className="mt-1 ml-6 space-y-0.5">
                                {files.map((file, idx) => {
                                  const fileId = file.id || 'legacy';
                                  const at = file.uploadedAt && formatUploadedAt(file.uploadedAt);
                                  const key = selectionKey(itemType, itemId, fileId);
                                  return (
                                    <li key={fileId || idx} className="flex items-center gap-2 text-xs text-gray-600">
                                      {file.fileUrl ? (
                                        <input
                                          type="checkbox"
                                          checked={!!zipSelection[key]}
                                          onChange={() => toggleSelection(itemType, itemId, fileId)}
                                          className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                      ) : (
                                        <span className="w-3" />
                                      )}
                                      <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                      <span className="truncate flex-1 min-w-0">{file.fileName || `Archivo ${idx + 1}`}</span>
                                      {at && <span className="text-[11px] text-gray-400 whitespace-nowrap">{at}</span>}
                                      {file.fileUrl && (
                                        <button
                                          type="button"
                                          onClick={() => window.open(file.fileUrl, '_blank')}
                                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                          title="Descargar"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div key={stage.id || stage.stageNumber}>
                          <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-gray-200">
                            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Etapa {stage.stageNumber}</span>
                            <h3 className="text-sm font-semibold text-gray-900 truncate">{getText(stage.name, `Etapa ${stage.stageNumber}`)}</h3>
                          </div>

                          {stageDels.length > 0 && (
                            <div className="mb-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Entregables</p>
                              <div className="divide-y divide-gray-100">
                                {stageDels.map((d) => renderItemRow(d, 'del'))}
                              </div>
                            </div>
                          )}

                          {stageDocs.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Documentos requeridos</p>
                              <div className="divide-y divide-gray-100">
                                {stageDocs.map((d) => renderItemRow(d, 'doc'))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FINANCIALS TAB */}
          <TabsContent value="financials" className="space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Total del Caso"
                value={`$${financialSummary.totalAmount.toLocaleString()}`}
                icon={DollarSign}
              />
              <StatCard
                title="Pagado"
                value={`$${financialSummary.paidAmount.toLocaleString()}`}
                icon={CheckCircle}
                variant="success"
              />
              <StatCard
                title="Pendiente"
                value={`$${financialSummary.pendingAmount.toLocaleString()}`}
                icon={Clock}
                variant={financialSummary.pendingAmount > 0 ? 'warning' : 'default'}
              />
            </div>

            {/* Payments History */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    Pagos Registrados
                    <Badge className="bg-emerald-100 text-emerald-700 ml-2">
                      {manualPayments.length}
                    </Badge>
                  </h3>
                  <Button
                    onClick={() => setPaymentModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar Pago
                  </Button>
                </div>
                
                {manualPayments.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">No hay pagos registrados para este caso</p>
                    <p className="text-sm text-gray-400">Para registrar un pago, selecciona una o más etapas en la sección de Etapas del Caso</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {manualPayments.map((payment) => (
                      <div 
                        key={payment.id || payment.id}
                        className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/30"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                              <span className="text-sm font-semibold text-gray-900">
                                {payment.stageNumbers && payment.stageNumbers.length > 0 ? (
                                  payment.stageNumbers.length === 1 ? (
                                    `Etapa ${payment.stageNumbers[0]}`
                                  ) : (
                                    `Etapas ${payment.stageNumbers.join(', ')}`
                                  )
                                ) : payment.stageNumber ? (
                                  `Etapa ${payment.stageNumber}`
                                ) : (
                                  'Pago general'
                                )}
                              </span>
                              <Badge className="bg-blue-100 text-blue-800">
                                {payment.paymentMethod === 'cash' ? 'Efectivo' :
                                 payment.paymentMethod === 'transfer' ? 'Transferencia' :
                                 payment.paymentMethod === 'fanbasis' ? 'Fanbasis' :
                                 payment.paymentMethod === 'wire' ? 'Wire' :
                                 payment.paymentMethod === 'check' ? 'Cheque' : 'Otro'}
                              </Badge>
                              {payment.stageNumbers && payment.stageNumbers.length > 1 && (
                                <span className="text-xs text-gray-600">
                                  {payment.stageNumbers.length} etapas pagadas
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs">Fecha de Pago</p>
                                <p className="font-medium text-gray-900">
                                  {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('es', { 
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  }) : 'N/A'}
                                </p>
                              </div>
                              
                              {payment.reference && (
                                <div>
                                  <p className="text-gray-500 text-xs">Referencia</p>
                                  <p className="font-mono text-sm text-gray-900">{payment.reference}</p>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 text-sm">
                              <p className="text-gray-500 text-xs">Registrado por</p>
                              <p className="font-medium text-gray-900">{payment.registeredByName || 'N/A'}</p>
                            </div>

                            {payment.notes && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                                <p className="text-gray-500 text-xs font-medium mb-1">Notas:</p>
                                <p className="text-sm text-gray-900">{payment.notes}</p>
                              </div>
                            )}

                            {payment.receiptUrl && (
                              <div className="mt-3">
                                <a
                                  href={payment.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <FileText className="h-4 w-4" />
                                  Ver Comprobante
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Monto Pagado</p>
                              <p className="text-2xl font-bold text-emerald-600">
                                ${(payment.amount || 0).toLocaleString()}
                              </p>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditPaymentData({
                                      id: payment.id || payment.id,
                                      amount: payment.amount || 0,
                                      paymentMethod: payment.paymentMethod || 'transfer',
                                      paymentDate: payment.paymentDate ? payment.paymentDate.split('T')[0] : '',
                                      reference: payment.reference || '',
                                      notes: payment.notes || '',
                                      receiptUrl: payment.receiptUrl || '',
                                      stageNumbers: payment.stageNumbers || [],
                                    });
                                    setEditPaymentOpen(true);
                                  }}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPaymentToDelete(payment);
                                    setDeletePaymentModalOpen(true);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  data-testid={`delete-payment-${payment.id || payment.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Eliminar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Summary */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-emerald-900">Total Pagado:</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          ${manualPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info about adding payments */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">¿Cómo registrar un nuevo pago?</p>
                  <p>Para registrar un pago, ve a la pestaña <strong>Etapas</strong> y selecciona las etapas que deseas marcar como pagadas. Luego usa el botón de Registrar Pago que aparecerá.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* HISTORY TAB */}
          {/* NOTES TAB */}
          <TabsContent value="notes" className="space-y-4">
            <NotesTab caseId={caseId} token={token} caseNotes={caseNotes} fetchCaseNotes={fetchCaseNotes} userRole={userRole} userId={currentUserId} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* Case Activities Timeline */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Timeline de Actividades
                </h3>
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No hay actividades registradas</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {activities.map((act, i) => {
                        const colorMap = {
                          'client_uploaded_doc': 'bg-blue-500',
                          'staff_uploaded_deliverable': 'bg-purple-500',
                          'deliverable_file_uploaded': 'bg-purple-500',
                          'deliverable_file_deleted': 'bg-red-400',
                          'deliverable_created': 'bg-purple-400',
                          'document_created': 'bg-blue-400',
                          'doc_validated': 'bg-emerald-500',
                          'document_validated': 'bg-emerald-500',
                          'doc_rejected': 'bg-red-500',
                          'document_rejected': 'bg-red-500',
                          'payment_registered': 'bg-green-500',
                          'payment_deleted': 'bg-red-400',
                          'stage_unlocked': 'bg-amber-500',
                          'case_status_changed': 'bg-indigo-500',
                          'coordinator_assigned': 'bg-cyan-500',
                          'note_added': 'bg-yellow-500',
                          'deliverable_file_note_added': 'bg-yellow-500',
                          'deliverable_file_note_deleted': 'bg-yellow-300',
                          'client_document_note_added': 'bg-yellow-500',
                          'client_document_note_deleted': 'bg-yellow-300',
                        };
                        const dot = colorMap[act.type] || 'bg-gray-400';
                        const ts = act.timestamp ? new Date(act.timestamp) : null;
                        return (
                          <div key={i} className="relative pl-10">
                            <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full ${dot} ring-2 ring-white`} />
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">{act.label}</span>
                                <span className="text-xs text-gray-400">{ts ? ts.toLocaleString('es', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
                              </div>
                              {act.details?.documentName && <p className="text-xs text-gray-600">Documento: {act.details.documentName}</p>}
                              {act.details?.deliverableName && <p className="text-xs text-gray-600">Entregable: {act.details.deliverableName}</p>}
                              {act.details?.amount && <p className="text-xs text-gray-600">Monto: ${act.details.amount.toLocaleString()}</p>}
                              {act.details?.stageNumbers && <p className="text-xs text-gray-600">Etapa(s): {act.details.stageNumbers.join(', ')}</p>}
                              {act.details?.stageName && <p className="text-xs text-gray-600">Etapa: {act.details.stageName}</p>}
                              {act.details?.reason && <p className="text-xs text-red-600">Motivo: {act.details.reason}</p>}
                              {act.details?.newStatus && <p className="text-xs text-gray-600">Nuevo estado: {act.details.newStatus}</p>}
                              <p className="text-xs text-gray-400 mt-1">{act.performedBy?.name} ({act.performedBy?.role || 'sistema'})</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <DeliverableUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        deliverable={selectedDeliverable}
        caseId={caseId}
        onUploadComplete={fetchCaseData}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeliverableToDelete(null); }}
        onConfirm={handleDeleteDeliverable}
        deliverableName={getText(deliverableToDelete?.name, deliverableToDelete?.deliverableName || 'este entregable')}
      />

      {/* Reject Appointment Modal */}
      <Dialog open={!!rejectApptId} onOpenChange={(open) => { if (!open) { setRejectApptId(null); setRejectApptReason(''); } }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Rechazar Cita</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo. El cliente recibira una notificacion.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <textarea
              value={rejectApptReason}
              onChange={(e) => setRejectApptReason(e.target.value)}
              placeholder="Ej: Horario no disponible, por favor selecciona otra fecha..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 focus:border-red-400 focus:ring-1 focus:ring-red-400/50 focus:outline-none resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectApptId(null); setRejectApptReason(''); }}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectApptReason.trim()}
              onClick={async () => {
                try {
                  await axios.patch(`${BACKEND_URL}/api/admin/appointments/${rejectApptId}`, { status: 'rejected', adminNotes: rejectApptReason.trim() }, { headers: { Authorization: `Bearer ${token}` } });
                  toast.success('Cita rechazada');
                  setRejectApptId(null); setRejectApptReason('');
                  fetchAppointments();
                } catch { toast.error('Error al rechazar'); }
              }}
            >
              <XCircle className="h-4 w-4 mr-1" />Rechazar Cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete File from Deliverable Modal */}
      <Dialog open={!!fileToDelete} onOpenChange={(open) => { if (!open) setFileToDelete(null); }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Eliminar archivo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar <strong>{fileToDelete?.fileName}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFileToDelete(null)}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!fileToDelete) return;
                try {
                  if (fileToDelete.fileId === 'legacy') {
                    await axios.delete(`${BACKEND_URL}/api/admin/deliverables/${fileToDelete.deliverableId}/file`, { headers: { Authorization: `Bearer ${token}` } });
                  } else {
                    await axios.delete(`${BACKEND_URL}/api/admin/deliverables/${fileToDelete.deliverableId}/files/${fileToDelete.fileId}`, { headers: { Authorization: `Bearer ${token}` } });
                  }
                  toast.success('Archivo eliminado');
                  setFileToDelete(null);
                  fetchCaseData();
                } catch { toast.error('Error al eliminar archivo'); }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add File Note Modal */}
      <Dialog open={!!editingFileNote} onOpenChange={(open) => { if (!open) handleCloseFileNoteEditor(); }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Agregar nota</DialogTitle>
            <DialogDescription>
              {editingFileNote?.fileLabel ? `Archivo: ${editingFileNote.fileLabel}` : 'Agrega una nota al archivo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={fileNoteDraft}
              onChange={(e) => setFileNoteDraft(e.target.value)}
              placeholder="Escribe una nota sobre este archivo..."
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Cliente puede ver esta nota</p>
                <p className="text-xs text-blue-600">Si esta apagado, solo el equipo interno la vera.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fileNoteVisibleDraft}
                onClick={() => setFileNoteVisibleDraft(!fileNoteVisibleDraft)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  fileNoteVisibleDraft ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    fileNoteVisibleDraft ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseFileNoteEditor} disabled={savingFileNote}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveFileNote}
              disabled={savingFileNote}
            >
              {savingFileNote ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
              ) : (
                'Agregar nota'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deliverable Modal */}
      <Dialog open={!!addingDeliverable} onOpenChange={(open) => { if (!open) handleCloseAddDeliverable(); }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Agregar entregable</DialogTitle>
            <DialogDescription>
              {addingDeliverable?.stageLabel ? `Etapa: ${addingDeliverable.stageLabel}` : 'Crea un entregable para este cliente.'} Solo se agregará a este caso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-del-name">Nombre *</Label>
              <Input
                id="new-del-name"
                value={newDeliverableName}
                onChange={(e) => setNewDeliverableName(e.target.value)}
                placeholder="Ej: Carta de recomendación"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-del-desc">Descripción</Label>
              <Textarea
                id="new-del-desc"
                value={newDeliverableDescription}
                onChange={(e) => setNewDeliverableDescription(e.target.value)}
                placeholder="Descripción opcional del entregable..."
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseAddDeliverable} disabled={savingNewDeliverable}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveNewDeliverable}
              disabled={savingNewDeliverable}
            >
              {savingNewDeliverable ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
              ) : (
                'Crear entregable'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Document Modal */}
      <Dialog open={!!addingDocument} onOpenChange={(open) => { if (!open) handleCloseAddDocument(); }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Agregar documento</DialogTitle>
            <DialogDescription>
              {addingDocument?.stageLabel ? `Etapa: ${addingDocument.stageLabel}` : 'Solicita un documento al cliente.'} Solo se agregará a este caso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-doc-name">Nombre *</Label>
              <Input
                id="new-doc-name"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="Ej: Pasaporte vigente"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-doc-desc">Descripción</Label>
              <Textarea
                id="new-doc-desc"
                value={newDocumentDescription}
                onChange={(e) => setNewDocumentDescription(e.target.value)}
                placeholder="Descripción opcional del documento..."
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Documento requerido</p>
                <p className="text-xs text-blue-600">El cliente debe subirlo para avanzar.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newDocumentRequired}
                onClick={() => setNewDocumentRequired(!newDocumentRequired)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  newDocumentRequired ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    newDocumentRequired ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold text-orange-900">Requiere copia física</p>
                <p className="text-xs text-orange-600">El cliente debe enviar el original por correo.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newDocumentPhysical}
                onClick={() => setNewDocumentPhysical(!newDocumentPhysical)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  newDocumentPhysical ? 'bg-orange-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    newDocumentPhysical ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseAddDocument} disabled={savingNewDocument}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveNewDocument}
              disabled={savingNewDocument}
            >
              {savingNewDocument ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
              ) : (
                'Crear documento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Document Note Modal */}
      <Dialog open={!!editingDocNote} onOpenChange={(open) => { if (!open) handleCloseDocNoteEditor(); }}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Agregar nota</DialogTitle>
            <DialogDescription>
              {editingDocNote?.documentLabel ? `Documento: ${editingDocNote.documentLabel}` : 'Agrega una nota interna o visible al cliente.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={docNoteDraft}
              onChange={(e) => setDocNoteDraft(e.target.value)}
              placeholder="Escribe una nota sobre este documento..."
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Cliente puede ver esta nota</p>
                <p className="text-xs text-blue-600">Si esta apagado, solo el equipo interno la vera.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={docNoteVisibleDraft}
                onClick={() => setDocNoteVisibleDraft(!docNoteVisibleDraft)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  docNoteVisibleDraft ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    docNoteVisibleDraft ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDocNoteEditor} disabled={savingDocNote}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveDocNote}
              disabled={savingDocNote}
            >
              {savingDocNote ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
              ) : (
                'Agregar nota'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Document Modal */}
      {/* Modal de Confirmación para Validar Documento */}
      <Dialog open={!!documentToValidate} onOpenChange={(open) => { if (!open) setDocumentToValidate(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Validar Documento</DialogTitle>
            <DialogDescription className="text-gray-500">
              Confirma la validación del documento del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {documentToValidate && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  {getText(documentToValidate.name || documentToValidate.documentType || documentToValidate.documentName, 'Documento')}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {documentToValidate.fileName || 'Sin archivo'}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-purple-900">Notificar al cliente</p>
                  <p className="text-xs text-purple-600">Enviar email informando que su documento fue aprobado</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={validateNotifyClient}
                onClick={() => setValidateNotifyClient(!validateNotifyClient)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  validateNotifyClient ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  validateNotifyClient ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocumentToValidate(null)} className="text-gray-500">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmValidate}
              disabled={validatingDocId}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {validatingDocId ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Validando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" />Validar Documento</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Rechazar Documento</DialogTitle>
            <DialogDescription className="text-gray-500">
              Proporciona una razón para el rechazo del documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {documentToReject && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-900">
                  {getText(documentToReject.name || documentToReject.documentType || documentToReject.documentName, 'Documento')}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {documentToReject.fileName || 'Sin archivo'}
                </p>
              </div>
            )}
            <div>
              <Label className="text-gray-700">Razón del rechazo *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describe por qué se rechaza el documento..."
                className="mt-2 bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-purple-900">Notificar al cliente</p>
                  <p className="text-xs text-purple-600">Enviar email informando que debe corregir el documento</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={rejectNotifyClient}
                onClick={() => setRejectNotifyClient(!rejectNotifyClient)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rejectNotifyClient ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  rejectNotifyClient ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRejectModalOpen(false);
                setDocumentToReject(null);
                setRejectionReason('');
                setRejectNotifyClient(true);
              }}
              className="text-gray-500"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRejectDocument}
              disabled={isRejecting || !rejectionReason.trim()}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación para Generar Nuevo Link */}
      <Dialog open={generateLinkModalOpen} onOpenChange={setGenerateLinkModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <LinkIcon className="h-5 w-5 text-purple-600" />
              Generar Nuevo Link de Acceso
            </DialogTitle>
            <DialogDescription className="text-left pt-4 text-gray-600">
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-2">⚠️ Importante</p>
                      <p className="mb-2">
                        Solo genera un nuevo link si el usuario reporta que <strong>el link anterior no funciona correctamente</strong>.
                      </p>
                      <p>
                        Si los links existentes funcionan bien, es recomendable <strong>usar uno de los que ya están creados</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> El nuevo link se agregará a la lista y estará disponible inmediatamente. Los links anteriores seguirán funcionando.
                  </p>
                </div>

                <p className="text-sm text-gray-600">
                  ¿Estás seguro de que deseas generar un nuevo link de acceso para este usuario?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setGenerateLinkModalOpen(false)}
              disabled={generatingLink}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateNewLink}
              disabled={generatingLink}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="confirm-generate-link"
            >
              {generatingLink ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Generar Nuevo Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación para Eliminar Pago */}
      {/* Edit Payment Modal */}
      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Editar Pago</DialogTitle>
            <DialogDescription>Modifica los datos del pago registrado.</DialogDescription>
          </DialogHeader>
          {editPaymentData && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Monto ($)</label>
                  <Input type="number" value={editPaymentData.amount}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, amount: parseFloat(e.target.value) || 0 })}
                    className="border-gray-300" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Metodo de pago</label>
                  <select value={editPaymentData.paymentMethod}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, paymentMethod: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm">
                    <option value="transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="fanbasis">Fanbasis</option>
                    <option value="wire">Wire</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Fecha de pago</label>
                  <Input type="date" value={editPaymentData.paymentDate}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, paymentDate: e.target.value })}
                    className="border-gray-300" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Referencia</label>
                  <Input value={editPaymentData.reference}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, reference: e.target.value })}
                    className="border-gray-300" placeholder="Numero de referencia" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">URL del comprobante</label>
                <Input value={editPaymentData.receiptUrl}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, receiptUrl: e.target.value })}
                  className="border-gray-300" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Notas</label>
                <textarea value={editPaymentData.notes}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={async () => {
                if (!editPaymentData) return;
                try {
                  await axios.put(`${BACKEND_URL}/api/admin/payments/${editPaymentData.id}`, {
                    amount: editPaymentData.amount,
                    paymentMethod: editPaymentData.paymentMethod,
                    paymentDate: editPaymentData.paymentDate,
                    reference: editPaymentData.reference,
                    notes: editPaymentData.notes,
                    receiptUrl: editPaymentData.receiptUrl,
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  toast.success('Pago actualizado');
                  setEditPaymentOpen(false);
                  fetchManualPayments();
                } catch (e) { toast.error(e.response?.data?.detail || 'Error al actualizar'); }
              }}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Modal */}
      <Dialog open={deletePaymentModalOpen} onOpenChange={setDeletePaymentModalOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Trash2 className="h-5 w-5 text-red-600" />
              Eliminar Pago
            </DialogTitle>
            <DialogDescription className="text-left pt-4 text-gray-600">
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-semibold mb-2">⚠️ Esta acción no se puede deshacer</p>
                      <p>
                        Se eliminará el registro del pago y las etapas asociadas volverán a estar marcadas como <strong>pendientes de pago</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {paymentToDelete && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Detalles del pago a eliminar:</p>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">
                        Monto: ${(paymentToDelete.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Etapa(s): {paymentToDelete.stageNumbers?.join(', ') || paymentToDelete.stageNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  ¿Estás seguro de que deseas eliminar este pago?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeletePaymentModalOpen(false);
                setPaymentToDelete(null);
              }}
              disabled={deletingPayment}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeletePayment}
              disabled={deletingPayment}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-payment"
            >
              {deletingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Registrar Pago */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              Registrar Pago Manual
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Selecciona una o más etapas para registrar el pago. Las etapas se desbloquearán automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Case Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">
                Caso: {caseData?.visaType} - {caseData?.user?.name}
              </p>
            </div>

            {/* Stage Selection */}
            <div>
              <Label className="text-gray-900 font-medium">Etapas a Pagar *</Label>
              <div className="mt-2 border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                {stages.filter(s => !s.isPaid).length === 0 ? (
                  <p className="text-sm text-gray-500">Todas las etapas están pagadas</p>
                ) : (
                  <div className="space-y-2">
                    {stages.filter(s => !s.isPaid).map((stage) => (
                      <label
                        key={stage.stageNumber}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStagesForPayment.includes(stage.stageNumber)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newSelection = [...selectedStagesForPayment, stage.stageNumber];
                              setSelectedStagesForPayment(newSelection);
                              const totalAmount = stages
                                .filter(s => newSelection.includes(s.stageNumber))
                                .reduce((sum, s) => sum + (s.amount || 0), 0);
                              setPaymentAmount(totalAmount.toString());
                            } else {
                              const newSelection = selectedStagesForPayment.filter(n => n !== stage.stageNumber);
                              setSelectedStagesForPayment(newSelection);
                              const totalAmount = stages
                                .filter(s => newSelection.includes(s.stageNumber))
                                .reduce((sum, s) => sum + (s.amount || 0), 0);
                              setPaymentAmount(totalAmount.toString());
                            }
                          }}
                          className="h-4 w-4 text-emerald-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Etapa {stage.stageNumber}: {getText(stage.name)}
                          </p>
                          <p className="text-xs text-gray-600">
                            Monto: ${stage.amount?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedStagesForPayment.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {selectedStagesForPayment.length} etapa{selectedStagesForPayment.length !== 1 ? 's' : ''} seleccionada{selectedStagesForPayment.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentAmount" className="text-gray-900 font-medium">Monto *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="paymentAmount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-7 text-gray-900"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="paymentDate" className="text-gray-900 font-medium">Fecha de Pago *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="text-gray-900 mt-1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentMethod" className="text-gray-900 font-medium">Método de Pago *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="text-gray-900 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fanbasis">Fanbasis</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentReference" className="text-gray-900 font-medium">Referencia</Label>
                <Input
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Número de factura, transferencia, etc."
                  className="text-gray-900 mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="paymentNotes" className="text-gray-900 font-medium">Notas</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Notas adicionales sobre el pago..."
                className="text-gray-900 mt-1"
                rows={3}
              />
            </div>

            {/* Summary */}
            {selectedStagesForPayment.length > 0 && paymentAmount && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-800">Resumen del Pago</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Etapas: {selectedStagesForPayment.sort((a, b) => a - b).join(', ')}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">
                    ${parseFloat(paymentAmount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPaymentModalOpen(false);
                setSelectedStagesForPayment([]);
                setPaymentAmount('');
                setPaymentReference('');
                setPaymentNotes('');
              }}
              disabled={registeringPayment}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={registeringPayment || selectedStagesForPayment.length === 0 || !paymentAmount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="confirm-register-payment"
            >
              {registeringPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Registrar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Editar Precio de Etapa */}
      <Dialog open={editPriceModalOpen} onOpenChange={setEditPriceModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Precio de Etapa
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {stageToEditPrice && (
                <span>Modifica el precio de la Etapa {stageToEditPrice.stageNumber}: {getText(stageToEditPrice.name)}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {stageToEditPrice && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Etapa {stageToEditPrice.stageNumber}:</strong> {getText(stageToEditPrice.name)}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Precio actual: ${(stageToEditPrice.amount || 0).toLocaleString()}
                  </p>
                </div>

                <div>
                  <Label htmlFor="newPrice" className="text-gray-900 font-medium">Nuevo Precio *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="newPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newStagePrice}
                      onChange={(e) => setNewStagePrice(e.target.value)}
                      className="pl-7 text-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {newStagePrice && parseFloat(newStagePrice) !== stageToEditPrice.amount && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      Diferencia: <strong>{parseFloat(newStagePrice) > stageToEditPrice.amount ? '+' : ''}${(parseFloat(newStagePrice) - (stageToEditPrice.amount || 0)).toLocaleString()}</strong>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditPriceModalOpen(false);
                setStageToEditPrice(null);
                setNewStagePrice('');
              }}
              disabled={updatingPrice}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateStagePrice}
              disabled={updatingPrice || !newStagePrice || parseFloat(newStagePrice) < 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="confirm-update-price"
            >
              {updatingPrice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar Precio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Editar Etapa - Solo Precio y Estado de Pago */}
      <Dialog open={editStageModalOpen} onOpenChange={setEditStageModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Etapa {stageToEdit?.stageNumber}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {stageToEdit && getText(stageToEdit.name, `Etapa ${stageToEdit.stageNumber}`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {stageToEdit && (
              <>
                {/* Price */}
                <div>
                  <Label htmlFor="stageAmount" className="text-gray-900 font-medium">Precio de la Etapa</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="stageAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editStageData.amount}
                      onChange={(e) => setEditStageData({...editStageData, amount: e.target.value})}
                      className="pl-7 text-gray-900"
                    />
                  </div>
                  {editStageData.amount !== stageToEdit.amount?.toString() && (
                    <p className="text-xs text-amber-600 mt-1">
                      Precio actual: ${(stageToEdit.amount || 0).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Unlock Stage Toggle */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-900 font-medium flex items-center gap-2">
                          <Lock className="h-4 w-4 text-blue-600" />
                          Desbloquear Etapa
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Permite al usuario acceder a esta etapa
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${editStageData.isUnlocked ? 'text-blue-700' : 'text-gray-500'}`}>
                          {editStageData.isUnlocked ? 'Desbloqueada' : 'Bloqueada'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditStageData({...editStageData, isUnlocked: !editStageData.isUnlocked})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            editStageData.isUnlocked ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              editStageData.isUnlocked ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Status - Admin Only */}
                {isAdmin && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-gray-900 font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-amber-600" />
                            Estado de Pago
                            <Badge className="bg-amber-100 text-amber-800 text-xs">Solo Admin</Badge>
                          </Label>
                          <p className="text-xs text-gray-500 mt-1">
                            Marcar si esta etapa está pagada
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${editStageData.isPaid ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {editStageData.isPaid ? 'Pagado' : 'No pagado'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditStageData({...editStageData, isPaid: !editStageData.isPaid})}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              editStageData.isPaid ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                editStageData.isPaid ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      {editStageData.isPaid !== stageToEdit?.isPaid && (
                        <p className="text-xs text-amber-700 mt-2 font-medium">
                          ⚠️ Cambiarás el estado de pago de esta etapa
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditStageModalOpen(false);
                setStageToEdit(null);
              }}
              disabled={savingStage}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveStage}
              disabled={savingStage}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="confirm-save-stage"
            >
              {savingStage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Crear Reporte de Elegibilidad */}
      <Dialog open={showEligibilityModal} onOpenChange={setShowEligibilityModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-blue-600" />
              {eligibilityReport?.has_report ? 'Re-subir CV para Elegibilidad' : 'Crear Reporte de Elegibilidad'}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Sube el CV del usuario para {eligibilityReport?.has_report ? 'regenerar' : 'crear'} su reporte de elegibilidad
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cv-file" className="text-gray-900 font-medium">
                Archivo CV (PDF)
              </Label>
              <Input
                id="cv-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setCvFile(e.target.files[0])}
                disabled={uploadingEligibility}
                className="text-gray-900"
              />
              {cvFile && (
                <p className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {cvFile.name}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Información:</strong> Al subir el CV, se {eligibilityReport?.has_report ? 'regenerará' : 'creará'} automáticamente el reporte de elegibilidad del usuario y será analizado por Monica.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEligibilityModal(false);
                setCvFile(null);
              }}
              disabled={uploadingEligibility}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEligibilityReport}
              disabled={uploadingEligibility || !cvFile}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadingEligibility ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {eligibilityReport?.has_report ? 'Regenerando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {eligibilityReport?.has_report ? 'Regenerar Reporte' : 'Crear Reporte'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Crear Ruta Personalizada */}
      <Dialog open={showRutaPersonalizadaModal} onOpenChange={setShowRutaPersonalizadaModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-purple-600" />
              {rutaPersonalizada?.has_report ? 'Re-subir CV para Ruta' : 'Crear Ruta Personalizada'}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Sube el CV del usuario para {rutaPersonalizada?.has_report ? 'regenerar' : 'crear'} su ruta personalizada
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cv-file-ruta" className="text-gray-900 font-medium">
                Archivo CV (PDF, DOC, DOCX)
              </Label>
              <Input
                id="cv-file-ruta"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setCvFileRuta(e.target.files[0])}
                disabled={uploadingRutaPersonalizada}
                className="text-gray-900"
              />
              {cvFileRuta && (
                <p className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {cvFileRuta.name}
                </p>
              )}
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Información:</strong> Al subir el CV, se {rutaPersonalizada?.has_report ? 'regenerará' : 'creará'} automáticamente la ruta personalizada del usuario y será analizada por Monica.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRutaPersonalizadaModal(false);
                setCvFileRuta(null);
              }}
              disabled={uploadingRutaPersonalizada}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRutaPersonalizada}
              disabled={uploadingRutaPersonalizada || !cvFileRuta}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {uploadingRutaPersonalizada ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {rutaPersonalizada?.has_report ? 'Regenerando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {rutaPersonalizada?.has_report ? 'Regenerar Ruta' : 'Crear Ruta'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Cambiar Etapa de Deliverable/Documento */}
      <Dialog open={changeStageModalOpen} onOpenChange={setChangeStageModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Cambiar Etapa
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {itemToChangeStage?.type === 'deliverable' 
                ? 'Mover este entregable a otra etapa del caso.'
                : 'Mover este documento a otra etapa del caso.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Item info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">
                {itemToChangeStage?.type === 'deliverable' ? 'Entregable' : 'Documento'}:
              </p>
              <p className="text-sm text-blue-700">
                {itemToChangeStage?.item?.deliverableName || 
                 itemToChangeStage?.item?.documentName || 
                 itemToChangeStage?.item?.name?.es || 
                 'Sin nombre'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Etapa actual: {itemToChangeStage?.item?.stageNumber || 1}
              </p>
            </div>

            {/* Stage selection */}
            <div>
              <Label htmlFor="newStage" className="text-gray-900 font-medium">Nueva Etapa *</Label>
              <Select 
                value={newStageNumber} 
                onValueChange={setNewStageNumber}
              >
                <SelectTrigger className="text-gray-900 mt-1">
                  <SelectValue placeholder="Seleccionar etapa">
                    {newStageNumber && `Etapa ${newStageNumber}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem 
                      key={stage.stageNumber} 
                      value={stage.stageNumber.toString()}
                      disabled={stage.stageNumber === itemToChangeStage?.item?.stageNumber}
                    >
                      Etapa {stage.stageNumber}: {stage.name?.es || stage.stageName || `Etapa ${stage.stageNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setChangeStageModalOpen(false);
                setItemToChangeStage(null);
              }}
              disabled={changingStage}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeStage}
              disabled={changingStage || !newStageNumber || newStageNumber === itemToChangeStage?.item?.stageNumber?.toString()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {changingStage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moviendo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Mover a Etapa {newStageNumber}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Editar Caso */}
      <Dialog open={editCaseModalOpen} onOpenChange={setEditCaseModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Caso
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Actualiza la información básica del caso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Case Overview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">
                Cliente: {caseData?.user?.name}
              </p>
              <p className="text-sm text-blue-700">
                Email: {caseData?.user?.email}
              </p>
            </div>

            {/* Visa Type */}
            <div>
              <Label htmlFor="visaType" className="text-gray-900 font-medium">Tipo de Visa *</Label>
              <Input
                id="visaType"
                value={editFormData.visaType}
                onChange={(e) => setEditFormData({...editFormData, visaType: e.target.value})}
                placeholder="Ej: EB-2 NIW, O-1, etc."
                className="text-gray-900 mt-1"
                required
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status" className="text-gray-900 font-medium">Estado del Caso *</Label>
              <Select 
                value={editFormData.status} 
                onValueChange={(value) => setEditFormData({...editFormData, status: value})}
              >
                <SelectTrigger className="text-gray-900 mt-1">
                  <SelectValue>
                    {editFormData.status === 'active' && 'Activo'}
                    {editFormData.status === 'pending' && 'Pendiente'}
                    {editFormData.status === 'completed' && 'Completado'}
                    {editFormData.status === 'on_hold' && 'En Espera'}
                    {editFormData.status === 'cancelled' && 'Cancelado'}
                    {editFormData.status === 'eligibility_approved' && 'Elegibilidad Aprobada'}
                    {editFormData.status === 'filed' && 'Radicado'}
                    {editFormData.status === 'approved' && 'Aprobado'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="eligibility_approved">Elegibilidad Aprobada</SelectItem>
                  <SelectItem value="filed">Radicado</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="on_hold">En Espera</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditCaseModalOpen(false)}
              disabled={savingCase}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCase}
              disabled={savingCase || !editFormData.visaType}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingCase ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Notes Tab Component =====
const NotesTab = ({ caseId, token, caseNotes, fetchCaseNotes, userRole, userId }) => {
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const ROLE_COLORS = {
    super_admin: { bg: '#F3E8FF', text: '#7C3AED', label: 'Super Admin' },
    admin: { bg: '#FEE2E2', text: '#DC2626', label: 'Admin' },
    coordinator: { bg: '#DBEAFE', text: '#2563EB', label: 'Coordinador' },
    advisor: { bg: '#D1FAE5', text: '#059669', label: 'Asesor' },
  };

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/cases/${caseId}/notes`, { text: newText },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      setNewText('');
      fetchCaseNotes();
      toast.success('Nota agregada');
    } catch { toast.error('Error al agregar nota'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (noteId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/cases/${caseId}/notes/${noteId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      fetchCaseNotes();
      toast.success('Nota eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-4">
      {/* Add note */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Agregar Nota
          </h3>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Escribe una nota sobre este caso..."
            rows={3}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-blue-400 resize-none mb-3"
            style={{ color: '#374151', background: '#FAFAFA' }}
          />
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={adding || !newText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
              Agregar Nota
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes list */}
      {caseNotes.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No hay notas en este caso</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {caseNotes.map(note => {
            const isDeleted = note.deleted;
            const isAuthor = note.createdBy?.id === userId;
            const role = note.createdBy?.role || 'advisor';
            const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.advisor;
            const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <Card key={note.id} className={`border shadow-sm ${isDeleted ? 'bg-red-50 border-red-200 opacity-70' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: roleStyle.bg, color: roleStyle.text }}>
                        {(note.createdBy?.name || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{note.createdBy?.name || 'Sistema'}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: roleStyle.bg, color: roleStyle.text }}>
                            {roleStyle.label}
                          </span>
                          {isDeleted && <Badge className="bg-red-100 text-red-700 text-xs">Eliminada</Badge>}
                        </div>
                        <span className="text-xs text-gray-400">{dateStr}</span>
                      </div>
                    </div>
                    {/* Delete button — only author or admin, not for already deleted */}
                    {!isDeleted && (isAuthor || isAdmin) && (
                      <button onClick={() => handleDelete(note.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 opacity-40 hover:opacity-100 transition-opacity"
                        title="Eliminar nota">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                  <p className={`text-sm whitespace-pre-wrap ${isDeleted ? 'text-red-400 line-through' : 'text-gray-700'}`}>
                    {note.content}
                  </p>
                  {isDeleted && note.deletedBy && (
                    <p className="text-xs text-red-400 mt-2">
                      Eliminada por {note.deletedBy.name} el {note.deletedAt ? new Date(note.deletedAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VisaCaseDetailRedesign;
