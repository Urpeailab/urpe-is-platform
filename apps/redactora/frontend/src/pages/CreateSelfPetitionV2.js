import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, AlertTriangle, XCircle, Trash2, Play, Paperclip, FileCheck, RefreshCcw, Eye, Edit, Copy, Layers, Plus, Sparkles, X, Check, Filter, List, Search, File } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

const CreateSelfPetitionV2 = () => {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('initial'); // initial, uploading, classifying, batch_complete, reviewing, generating, completed, error
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [applicantName, setApplicantName] = useState('');
  const [letterContent, setLetterContent] = useState({ en: '', es: '' });
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [editingClassification, setEditingClassification] = useState(null);
  // Batch processing state
  const [batchSummaries, setBatchSummaries] = useState([]);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  // File filter state
  const [fileFilter, setFileFilter] = useState('all'); // 'all', 'error', 'pending'
  // Upload tracking state
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const navigate = useNavigate();
  const clientId = new URLSearchParams(window.location.search).get('client_id');
  const fileInputRef = React.useRef(null);
  
  // Document type options for classification editing
  const documentTypes = [
    { value: 'passport', label: 'Pasaporte/ID' },
    { value: 'recommendation_letter', label: 'Carta de Recomendación' },
    { value: 'diploma', label: 'Título/Diploma' },
    { value: 'cv', label: 'CV/Currículum' },
    { value: 'publication', label: 'Publicación/Artículo' },
    { value: 'project', label: 'Proyecto' },
    { value: 'employment_verification', label: 'Verificación de Empleo' },
    { value: 'study', label: 'Estudio/Análisis' },
    { value: 'certificate', label: 'Certificado' },
    { value: 'award', label: 'Premio/Reconocimiento' },
    { value: 'other', label: 'Otro' }
  ];

  // Create session on mount
  useEffect(() => {
    createSession();
  }, []);

  // Poll for status updates when processing
  useEffect(() => {
    let interval;
    let errorCount = 0;
    const MAX_ERRORS = 20;         // Was 5 — production needs more tolerance for 520s
    let pollInterval = 5000;       // Start at 5s, back off on errors

    if (sessionId && ['classifying', 'batch_complete', 'extracting', 'synthesizing', 'drafting', 'translating'].includes(status)) {
      const doPoll = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/self-petition-v2/${sessionId}/status`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 25000 // 25s — Cloudflare kills at 30s; give enough room
          });
          
          // Success — reset error counter and poll interval
          if (errorCount > 0) {
            errorCount = 0;
            pollInterval = 5000;
            clearInterval(interval);
            interval = setInterval(doPoll, pollInterval);
          }
          
          setStatus(response.data.status);
          setProgress(response.data.progress);
          setProgressMessage(response.data.progress_message);
          setClassifications(response.data.classifications || []);
          
          // Update batch information
          if (response.data.batch_summaries) {
            setBatchSummaries(response.data.batch_summaries);
          }
          if (response.data.completed_batches !== undefined) {
            setCompletedBatches(response.data.completed_batches);
          }
          if (response.data.current_batch !== undefined) {
            setCurrentBatch(response.data.current_batch);
          }
          
          if (response.data.status === 'reviewing') {
            clearInterval(interval);
          }
          if (response.data.status === 'completed') {
            clearInterval(interval);
            // Load the final content
            loadFinalContent();
          }
          if (response.data.status === 'error') {
            clearInterval(interval);
            toast.error(response.data.error_message || 'Error en el procesamiento');
          }
        } catch (error) {
          errorCount++;
          console.error(`Error polling status (${errorCount}/${MAX_ERRORS}):`, error.message);
          
          if (errorCount >= MAX_ERRORS) {
            // Hard failure — show toast but keep a reconnect button visible
            toast.error(
              'El servidor está ocupado procesando tus archivos. El proceso continúa en segundo plano — usa "Forzar Continuación" en unos minutos.',
              { duration: 15000 }
            );
            clearInterval(interval);
            // Auto-retry after 60s to reconnect silently
            setTimeout(() => {
              errorCount = 0;
              pollInterval = 8000;
              interval = setInterval(doPoll, pollInterval);
            }, 60000);
          } else if (errorCount >= 3) {
            // Slow down polling on repeated errors (backoff: 8s → 12s → 15s)
            clearInterval(interval);
            pollInterval = Math.min(5000 + errorCount * 3000, 15000);
            interval = setInterval(doPoll, pollInterval);
          }
        }
      };

      interval = setInterval(doPoll, pollInterval);
    }
    return () => clearInterval(interval);
  }, [sessionId, status]);

  const createSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/self-petition-v2/create-session`,
        null,
        { 
          params: { client_id: clientId },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSessionId(response.data.session_id);
      setStatus('uploading');
      // Pre-populate applicant name from client
      if (response.data.applicant_name) {
        setApplicantName(response.data.applicant_name);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Error al crear sesión');
    }
  };

  const handleFilesSelected = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const MAX_FILES = 150;
    
    // Filter valid files
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        toast.error(`Formato no soportado: ${file.name}`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    // Check total limit
    const currentCount = files.length;
    if (currentCount + validFiles.length > MAX_FILES) {
      toast.error(`Limite de ${MAX_FILES} archivos. Ya tienes ${currentCount}, intentas agregar ${validFiles.length}.`);
      e.target.value = '';
      return;
    }
    
    // Phase 1: Upload ALL files fast (no classification)
    setIsUploading(true);
    setTotalToUpload(validFiles.length);
    setUploadedCount(0);
    toast.loading(`Subiendo ${validFiles.length} archivos...`, { id: 'bulk-upload' });
    
    const token = localStorage.getItem('token');
    const CONCURRENCY = 5; // Upload 5 files at a time
    let successCount = 0;
    let errorCount = 0;
    
    // Process in parallel batches
    for (let i = 0; i < validFiles.length; i += CONCURRENCY) {
      const batch = validFiles.slice(i, i + CONCURRENCY);
      
      const uploadPromises = batch.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await axios.post(
            `${API}/self-petition-v2/${sessionId}/upload-document?classify_immediately=false`,
            formData,
            { 
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
              timeout: 30000
            }
          );
          
          setFiles(prev => [...prev, {
            file_id: response.data.file_id,
            filename: file.name,
            size: file.size
          }]);
          
          successCount++;
          setUploadedCount(prev => prev + 1);
          return { success: true, filename: file.name };
        } catch (error) {
          console.error('Error uploading:', file.name, error);
          errorCount++;
          setUploadedCount(prev => prev + 1);
          return { success: false, filename: file.name };
        }
      });
      
      await Promise.all(uploadPromises);
      toast.loading(`Subiendo ${Math.min(i + CONCURRENCY, validFiles.length)}/${validFiles.length} archivos...`, { id: 'bulk-upload' });
    }
    
    setIsUploading(false);
    setTotalToUpload(0);
    setUploadedCount(0);
    
    if (errorCount > 0) {
      toast.warning(`Subidos: ${successCount} | Errores: ${errorCount}`, { id: 'bulk-upload' });
    } else {
      toast.success(`${successCount} archivos subidos exitosamente`, { id: 'bulk-upload' });
    }
    
    // Phase 2: Auto-start background classification if files were uploaded
    if (successCount > 0) {
      try {
        toast.loading('Iniciando clasificacion automatica...', { id: 'auto-classify' });
        await axios.post(
          `${API}/self-petition-v2/${sessionId}/start-classification?use_batch_mode=true`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStatus('classifying');
        toast.success('Clasificacion en progreso (lotes de 7)', { id: 'auto-classify' });
      } catch (classError) {
        console.error('Error starting classification:', classError);
        toast.info('Archivos subidos. Usa "Clasificar Pendientes" cuando estes listo.', { id: 'auto-classify' });
      }
    }
    
    // Reset file input
    e.target.value = '';
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.file_id !== fileId));
  };

  const startClassification = async () => {
    if (files.length === 0) {
      toast.error('Debes subir al menos un documento');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/self-petition-v2/${sessionId}/start-classification`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus('classifying');
      toast.info('🔍 Clasificando documentos...');
    } catch (error) {
      console.error('Error starting classification:', error);
      toast.error(error.response?.data?.detail || 'Error al iniciar clasificación');
    }
  };

  const updateClassification = async (fileId, updates) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/self-petition-v2/${sessionId}/update-classification`,
        updates,
        { 
          params: { classification_id: fileId },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setClassifications(prev => prev.map(c => 
        c.file_id === fileId ? { ...c, ...updates } : c
      ));
      setEditingClassification(null);
      toast.success('Clasificación actualizada');
    } catch (error) {
      console.error('Error updating classification:', error);
      toast.error('Error al actualizar');
    }
  };

  // Reference for reupload file input
  const reuploadInputRef = React.useRef(null);
  const [reuploadingFileId, setReuploadingFileId] = useState(null);

  const handleReuploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !reuploadingFileId) return;
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      toast.loading('Re-subiendo archivo...', { id: 'reupload' });
      
      const response = await axios.post(
        `${API}/self-petition-v2/${sessionId}/reupload-file/${reuploadingFileId}`,
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.status === 'classified') {
        toast.success('¡Archivo re-clasificado exitosamente!', { id: 'reupload' });
        // Update classifications
        setClassifications(prev => prev.map(c => 
          c.file_id === reuploadingFileId ? response.data.classification : c
        ));
      } else {
        toast.error('El archivo fue re-subido pero la clasificación falló. Intenta con otro formato.', { id: 'reupload' });
      }
      
      setReuploadingFileId(null);
    } catch (error) {
      console.error('Error reuploading:', error);
      toast.error('Error al re-subir archivo', { id: 'reupload' });
    }
    
    // Reset file input
    e.target.value = '';
  };

  const reclassifyFile = async (fileId) => {
    try {
      const token = localStorage.getItem('token');
      toast.loading('Re-clasificando...', { id: 'reclassify' });
      
      const response = await axios.post(
        `${API}/self-petition-v2/${sessionId}/reclassify-file/${fileId}`,
        null,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.status === 'classified') {
        toast.success('¡Re-clasificación exitosa!', { id: 'reclassify' });
        setClassifications(prev => prev.map(c => 
          c.file_id === fileId ? response.data.classification : c
        ));
      } else {
        toast.error('Re-clasificación falló. Intenta subir en otro formato.', { id: 'reclassify' });
      }
    } catch (error) {
      console.error('Error reclassifying:', error);
      toast.error('Error al re-clasificar', { id: 'reclassify' });
    }
  };

  const triggerReupload = (fileId) => {
    setReuploadingFileId(fileId);
    reuploadInputRef.current?.click();
  };

  // Count files that need retry
  const needsRetryCount = classifications.filter(c => c.status === 'needs_retry').length;

  const confirmClassifications = async () => {
    if (!applicantName.trim()) {
      toast.error('Ingresa el nombre del solicitante');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/self-petition-v2/${sessionId}/confirm-classifications`,
        null,
        { 
          params: { applicant_name: applicantName },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Clasificaciones confirmadas');
    } catch (error) {
      console.error('Error confirming:', error);
      toast.error('Error al confirmar');
    }
  };

  const startGeneration = async () => {
    if (!applicantName.trim()) {
      toast.error('Ingresa el nombre del solicitante');
      return;
    }
    
    try {
      // First confirm classifications
      await confirmClassifications();
      
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/self-petition-v2/${sessionId}/start-generation`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus('extracting');
      toast.info('✍️ Iniciando generación de carta...');
    } catch (error) {
      console.error('Error starting generation:', error);
      toast.error(error.response?.data?.detail || 'Error al iniciar generación');
    }
  };

  const loadFinalContent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/self-petition-v2/${sessionId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The session should have the content now
      // We need to find the letter ID from the session
      const lettersResponse = await axios.get(`${API}/self-petition-v2/letters`, {
        params: { client_id: clientId },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const latestLetter = lettersResponse.data.find(l => l.session_id === sessionId);
      if (latestLetter) {
        setLetterContent({
          en: latestLetter.content_en,
          es: latestLetter.content_es
        });
      }
    } catch (error) {
      console.error('Error loading content:', error);
    }
  };

  const downloadPDF = async (language) => {
    try {
      const token = localStorage.getItem('token');
      const lettersResponse = await axios.get(`${API}/self-petition-v2/letters`, {
        params: { client_id: clientId },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const latestLetter = lettersResponse.data.find(l => l.session_id === sessionId);
      if (!latestLetter) {
        toast.error('Carta no encontrada');
        return;
      }
      
      const response = await axios.get(
        `${API}/self-petition-v2/letters/${latestLetter.id}/download`,
        {
          params: { language },
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Self_Petition_V2_${applicantName.replace(/ /g, '_')}_${language.toUpperCase()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`📄 PDF descargado (${language === 'es' ? 'Español' : 'Inglés'})`);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Error al descargar PDF');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2" size={18} /> Volver
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FileText className="text-purple-600" size={28} />
          Carta de Autopetición V2
          <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">Multi-Documento</span>
        </h1>
        <p className="text-gray-600 mt-2">
          Sube hasta 150 documentos. El sistema los clasificará automáticamente y generará una carta completa.
        </p>
      </div>

      {/* Progress Bar */}
      {status !== 'initial' && status !== 'uploading' && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{progressMessage}</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 1: Upload Documents */}
      {(status === 'initial' || status === 'uploading') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="text-blue-600" size={20} />
              Paso 1: Subir Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isUploading ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-500'}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mx-auto mb-4 text-purple-600 animate-spin" size={48} />
                  <p className="text-lg font-medium mb-2">Subiendo archivos...</p>
                  <p className="text-sm text-purple-600 font-medium">{uploadedCount} / {totalToUpload} archivos subidos</p>
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 mt-3">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${totalToUpload > 0 ? (uploadedCount / totalToUpload) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Los archivos se clasificaran automaticamente al terminar</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                  <p className="text-lg font-medium mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
                  <p className="text-sm text-gray-500">PDF, DOC, DOCX, TXT, imágenes • Máximo 150 archivos</p>
                </>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                className="hidden"
                onChange={handleFilesSelected}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                disabled={isUploading}
              />
            </div>

            {/* Files List with Classification Status */}
            {files.length > 0 && (
              <div className="mt-6">
                {/* Summary Stats */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 rounded-lg">
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <strong>{classifications.filter(c => c.status === 'classified').length}</strong> clasificados
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <strong>{classifications.filter(c => c.status === 'needs_retry').length}</strong> con error
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <strong>{files.length - classifications.length}</strong> sin clasificar
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">Total: {files.length} archivos</span>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-3">
                  <button 
                    onClick={() => setFileFilter('all')}
                    className={`px-3 py-1 rounded text-sm ${fileFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Todos ({files.length})
                  </button>
                  <button 
                    onClick={() => setFileFilter('error')}
                    className={`px-3 py-1 rounded text-sm ${fileFilter === 'error' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Con Error ({classifications.filter(c => c.status === 'needs_retry').length})
                  </button>
                  <button 
                    onClick={() => setFileFilter('pending')}
                    className={`px-3 py-1 rounded text-sm ${fileFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Sin Clasificar ({files.length - classifications.length})
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2">
                  {files
                    .filter(file => {
                      const classification = classifications.find(c => c.file_id === file.file_id);
                      if (fileFilter === 'error') return classification?.status === 'needs_retry';
                      if (fileFilter === 'pending') return !classification;
                      return true;
                    })
                    .map((file, index) => {
                    const classification = classifications.find(c => c.file_id === file.file_id);
                    const globalIndex = files.findIndex(f => f.file_id === file.file_id) + 1;
                    return (
                      <div key={file.file_id} className={`flex items-center justify-between p-3 rounded border ${
                        classification?.status === 'needs_retry' ? 'bg-red-50 border-red-200' : 
                        classification?.status === 'classified' ? 'bg-green-50 border-green-200' : 
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-gray-500 w-6">{globalIndex}.</span>
                          <FileText size={16} className={
                            classification?.status === 'needs_retry' ? 'text-red-400' : 
                            classification?.status === 'classified' ? 'text-green-500' : 
                            'text-amber-500'
                          } />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm block truncate" title={file.filename}>{file.filename}</span>
                            {classification ? (
                              <div className="flex items-center gap-2 mt-1">
                                {classification.status === 'classified' ? (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                    {classification.document_type}
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1">
                                    <AlertTriangle size={10} /> {classification.error || 'Error'}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 truncate max-w-[200px]" title={classification.summary}>
                                  {classification.summary?.substring(0, 40)}...
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 mt-1 block">⏳ Sin clasificar - sube de nuevo o usa "Clasificar Pendientes"</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {(classification?.status === 'needs_retry' || !classification) && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => triggerReupload(file.file_id)}
                                className="text-xs h-7 px-2 text-amber-700 border-amber-300"
                              >
                                <Upload size={12} className="mr-1" /> Re-subir
                              </Button>
                              {classification && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => reclassifyFile(file.file_id)}
                                  className="h-7 px-2"
                                  title="Reintentar clasificación"
                                >
                                  <RefreshCcw size={14} />
                                </Button>
                              )}
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => removeFile(file.file_id)} className="h-7 px-2">
                            <X size={14} className="text-red-400" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hidden file input for reupload */}
            <input 
              ref={reuploadInputRef}
              type="file" 
              className="hidden"
              onChange={handleReuploadFile}
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            />

            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {classifications.filter(c => c.status === 'needs_retry').length > 0 && (
                  <span className="text-amber-600">
                    ⚠️ {classifications.filter(c => c.status === 'needs_retry').length} archivo(s) con error - usa Re-subir
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {files.length > classifications.length && status !== 'classifying' && (
                  <Button 
                    onClick={startClassification}
                    variant="outline"
                    className="border-purple-300 text-purple-700"
                    disabled={isUploading}
                  >
                    <RefreshCw className="mr-2" size={16} />
                    Clasificar Pendientes ({files.length - classifications.length})
                  </Button>
                )}
                <Button 
                  onClick={() => setStatus('reviewing')}
                  disabled={classifications.length === 0 || isUploading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowRight className="mr-2" size={18} />
                  Continuar a Revisión
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review Classifications */}
      {(status === 'classifying' || status === 'batch_complete' || status === 'reviewing') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="text-green-600" size={20} />
              Paso 2: Revisar Clasificaciones
              {completedBatches > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded ml-2">
                  {completedBatches} lotes procesados
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'classifying' ? (
              <div className="text-center py-8">
                <Loader2 className="mx-auto animate-spin text-purple-600 mb-4" size={48} />
                <p className="text-lg">{progressMessage}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {classifications.length > 0 && `${classifications.length} documentos clasificados`}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Procesando en lotes de 7 documentos para mayor estabilidad
                </p>
                
                {/* Force Continue Button - shown after 30 seconds */}
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await axios.post(
                          `${API}/self-petition-v2/${sessionId}/force-continue`,
                          {},
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.info(`Reiniciando clasificación. ${response.data.remaining} archivos pendientes.`);
                      } catch (error) {
                        toast.error('Error al reiniciar: ' + (error.response?.data?.detail || error.message));
                      }
                    }}
                    className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    <RefreshCw size={14} className="mr-1" />
                    ¿Proceso atascado? Forzar continuación
                  </Button>
                </div>
                
                {/* Batch Summaries during classification */}
                {batchSummaries.length > 0 && (
                  <div className="mt-6 text-left">
                    <h4 className="font-medium mb-3 text-gray-700">Resúmenes de Lotes Completados:</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {batchSummaries.map((batch, idx) => (
                        <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-green-800">Lote {batch.batch_number}</span>
                            <span className="text-xs text-green-600">
                              {batch.successful} OK / {batch.failed} errores
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{batch.synthesis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Batch Summaries Panel - shown after classification */}
                {batchSummaries.length > 0 && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-800">
                      <FileText size={16} />
                      Resumen del Análisis ({batchSummaries.length} lotes procesados)
                    </h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {batchSummaries.map((batch, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Lote {batch.batch_number}</span>
                            <span className="text-xs text-gray-500">
                              {batch.files_processed} docs • {batch.successful} clasificados
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{batch.synthesis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hidden file input for reupload */}
                <input 
                  ref={reuploadInputRef}
                  type="file" 
                  className="hidden"
                  onChange={handleReuploadFile}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                />

                {/* Warning for files needing retry */}
                {needsRetryCount > 0 && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle size={20} />
                      <span className="font-medium">{needsRetryCount} documento(s) requieren atención</span>
                    </div>
                    <p className="text-sm text-amber-700 mt-1">
                      Puedes re-subir estos archivos en otro formato (PDF texto, DOCX, o imagen clara) o intentar re-clasificarlos.
                    </p>
                  </div>
                )}

                {/* Applicant Name Input */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <Label className="font-medium">Nombre del Solicitante *</Label>
                  <Input
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Ej: María García López"
                    className="mt-2"
                  />
                </div>

                {/* Classifications Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">Exhibit</th>
                        <th className="p-3 text-left">Documento</th>
                        <th className="p-3 text-left">Estado</th>
                        <th className="p-3 text-left">Tipo</th>
                        <th className="p-3 text-left">Resumen</th>
                        <th className="p-3 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classifications.map((c) => (
                        <tr key={c.file_id} className={`border-b hover:bg-gray-50 ${c.status === 'needs_retry' ? 'bg-red-50' : ''}`}>
                          <td className="p-3 font-medium">{c.exhibit_number}</td>
                          <td className="p-3" title={c.filename}>
                            <div className="flex items-center gap-2">
                              <FileText size={14} className={c.status === 'needs_retry' ? 'text-red-400' : 'text-gray-400'} />
                              <span>{c.filename?.substring(0, 25)}{c.filename?.length > 25 ? '...' : ''}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {c.status === 'needs_retry' ? (
                              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 flex items-center gap-1">
                                <AlertTriangle size={12} /> Error
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 flex items-center gap-1">
                                <Check size={12} /> OK
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {editingClassification === c.file_id ? (
                              <select
                                value={c.document_type}
                                onChange={(e) => updateClassification(c.file_id, { document_type: e.target.value })}
                                className="border rounded p-1 text-sm"
                              >
                                {documentTypes.map(dt => (
                                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`px-2 py-1 rounded text-xs ${
                                c.document_type === 'recommendation_letter' ? 'bg-green-100 text-green-800' :
                                c.document_type === 'cv' ? 'bg-blue-100 text-blue-800' :
                                c.document_type === 'diploma' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {documentTypes.find(dt => dt.value === c.document_type)?.label || c.document_type}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-gray-600" style={{ maxWidth: '250px' }}>
                            <div 
                              className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                              title={c.summary}
                              onClick={() => {
                                const el = document.getElementById(`summary-${c.file_id}`);
                                if (el) el.classList.toggle('line-clamp-2');
                              }}
                            >
                              <p id={`summary-${c.file_id}`} className={`line-clamp-2 ${c.status === 'needs_retry' ? 'text-red-600' : ''}`}>
                                {c.summary || 'Sin resumen disponible'}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              {c.status === 'needs_retry' ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => triggerReupload(c.file_id)}
                                    title="Re-subir en otro formato"
                                    className="text-xs px-2"
                                  >
                                    <Upload size={12} className="mr-1" /> Re-subir
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => reclassifyFile(c.file_id)}
                                    title="Reintentar clasificación"
                                  >
                                    <RefreshCcw size={14} />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingClassification(editingClassification === c.file_id ? null : c.file_id)}
                                >
                                  <Edit size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {classifications.filter(c => c.status === 'classified').length} de {classifications.length} documentos listos
                  </div>
                  <Button
                    onClick={startGeneration}
                    disabled={!applicantName.trim() || needsRetryCount === classifications.length}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Sparkles className="mr-2" size={18} />
                    Generar Carta de Autopetición
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generating */}
      {['extracting', 'synthesizing', 'drafting', 'translating'].includes(status) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-purple-600 animate-pulse" size={20} />
              Paso 3: Generando Carta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Loader2 className="mx-auto animate-spin text-purple-600 mb-4" size={64} />
              <p className="text-xl font-medium mb-2">{progressMessage}</p>
              <p className="text-gray-500">Este proceso puede tomar varios minutos...</p>
              
              <div className="mt-6 grid grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className={`p-3 rounded ${status === 'extracting' ? 'bg-purple-100 text-purple-700' : progress > 40 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  <FileText size={24} className="mx-auto mb-1" />
                  <span className="text-xs">Extrayendo</span>
                </div>
                <div className={`p-3 rounded ${status === 'synthesizing' ? 'bg-purple-100 text-purple-700' : progress > 65 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  <Layers size={24} className="mx-auto mb-1" />
                  <span className="text-xs">Sintetizando</span>
                </div>
                <div className={`p-3 rounded ${status === 'drafting' ? 'bg-purple-100 text-purple-700' : progress > 75 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  <Edit size={24} className="mx-auto mb-1" />
                  <span className="text-xs">Redactando</span>
                </div>
                <div className={`p-3 rounded ${status === 'translating' ? 'bg-purple-100 text-purple-700' : progress > 90 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  <Globe size={24} className="mx-auto mb-1" />
                  <span className="text-xs">Traduciendo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Completed */}
      {status === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={24} />
                ✅ Carta de Autopetición V2 Generada Exitosamente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <Button 
                  onClick={() => downloadPDF('en')}
                  variant="outline"
                  style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                >
                  <Download className="mr-2" size={16} />
                  PDF (English)
                </Button>
                
                <Button 
                  onClick={() => downloadPDF('es')}
                  variant="outline"
                  style={{ borderColor: '#10b981', color: '#10b981' }}
                >
                  <Download className="mr-2" size={16} />
                  PDF (Español)
                </Button>

                <Button variant="outline" onClick={() => {
                  if (clientId) {
                    navigate(`/client-documents/${clientId}/selfpetition`);
                  } else {
                    navigate('/dashboard');
                  }
                }}>
                  <FileText className="mr-2" size={16} />
                  Volver a Cartas
                </Button>

                <Button variant="outline" onClick={() => {
                  setStatus('initial');
                  setSessionId(null);
                  setFiles([]);
                  setClassifications([]);
                  setLetterContent({ en: '', es: '' });
                  createSession();
                }}>
                  <Plus className="mr-2" size={16} />
                  Nueva Carta V2
                </Button>
              </div>

              {/* Language Toggle */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={currentLanguage === 'en' ? 'default' : 'outline'}
                  onClick={() => setCurrentLanguage('en')}
                  size="sm"
                >
                  🇺🇸 English
                </Button>
                <Button
                  variant={currentLanguage === 'es' ? 'default' : 'outline'}
                  onClick={() => setCurrentLanguage('es')}
                  size="sm"
                >
                  🇪🇸 Español
                </Button>
              </div>

              {/* Document Summary */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Documentos procesados:</strong> {classifications.length} | 
                  <strong> Solicitante:</strong> {applicantName}
                </p>
              </div>

              {/* Content Preview */}
              <div style={{ 
                background: '#f9fafb', 
                padding: '2rem', 
                borderRadius: '8px',
                maxHeight: '600px',
                overflowY: 'auto',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }}>
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: currentLanguage === 'es' ? letterContent.es : letterContent.en 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <Card className="mb-6 border-red-200">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h3 className="text-lg font-medium text-red-700 mb-2">Error en el procesamiento</h3>
            <p className="text-gray-600 mb-4">{progressMessage}</p>
            <Button onClick={createSession} variant="outline">
              Intentar de nuevo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


// ==========================================
// CREATE SELF-PETITION LETTER COMPONENT
// ==========================================

export default CreateSelfPetitionV2;
