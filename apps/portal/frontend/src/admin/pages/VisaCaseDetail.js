import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { 
  ArrowLeft, Loader2, User, Mail, Phone, Briefcase, 
  Calendar, DollarSign, Upload, Download, CheckCircle, 
  XCircle, Clock, FileText, AlertCircle, Edit, Trash2,
  ChevronsUpDown, Check, Link as LinkIcon, Copy, AlertTriangle,
  MoveRight, ArrowRight, History
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DeliverableUploadModal } from '../components/DeliverableUploadModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { CaseAuditLog } from '../components/CaseAuditLog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  'proceso_venta': 'En proceso de venta',
  'eligibility_approved': 'Elegibilidad Aprobada',
  'elegibility_approved': 'Elegibilidad Aprobada',
  'active': 'Activo',
  'in_progress': 'En Progreso',
  'ready_to_file': 'Listo para Radicar',
  'filed': 'Radicado',
  'approved': 'Aprobado',
  'denied': 'Denegado',
  'on_hold': 'En Espera',
  'en_proceso': 'En Proceso',
  'finalizado': 'Finalizado',
  'analizando': 'Analizando',
  'impreso': 'Impreso',
  'enviado': 'Enviado',
  'ioe': 'IOE',
  'devuelto': 'Devuelto',
};

const STAGE_STATUS_LABELS = {
  'locked': 'Bloqueada',
  'unlocked': 'Desbloqueada',
  'in_progress': 'En Progreso',
  'payment_pending': 'Pago Pendiente',
  'completed': 'Completada'
};

const DELIVERABLE_STATUS = {
  'draft': { label: 'BORRADOR', color: 'bg-yellow-100 text-yellow-800' },
  'unlocked': { label: 'Desbloqueado', color: 'bg-green-100 text-green-800' },
  'validated': { label: 'Validado', color: 'bg-blue-100 text-blue-800' }
};

const DOCUMENT_STATUS = {
  'pending': { label: 'Pendiente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  'uploaded': { label: 'Subido', color: 'bg-blue-100 text-blue-800', icon: FileText },
  'in_review': { label: 'En Revisión', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  'validated': { label: 'Validado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'rejected': { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle }
};

export const VisaCaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [stages, setStages] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingRoadMapPDF, setDownloadingRoadMapPDF] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deliverableToDelete, setDeliverableToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [documentToReject, setDocumentToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [editingStageAmount, setEditingStageAmount] = useState(null);
  const [newAmount, setNewAmount] = useState('');
  const [isUpdatingAmount, setIsUpdatingAmount] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [manualPayments, setManualPayments] = useState([]);
  const [magicLinks, setMagicLinks] = useState([]);
  
  // Magic link generation states
  const [generateLinkModalOpen, setGenerateLinkModalOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  
  // Eligibility Report state
  const [eligibilityReport, setEligibilityReport] = useState(null);
  const [loadingEligibilityReport, setLoadingEligibilityReport] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [uploadingEligibility, setUploadingEligibility] = useState(false);
  
  // Ruta Personalizada state
  const [rutaPersonalizada, setRutaPersonalizada] = useState(null);
  const [loadingRutaPersonalizada, setLoadingRutaPersonalizada] = useState(false);
  const [showRutaPersonalizadaModal, setShowRutaPersonalizadaModal] = useState(false);
  const [cvFileRuta, setCvFileRuta] = useState(null);
  const [uploadingRutaPersonalizada, setUploadingRutaPersonalizada] = useState(false);

  // Payment modal states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStageForPayment, setSelectedStageForPayment] = useState(null);
  const [selectedStagesForPayment, setSelectedStagesForPayment] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('fanbasis');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [registeringPayment, setRegisteringPayment] = useState(false);
  
  // Delete payment/unmark stage states
  const [deletePaymentModalOpen, setDeletePaymentModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [unmarkStageModalOpen, setUnmarkStageModalOpen] = useState(false);
  const [stageToUnmark, setStageToUnmark] = useState(null);
  const [unmarkingStage, setUnmarkingStage] = useState(false);
  
  // Edit case modal states
  const [editCaseModalOpen, setEditCaseModalOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [editFormData, setEditFormData] = useState({
    visaType: '',
    status: '',
    assignedCoordinator: '',
    assignedSalesRep: ''
  });
  const [savingCase, setSavingCase] = useState(false);
  const [coordinatorPopoverOpen, setCoordinatorPopoverOpen] = useState(false);
  const [salesRepPopoverOpen, setSalesRepPopoverOpen] = useState(false);

  // Move item modal states
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState(null); // { type: 'deliverable' | 'document', item: {...} }
  const [targetStageNumber, setTargetStageNumber] = useState('');
  const [movingItem, setMovingItem] = useState(false);

  // Helper function to copy text to clipboard with fallback
  const copyToClipboard = async (text) => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          toast.success('Link copiado al portapapeles');
          return true;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed, trying fallback:', clipboardErr);
          // Continue to fallback method
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
      
      // For iOS devices
      textArea.setSelectionRange(0, 99999);
      
      try {
        const successful = document.execCommand('copy');
        
        // Safely remove textArea with validation to prevent NotFoundError
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
        // Safely remove textArea with validation to prevent NotFoundError
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

  // Helper function to get stage name (handles both string and object {es, en})
  const getStageName = (name) => {
    if (!name) return 'Etapa';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') return name.es || name.en || 'Etapa';
    return 'Etapa';
  };

  // Calculate total paid amount from paid stages
  const totalPaidAmount = useMemo(() => {
    return stages.reduce((sum, stage) => {
      if (stage.isPaid && stage.paidAmount) {
        return sum + stage.paidAmount;
      }
      return sum;
    }, 0);
  }, [stages]);

  // Calculate last paid stage
  const lastPaidStage = useMemo(() => {
    const paidStages = stages.filter(stage => stage.isPaid).sort((a, b) => b.stageNumber - a.stageNumber);
    return paidStages.length > 0 ? paidStages[0].stageNumber : 0;
  }, [stages]);

  // Define all fetch functions BEFORE the useEffect that uses them
  const fetchCaseDetail = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/visa-cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCaseData(data.case);
      setStages(data.stages || []);
      setDeliverables(data.deliverables || []);
      setDocuments(data.documents || []);
      setPayments(data.payments || []);
      setMeetings(data.meetings || []);
    } catch (error) {
      console.error('Error fetching case:', error);
      toast.error('Error al cargar el caso');
      if (error.response?.status === 404) {
        navigate('/admin/visa-cases');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId, navigate]);

  const fetchAppointments = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/appointments?caseId=${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [caseId]);

  const fetchManualPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/payments?caseId=${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setManualPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching manual payments:', error);
    }
  }, [caseId]);

  const fetchMagicLinks = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Fetch magic links by client UUID
      if (caseData?.user?.id) {
        const { data } = await axios.get(
          `${BACKEND_URL}/api/admin/users/${caseData.user.id}/magic-links`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        setMagicLinks(data.magicLinks || []);
      }
    } catch (error) {
      console.error('Error fetching magic links:', error);
    }
  }, [caseData]);


  // Fetch Eligibility Report from N8N webhook
  const fetchEligibilityReport = async (userPhone) => {
    if (!userPhone) {
      console.log('⚠️ No phone provided for eligibility report');
      return;
    }
    
    console.log('📞 Calling N8N webhook with phone:', userPhone);
    
    try {
      setLoadingEligibilityReport(true);
      
      console.log('🚀 Making GET request to N8N webhook...');
      const response = await axios.get(
        `https://n8n.urpeailab.com/webhook/8d4b04f2-fb83-4008-bf1a-f4944446963a?phone=${encodeURIComponent(userPhone)}`
      );
      
      console.log('✅ N8N webhook response:', response.data);
      setEligibilityReport(response.data);
    } catch (error) {
      console.error('❌ Error fetching eligibility report:', error);
      console.error('Error details:', error.response?.data || error.message);
      setEligibilityReport(null);
    } finally {
      setLoadingEligibilityReport(false);
    }
  };

  // Fetch Ruta Personalizada from N8N webhook
  const fetchRutaPersonalizada = async (userPhone) => {
    if (!userPhone) {
      console.log('⚠️ No phone provided for ruta personalizada');
      return;
    }
    
    console.log('📞 Calling N8N webhook for ruta personalizada with phone:', userPhone);
    
    try {
      setLoadingRutaPersonalizada(true);
      
      console.log('🚀 Making GET request to N8N webhook for ruta personalizada...');
      const response = await axios.get(
        `https://n8n.urpeailab.com/webhook/8d4b04f2-fb83-4008-bf1a-f4944446963a7?phone=${encodeURIComponent(userPhone)}`
      );
      
      console.log('✅ N8N ruta personalizada response:', response.data);
      setRutaPersonalizada(response.data);
    } catch (error) {
      console.error('❌ Error fetching ruta personalizada:', error);
      console.error('Error details:', error.response?.data || error.message);
      setRutaPersonalizada(null);
    } finally {
      setLoadingRutaPersonalizada(false);
    }
  };

  // Create Eligibility Report
  const handleCreateEligibilityReport = async () => {
    console.log('🔵🔵🔵 START handleCreateEligibilityReport 🔵🔵🔵');
    console.log('cvFile state:', cvFile);
    console.log('caseData state:', caseData);
    console.log('uploadingEligibility state:', uploadingEligibility);
    
    if (!cvFile) {
      console.log('❌ No CV file selected');
      toast.error('Por favor selecciona un archivo CV');
      return;
    }
    
    console.log('✅ cvFile is present:', cvFile.name, 'Size:', cvFile.size);

    if (!caseData?.user?.phone) {
      console.log('❌ No user phone found');
      toast.error('No se puede crear el reporte: usuario sin teléfono');
      return;
    }

    try {
      console.log('🟢 Setting uploadingEligibility to true');
      setUploadingEligibility(true);

      // Upload CV file to Supabase Storage
      const formData = new FormData();
      formData.append('file', cvFile);
      formData.append('documentType', 'cv');

      const token = localStorage.getItem('admin_token');
      console.log('🔑 Token exists:', !!token);
      
      console.log('📤 [STEP 1/3] Uploading CV file to Supabase...');
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

      console.log('✅ [STEP 1/3] Upload successful:', uploadResponse.data);
      const cvUrl = uploadResponse.data.publicUrl || uploadResponse.data.fileUrl || uploadResponse.data.url;
      
      if (!cvUrl) {
        console.error('❌ No URL found in upload response:', uploadResponse.data);
        throw new Error('No se obtuvo URL del CV subido');
      }
      
      console.log('📎 CV URL extracted:', cvUrl);

      // Validate caseData structure
      console.log('🔍 Validating caseData structure...');
      console.log('caseData:', caseData);
      
      if (!caseData) {
        console.error('❌ caseData is undefined');
        throw new Error('No se encontraron datos del caso');
      }
      
      if (!caseData.user) {
        console.error('❌ caseData.user is undefined');
        throw new Error('No se encontraron datos del usuario');
      }

      // Call backend endpoint to create eligibility report
      // Backend will call N8N webhook (avoiding CORS issues)
      // Note: caseData is the case object itself, which contains the user info
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

      console.log('🚀 [STEP 2/3] Calling backend to create eligibility report...');
      console.log('📋 Request data:', JSON.stringify(reportRequest, null, 2));
      
      console.log('⏳ [STEP 2/3] Sending request to backend NOW...');
      const reportResponse = await axios.post(
        `${BACKEND_URL}/api/eligibility/create-report`,
        reportRequest,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ [STEP 2/3] Backend call completed!');
      console.log('📊 Response status:', reportResponse.status);
      console.log('📊 Response data:', reportResponse.data);
      
      console.log('🎉 [STEP 3/3] Showing success message');
      toast.success('Reporte de elegibilidad creado exitosamente');
      setShowEligibilityModal(false);
      setCvFile(null);
      
      // Refresh eligibility report status
      console.log('🔄 Scheduling refresh in 2 seconds...');
      setTimeout(() => {
        console.log('🔄 Refreshing eligibility report...');
        fetchEligibilityReport(caseData.user.phone);
      }, 2000);

      console.log('✅ handleCreateEligibilityReport COMPLETED SUCCESSFULLY');

    } catch (error) {
      console.error('❌❌❌ ERROR in handleCreateEligibilityReport:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error stack:', error.stack);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Error al crear el reporte de elegibilidad';
      toast.error(errorMessage);
    } finally {
      console.log('🔵 FINALLY: Setting uploadingEligibility to false');
      setUploadingEligibility(false);
    }
  };

  // Create Ruta Personalizada
  const handleCreateRutaPersonalizada = async () => {
    console.log('🔵🔵🔵 START handleCreateRutaPersonalizada 🔵🔵🔵');
    console.log('cvFileRuta state:', cvFileRuta);
    console.log('caseData state:', caseData);
    console.log('uploadingRutaPersonalizada state:', uploadingRutaPersonalizada);
    
    if (!cvFileRuta) {
      console.log('❌ No CV file selected');
      toast.error('Por favor selecciona un archivo CV');
      return;
    }
    
    console.log('✅ cvFileRuta is present:', cvFileRuta.name, 'Size:', cvFileRuta.size);

    if (!caseData?.user?.phone) {
      console.log('❌ No user phone found');
      toast.error('No se puede crear la ruta personalizada: usuario sin teléfono');
      return;
    }

    try {
      console.log('🟢 Setting uploadingRutaPersonalizada to true');
      setUploadingRutaPersonalizada(true);

      // Upload CV file to Supabase Storage
      const formData = new FormData();
      formData.append('file', cvFileRuta);
      formData.append('documentType', 'cv');

      const token = localStorage.getItem('admin_token');
      console.log('🔑 Token exists:', !!token);
      
      console.log('📤 [STEP 1/3] Uploading CV file to Supabase...');
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

      console.log('✅ [STEP 1/3] Upload successful:', uploadResponse.data);
      const cvUrl = uploadResponse.data.publicUrl || uploadResponse.data.fileUrl || uploadResponse.data.url;
      
      if (!cvUrl) {
        console.error('❌ No URL found in upload response:', uploadResponse.data);
        throw new Error('No se obtuvo URL del CV subido');
      }
      
      console.log('📎 CV URL extracted:', cvUrl);

      // Prepare data for N8N webhook
      const rutaData = {
        phone: caseData.user.phone,
        name: caseData.user.name || 'Usuario sin nombre',
        email: caseData.user.email || '',
        cvUrl: cvUrl,
        userState: caseData.user.userState || 'U1',
        caseId: caseData.id || caseData._id,
        visaType: caseData.visaType || 'EB-2 NIW'
      };

      console.log('🚀 [STEP 2/3] Calling N8N webhook to create ruta personalizada...');
      console.log('📋 Request data:', JSON.stringify(rutaData, null, 2));
      
      // Call N8N webhook directly
      const response = await axios.post(
        'https://n8n.urpeailab.com/webhook/3198544c-d830-4e81-b71d-54fceb5ab9f16',
        rutaData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ [STEP 2/3] N8N webhook call completed!');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', response.data);
      
      console.log('🎉 [STEP 3/3] Showing success message');
      toast.success('Ruta Personalizada creada exitosamente');
      setShowRutaPersonalizadaModal(false);
      setCvFileRuta(null);
      
      // Refresh ruta personalizada status
      console.log('🔄 Scheduling refresh in 2 seconds...');
      setTimeout(() => {
        console.log('🔄 Refreshing ruta personalizada...');
        fetchRutaPersonalizada(caseData.user.phone);
      }, 2000);

      console.log('✅ handleCreateRutaPersonalizada COMPLETED SUCCESSFULLY');

    } catch (error) {
      console.error('❌❌❌ ERROR in handleCreateRutaPersonalizada:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error stack:', error.stack);
      
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Error al crear la ruta personalizada';
      toast.error(errorMessage);
    } finally {
      console.log('🔵 FINALLY: Setting uploadingRutaPersonalizada to false');
      setUploadingRutaPersonalizada(false);
    }
  };

  const handleGenerateNewLink = async () => {
    if (!caseData?.user?.phone) {
      toast.error('No se puede generar link: usuario sin teléfono');
      return;
    }

    setGeneratingLink(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        toast.error('No se encontró el token de autenticación. Por favor, inicia sesión nuevamente.');
        setGeneratingLink(false);
        return;
      }
      
      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/users/${caseData.user.id}/generate-magic-link`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (data.success) {
        toast.success('Nuevo link de acceso generado exitosamente');
        // Refresh magic links list
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


  // Now the useEffect can safely use the functions as dependencies
  useEffect(() => {
    fetchCaseDetail();
    fetchAppointments();
    fetchManualPayments();
  }, [fetchCaseDetail, fetchAppointments, fetchManualPayments]);

  // Fetch magic links when caseData is available
  useEffect(() => {
    if (caseData?.user?.phone) {
      fetchMagicLinks();
    }
  }, [caseData, fetchMagicLinks]);
  
  // Fetch eligibility report separately
  useEffect(() => {
    if (caseData?.user?.phone) {
      console.log('🔍 Fetching eligibility report for phone:', caseData.user.phone);
      fetchEligibilityReport(caseData.user.phone);
    }
  }, [caseData?.user?.phone]);

  // Fetch ruta personalizada separately
  useEffect(() => {
    if (caseData?.user?.phone) {
      console.log('🔍 Fetching ruta personalizada for phone:', caseData.user.phone);
      fetchRutaPersonalizada(caseData.user.phone);
    }
  }, [caseData?.user?.phone]);

  const handleUploadComplete = () => {
    fetchCaseDetail();
    setUploadModalOpen(false);
    setSelectedDeliverable(null);
  };

  const startEditingAmount = (stage) => {
    if (stage.isPaid) {
      toast.error('No se puede modificar el monto de una etapa ya pagada');
      return;
    }
    setEditingStageAmount(stage.stageNumber);
    // Set current amount with 2 decimal places as default
    setNewAmount(stage.amount ? stage.amount.toFixed(2) : '0.00');
  };

  const cancelEditingAmount = () => {
    setEditingStageAmount(null);
    setNewAmount('');
  };

  const saveStageAmount = async (stageNumber) => {
    try {
      const amount = parseFloat(newAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('Por favor ingresa un monto válido mayor a 0');
        return;
      }

      setIsUpdatingAmount(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.patch(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}/stages/${stageNumber}/amount`,
        { amount },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Monto actualizado exitosamente');
      setEditingStageAmount(null);
      setNewAmount('');
      fetchCaseDetail();
    } catch (error) {
      console.error('Error updating amount:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el monto');
    } finally {
      setIsUpdatingAmount(false);
    }
  };

  const openUploadModal = (deliverable) => {
    setSelectedDeliverable(deliverable);
    setUploadModalOpen(true);
  };

  const openDeleteModal = (deliverable) => {
    setDeliverableToDelete(deliverable);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setDeliverableToDelete(null);
    }
  };

  const confirmDeleteDeliverableFile = async () => {
    if (!deliverableToDelete) return;

    try {
      setIsDeleting(true);
      const token = localStorage.getItem('admin_token');
      await axios.delete(
        `${BACKEND_URL}/api/admin/deliverables/${deliverableToDelete._id || deliverableToDelete.id}/file`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Archivo eliminado exitosamente');
      setDeleteModalOpen(false);
      setDeliverableToDelete(null);
      fetchCaseDetail(); // Refrescar los datos
    } catch (error) {
      console.error('Error deleting deliverable file:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar el archivo');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete a single file from a deliverable's files array
  const handleDeleteSingleFile = async (deliverableId, fileId) => {
    if (!window.confirm('¿Estás seguro de eliminar este archivo?')) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(
        `${BACKEND_URL}/api/admin/deliverables/${deliverableId}/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Archivo eliminado');
      fetchCaseDetail(); // Refresh data
    } catch (error) {
      console.error('Error deleting single file:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar el archivo');
    }
  };

  const handleValidateDocument = async (documentId) => {
    try {
      const token = localStorage.getItem('admin_token');
      
      await axios.put(
        `${BACKEND_URL}/api/admin/client-documents/${documentId}/validate`,
        { validationNotes: '' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Documento validado exitosamente');
      fetchCaseDetail(); // Refresh data
    } catch (error) {
      console.error('Error validating document:', error);
      toast.error(error.response?.data?.detail || 'Error al validar el documento');
    }
  };

  const openRejectModal = (doc) => {
    setDocumentToReject(doc);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setDocumentToReject(null);
    setRejectionReason('');
  };

  const handleRejectDocument = async () => {
    if (!rejectionReason || rejectionReason.trim() === '') {
      toast.error('Debes proporcionar una razón para rechazar el documento');
      return;
    }

    try {
      setIsRejecting(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.put(
        `${BACKEND_URL}/api/admin/client-documents/${documentToReject._id || documentToReject.id}/reject`,
        { rejectionReason: rejectionReason.trim() },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Documento rechazado');
      closeRejectModal();
      fetchCaseDetail(); // Refresh data
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast.error(error.response?.data?.detail || 'Error al rechazar el documento');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) return null;

    try {
      setUploadingReceipt(true);
      const token = localStorage.getItem('admin_token');
      
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('documentType', 'receipt');

      const { data } = await axios.post(
        `${BACKEND_URL}/api/storage/upload`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('Error al subir el comprobante');
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (selectedStagesForPayment.length === 0) {
      toast.error('Por favor selecciona al menos una etapa');
      return;
    }

    try {
      setRegisteringPayment(true);
      const token = localStorage.getItem('admin_token');

      // Upload receipt if provided
      let receiptUrl = null;
      if (receiptFile) {
        receiptUrl = await handleUploadReceipt();
        if (!receiptUrl) {
          toast.error('Error al subir el comprobante. Intenta nuevamente.');
          return;
        }
      }

      const payload = {
        caseId: caseId,
        stageNumbers: selectedStagesForPayment, // Array de números de etapa
        amount: parseFloat(paymentAmount),
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        reference: paymentReference.trim() || null,
        receiptUrl: receiptUrl,
        notes: paymentNotes.trim() || null
      };

      const { data } = await axios.post(
        `${BACKEND_URL}/api/admin/payments/register-multiple`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        const stageCount = selectedStagesForPayment.length;
        toast.success(`¡Pago registrado exitosamente para ${stageCount} etapa${stageCount > 1 ? 's' : ''}!`);
        toast.info('Las etapas han sido desbloqueadas automáticamente');
        
        // Reset form
        setPaymentModalOpen(false);
        setSelectedStageForPayment(null);
        setSelectedStagesForPayment([]);
        setPaymentAmount('');
        setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
        setPaymentMethod('fanbasis');
        setPaymentReference('');
        setPaymentNotes('');
        setReceiptFile(null);
        
        // Refresh case data
        fetchCaseDetail();
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

  // Delete payment function
  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    
    try {
      setDeletingPayment(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.delete(
        `${BACKEND_URL}/api/admin/payments/${paymentToDelete.id || paymentToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Pago eliminado exitosamente');
      setDeletePaymentModalOpen(false);
      setPaymentToDelete(null);
      fetchManualPayments();
      fetchCaseDetail();
    } catch (error) {
      console.error('Error deleting payment:', error);
      const errorMessage = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Error al eliminar el pago';
      toast.error(errorMessage);
    } finally {
      setDeletingPayment(false);
    }
  };

  // Unmark stage as paid function
  const handleUnmarkStageAsPaid = async () => {
    if (!stageToUnmark) return;
    
    try {
      setUnmarkingStage(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.post(
        `${BACKEND_URL}/api/admin/stages/${stageToUnmark._id || stageToUnmark.id}/unmark-paid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Pago de Etapa ${stageToUnmark.stageNumber} eliminado exitosamente`);
      setUnmarkStageModalOpen(false);
      setStageToUnmark(null);
      fetchCaseDetail();
    } catch (error) {
      console.error('Error unmarking stage:', error);
      const errorMessage = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Error al quitar el pago de la etapa';
      toast.error(errorMessage);
    } finally {
      setUnmarkingStage(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaffList(data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleOpenEditCaseModal = () => {
    // Pre-fill form with current case data
    setEditFormData({
      visaType: caseData?.visaType || '',
      status: caseData?.status || 'on_hold',
      assignedCoordinator: caseData?.coordinatorId || '',
      assignedSalesRep: caseData?.salesRepId || ''
    });
    fetchStaffList();
    setEditCaseModalOpen(true);
  };

  const handleSaveCase = async () => {
    try {
      setSavingCase(true);
      const token = localStorage.getItem('admin_token');
      
      const payload = {
        visaType: editFormData.visaType,
        status: editFormData.status,
        coordinatorId: editFormData.assignedCoordinator || null,
        salesRepId: editFormData.assignedSalesRep || null
      };

      await axios.put(
        `${BACKEND_URL}/api/admin/visa-cases/${caseId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Caso actualizado exitosamente');
      setEditCaseModalOpen(false);
      
      // Refresh case data
      fetchCaseDetail();
    } catch (error) {
      console.error('Error updating case:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar el caso');
    } finally {
      setSavingCase(false);
    }
  };

  // Move item handlers
  const openMoveModal = (type, item) => {
    setItemToMove({ type, item });
    setTargetStageNumber('');
    setMoveModalOpen(true);
  };

  const closeMoveModal = () => {
    if (!movingItem) {
      setMoveModalOpen(false);
      setItemToMove(null);
      setTargetStageNumber('');
    }
  };

  const handleMoveItem = async () => {
    if (!itemToMove || !targetStageNumber) {
      toast.error('Por favor selecciona una etapa destino');
      return;
    }

    const targetStage = parseInt(targetStageNumber, 10);
    if (isNaN(targetStage)) {
      toast.error('Etapa inválida');
      return;
    }

    // Don't allow moving to the same stage
    if (targetStage === itemToMove.item.stageNumber) {
      toast.error('El item ya está en esta etapa');
      return;
    }

    try {
      setMovingItem(true);
      const token = localStorage.getItem('admin_token');
      const itemId = itemToMove.item._id || itemToMove.item.id;

      if (itemToMove.type === 'deliverable') {
        await axios.post(
          `${BACKEND_URL}/api/admin/cases/${caseId}/deliverables/move`,
          { 
            deliverable_id: itemId,
            to_stage: targetStage 
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Entregable movido a Etapa ${targetStage}`);
      } else {
        await axios.post(
          `${BACKEND_URL}/api/admin/cases/${caseId}/documents/move`,
          { 
            document_id: itemId,
            to_stage: targetStage 
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Documento movido a Etapa ${targetStage}`);
      }

      closeMoveModal();
      fetchCaseDetail(); // Refresh data
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error(error.response?.data?.detail || 'Error al mover el item');
    } finally {
      setMovingItem(false);
    }
  };

  const handleDownloadEligibilityPDF = async () => {
    setDownloadingPDF(true);
    toast.info('Generando reporte de elegibilidad...');
    
    try {
      console.log('Starting PDF generation for case user...');
      console.log('User data:', caseData?.user);
      
      // Fetch complete data from n8n webhook using user's phone
      let completeData = null;
      if (caseData?.user?.phone) {
        try {
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
        } catch (err) {
          console.error('Error fetching calculator data for PDF:', err);
          toast.error('Error al obtener datos del webhook');
        }
      } else {
        toast.error('No se encontró el teléfono del usuario');
        setDownloadingPDF(false);
        return;
      }

      // Check if we have data
      if (!completeData) {
        toast.error('No hay datos disponibles para generar el reporte.');
        setDownloadingPDF(false);
        return;
      }

      // Merge data
      const mergedData = {
        ...completeData,
        nombreCompleto: caseData?.user?.name || completeData?.nombreCompleto,
      };

      console.log('=== PDF DATA DEBUG ===');
      console.log('Merged data for PDF:', mergedData);
      
      // Use comprehensive PDF generator
      const { generateCompletePDF } = await import('../../utils/completePdfGenerator');
      const result = generateCompletePDF(mergedData, caseData?.user);
      
      if (result.success) {
        toast.success(result.message || 'Reporte completo descargado exitosamente');
      } else {
        toast.error(result.message || 'Error al descargar el reporte');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      console.error('Error details:', error.message, error.stack);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadRoadMapPDF = async () => {
    setDownloadingRoadMapPDF(true);
    toast.info('Generando PDF de ruta personalizada...');
    
    try {
      console.log('Starting RoadMap PDF generation for case user...');
      
      // Fetch roadmap data from webhook using user's phone
      let roadMapData = null;
      if (caseData?.user?.phone) {
        try {
          const response = await axios.post(
            'https://n8n.urpeailab.com/webhook/road-map',
            { telefono: caseData.user.phone },
            { timeout: 45000 }
          );

          if (response.data) {
            let parsedData;
            
            // The response has a 'data' field which is a JSON string
            if (response.data.data && typeof response.data.data === 'string') {
              parsedData = JSON.parse(response.data.data);
              // Extract roadmap_servicios from the parsed data
              if (parsedData.roadmap_servicios) {
                roadMapData = parsedData.roadmap_servicios;
              }
            } else if (Array.isArray(response.data)) {
              parsedData = response.data;
              roadMapData = parsedData;
            } else if (response.data.roadmap_servicios) {
              roadMapData = response.data.roadmap_servicios;
            }
          }
        } catch (err) {
          console.error('Error fetching roadmap data for PDF:', err);
          toast.error('Error al obtener datos de ruta personalizada');
        }
      } else {
        toast.error('No se encontró el teléfono del usuario');
        setDownloadingRoadMapPDF(false);
        return;
      }

      if (!roadMapData || roadMapData.length === 0) {
        toast.error('No hay datos de ruta personalizada para descargar');
        setDownloadingRoadMapPDF(false);
        return;
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        compress: true,
        unit: 'mm',
        format: 'a4'
      });

      // Helper function to properly encode text for PDF
      const encodeText = (text) => {
        if (!text) return '';
        return text
          .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
          .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
          .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
          .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N')
          .replace(/ü/g, 'u').replace(/Ü/g, 'U')
          .replace(/¿/g, '').replace(/¡/g, '')
          .replace(/–/g, '-').replace(/—/g, '-')
          .replace(/"/g, '"').replace(/"/g, '"')
          .replace(/'/g, "'").replace(/'/g, "'");
      };

      // Colors
      const primaryColor = '#F59E0B'; // Yellow
      const secondaryColor = '#1F2937'; // Dark gray
      const accentColor = '#10B981'; // Green
      
      // Header
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(encodeText('Tu Ruta Personalizada'), 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(encodeText('Servicios recomendados para maximizar tu exito'), 105, 30, { align: 'center' });
      
      let yPos = 50;
      
      // Services
      roadMapData.forEach((service, index) => {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        // Service card background
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(10, yPos, 190, 45, 3, 3, 'F');
        
        // Service number badge
        doc.setFillColor(245, 158, 11);
        doc.circle(20, yPos + 10, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text((index + 1).toString(), 20, yPos + 12, { align: 'center' });
        
        // Service name
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(encodeText(service.servicio || ''), 30, yPos + 12);
        
        // Description
        doc.setTextColor(75, 85, 99);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(encodeText(service.descripcion || ''), 170);
        doc.text(descLines, 15, yPos + 22);
        
        yPos += 50;
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 287, 210, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(`Pagina ${i} de ${pageCount}`, 105, 293, { align: 'center' });
      }
      
      // Download
      const userName = caseData?.user?.name || 'Usuario';
      const fileName = `Ruta_Personalizada_${userName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      
      toast.success('Ruta personalizada descargada exitosamente');
    } catch (error) {
      console.error('RoadMap PDF generation error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingRoadMapPDF(false);
    }
  };

  const getStageDeliverables = (stageNumber) => {
    return deliverables.filter(d => d.stageNumber === stageNumber);
  };

  const getStageDocuments = (stageNumber) => {
    return documents.filter(d => d.stageNumber === stageNumber);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Caso no encontrado</p>
        <Button onClick={() => navigate('/admin/visa-cases')} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/visa-cases')}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <div className="mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {caseData.user?.name || 'Cliente'}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-yellow-500 text-black">
                  {caseData.visaType}
                </Badge>
                <select
                  data-testid="case-status-select"
                  value={caseData.status || 'proceso_venta'}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    try {
                      const t = localStorage.getItem('admin_token');
                      await axios.put(`${BACKEND_URL}/api/admin/visa-cases/${caseId}`, { status: newStatus }, { headers: { Authorization: `Bearer ${t}` } });
                      setCaseData(prev => ({ ...prev, status: newStatus }));
                      toast.success(`Estado cambiado a: ${STATUS_LABELS[newStatus] || newStatus}`);
                    } catch (err) { toast.error('Error al cambiar estado'); }
                  }}
                  className="h-7 px-2 rounded-full text-xs font-semibold border border-gray-300 outline-none cursor-pointer"
                  style={{ color: '#374151', background: '#F3F4F6' }}
                >
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'eligibility_approved').map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {caseData.user?.userState && (
                  <Badge 
                    className={
                      caseData.user.userState === 'U1' 
                        ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                        : 'bg-green-100 text-green-800 border border-green-300'
                    }
                  >
                    {caseData.user.userState === 'U1' ? '👤 Visitante (U1)' : '✅ Registrado (U3)'}
                  </Badge>
                )}
                {/* Eligibility Report Status */}
                {loadingEligibilityReport ? (
                  <Badge className="bg-gray-100 text-gray-600 border border-gray-300">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Verificando elegibilidad...
                  </Badge>
                ) : eligibilityReport ? (
                  eligibilityReport.has_report === true ? (
                    <Badge className="bg-green-100 text-green-800 border border-green-300">
                      ✅ Reporte de Elegibilidad Completo
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setShowEligibilityModal(true)}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Crear Reporte de Elegibilidad
                    </Button>
                  )
                ) : null}
                
                {/* Ruta Personalizada Status */}
                {loadingRutaPersonalizada ? (
                  <Badge className="bg-gray-100 text-gray-600 border border-gray-300">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Verificando ruta personalizada...
                  </Badge>
                ) : rutaPersonalizada ? (
                  rutaPersonalizada.has_report === true ? (
                    <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                      ✅ Ruta Personalizada Completa
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setShowRutaPersonalizadaModal(true)}
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Crear Ruta Personalizada
                    </Button>
                  )
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="break-all">{caseData.user?.email}</span>
              </div>
              {caseData.user?.phone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>{caseData.user.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
          onClick={handleOpenEditCaseModal}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editar Caso
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Progreso General</p>
                <p className="text-2xl font-bold text-gray-900">{caseData.overallProgress}%</p>
              </div>
              <Briefcase className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all"
                style={{ width: `${caseData.overallProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Última Etapa Pagada</p>
                <p className="text-2xl font-bold text-gray-900">{lastPaidStage} de {stages.length}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-yellow-600">{lastPaidStage}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monto Pagado</p>
                <p className="text-2xl font-bold text-success">
                  ${totalPaidAmount.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-success" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              de ${caseData?.totalFee?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Coordinadora</p>
                <p className="text-lg font-semibold text-gray-900">
                  {caseData.coordinator?.name || 'No asignada'}
                </p>
              </div>
              <User className="h-8 w-8 text-blue-500" />
            </div>
            {caseData.coordinator?.email && (
              <p className="text-xs text-gray-500 mt-1">{caseData.coordinator.email}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vendedora</p>
                <p className="text-lg font-semibold text-gray-900">
                  {caseData.salesRep?.name || 'No asignada'}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-500" />
            </div>
            {caseData.salesRep?.email && (
              <p className="text-xs text-gray-500 mt-1">{caseData.salesRep.email}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sections Container */}
      <div className="mt-6">
        <Accordion type="multiple" defaultValue={["etapas", "citas", "pagos", "links"]} className="space-y-4">
          
          {/* Etapas del Proceso Section */}
          <AccordionItem value="etapas" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Etapas del Proceso</h3>
                  <p className="text-sm text-gray-600">{stages.length} etapas en total</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">
                {/* Detalles completos de todas las etapas */}
                <Accordion type="single" collapsible className="space-y-3">
                    {stages.map((stage) => (
                      <AccordionItem key={stage.stageNumber} value={`stage-${stage.stageNumber}`} className="border rounded-lg">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-semibold text-lg text-gray-900">Etapa {stage.stageNumber}</span>
                              <span className="text-sm text-gray-600">({stage.percentage}%)</span>
                              {stage.isPaid && (
                                <Badge className="bg-success text-white text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Pagado
                                </Badge>
                              )}
                              
                              {/* Entregables pendientes */}
                              {stage.totalDeliverables - stage.deliverablesCompleted > 0 && (
                                <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50 text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {stage.totalDeliverables - stage.deliverablesCompleted} entregable{stage.totalDeliverables - stage.deliverablesCompleted !== 1 ? 's' : ''} pendiente{stage.totalDeliverables - stage.deliverablesCompleted !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="px-4 pb-4 space-y-6">
                          {/* Stage Info */}
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Estado</p>
                        <p className="font-semibold text-gray-900">
                          {STAGE_STATUS_LABELS[stage.status]}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Monto</p>
                        {editingStageAmount === stage.stageNumber ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-28 pl-5 pr-2 py-1 border border-blue-500 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                                disabled={isUpdatingAmount}
                                autoFocus
                              />
                            </div>
                            <button
                              onClick={() => saveStageAmount(stage.stageNumber)}
                              disabled={isUpdatingAmount}
                              className="text-success hover:text-green-700 disabled:text-gray-400"
                              title="Guardar"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEditingAmount}
                              disabled={isUpdatingAmount}
                              className="text-red-600 hover:text-red-700 disabled:text-gray-400"
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">${stage.amount?.toFixed(2)}</p>
                            {!stage.isPaid && (
                              <button
                                onClick={() => startEditingAmount(stage)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Editar monto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Entregables</p>
                        <p className="font-semibold text-gray-900">
                          {stage.deliverablesCompleted}/{stage.totalDeliverables}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pago</p>
                        <div className="flex items-center gap-2">
                          {stage.amount === 0 ? (
                            <Badge className="bg-gray-500 text-white">
                              Sin costo
                            </Badge>
                          ) : stage.isPaid ? (
                            <Badge className="bg-success text-white">
                              Pagado
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 text-white">
                              Pendiente
                            </Badge>
                          )}
                          {!stage.isPaid && stage.amount > 0 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedStageForPayment(stage);
                                setSelectedStagesForPayment([stage.stageNumber]);
                                setPaymentAmount(stage.amount?.toString() || '');
                                setPaymentModalOpen(true);
                              }}
                              className="bg-success hover:bg-green-700 text-white"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Registrar Pago
                            </Button>
                          )}
                          {stage.isPaid && stage.amount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setStageToUnmark(stage);
                                setUnmarkStageModalOpen(true);
                              }}
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                              data-testid={`unmark-stage-${stage.stageNumber}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Quitar Pago
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Entregables de la Etapa {stage.stageNumber}
                    </h3>
                    <div className="space-y-3">
                      {getStageDeliverables(stage.stageNumber).length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          No hay entregables para esta etapa
                        </p>
                      ) : (
                        getStageDeliverables(stage.stageNumber).map((deliverable) => (
                          <div
                            key={deliverable._id || deliverable.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="font-semibold text-gray-900">
                                    {deliverable.deliverableName || deliverable.name?.es || deliverable.name?.en || deliverable.name || 'Sin nombre'}
                                  </h4>
                                  <Badge className={DELIVERABLE_STATUS[deliverable.status]?.color}>
                                    {DELIVERABLE_STATUS[deliverable.status]?.label}
                                  </Badge>
                                  {/* Show file count if multiple files */}
                                  {(deliverable.files?.length > 1 || (deliverable.files?.length === 1 && !deliverable.files[0]?.id?.startsWith('legacy'))) && (
                                    <Badge className="bg-blue-100 text-blue-800">
                                      {deliverable.files?.length || 0} archivo(s)
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {deliverable.description?.es || deliverable.description?.en || deliverable.description || ''}
                                </p>
                                
                                {/* Files list for deliverables with multiple files */}
                                {(() => {
                                  const delFiles = deliverable.files?.length > 0 
                                    ? deliverable.files 
                                    : deliverable.fileUrl 
                                      ? [{ id: 'legacy', fileName: deliverable.fileName || 'Archivo', fileUrl: deliverable.fileUrl }]
                                      : [];
                                  
                                  if (delFiles.length > 0) {
                                    return (
                                      <div className="mt-3 space-y-2">
                                        {delFiles.map((file, index) => (
                                          <div 
                                            key={file.id || index}
                                            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                              <span className="text-sm text-gray-700 truncate">
                                                {file.fileName || `Archivo ${index + 1}`}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open(file.fileUrl, '_blank')}
                                                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                              >
                                                <Download className="h-3.5 w-3.5" />
                                              </Button>
                                              {file.id !== 'legacy' && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => handleDeleteSingleFile(deliverable._id || deliverable.id, file.id)}
                                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex space-x-2 ml-4">
                                {(() => {
                                  const deliverableName = deliverable.deliverableName || deliverable.name?.es || deliverable.name?.en || deliverable.name || '';
                                  const isEligibilityReport = typeof deliverableName === 'string' && (deliverableName.includes('Reporte de Elegibilidad') || 
                                                             deliverableName.includes('Análisis detallado'));
                                  const isRoadmap = typeof deliverableName === 'string' && (deliverableName.includes('Ruta Personalizada') || 
                                                   deliverableName.includes('Plan estratégico'));
                                  
                                  if (isEligibilityReport) {
                                    // Botón de descarga de reporte de elegibilidad
                                    return (
                                      <Button
                                        size="sm"
                                        onClick={handleDownloadEligibilityPDF}
                                        disabled={downloadingPDF}
                                        className="bg-success hover:bg-success text-white"
                                      >
                                        <Download className="h-4 w-4 mr-1" />
                                        {downloadingPDF ? 'Generando...' : 'Descargar'}
                                      </Button>
                                    );
                                  } else if (isRoadmap) {
                                    // Ruta personalizada - botón de descarga verde
                                    return (
                                      <Button
                                        size="sm"
                                        onClick={handleDownloadRoadMapPDF}
                                        disabled={downloadingRoadMapPDF}
                                        className="bg-success hover:bg-success text-white"
                                      >
                                        <Download className="h-4 w-4 mr-1" />
                                        {downloadingRoadMapPDF ? 'Generando...' : 'Descargar'}
                                      </Button>
                                    );
                                  } else {
                                    // Entregables normales: botones de subir archivo y mover
                                    return (
                                      <>
                                        <Button
                                          size="sm"
                                          className="bg-yellow-500 hover:bg-yellow-600 text-black"
                                          onClick={() => openUploadModal(deliverable)}
                                        >
                                          <Upload className="h-4 w-4 mr-1" />
                                          {(deliverable.files?.length > 0 || deliverable.fileUrl) ? 'Agregar' : 'Subir'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openMoveModal('deliverable', deliverable)}
                                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                          title="Mover a otra etapa"
                                          data-testid={`move-deliverable-${deliverable._id || deliverable.id}`}
                                        >
                                          <MoveRight className="h-4 w-4" />
                                        </Button>
                                      </>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Client Documents */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Documentos del Cliente
                    </h3>
                    <div className="space-y-3">
                      {getStageDocuments(stage.stageNumber).length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          No hay documentos requeridos para esta etapa
                        </p>
                      ) : (
                        getStageDocuments(stage.stageNumber).map((doc) => {
                          const statusInfo = DOCUMENT_STATUS[doc.status];
                          const StatusIcon = statusInfo?.icon || FileText;
                          
                          // Get files array (with backward compatibility for single fileUrl)
                          const docFiles = doc.files?.length > 0 
                            ? doc.files 
                            : doc.fileUrl 
                              ? [{ id: 'legacy', fileName: doc.fileName || 'Archivo', fileUrl: doc.fileUrl }]
                              : [];
                          
                          return (
                            <div
                              key={doc._id || doc.id}
                              className="border border-gray-200 rounded-lg p-4 bg-white"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <StatusIcon className="h-5 w-5 text-gray-600" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">
                                        {doc.documentName || doc.name?.es || doc.name?.en || doc.name || 'Sin nombre'}
                                      </p>
                                      {docFiles.length > 1 && (
                                        <Badge className="bg-blue-100 text-blue-800">
                                          {docFiles.length} archivo(s)
                                        </Badge>
                                      )}
                                    </div>
                                    {doc.requiresPhysicalCopy && (
                                      <p className="text-xs text-orange-600">
                                        📮 Requiere envío físico por correo
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge className={statusInfo?.color}>
                                    {statusInfo?.label}
                                  </Badge>
                                  {/* Validar/Rechazar buttons for uploaded documents */}
                                  {doc.status === 'uploaded' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleValidateDocument(doc._id || doc.id)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white"
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Validar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => openRejectModal(doc)}
                                        className="bg-red-500 hover:bg-red-600 text-white"
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Rechazar
                                      </Button>
                                    </>
                                  )}
                                  {/* Move document button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openMoveModal('document', doc)}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                    title="Mover a otra etapa"
                                    data-testid={`move-document-${doc._id || doc.id}`}
                                  >
                                    <MoveRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Files list for documents */}
                              {docFiles.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {docFiles.map((file, index) => (
                                    <div 
                                      key={file.id || index}
                                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                                    >
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
                                        className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Mostrar texto enviado si es documento tipo text */}
                              {doc.type === 'text' && doc.textValue && (
                                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                  <p className="text-xs text-gray-500 mb-1 font-medium">Información enviada:</p>
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{doc.textValue}</p>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Citas Agendadas Section */}
          <AccordionItem value="citas" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Citas Agendadas</h3>
                  <p className="text-sm text-gray-600">{appointments.length} cita{appointments.length !== 1 ? 's' : ''}</p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/admin/appointments');
                  }}
                  variant="outline"
                  size="sm"
                  className="mr-4 border-blue-500 text-blue-700 hover:bg-blue-50"
                >
                  Ver Todas las Citas
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">

                {appointments.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No hay citas para este caso</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appointment) => (
                      <Card key={appointment.id} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={
                                  appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                  appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {appointment.status === 'pending' ? 'Pendiente' :
                                   appointment.status === 'confirmed' ? 'Confirmada' :
                                   appointment.status === 'completed' ? 'Completada' : 'Cancelada'}
                                </Badge>
                                <span className="text-sm font-semibold text-gray-700">
                                  {getStageName(appointment.stageName)}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-600">Fecha Propuesta:</p>
                                  <p className="font-medium text-gray-900">
                                    {new Date(appointment.proposedDate).toLocaleString('es', { 
                                      dateStyle: 'medium', 
                                      timeStyle: 'short' 
                                    })}
                                  </p>
                                </div>
                                
                                {appointment.confirmedDate && (
                                  <div>
                                    <p className="text-gray-600">Fecha Confirmada:</p>
                                    <p className="font-medium text-blue-600">
                                      {new Date(appointment.confirmedDate).toLocaleString('es', { 
                                        dateStyle: 'medium', 
                                        timeStyle: 'short' 
                                      })}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {appointment.meetingLink && (
                                <div className="mt-2">
                                  <a
                                    href={appointment.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Calendar className="h-4 w-4" />
                                    Link de Reunión
                                  </a>
                                </div>
                              )}

                              {appointment.clientNotes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                  <p className="text-gray-600 font-medium">Notas del Cliente:</p>
                                  <p className="text-gray-900">{appointment.clientNotes}</p>
                                </div>
                              )}
                            </div>

                            <div className="ml-4">
                              <p className="text-sm text-gray-600">Monto:</p>
                              <p className="text-lg font-bold text-success">
                                ${appointment.stageAmount?.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pagos Registrados Section */}
          <AccordionItem value="pagos" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-success to-success flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Pagos Registrados</h3>
                  <p className="text-sm text-gray-600">{manualPayments.length} pago{manualPayments.length !== 1 ? 's' : ''} registrado{manualPayments.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">

                {manualPayments.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">No hay pagos registrados para este caso</p>
                    <p className="text-sm text-gray-400">Para registrar un pago, selecciona una o más etapas en la sección de Etapas del Caso</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {manualPayments.map((payment) => (
                      <Card key={payment.id} className="border-2 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-5 w-5 text-success" />
                                <div className="flex flex-col">
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
                                      getStageName(payment.stageName)
                                    )}
                                  </span>
                                  {payment.stageNumbers && payment.stageNumbers.length > 1 && (
                                    <span className="text-xs text-gray-600">
                                      {payment.stageNumbers.length} etapas pagadas con esta factura
                                    </span>
                                  )}
                                </div>
                                <Badge className="bg-blue-100 text-blue-800">
                                  {payment.paymentMethod === 'cash' ? 'Efectivo' :
                                   payment.paymentMethod === 'transfer' ? 'Transferencia' :
                                   payment.paymentMethod === 'fanbasis' ? 'Fanbasis' :
                                   payment.paymentMethod === 'wire' ? 'Wire' :
                                   payment.paymentMethod === 'check' ? 'Cheque' : 'Otro'}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-600">Fecha de Pago:</p>
                                  <p className="font-medium text-gray-900">
                                    {new Date(payment.paymentDate).toLocaleDateString('es', { 
                                      dateStyle: 'long'
                                    })}
                                  </p>
                                </div>
                                
                                {payment.reference && (
                                  <div>
                                    <p className="text-gray-600">Referencia:</p>
                                    <p className="font-mono text-sm text-gray-900">{payment.reference}</p>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 text-sm">
                                <p className="text-gray-600">Registrado por:</p>
                                <p className="font-medium text-gray-900">{payment.registeredByName}</p>
                              </div>

                              {payment.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                  <p className="text-gray-600 font-medium">Notas:</p>
                                  <p className="text-gray-900">{payment.notes}</p>
                                </div>
                              )}

                              {payment.receiptUrl && (
                                <div className="mt-2">
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

                            <div className="ml-4 flex flex-col items-end gap-2">
                              <div>
                                <p className="text-sm text-gray-600">Monto Pagado:</p>
                                <p className="text-2xl font-bold text-success">
                                  ${payment.amount?.toLocaleString()}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPaymentToDelete(payment);
                                  setDeletePaymentModalOpen(true);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                data-testid={`delete-payment-${payment._id || payment.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-green-900">Total Pagado:</p>
                        <p className="text-2xl font-bold text-success">
                          ${manualPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Links de Acceso Section */}
          <AccordionItem value="links" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <LinkIcon className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Links de Acceso Generados</h3>
                  <p className="text-sm text-gray-600">{magicLinks.length} link{magicLinks.length !== 1 ? 's' : ''} generado{magicLinks.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">

                {magicLinks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">No hay links de acceso generados para este usuario</p>
                    <p className="text-sm text-gray-400">Los links de acceso se generan automáticamente cuando se crea un usuario</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {magicLinks.map((link, index) => (
                      <Card 
                        key={link.magicToken} 
                        className="border-2 border-purple-200"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <LinkIcon className="h-5 w-5 text-purple-600" />
                                <span className="text-sm font-semibold text-gray-700">
                                  Link #{magicLinks.length - index}
                                </span>
                                <Badge className="bg-green-100 text-green-800">
                                  Activo
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <p className="text-gray-600">Fecha de Creación:</p>
                                  <p className="font-medium text-gray-900">
                                    {new Date(link.createdAt).toLocaleString('es', { 
                                      dateStyle: 'long',
                                      timeStyle: 'short'
                                    })}
                                  </p>
                                </div>
                                
                                <div>
                                  <p className="text-gray-600">Validez:</p>
                                  <p className="font-medium text-gray-900">{link.expiresIn}</p>
                                </div>

                                <div>
                                  <p className="text-gray-600 mb-1">URL del Link:</p>
                                  <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-gray-100 text-gray-900 p-2 rounded text-xs break-all">
                                      {link.magicLinkUrl}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(link.magicLinkUrl)}
                                      className="border-purple-300 text-purple-700 hover:bg-purple-50 flex-shrink-0"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {/* Botón y mensaje informativo - siempre visibles */}
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={() => setGenerateLinkModalOpen(true)}
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Generar Nuevo Link de Acceso
                  </Button>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-semibold mb-1">Información sobre Links de Acceso</p>
                      <p>Los links de acceso <strong>no tienen vencimiento</strong> y pueden ser utilizados múltiples veces. El usuario podrá acceder al sistema con el mismo link en cualquier momento.</p>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Historial de Auditoría Section */}
          <AccordionItem value="auditoria" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0">
                  <History className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Historial de Auditoría</h3>
                  <p className="text-sm text-gray-600">Registro de todos los cambios realizados en este caso</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <CaseAuditLog caseId={caseId} />
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* Upload Modal */}
      <DeliverableUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedDeliverable(null);
        }}
        deliverable={selectedDeliverable}
        caseId={caseId}
        onUploadComplete={handleUploadComplete}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteDeliverableFile}
        deliverableName={deliverableToDelete?.deliverableName || deliverableToDelete?.name?.es || deliverableToDelete?.name?.en || deliverableToDelete?.name || 'este entregable'}
        isDeleting={isDeleting}
      />

      {/* Reject Document Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rechazar Documento
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Documento: <span className="font-medium">{documentToReject?.documentName || documentToReject?.name?.es || documentToReject?.name?.en || 'Sin nombre'}</span>
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razón del rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                rows={4}
                placeholder="Explica por qué este documento no es válido..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
              {rejectionReason.trim() === '' && (
                <p className="text-xs text-gray-500 mt-1">
                  Este campo es obligatorio
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                onClick={closeRejectModal}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={isRejecting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejectDocument}
                className="bg-red-500 hover:bg-red-600 text-white"
                disabled={isRejecting || rejectionReason.trim() === ''}
              >
                {isRejecting ? 'Rechazando...' : 'Rechazar Documento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Registration Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <DollarSign className="h-6 w-6 text-success" />
              Registrar Pago Manual
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Selecciona una o más etapas para registrar el pago. Las etapas se desbloquearán automáticamente.
            </DialogDescription>
          </DialogHeader>

          {selectedStageForPayment && (
            <div className="space-y-4">
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
                                // Calcular monto total sugerido
                                const totalAmount = stages
                                  .filter(s => newSelection.includes(s.stageNumber))
                                  .reduce((sum, s) => sum + (s.amount || 0), 0);
                                setPaymentAmount(totalAmount.toString());
                              } else {
                                const newSelection = selectedStagesForPayment.filter(n => n !== stage.stageNumber);
                                setSelectedStagesForPayment(newSelection);
                                // Recalcular monto
                                const totalAmount = stages
                                  .filter(s => newSelection.includes(s.stageNumber))
                                  .reduce((sum, s) => sum + (s.amount || 0), 0);
                                setPaymentAmount(totalAmount.toString());
                              }
                            }}
                            className="h-4 w-4 text-success"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Etapa {stage.stageNumber}: {getStageName(stage.name)}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentAmount" className="text-gray-900 font-medium">Monto *</Label>
                  <div className="relative">
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
                    className="text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentMethod" className="text-gray-900 font-medium">Método de Pago *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="text-gray-900">
                      <SelectValue className="text-gray-900" />
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
                  <Label htmlFor="paymentReference" className="text-gray-900 font-medium">Referencia/ID Transacción *</Label>
                  <Input
                    id="paymentReference"
                    placeholder="Ej: REF-12345"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="text-gray-900"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="receiptFile" className="text-gray-900 font-medium">Comprobante de Pago (Opcional)</Label>
                <div className="mt-2">
                  <Input
                    id="receiptFile"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files[0])}
                    className="text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sube una imagen o PDF del comprobante de pago
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="paymentNotes" className="text-gray-900 font-medium">Notas</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Notas adicionales sobre este pago..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="text-gray-900"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold mb-1">Al registrar este pago:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>La etapa se desbloqueará automáticamente</li>
                      <li>El cliente podrá acceder al contenido</li>
                      <li>Las citas relacionadas se marcarán como completadas</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentModalOpen(false);
                setSelectedStageForPayment(null);
              }}
              disabled={registeringPayment || uploadingReceipt}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={selectedStagesForPayment.length === 0 || !paymentAmount || !paymentReference || registeringPayment || uploadingReceipt}
              className="bg-success hover:bg-green-700"
            >
              {registeringPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingReceipt ? 'Subiendo comprobante...' : 'Registrando...'}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Registrar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case Modal */}
      <Dialog open={editCaseModalOpen} onOpenChange={setEditCaseModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Edit className="h-6 w-6 text-blue-600" />
              Editar Caso
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Actualiza la información básica del caso y asigna un coordinador.
            </DialogDescription>
          </DialogHeader>

          {caseData && (
            <div className="space-y-4">
              {/* Case Overview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">
                  Cliente: {caseData.user?.name}
                </p>
                <p className="text-sm text-blue-700">
                  Email: {caseData.user?.email}
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
                  className="text-gray-900"
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
                  <SelectTrigger className="text-gray-900">
                    <SelectValue className="text-gray-900">
                      {editFormData.status === 'active' && 'Activo'}
                      {editFormData.status === 'pending' && 'Pendiente'}
                      {editFormData.status === 'completed' && 'Completado'}
                      {editFormData.status === 'on_hold' && 'En Espera'}
                      {editFormData.status === 'cancelled' && 'Cancelado'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="on_hold">En Espera</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned Coordinator */}
              <div>
                <Label htmlFor="coordinator" className="text-gray-900 font-medium">Coordinador Asignado</Label>
                <Popover open={coordinatorPopoverOpen} onOpenChange={setCoordinatorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={coordinatorPopoverOpen}
                      className="w-full justify-between border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      {editFormData.assignedCoordinator ? (
                        (() => {
                          const coordinator = staffList.find(s => s._id === editFormData.assignedCoordinator);
                          if (!coordinator) return 'Sin asignar';
                          return (
                            <div className="flex items-center gap-2 truncate">
                              <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-start text-left overflow-hidden">
                                <span className="font-medium truncate w-full">{coordinator.name}</span>
                                <span className="text-xs text-gray-500 truncate w-full">{coordinator.email}</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-gray-500">Seleccionar coordinador...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o email..." />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty>No se encontraron coordinadores.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setEditFormData({...editFormData, assignedCoordinator: ''});
                              setCoordinatorPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${!editFormData.assignedCoordinator ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">Sin asignar</span>
                              <span className="text-xs text-gray-500">No asignar coordinador</span>
                            </div>
                          </CommandItem>
                          {staffList.map((staff) => (
                            <CommandItem
                              key={staff._id}
                              value={`${staff.name} ${staff.email} ${staff.role}`}
                              onSelect={() => {
                                setEditFormData({...editFormData, assignedCoordinator: staff._id});
                                setCoordinatorPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${editFormData.assignedCoordinator === staff._id ? 'opacity-100' : 'opacity-0'}`}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{staff.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {staff.role}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-gray-500">{staff.email}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">
                  Busca y asigna un coordinador o asesor para gestionar este caso
                </p>
              </div>

              {/* Assigned Sales Rep */}
              <div>
                <Label htmlFor="salesRep" className="text-gray-900 font-medium">Vendedora Asignada</Label>
                <Popover open={salesRepPopoverOpen} onOpenChange={setSalesRepPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={salesRepPopoverOpen}
                      className="w-full justify-between border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      {editFormData.assignedSalesRep ? (
                        (() => {
                          const salesRep = staffList.find(s => s._id === editFormData.assignedSalesRep);
                          if (!salesRep) return 'Sin asignar';
                          return (
                            <div className="flex items-center gap-2 truncate">
                              <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-start text-left overflow-hidden">
                                <span className="font-medium truncate w-full">{salesRep.name}</span>
                                <span className="text-xs text-gray-500 truncate w-full">{salesRep.email}</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-gray-500">Seleccionar vendedora...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o email..." />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty>No se encontraron vendedoras.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setEditFormData({...editFormData, assignedSalesRep: ''});
                              setSalesRepPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${!editFormData.assignedSalesRep ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">Sin asignar</span>
                              <span className="text-xs text-gray-500">No asignar vendedora</span>
                            </div>
                          </CommandItem>
                          {staffList.map((staff) => (
                            <CommandItem
                              key={staff._id}
                              value={`${staff.name} ${staff.email} ${staff.role}`}
                              onSelect={() => {
                                setEditFormData({...editFormData, assignedSalesRep: staff._id});
                                setSalesRepPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${editFormData.assignedSalesRep === staff._id ? 'opacity-100' : 'opacity-0'}`}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{staff.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {staff.role}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-gray-500">{staff.email}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">
                  Busca y asigna una vendedora para este caso
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Los cambios se aplicarán inmediatamente. El estado del caso cambiará automáticamente de &ldquo;En Espera&rdquo; a &ldquo;Activo&rdquo; cuando se registre el primer pago.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
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
              disabled={!editFormData.visaType || savingCase}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingCase ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      {/* Modal de Confirmación para Generar Nuevo Link */}
      <Dialog open={generateLinkModalOpen} onOpenChange={setGenerateLinkModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-purple-600" />
              Generar Nuevo Link de Acceso
            </DialogTitle>
            <DialogDescription className="text-left pt-4">
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-2">⚠️ Importante</p>
                      <p className="mb-2">
                        Solo genera un nuevo link si el usuario reporta que <strong>el link anterior no funciona correctamente</strong>.
                      </p>
                      <p>
                        Si los links existentes funcionan bien, es recomendable <strong>usar uno de los que ya están creados</strong> en lugar de generar nuevos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> El nuevo link se agregará a la lista de links generados y estará disponible inmediatamente. Los links anteriores seguirán funcionando.
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

      {/* Modal para crear Reporte de Elegibilidad */}
      <Dialog open={showEligibilityModal} onOpenChange={setShowEligibilityModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-blue-600" />
              Crear Reporte de Elegibilidad
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Sube el CV del usuario para crear su reporte de elegibilidad
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cv-file" className="text-gray-900 font-medium">
                Archivo CV (PDF, DOC, DOCX)
              </Label>
              <Input
                id="cv-file"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  console.log('📁 File input onChange triggered');
                  console.log('📁 Files:', e.target.files);
                  console.log('📁 File selected:', e.target.files[0]);
                  setCvFile(e.target.files[0]);
                  console.log('✅ setCvFile called with:', e.target.files[0]?.name);
                }}
                disabled={uploadingEligibility}
                className="text-gray-900"
              />
              {cvFile && (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {cvFile.name}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Información:</strong> Al subir el CV, se creará automáticamente el reporte de elegibilidad del usuario y se enviará a N8N para su procesamiento.
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
                  Creando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Crear Reporte
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para crear Ruta Personalizada */}
      <Dialog open={showRutaPersonalizadaModal} onOpenChange={setShowRutaPersonalizadaModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-purple-600" />
              Crear Ruta Personalizada
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Sube el CV del usuario para crear su ruta personalizada
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
                onChange={(e) => {
                  console.log('📁 File input onChange triggered (Ruta)');
                  console.log('📁 Files:', e.target.files);
                  console.log('📁 File selected:', e.target.files[0]);
                  setCvFileRuta(e.target.files[0]);
                  console.log('✅ setCvFileRuta called with:', e.target.files[0]?.name);
                }}
                disabled={uploadingRutaPersonalizada}
                className="text-gray-900"
              />
              {cvFileRuta && (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {cvFileRuta.name}
                </p>
              )}
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Información:</strong> Al subir el CV, se creará automáticamente la ruta personalizada del usuario y se enviará a N8N para su procesamiento.
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
                  Creando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Crear Ruta Personalizada
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation Modal */}
      <Dialog open={deletePaymentModalOpen} onOpenChange={setDeletePaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Pago
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          {paymentToDelete && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto:</span>
                  <span className="font-bold text-red-600">${paymentToDelete.amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha:</span>
                  <span>{paymentToDelete.paymentDate ? format(new Date(paymentToDelete.paymentDate), 'dd/MM/yyyy') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Método:</span>
                  <span>{paymentToDelete.paymentMethod || 'N/A'}</span>
                </div>
                {paymentToDelete.stageNumbers?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Etapas:</span>
                    <span>{paymentToDelete.stageNumbers.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeletePaymentModalOpen(false);
                setPaymentToDelete(null);
              }}
              disabled={deletingPayment}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deletingPayment}
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

      {/* Unmark Stage as Paid Confirmation Modal */}
      <Dialog open={unmarkStageModalOpen} onOpenChange={setUnmarkStageModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Quitar Pago de Etapa
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas quitar el estado de pago de esta etapa? Esta acción marcará la etapa como pendiente de pago.
            </DialogDescription>
          </DialogHeader>
          
          {stageToUnmark && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Etapa:</span>
                  <span className="font-bold">{stageToUnmark.stageNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre:</span>
                  <span>{stageToUnmark.name?.es || stageToUnmark.name?.en || stageToUnmark.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto:</span>
                  <span className="font-bold text-red-600">${stageToUnmark.amount?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setUnmarkStageModalOpen(false);
                setStageToUnmark(null);
              }}
              disabled={unmarkingStage}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnmarkStageAsPaid}
              disabled={unmarkingStage}
              data-testid="confirm-unmark-stage"
            >
              {unmarkingStage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Quitando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Quitar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Item Modal */}
      <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <MoveRight className="h-5 w-5 text-blue-600" />
              Mover {itemToMove?.type === 'deliverable' ? 'Entregable' : 'Documento'}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Selecciona la etapa destino para mover este {itemToMove?.type === 'deliverable' ? 'entregable' : 'documento'}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Current item info */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Item a mover:</p>
              <p className="font-medium text-gray-900">
                {itemToMove?.item?.deliverableName || 
                 itemToMove?.item?.documentName || 
                 itemToMove?.item?.name?.es || 
                 itemToMove?.item?.name?.en || 
                 itemToMove?.item?.name || 
                 'Sin nombre'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Etapa actual: <span className="font-medium text-gray-700">Etapa {itemToMove?.item?.stageNumber}</span>
              </p>
            </div>

            {/* Target stage selector */}
            <div className="space-y-2">
              <Label className="text-gray-700">Etapa destino</Label>
              <Select value={targetStageNumber} onValueChange={setTargetStageNumber}>
                <SelectTrigger className="w-full text-gray-900 bg-white border-gray-300">
                  <SelectValue placeholder="Selecciona una etapa" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {stages
                    .filter(s => s.stageNumber !== itemToMove?.item?.stageNumber)
                    .map((stage) => (
                      <SelectItem 
                        key={stage.stageNumber} 
                        value={stage.stageNumber.toString()}
                        className="text-gray-900"
                      >
                        Etapa {stage.stageNumber} - {getStageName(stage.name)}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={closeMoveModal}
              disabled={movingItem}
              className="border-gray-300 text-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMoveItem}
              disabled={movingItem || !targetStageNumber}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="confirm-move-item"
            >
              {movingItem ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moviendo...
                </>
              ) : (
                <>
                  <MoveRight className="h-4 w-4 mr-2" />
                  Mover
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisaCaseDetail;
