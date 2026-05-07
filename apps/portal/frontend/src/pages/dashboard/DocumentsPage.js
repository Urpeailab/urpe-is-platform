import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, CheckCircle, XCircle, Clock, 
  AlertCircle, Search, Filter, Download, Eye
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const DocumentsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [unlockedStages, setUnlockedStages] = useState([]);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingRoadMapPDF, setDownloadingRoadMapPDF] = useState(false);
  const [roadMapData, setRoadMapData] = useState([]);

  useEffect(() => {
    fetchDocuments();
    fetchRoadMapData();
  }, []);

  // MISMA LÓGICA que DashboardHome.js para obtener roadMapData
  const fetchRoadMapData = async () => {
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const user = userDataStr ? JSON.parse(userDataStr) : null;
      
      if (!user?.phone) {
        return;
      }

      const response = await axios.post(
        'https://n8n.urpeailab.com/webhook/road-map',
        { telefono: user.phone },
        { timeout: 45000 }
      );

      if (response.data) {
        let parsedData;
        
        // The response has a 'data' field which is a JSON string
        if (response.data.data && typeof response.data.data === 'string') {
          parsedData = JSON.parse(response.data.data);
          // Extract roadmap_servicios from the parsed data
          if (parsedData.roadmap_servicios) {
            setRoadMapData(parsedData.roadmap_servicios);
          }
        } else if (Array.isArray(response.data)) {
          parsedData = response.data;
          setRoadMapData(parsedData);
        } else if (response.data.roadmap_servicios) {
          setRoadMapData(response.data.roadmap_servicios);
        }
      }
    } catch (error) {
      console.error('Error fetching roadmap data:', error);
      // Fail silently, roadmap data is optional
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      if (!token) {
        toast.error('Por favor inicia sesión nuevamente');
        setLoading(false);
        return;
      }
      
      // Obtener documentos requeridos
      const { data: docsData } = await axios.get(`${BACKEND_URL}/api/client/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Obtener entregables
      const { data: delivsData } = await axios.get(`${BACKEND_URL}/api/client/my-case/deliverables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Combinar documentos y entregables
      const allDocuments = [
        ...(docsData.documents || []).map(doc => ({ ...doc, itemType: 'document' })),
        ...(delivsData.deliverables || []).map(deliv => {
          // Determinar el status correcto del entregable
          let status = deliv.status || 'draft'; // Usar el status que viene del backend
          
          // REGLA ESPECIAL: "Reporte de Elegibilidad Completo" SIEMPRE está entregado
          const isEligibilityReport = 
            deliv.name?.es?.includes('Reporte de Elegibilidad') ||
            deliv.name?.en?.includes('Eligibility Report') ||
            deliv.deliverableName?.includes('Reporte de Elegibilidad');
          
          // REGLA ESPECIAL: "Ruta Personalizada" SIEMPRE está entregado
          const isRoadMap = 
            deliv.name?.es?.includes('Ruta Personalizada') ||
            deliv.name?.en?.includes('Personalized Roadmap') ||
            deliv.deliverableName?.includes('Ruta Personalizada');
          
          if (isEligibilityReport || isRoadMap) {
            status = 'unlocked'; // SIEMPRE entregado
          }
          // Si tiene fileUrl, también es "Entregado" (unlocked)
          else if (deliv.fileUrl && deliv.fileUrl.trim() !== '') {
            status = 'unlocked';
          }
          
          return {
            ...deliv, 
            itemType: 'deliverable',
            name: deliv.name || deliv.deliverableName,
            status: status,
            isEligibilityReport: isEligibilityReport, // Flag para identificarlo después
            isRoadMap: isRoadMap // Flag para identificar Ruta Personalizada
          };
        })
      ];

      setDocuments(allDocuments);
      setGrouped(docsData.grouped || {});
      
      // Recalcular estadísticas incluyendo deliverables
      const stats = {
        total: allDocuments.length,
        pending: allDocuments.filter(d => d.status === 'pending' || d.status === 'draft').length,
        uploaded: allDocuments.filter(d => d.status === 'uploaded').length,
        validated: allDocuments.filter(d => d.status === 'validated' || d.status === 'unlocked').length
      };
      setStats(stats);
      
      // Obtener etapas desbloqueadas
      const caseResponse = await axios.get(`${BACKEND_URL}/api/client/my-case`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const stages = caseResponse.data.stages || [];
      const unlocked = stages
        .filter(stage => stage.isUnlocked === true)
        .map(stage => stage.stageNumber);
      setUnlockedStages(unlocked);
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (error.response?.status === 401) {
        toast.error('Tu sesión ha expirado. Por favor inicia sesión nuevamente');
      } else {
        toast.error('Error al cargar los documentos');
      }
    } finally {
      setLoading(false);
    }
  };

  // MISMA LÓGICA que el botón "Descargar Reporte" en "Tu Probabilidad de Éxito" (DashboardHome.js)
  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    toast.info('Generando PDF completo...');
    
    try {
      console.log('Starting comprehensive PDF generation...');
      
      // Get user data from localStorage
      const userDataStr = localStorage.getItem('urpe_user');
      const user = userDataStr ? JSON.parse(userDataStr) : null;
      
      // Fetch complete data from n8n webhook
      let completeData = null;
      if (user?.phone) {
        try {
          const response = await axios.post(
            'https://n8n.urpeailab.com/webhook/ae8c88b1-3c08-49d8-b365-8e65fe96a291',
            { telefono: user.phone },
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
          // Fallback to user.report if webhook fails
          completeData = user?.report;
        }
      } else {
        completeData = user?.report;
      }

      // Check if we have any data
      if (!completeData && !user?.report) {
        toast.error('No hay datos disponibles para generar el reporte. Por favor, completa tu evaluación de elegibilidad primero.');
        setDownloadingPDF(false);
        return;
      }

      // Merge user.report with webhook data for complete PDF
      const mergedData = {
        ...user?.report,
        ...completeData,
        nombreCompleto: user?.name || user?.report?.nombreCompleto || completeData?.nombreCompleto,
        ocupacion: user?.report?.ocupacion || completeData?.ocupacion,
        oportunidadesCrecimiento: completeData?.oportunidadesCrecimiento || user?.report?.oportunidadesCrecimiento,
      };

      console.log('=== PDF DATA DEBUG ===');
      console.log('Merged data for PDF:', mergedData);
      console.log('Oportunidades count:', mergedData?.oportunidadesCrecimiento?.length);
      
      // Use comprehensive PDF generator
      const { generateCompletePDF } = await import('../../utils/completePdfGenerator');
      const result = generateCompletePDF(mergedData, user);
      
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

  // MISMA LÓGICA que el botón de "Ruta Personalizada" en DashboardHome.js
  const handleDownloadRoadMapPDF = async () => {
    if (!roadMapData || roadMapData.length === 0) {
      toast.error('No hay datos de ruta personalizada para descargar');
      return;
    }

    setDownloadingRoadMapPDF(true);
    toast.info('Generando PDF de tu ruta personalizada...');
    
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const user = userDataStr ? JSON.parse(userDataStr) : null;
      
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
      
      // URPE Colors
      const urpeYellow = [234, 179, 8];
      const urpeGold = [245, 158, 11];
      const darkGray = [31, 41, 55];
      
      let yPosition = 20;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const leftMargin = 20;
      const rightMargin = pageWidth - 20;
      const contentWidth = rightMargin - leftMargin;

      // Header
      doc.setTextColor(...darkGray);
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text(encodeText('Tu Ruta Personalizada'), leftMargin, yPosition);
      
      doc.setDrawColor(...urpeYellow);
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPosition + 2, rightMargin, yPosition + 2);
      
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(encodeText('Servicios recomendados para maximizar tu exito'), leftMargin, yPosition);
      
      yPosition += 10;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(encodeText(`${user?.name || 'N/A'}`), leftMargin, yPosition);
      doc.text(`${new Date().toLocaleDateString('es-ES')}`, rightMargin - 20, yPosition);
      
      yPosition += 15;

      // Group services by category
      const groupedByCategory = roadMapData.reduce((acc, service) => {
        const category = service.categoria || 'Otros';
        if (!acc[category]) acc[category] = [];
        acc[category].push(service);
        return acc;
      }, {});

      // Iterate through categories
      Object.entries(groupedByCategory).forEach(([categoria, servicios]) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkGray);
        doc.text(encodeText(categoria), leftMargin, yPosition);
        
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(leftMargin, yPosition + 1, rightMargin, yPosition + 1);
        
        yPosition += 8;

        servicios.forEach((servicio) => {
          if (yPosition > pageHeight - 50) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...darkGray);
          doc.text(encodeText(servicio.item), leftMargin, yPosition);

          if (servicio.requerido) {
            const titleWidth = doc.getTextWidth(encodeText(servicio.item));
            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(239, 68, 68);
            doc.text('*', leftMargin + titleWidth + 2, yPosition);
          }

          yPosition += 5;

          if (servicio.ejemplo_urpe) {
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            const exampleText = encodeText(servicio.ejemplo_urpe);
            const exampleLines = doc.splitTextToSize(exampleText, contentWidth);
            doc.text(exampleLines, leftMargin, yPosition);
            yPosition += (exampleLines.length * 3.5) + 3;
          } else {
            yPosition += 2;
          }

          doc.setFontSize(8);
          
          doc.setTextColor(22, 163, 74);
          doc.setFont(undefined, 'bold');
          doc.text('URPE:', leftMargin, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`${servicio.dias_urpe} dias`, leftMargin + 15, yPosition);
          
          doc.setTextColor(234, 88, 12);
          doc.setFont(undefined, 'bold');
          doc.text('DIY:', leftMargin + 45, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`${servicio.dias_prospecto_estimado} dias`, leftMargin + 55, yPosition);

          const saved = servicio.dias_prospecto_estimado - servicio.dias_urpe;
          doc.setTextColor(...urpeGold);
          doc.setFont(undefined, 'bold');
          doc.text(`(-${saved} dias)`, rightMargin - 20, yPosition);

          yPosition += 8;

          doc.setDrawColor(240, 240, 240);
          doc.setLineWidth(0.2);
          doc.line(leftMargin, yPosition, rightMargin, yPosition);
          
          yPosition += 6;
        });

        yPosition += 5;
      });

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(`${i}/${totalPages}`, leftMargin, pageHeight - 10);
        doc.text('urpeailab.com', rightMargin - 20, pageHeight - 10);
      }

      const fileName = `URPE_Ruta_Personalizada_${encodeText(user?.name?.replace(/\s+/g, '_') || 'Usuario')}_${Date.now()}.pdf`;
      doc.save(fileName);
      
      toast.success('Ruta personalizada descargada exitosamente');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(`Error al generar el PDF: ${error.message}`);
    } finally {
      setDownloadingRoadMapPDF(false);
    }
  };

  const handleUpload = async (documentId, file) => {
    try {
      const userDataStr = localStorage.getItem('urpe_user');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const token = userData?.token;
      
      if (!token) {
        toast.error('Por favor inicia sesión nuevamente');
        return;
      }
      
      // Demo mode: simulate file upload
      const mockUrl = `https://demo-storage.urpe.com/documents/${Date.now()}/${file.name}`;
      
      const { data } = await axios.post(
        `${BACKEND_URL}/api/client/documents/upload`,
        {
          documentId,
          fileName: file.name,
          fileUrl: mockUrl,
          fileSize: file.size,
          notes: ''
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Documento subido exitosamente');
      setShowUploadModal(false);
      setSelectedDocument(null);
      fetchDocuments(); // Refresh
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error.response?.data?.detail || 'Error al subir el documento');
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        icon: Clock,
        color: 'text-slate-light',
        bg: 'bg-navy-light/20',
        label: 'Pendiente',
        description: 'Esperando que subas este documento'
      },
      draft: {
        icon: Clock,
        color: 'text-orange-500',
        bg: 'bg-orange-100',
        label: 'Pendiente de Entrega',
        description: 'El coordinador aún no ha subido este entregable'
      },
      uploaded: {
        icon: Clock,
        color: 'text-blue-500',
        bg: 'bg-blue-100',
        label: 'En Revisión',
        description: 'El coordinador está revisando tu documento'
      },
      validated: {
        icon: CheckCircle,
        color: 'text-success',
        bg: 'bg-green-100',
        label: 'Validado',
        description: 'Documento aprobado por el coordinador'
      },
      unlocked: {
        icon: CheckCircle,
        color: 'text-success',
        bg: 'bg-green-100',
        label: 'Entregado',
        description: 'Entregable disponible para descargar'
      },
      rejected: {
        icon: XCircle,
        color: 'text-red-500',
        bg: 'bg-red-100',
        label: 'Rechazado',
        description: 'Requiere corrección, por favor vuelve a subir'
      }
    };
    return configs[status] || configs.pending;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name?.es?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.name?.en?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Para el filtro "validated", incluir también "unlocked" (entregables)
    let matchesFilter = filterStatus === 'all' || doc.status === filterStatus;
    if (filterStatus === 'validated' && doc.status === 'unlocked') {
      matchesFilter = true;
    }
    
    return matchesSearch && matchesFilter;
  });
  
  // Agrupar documentos por etapa
  const groupedByStage = React.useMemo(() => {
    const groups = filteredDocuments.reduce((acc, doc) => {
      const stage = doc.stageNumber || 0;
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(doc);
      return acc;
    }, {});
    
    return Object.keys(groups)
      .sort((a, b) => Number(a) - Number(b))
      .map(stageNumber => ({
        stageNumber: Number(stageNumber),
        documents: groups[stageNumber]
      }));
  }, [filteredDocuments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-dark"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 pt-6">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900 via-black to-gray-900">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-dark/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="relative p-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl blur-md opacity-50"></div>
              <div className="relative h-16 w-16 rounded-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg">
                <FileText className="h-8 w-8 text-black" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                Mis Documentos
              </h1>
              <p className="text-slate text-lg mt-1">
                Gestiona todos tus documentos requeridos para tu caso de visa
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content with Padding */}
      <div className="px-6 md:px-8 lg:px-12 space-y-6">
        {/* Premium Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Card */}
        <Card className="h-36 bg-navy-secondary border border-navy-light/20 hover:border-navy-light/30 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6 h-full flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-light mb-2">Total Documentos</p>
              <p className="text-4xl font-bold text-gold-subtle">{stats.total || 0}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-navy-light/20 flex items-center justify-center">
              <FileText className="h-7 w-7 text-slate" />
            </div>
          </CardContent>
        </Card>

        {/* Pendientes Card */}
        <Card className="h-36 bg-navy-secondary border border-orange-200 hover:border-orange-300 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6 h-full flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-light mb-2">Pendientes</p>
              <p className="text-4xl font-bold text-orange-600">{stats.pending || 0}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock className="h-7 w-7 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        {/* En Revisión Card */}
        <Card className="h-36 bg-navy-secondary border border-blue-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6 h-full flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-light mb-2">En Revisión</p>
              <p className="text-4xl font-bold text-blue-600">{stats.uploaded || 0}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center">
              <Clock className="h-7 w-7 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Validados Card */}
        <Card className="h-36 bg-navy-secondary border border-green-200 hover:border-green-300 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6 h-full flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-light mb-2">Validados</p>
              <p className="text-4xl font-bold text-success">{stats.validated || 0}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters - Premium Design */}
      <Card className="bg-navy-secondary border-2 border-navy-light/20 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-lg bg-gold-dark/20 flex items-center justify-center">
                <Search className="h-5 w-5 text-gold-dark" />
              </div>
              <Input
                type="text"
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-16 h-12 border-2 border-navy-light/20 focus:border-gold-dark/80 focus:ring-yellow-400 text-gold-subtle rounded-xl"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-navy-light/20 flex items-center justify-center">
                <Filter className="h-5 w-5 text-slate" />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-12 px-6 border-2 border-navy-light/20 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-gold-dark/80 text-gold-subtle font-medium cursor-pointer hover:border-gold-dark/60 transition-colors"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="uploaded">En Revisión</option>
                <option value="validated">Validados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <div className="space-y-6">
        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-slate-light mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gold-subtle mb-2">
                No se encontraron documentos
              </h3>
              <p className="text-slate">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Intenta con otros filtros de búsqueda' 
                  : 'Aún no tienes documentos asignados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          groupedByStage.map(({ stageNumber, documents: stageDocs }) => (
            <div key={`stage-${stageNumber}`} className="space-y-4">
              {/* Stage Header */}
              <div className="flex items-center gap-3 py-3 border-b-2 border-gold-dark">
                <div className="h-8 w-8 rounded-lg bg-gold-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{stageNumber}</span>
                </div>
                <h2 className="text-xl font-bold text-gold-subtle">
                  Etapa {stageNumber}
                </h2>
                {!unlockedStages.includes(stageNumber) && (
                  <span className="ml-auto bg-navy-light/20 text-slate text-xs px-3 py-1 rounded-full font-medium">
                    🔒 Bloqueada
                  </span>
                )}
              </div>
              
              {/* Documents in this stage */}
              <div className="space-y-4">
                {stageDocs.map((doc) => {
                  const config = getStatusConfig(doc.status);
                  const StatusIcon = config.icon;
                  const isStageUnlocked = unlockedStages.includes(doc.stageNumber);
                  const canUpload = (doc.status === 'pending' || doc.status === 'rejected') && isStageUnlocked;

                  return (
                    <Card key={doc._id || doc.id} className="bg-navy-secondary border border-navy-light/20 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <FileText className="h-6 w-6 text-slate-light" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gold-subtle">
                              {doc.name?.es || doc.name?.en || doc.name}
                            </h3>
                            {doc.itemType === 'deliverable' && (
                              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                Entregable
                              </span>
                            )}
                            {doc.itemType === 'document' && doc.required && (
                              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                Requerido
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-slate mb-3">
                        {doc.description?.es || doc.description?.en || ''}
                      </p>

                      <div className="flex items-center space-x-4 mb-3">
                        <Badge className={`${config.bg} ${config.color} flex items-center`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        
                        {doc.requiresPhysicalCopy && (
                          <span className="text-xs text-slate-light flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Requiere copia física
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-light">
                        {config.description}
                      </p>

                      {doc.status === 'rejected' && doc.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">
                            <strong>Razón del rechazo:</strong> {doc.rejectionReason}
                          </p>
                        </div>
                      )}

                      {(doc.notes && doc.notes.length > 0
                        ? doc.notes
                        : doc.note
                          ? [{ id: 'legacy', text: doc.note, createdAt: null }]
                          : []
                      ).map((noteEntry) => (
                        <div key={noteEntry.id} className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Nota del equipo</p>
                            {noteEntry.createdAt && (
                              <p className="text-[10px] text-amber-700">{new Date(noteEntry.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            )}
                          </div>
                          <p className="text-sm text-amber-900 whitespace-pre-wrap">{noteEntry.text}</p>
                        </div>
                      ))}

                      {doc.status === 'uploaded' && doc.uploadedAt && (
                        <p className="text-xs text-slate-light mt-2">
                          Subido el {new Date(doc.uploadedAt).toLocaleDateString('es-ES')}
                        </p>
                      )}

                      {doc.status === 'validated' && doc.reviewedAt && (
                        <p className="text-xs text-success mt-2">
                          Validado el {new Date(doc.reviewedAt).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col space-y-2">
                      {canUpload && (
                        <Button
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowUploadModal(true);
                          }}
                          className="bg-gold-primary hover:bg-gold-dark text-black"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {doc.status === 'rejected' ? 'Resubir' : 'Subir'}
                        </Button>
                      )}
                      
                      {/* Mostrar mensaje si la etapa está bloqueada */}
                      {!isStageUnlocked && (doc.status === 'pending' || doc.status === 'rejected') && (
                        <div className="bg-navy-light/20 border border-navy-light/30 rounded-lg p-3">
                          <p className="text-xs text-slate flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1 text-slate-light" />
                            Etapa {doc.stageNumber} bloqueada
                          </p>
                          <p className="text-xs text-slate-light mt-1">
                            Paga la etapa para subir documentos
                          </p>
                        </div>
                      )}

                      {/* Mostrar botón "Ver" si es Reporte de Elegibilidad, Ruta Personalizada (SIEMPRE) o si tiene fileUrl */}
                      {(doc.isEligibilityReport || doc.isRoadMap || doc.fileUrl) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Si es Reporte de Elegibilidad, descargar PDF
                            if (doc.isEligibilityReport) {
                              handleDownloadPDF();
                            }
                            // Si es Ruta Personalizada, descargar PDF de roadmap
                            else if (doc.isRoadMap) {
                              handleDownloadRoadMapPDF();
                            }
                            // Para otros documentos, abrir el archivo
                            else {
                              window.open(doc.fileUrl, '_blank');
                            }
                          }}
                          disabled={(doc.isEligibilityReport && downloadingPDF) || (doc.isRoadMap && downloadingRoadMapPDF)}
                          className="border-navy-light/30 text-slate hover:bg-navy-primary disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {doc.isEligibilityReport && downloadingPDF ? 'Generando...' : 
                           doc.isRoadMap && downloadingRoadMapPDF ? 'Generando...' : 'Ver'}
                        </Button>
                      )}
                    </div>
                    </div>
                  </CardContent>
                </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Subir Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gold-subtle mb-2">
                  {selectedDocument.name?.es || selectedDocument.name?.en || selectedDocument.name}
                </h4>
                <p className="text-sm text-slate">
                  {selectedDocument.description?.es || selectedDocument.description?.en || ''}
                </p>
                {selectedDocument.requiresPhysicalCopy && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-700">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Este documento también requiere copia física. Envíala por correo.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-2 border-dashed border-navy-light/30 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-slate-light mx-auto mb-3" />
                <p className="text-sm text-slate mb-2">
                  Arrastra tu archivo aquí o haz click para seleccionar
                </p>
                <p className="text-xs text-slate-light mb-3">
                  Formatos: PDF, JPG, PNG (Max 10MB)
                </p>
                <input
                  type="file"
                  className="hidden"
                  id="file-upload-docs"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('El archivo es demasiado grande (máx 10MB)');
                        return;
                      }
                      handleUpload(selectedDocument._id || selectedDocument.id, file);
                    }
                  }}
                />
                <label htmlFor="file-upload-docs">
                  <Button variant="outline" as="span" className="cursor-pointer">
                    Seleccionar Archivo
                  </Button>
                </label>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedDocument(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div> {/* Close padding container */}
    </div>
  );
};
