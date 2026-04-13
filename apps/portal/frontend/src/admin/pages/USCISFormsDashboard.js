import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  History, 
  Share2, 
  Users, 
  Loader2,
  FolderOpen,
  ChevronRight,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  MessageSquare,
  CheckCircle,
  Send,
  ClipboardList,
  Search,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { toast } from 'sonner';
import axios from 'axios';
import FormSummaryModal from '../components/FormSummaryModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const USCISFormsDashboard = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [sharedForms, setSharedForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');
  
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareData, setShareData] = useState({ 
    client_name: '', 
    client_email: '', 
    expires_in_days: 30,
    form_type: 'complete', // 'complete' or 'pre_validation'
    visa_case_id: '' // Linked visa case
  });
  const [creatingShare, setCreatingShare] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [visaCases, setVisaCases] = useState([]);
  const [visaCaseComboOpen, setVisaCaseComboOpen] = useState(false);
  const [visaCaseSearch, setVisaCaseSearch] = useState('');
  
  // Summary modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  
  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, historyRes, sharedRes, submissionsRes, casesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/uscis-forms/templates`, { headers }),
        axios.get(`${BACKEND_URL}/api/uscis-forms/history`, { headers }),
        axios.get(`${BACKEND_URL}/api/uscis-forms/shared-forms`, { headers }),
        axios.get(`${BACKEND_URL}/api/uscis-forms/client-submissions`, { headers }),
        axios.get(`${BACKEND_URL}/api/admin/visa-cases`, { headers }).catch(() => ({ data: { cases: [] } })),
      ]);
      
      setTemplates(templatesRes.data || []);
      setHistory(historyRes.data || []);
      setSharedForms(sharedRes.data || []);
      setSubmissions(submissionsRes.data || []);
      // Handle visa cases response - it returns { cases: [], pagination: {} }
      setVisaCases(casesRes.data?.cases || casesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateI140N8N = async () => {
    try {
      toast.loading('Creando plantilla I-140 N8N...');
      const response = await axios.post(
        `${BACKEND_URL}/api/uscis-forms/templates/create-i140-n8n`,
        {},
        { headers }
      );
      toast.dismiss();
      toast.success(`✅ ${response.data.message}`);
      fetchData(); // Refresh templates list
    } catch (error) {
      toast.dismiss();
      console.error('Error creating I-140 N8N:', error);
      toast.error(error.response?.data?.detail || 'Error al crear plantilla N8N');
    }
  };

  const [deleteTemplateId, setDeleteTemplateId] = useState(null);

  const handleDeleteTemplate = async (templateId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/uscis-forms/templates/${templateId}`, { headers });
      toast.success('Formulario eliminado');
      setDeleteTemplateId(null);
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar el formulario');
    }
  };

  const handleRegenerateQuestions = async (templateId) => {
    try {
      toast.loading('Regenerando preguntas con IA...');
      await axios.post(`${BACKEND_URL}/api/uscis-forms/templates/${templateId}/regenerate-questions`, {}, { headers });
      toast.dismiss();
      toast.success('Preguntas regeneradas exitosamente');
      fetchData();
    } catch (error) {
      toast.dismiss();
      toast.error('Error al regenerar las preguntas');
    }
  };

  const handleShareForm = async (template) => {
    setSelectedTemplate(template);
    setShareModalOpen(true);
    setShareLink('');
    setShareData({ 
      client_name: '', 
      client_email: '', 
      expires_in_days: 30,
      form_type: 'complete'
    });
  };

  const handleCreateShareLink = async () => {
    if (!shareData.client_name) {
      toast.error('Por favor ingrese el nombre del cliente');
      return;
    }

    setCreatingShare(true);
    try {
      const payload = {
        template_id: selectedTemplate.id,
        client_name: shareData.client_name,
        client_email: shareData.client_email,
        expires_in_days: shareData.expires_in_days,
        form_type: shareData.form_type
      };
      
      // Add visa_case_id if selected
      if (shareData.visa_case_id) {
        payload.visa_case_id = shareData.visa_case_id;
      }
      
      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/shared-forms`, payload, { headers });

      const url = `${window.location.origin}/uscis-form/${response.data.token}`;
      setShareLink(url);
      
      // Try to copy to clipboard, but don't fail if it's blocked
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace creado y copiado al portapapeles');
      } catch (clipboardError) {
        toast.success('Enlace creado. Use el botón "Copiar" para copiar al portapapeles');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Error al crear el enlace');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Enlace copiado al portapapeles');
    } catch (error) {
      // Fallback: Select the text for manual copy
      const tempInput = document.createElement('input');
      tempInput.value = shareLink;
      document.body.appendChild(tempInput);
      tempInput.select();
      tempInput.setSelectionRange(0, 99999);
      
      try {
        document.execCommand('copy');
        toast.success('Enlace copiado al portapapeles');
      } catch (err) {
        toast.error('No se pudo copiar. Por favor copie el enlace manualmente');
      }
      
      document.body.removeChild(tempInput);
    }
  };

  const handleDownloadHistory = async (historyId, formCode) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/history/${historyId}/download`, {
        headers,
        responseType: 'blob'
      });
      
      const contentType = response.headers['content-type'];
      const extension = contentType.includes('html') ? 'html' : 'pdf';
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formCode}_filled.${extension}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar el archivo');
    }
  };

  const handleDeleteSharedForm = async (token) => {
    if (!window.confirm('¿Está seguro de eliminar este enlace compartido?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/uscis-forms/shared-forms/${token}`, { headers });
      toast.success('Enlace eliminado');
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar el enlace');
    }
  };

  const handleDownloadSubmission = async (submissionId, formCode, clientName) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/client-submissions/${submissionId}/download`, {
        headers,
        responseType: 'blob'
      });
      
      const contentType = response.headers['content-type'];
      const extension = contentType.includes('html') ? 'html' : 'pdf';
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formCode}_${clientName || 'client'}.${extension}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar el archivo');
    }
  };

  const handleStatusChange = async (submissionId, newStatus) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/uscis-forms/client-submissions/${submissionId}/status`,
        { status: newStatus },
        { headers }
      );
      
      // Update local state
      setSubmissions(prev => 
        prev.map(sub => 
          sub.id === submissionId 
            ? { ...sub, submission_status: newStatus, last_modified: new Date().toISOString() }
            : sub
        )
      );
      
      const statusLabels = {
        'por_revisar': 'Por Revisar',
        'en_revision': 'En Revisión',
        'completado': 'Completado'
      };
      toast.success(`Estado actualizado a "${statusLabels[newStatus]}"`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const copyShareLink = (token) => {
    const url = `${window.location.origin}/uscis-form/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Enlace copiado al portapapeles');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    // Ensure proper timezone handling - dates from backend are in UTC
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const tabs = [
    { id: 'templates', label: 'Formularios', icon: FileText, count: templates.length },
    { id: 'history', label: 'Historial', icon: History, count: history.length },
    { id: 'shared', label: 'Enlaces Compartidos', icon: Share2, count: sharedForms.length },
    { id: 'submissions', label: 'Envíos de Clientes', icon: Users, count: submissions.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Formularios USCIS</h1>
          <p className="text-gray-400">Sistema de llenado inteligente de formularios de inmigración</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleCreateI140N8N}
            variant="outline"
            className="border-gold-primary text-gold-primary hover:bg-gold-primary/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear I-140 N8N
          </Button>
          <Button 
            onClick={() => navigate('/admin/uscis-forms/new')}
            className="bg-gold-primary hover:bg-gold-dark text-navy-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Formulario
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-navy-secondary border-navy-light">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Formularios</p>
                <p className="text-2xl font-bold text-white">{templates.length}</p>
              </div>
              <FileText className="h-8 w-8 text-gold-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-navy-secondary border-navy-light">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Formularios Generados</p>
                <p className="text-2xl font-bold text-white">{history.length}</p>
              </div>
              <History className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-navy-secondary border-navy-light">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Enlaces Activos</p>
                <p className="text-2xl font-bold text-white">{sharedForms.filter(f => f.status === 'pending').length}</p>
              </div>
              <Share2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-navy-secondary border-navy-light">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Envíos Recibidos</p>
                <p className="text-2xl font-bold text-white">{submissions.length}</p>
              </div>
              <Users className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-navy-secondary p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-gold-primary text-navy-primary font-medium'
                : 'text-gray-400 hover:text-white hover:bg-navy-light'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <Badge variant="secondary" className={`ml-1 ${activeTab === tab.id ? 'bg-navy-primary text-white' : 'bg-navy-light'}`}>
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Content */}
      <Card className="bg-navy-secondary border-navy-light">
        <CardContent className="pt-6">
          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay formularios creados</p>
                  <Button 
                    onClick={() => navigate('/admin/uscis-forms/new')}
                    className="mt-4 bg-gold-primary hover:bg-gold-dark text-navy-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Formulario
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <div 
                      key={template.id}
                      className="flex items-center justify-between p-4 bg-navy-light rounded-lg hover:bg-navy-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gold-primary/20 rounded-lg">
                          <FileText className="h-6 w-6 text-gold-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{template.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-blue-500/20 text-blue-400">{template.form_code}</Badge>
                            <Badge className="bg-purple-500/20 text-purple-400">{template.visa_category}</Badge>
                            {template.visa_subcategory && (
                              <Badge className="bg-green-500/20 text-green-400">{template.visa_subcategory}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {template.field_count} campos • Creado: {formatDate(template.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegenerateQuestions(template.id)}
                          className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                          title="Regenerar preguntas"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/admin/uscis-forms/fill/${template.id}`)}
                          className="bg-gold-primary hover:bg-gold-dark text-navy-primary"
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Llenar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/uscis-forms/fill/${template.id}`, { state: { defaultMode: 'chat' } })}
                          className="border-green-500 text-green-400 hover:bg-green-500/20"
                          title="Llenar con chat IA"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShareForm(template)}
                          className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/20"
                          title="Compartir con cliente"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTemplateId(template.id)}
                          className="border-red-500 text-red-400 hover:bg-red-500/20"
                          title="Eliminar formulario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay formularios generados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-navy-light">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Formulario</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Cliente</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Tipo</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id} className="border-b border-navy-light/50 hover:bg-navy-light/30">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white font-medium">{item.template_name}</p>
                              <p className="text-sm text-gray-500">{item.form_code}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{item.client_name || '-'}</td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(item.created_at)}</td>
                          <td className="py-3 px-4">
                            <Badge className={item.file_type === 'pdf' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}>
                              {item.file_type?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadHistory(item.id, item.form_code)}
                              className="border-gold-primary text-gold-primary hover:bg-gold-primary/20"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Descargar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Shared Forms Tab */}
          {activeTab === 'shared' && (
            <div className="space-y-4">
              {sharedForms.length === 0 ? (
                <div className="text-center py-12">
                  <Share2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay enlaces compartidos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-navy-light">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Formulario</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Cliente</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Creado</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Expira</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedForms.map((form) => (
                        <tr key={form.token} className="border-b border-navy-light/50 hover:bg-navy-light/30">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white font-medium">{form.template_name}</p>
                              <p className="text-sm text-gray-500">{form.form_code}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-gray-300">{form.client_name || '-'}</p>
                              <p className="text-sm text-gray-500">{form.client_email || ''}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(form.created_at)}</td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(form.expires_at)}</td>
                          <td className="py-3 px-4">
                            <Badge className={form.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                              {form.status === 'completed' ? 'Completado' : 'Pendiente'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            {form.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyShareLink(form.token)}
                                className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                              >
                                <Share2 className="h-4 w-4 mr-1" />
                                Copiar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteSharedForm(form.token)}
                              className="border-red-500 text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Submissions Tab */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay envíos de clientes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-navy-light">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Formulario</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Cliente</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Enviado</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Último Cambio</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-navy-light/50 hover:bg-navy-light/30">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white font-medium">{submission.template_name}</p>
                              <p className="text-sm text-gray-500">{submission.form_code}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{submission.client_name || '-'}</td>
                          <td className="py-3 px-4 text-gray-300">{submission.client_email || '-'}</td>
                          <td className="py-3 px-4">
                            <Select
                              value={submission.submission_status || 'por_revisar'}
                              onValueChange={(value) => handleStatusChange(submission.id, value)}
                            >
                              <SelectTrigger 
                                className={`w-[140px] h-8 text-xs font-medium border-0 ${
                                  submission.submission_status === 'por_revisar' 
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : submission.submission_status === 'en_revision'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-secondary border-navy-light">
                                <SelectItem 
                                  value="por_revisar" 
                                  className="text-yellow-400 focus:bg-yellow-500/20 focus:text-yellow-400"
                                >
                                  Por Revisar
                                </SelectItem>
                                <SelectItem 
                                  value="en_revision"
                                  className="text-blue-400 focus:bg-blue-500/20 focus:text-blue-400"
                                >
                                  En Revisión
                                </SelectItem>
                                <SelectItem 
                                  value="completado"
                                  className="text-green-400 focus:bg-green-500/20 focus:text-green-400"
                                >
                                  Completado
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{formatDate(submission.submitted_at)}</td>
                          <td className="py-3 px-4 text-gray-300">
                            {submission.last_modified ? formatDate(submission.last_modified) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(submission.submission_status === 'por_revisar' || submission.submission_status === 'en_revision') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/admin/uscis-forms/fill/${submission.template_id}`, { 
                                    state: { 
                                      submissionId: submission.id
                                    } 
                                  })}
                                  className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                                  title="Completar formulario"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSubmissionId(submission.id);
                                  setSummaryModalOpen(true);
                                }}
                                className="h-8 px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                                data-testid={`summary-btn-${submission.id}`}
                                title="Ver resumen"
                              >
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadSubmission(submission.id, submission.form_code, submission.client_name)}
                                className="h-8 px-2 text-gold-primary hover:text-gold-dark hover:bg-gold-primary/20"
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-navy-secondary border-navy-light text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Compartir Formulario con Cliente</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedTemplate && `Compartir: ${selectedTemplate.name} (${selectedTemplate.form_code})`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre del Cliente *</Label>
              <Input
                type="text"
                value={shareData.client_name}
                onChange={(e) => setShareData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Nombre completo"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Email del Cliente (Opcional)</Label>
              <Input
                type="email"
                value={shareData.client_email}
                onChange={(e) => setShareData(prev => ({ ...prev, client_email: e.target.value }))}
                placeholder="cliente@email.com"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Días de Validez</Label>
              <Select 
                value={shareData.expires_in_days.toString()} 
                onValueChange={(v) => setShareData(prev => ({ ...prev, expires_in_days: parseInt(v) }))}
              >
                <SelectTrigger className="bg-navy-light border-navy-light text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-navy-secondary border-navy-light">
                  <SelectItem value="7" className="text-white">7 días</SelectItem>
                  <SelectItem value="14" className="text-white">14 días</SelectItem>
                  <SelectItem value="30" className="text-white">30 días</SelectItem>
                  <SelectItem value="60" className="text-white">60 días</SelectItem>
                  <SelectItem value="90" className="text-white">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vincular con Caso de Visa - Combobox con búsqueda */}
            <div className="space-y-2">
              <Label className="text-gray-300">Vincular con Caso de Visa (Opcional)</Label>
              <Popover open={visaCaseComboOpen} onOpenChange={setVisaCaseComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={visaCaseComboOpen}
                    className="w-full justify-between bg-navy-light border-navy-light text-white hover:bg-navy-secondary hover:text-white"
                  >
                    {shareData.visa_case_id
                      ? (() => {
                          const selectedCase = visaCases.find(vc => (vc._id || vc.id) === shareData.visa_case_id);
                          return selectedCase 
                            ? `${selectedCase.userName || 'Sin nombre'} - ${typeof selectedCase.visaType === 'string' ? selectedCase.visaType : 'Sin tipo'}`
                            : 'Seleccionar caso...';
                        })()
                      : 'Sin vincular'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-navy-secondary border-navy-light" align="start">
                  <Command className="bg-navy-secondary">
                    <CommandInput 
                      placeholder="Buscar caso por nombre..." 
                      className="text-white"
                      value={visaCaseSearch}
                      onValueChange={setVisaCaseSearch}
                    />
                    <CommandList className="max-h-60">
                      <CommandEmpty className="text-gray-400 py-4 text-center">No se encontraron casos</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setShareData(prev => ({ ...prev, visa_case_id: '' }));
                            setVisaCaseComboOpen(false);
                          }}
                          className="text-gray-400 hover:bg-navy-light cursor-pointer"
                        >
                          <Check className={`mr-2 h-4 w-4 ${!shareData.visa_case_id ? 'opacity-100' : 'opacity-0'}`} />
                          Sin vincular
                        </CommandItem>
                        {visaCases
                          .filter(vc => {
                            if (!visaCaseSearch) return true;
                            const searchLower = visaCaseSearch.toLowerCase();
                            const name = (vc.userName || '').toLowerCase();
                            const type = (typeof vc.visaType === 'string' ? vc.visaType : '').toLowerCase();
                            return name.includes(searchLower) || type.includes(searchLower);
                          })
                          .slice(0, 50) // Limit to 50 results for performance
                          .map((vc) => (
                            <CommandItem
                              key={vc._id || vc.id}
                              value={`${vc.userName || ''} ${vc.visaType || ''}`}
                              onSelect={() => {
                                const caseId = vc._id || vc.id;
                                setShareData(prev => ({ 
                                  ...prev, 
                                  visa_case_id: caseId,
                                  client_name: vc.userName || prev.client_name
                                }));
                                setVisaCaseComboOpen(false);
                              }}
                              className="text-white hover:bg-navy-light cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 ${shareData.visa_case_id === (vc._id || vc.id) ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="truncate">
                                {vc.userName || 'Sin nombre'} - {typeof vc.visaType === 'string' ? vc.visaType : 'Sin tipo'}
                              </span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {visaCases && visaCases.length > 0 && (
                <p className="text-xs text-gray-500">{visaCases.length} casos disponibles</p>
              )}
            </div>

            {/* Only show form type selector for I-140 and I-907 */}
            {selectedTemplate && (
              selectedTemplate.form_code.toLowerCase().includes('i140') || 
              selectedTemplate.form_code.toLowerCase().includes('i-140') ||
              selectedTemplate.form_code.toLowerCase().includes('i907') ||
              selectedTemplate.form_code.toLowerCase().includes('i-907')
            ) && (
              <div className="space-y-2">
                <Label className="text-gray-300">Tipo de Formulario</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="complete"
                      name="form_type"
                      value="complete"
                      checked={shareData.form_type === 'complete'}
                      onChange={(e) => setShareData(prev => ({ ...prev, form_type: e.target.value }))}
                      className="w-4 h-4 text-gold-primary"
                    />
                    <label htmlFor="complete" className="text-sm text-gray-300 cursor-pointer">
                      Formulario Completo (todas las preguntas)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="pre_validation"
                      name="form_type"
                      value="pre_validation"
                      checked={shareData.form_type === 'pre_validation'}
                      onChange={(e) => setShareData(prev => ({ ...prev, form_type: e.target.value }))}
                      className="w-4 h-4 text-gold-primary"
                    />
                    <label htmlFor="pre_validation" className="text-sm text-gray-300 cursor-pointer">
                      Solo Pre-Validación (6 preguntas básicas)
                    </label>
                  </div>
                  {shareData.form_type === 'pre_validation' && (
                    <p className="text-xs text-yellow-400 ml-6 mt-1">
                      ℹ️ El cliente solo responderá 6 preguntas de validación. Luego el coordinador completará el resto.
                    </p>
                  )}
                </div>
              </div>
            )}

            {shareLink && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-medium">Enlace creado exitosamente</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={shareLink}
                    readOnly
                    className="bg-navy-light border-navy-light text-white text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShareLink}
                    className="border-green-500 text-green-400 hover:bg-green-500/20"
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Comparte este enlace con tu cliente para que llene el formulario
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShareModalOpen(false);
                setShareLink('');
              }}
              className="border-gray-600 text-gray-400"
            >
              Cerrar
            </Button>
            {!shareLink && (
              <Button
                onClick={handleCreateShareLink}
                disabled={creatingShare}
                className="bg-gold-primary hover:bg-gold-dark text-navy-primary"
              >
                {creatingShare ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Crear Enlace
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Modal */}
      <FormSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => {
          setSummaryModalOpen(false);
          setSelectedSubmissionId(null);
        }}
        submissionId={selectedSubmissionId}
      />

      {/* Delete Template Confirmation */}
      <Dialog open={!!deleteTemplateId} onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Formulario</DialogTitle>
            <DialogDescription>Esta accion no se puede deshacer. Se eliminara el formulario y su PDF.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTemplateId(null)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteTemplate(deleteTemplateId)}>
              <Trash2 className="h-4 w-4 mr-1" />Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default USCISFormsDashboard;
