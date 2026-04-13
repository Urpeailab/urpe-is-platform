import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { WelcomeVideoModal } from '../../components/WelcomeVideoModal';
import { RegisterModal } from '../../components/RegisterModal';
import { getDisplayName } from '../../utils/userUtils';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  FileText, 
  Calendar, 
  MessageSquare, 
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Briefcase,
  Clock,
  Loader2,
  Download,
  Video,
  BookOpen,
  Award
} from 'lucide-react';

export const DashboardHome = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [probabilityData, setProbabilityData] = useState(null);
  const [loadingProbability, setLoadingProbability] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [loadingCase, setLoadingCase] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const isClient = user?.eligible === true && user?.userState === 'U3';
  const isVisitor = user?.userState === 'U1';
  const hasReport = user?.report;

  // Fetch case data for clients
  useEffect(() => {
    const fetchCaseData = async () => {
      if (!isClient) {
        setLoadingCase(false);
        return;
      }

      try {
        setLoadingCase(true);
        const userDataStr = localStorage.getItem('urpe_user');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const token = userData?.token;

        if (!token) {
          setLoadingCase(false);
          return;
        }

        const response = await axios.get(`${BACKEND_URL}/api/client/my-case`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setCaseData(response.data);
      } catch (error) {
        console.error('Error fetching case data:', error);
      } finally {
        setLoadingCase(false);
      }
    };

    fetchCaseData();
  }, [isClient, BACKEND_URL]);

  // Fetch probability data
  useEffect(() => {
    const fetchProbabilityData = async () => {
      if (!user?.phone) {
        setLoadingProbability(false);
        return;
      }

      try {
        setLoadingProbability(true);
        const response = await axios.post(
          'https://n8n.urpeailab.com/webhook/ae8c88b1-3c08-49d8-b365-8e65fe96a291',
          { telefono: user.phone },
          { timeout: 30000 }
        );

        if (response.data) {
          let parsedData;
          if (Array.isArray(response.data)) {
            parsedData = response.data[0];
          } else if (response.data.data && typeof response.data.data === 'string') {
            parsedData = JSON.parse(response.data.data);
          } else {
            parsedData = response.data;
          }
          setProbabilityData(parsedData);
        }
      } catch (err) {
        console.error('Error fetching probability data:', err);
      } finally {
        setLoadingProbability(false);
      }
    };

    fetchProbabilityData();
  }, [user?.phone]);

  // Handler for PDF download
  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    toast.info('Generando PDF completo...');
    
    try {
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
          completeData = user?.report;
        }
      } else {
        completeData = user?.report;
      }

      if (!completeData && !user?.report) {
        toast.error('No hay datos disponibles para generar el reporte.');
        setDownloadingPDF(false);
        return;
      }

      const mergedData = {
        ...user?.report,
        ...completeData,
        nombreCompleto: user?.name || user?.report?.nombreCompleto || completeData?.nombreCompleto,
        ocupacion: user?.report?.ocupacion || completeData?.ocupacion,
        oportunidadesCrecimiento: completeData?.oportunidadesCrecimiento || user?.report?.oportunidadesCrecimiento,
      };
      
      const { generateCompletePDF } = await import('../../utils/completePdfGenerator');
      const result = generateCompletePDF(mergedData, user);
      
      if (result.success) {
        toast.success(result.message || 'Reporte descargado exitosamente');
      } else {
        toast.error(result.message || 'Error al descargar el reporte');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Quick actions - Miller's Law: exactly 4 items for clients, 3 for visitors
  const clientQuickActions = [
    {
      id: 'my-case',
      icon: Briefcase,
      title: 'Mi Caso',
      description: 'Ver progreso de tu visa',
      path: '/dashboard/my-case',
      color: 'gold',
    },
    {
      id: 'appointments',
      icon: Calendar,
      title: 'Citas',
      description: 'Agenda con tu asesor',
      path: '/dashboard/appointments',
      color: 'blue',
    },
    {
      id: 'messages',
      icon: MessageSquare,
      title: 'Mensajes',
      description: 'Comunicación directa',
      path: '/dashboard/messages',
      color: 'green',
    },
    {
      id: 'eligibility',
      icon: FileText,
      title: 'Reporte',
      description: 'Tu evaluación NIW',
      path: '/dashboard/success-calculator',
      color: 'gold',
    },
  ];

  const visitorQuickActions = [
    {
      id: 'eligibility',
      icon: FileText,
      title: 'Reporte de Elegibilidad',
      description: 'Tu evaluación personalizada',
      path: '/dashboard/success-calculator',
      color: 'gold',
    },
    {
      id: 'appointments',
      icon: Calendar,
      title: 'Agendar Cita',
      description: 'Consulta gratuita',
      path: '/dashboard/appointments',
      color: 'blue',
    },
    {
      id: 'success-stories',
      icon: Award,
      title: 'Casos de Exito',
      description: 'Historias de aprobacion',
      path: '/dashboard/success-stories',
      color: 'green',
    },
    {
      id: 'legal-library',
      icon: BookOpen,
      title: 'Biblioteca Legal',
      description: 'Recursos legales',
      path: '/dashboard/legal-library',
      color: 'gold',
    },
  ];

  const quickActions = isClient ? clientQuickActions : visitorQuickActions;

  // Secondary resources - collapsed by default
  const resources = [
    { id: 'webinars', icon: Video, title: 'Webinars', path: '/dashboard/webinars' },
    { id: 'library', icon: BookOpen, title: 'Biblioteca Legal', path: '/dashboard/legal-library' },
    { id: 'stories', icon: Award, title: 'Casos de Éxito', path: '/dashboard/success-stories' },
  ];

  return (
    <>
      <RegisterModal 
        isOpen={showRegisterModal} 
        onClose={() => setShowRegisterModal(false)} 
      />

      <div className="min-h-screen bg-[#0F172A] pb-24 sm:pb-8">
        {/* ========== COMPACT HERO ========== */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          <div className="max-w-4xl mx-auto">
            {/* Welcome + Badge */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#F8FAFC] mb-1" data-testid="welcome-title">
                  ¡Hola, {getDisplayName(user)}!
                </h1>
                <p className="text-[#94A3B8] text-sm sm:text-base">
                  {isClient ? 'Tu caso está en progreso' : 'Gestiona tu proceso migratorio'}
                </p>
              </div>
              {isClient && (
                <Badge className="bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 px-3 py-1.5 flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Cliente Activo
                </Badge>
              )}
            </div>

            {/* ========== PROGRESS CARD (Clients only) ========== */}
            {isClient && !loadingCase && caseData && (
              <Card className="bg-[#1E293B] border border-[#334155] rounded-xl mb-6 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-[#C9A96A]/20 flex items-center justify-center border border-[#C9A96A]/30">
                        <TrendingUp className="h-5 w-5 text-[#C9A96A]" />
                      </div>
                      <div>
                        <p className="text-[#F8FAFC] font-medium">Progreso del Caso</p>
                        <p className="text-[#64748B] text-sm">{caseData.case?.visaType || 'EB-2 NIW'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[#C9A96A]">{caseData.progress?.overallProgress || 0}%</p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-[#334155] rounded-full h-2.5 mb-4">
                    <div 
                      className="bg-gradient-to-r from-[#C9A96A] to-[#22C55E] rounded-full h-2.5 transition-all duration-700" 
                      style={{ width: `${caseData.progress?.overallProgress || 0}%` }}
                    />
                  </div>
                  
                  {/* Quick Status - Show completed stages count */}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-[#22C55E]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{caseData.progress?.paidStages?.filter(s => s !== null).length || 0} etapas completadas</span>
                    </div>
                    <span className="text-[#334155]">•</span>
                    <span className="text-[#94A3B8]">Etapa actual: {caseData.case?.currentStage || 1}</span>
                  </div>
                  
                  {/* CTA */}
                  <Button
                    onClick={() => navigate('/dashboard/my-case')}
                    className="w-full mt-4 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold py-3 min-h-[48px]"
                    data-testid="view-case-btn"
                  >
                    Ver detalles de mi caso
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Loading state for case */}
            {isClient && loadingCase && (
              <Card className="bg-[#1E293B] border border-[#334155] rounded-xl mb-6">
                <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-[#C9A96A]" />
                    <span className="text-[#94A3B8]">Cargando progreso...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========== PROBABILITY CARD (Compact) ========== */}
            {loadingProbability ? (
              <Card className="bg-[#1E293B] border border-[#334155] rounded-xl mb-6">
                <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-[#C9A96A]" />
                    <span className="text-[#94A3B8]">Calculando probabilidad...</span>
                  </div>
                </CardContent>
              </Card>
            ) : probabilityData ? (
              <Card className="bg-[#1E293B] border border-[#C9A96A]/30 rounded-xl mb-6 overflow-hidden">
                <CardContent className="p-5">
                  {/* Title - Clear context */}
                  <div className="text-center mb-4">
                    <h2 className="text-[#F8FAFC] font-semibold text-lg">Tu Probabilidad de Aprobación</h2>
                    <p className="text-[#64748B] text-xs mt-1">Basado en tu perfil y casos similares</p>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Current */}
                    <div className="text-center flex-1">
                      <p className="text-[#64748B] text-xs uppercase tracking-wide mb-1">Sin URPE</p>
                      <p className="text-2xl sm:text-3xl font-bold text-[#C9A96A]">{probabilityData.probabilidadActual}%</p>
                    </div>
                    
                    {/* Center: Arrow + Increment */}
                    <div className="flex flex-col items-center px-4">
                      <div className="text-[#22C55E] font-bold text-lg sm:text-xl">+{probabilityData.incremento}%</div>
                      <ChevronRight className="h-5 w-5 text-[#C9A96A]" />
                    </div>
                    
                    {/* Right: With Services */}
                    <div className="text-center flex-1">
                      <p className="text-[#64748B] text-xs uppercase tracking-wide mb-1">Con URPE</p>
                      <p className="text-2xl sm:text-3xl font-bold text-[#22C55E]">{probabilityData.probabilidadConServicios}%</p>
                    </div>
                  </div>
                  
                  {/* CTA Buttons */}
                  <div className="flex gap-3 mt-5">
                    <Button
                      onClick={() => navigate('/dashboard/success-calculator')}
                      className="flex-1 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold py-3 min-h-[48px]"
                    >
                      Ver análisis completo
                    </Button>
                    <Button
                      onClick={handleDownloadPDF}
                      disabled={downloadingPDF}
                      className="bg-[#1E293B] border-2 border-[#C9A96A] text-[#C9A96A] hover:bg-[#C9A96A]/10 px-4 min-h-[48px]"
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* ========== QUICK ACTIONS GRID - Miller's Law: 4 items ========== */}
            <div className="mb-6">
              <h2 className="text-sm font-medium text-[#94A3B8] uppercase tracking-wide mb-3">
                Acciones rápidas
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.slice(0, 4).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => navigate(action.path)}
                    className="bg-[#1E293B] border border-[#334155] hover:border-[#C9A96A]/50 rounded-xl p-4 text-left transition-all duration-200 active:scale-[0.98] min-h-[100px] group"
                    data-testid={`action-${action.id}`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${
                      action.color === 'gold' ? 'bg-[#C9A96A]/20 border border-[#C9A96A]/30' :
                      action.color === 'blue' ? 'bg-blue-500/20 border border-blue-500/30' :
                      'bg-[#22C55E]/20 border border-[#22C55E]/30'
                    }`}>
                      <action.icon className={`h-5 w-5 ${
                        action.color === 'gold' ? 'text-[#C9A96A]' :
                        action.color === 'blue' ? 'text-blue-400' :
                        'text-[#22C55E]'
                      }`} />
                    </div>
                    <p className="text-[#F8FAFC] font-medium text-sm group-hover:text-[#C9A96A] transition-colors">
                      {action.title}
                    </p>
                    <p className="text-[#64748B] text-xs mt-0.5 line-clamp-1">
                      {action.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* ========== RESOURCES ROW - Hick's Law: minimal choices ========== */}
            <div className="mb-6">
              <h2 className="text-sm font-medium text-[#94A3B8] uppercase tracking-wide mb-3">
                Recursos
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {resources.map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => navigate(resource.path)}
                    className="flex items-center gap-2 bg-[#1E293B] border border-[#334155] hover:border-[#C9A96A]/50 rounded-full px-4 py-2.5 text-sm whitespace-nowrap transition-all flex-shrink-0 min-h-[44px]"
                    data-testid={`resource-${resource.id}`}
                  >
                    <resource.icon className="h-4 w-4 text-[#C9A96A]" />
                    <span className="text-[#F8FAFC]">{resource.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ========== VISITOR CTA (Only for U1) ========== */}
            {isVisitor && (
              <Card className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-2 border-[#22C55E]/30 rounded-xl overflow-hidden">
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#22C55E]/20 border border-[#22C55E]/30 mb-4">
                    <CheckCircle2 className="h-7 w-7 text-[#22C55E]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2">
                    ¿Listo para comenzar?
                  </h3>
                  <p className="text-[#94A3B8] text-sm mb-5 max-w-sm mx-auto">
                    Deja que expertos manejen todo tu proceso de visa EB-2 NIW
                  </p>
                  <Button
                    onClick={() => navigate('/dashboard/appointments')}
                    className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold px-8 py-3 min-h-[52px] text-base"
                    data-testid="start-cta"
                  >
                    Agendar consulta gratuita
                  </Button>
                  <p className="text-[#64748B] text-xs mt-3">
                    Sin compromiso • Respuesta en 24h
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ========== NEXT APPOINTMENT (If scheduled) ========== */}
            {isClient && (
              <Card className="bg-[#1E293B] border border-[#334155] rounded-xl mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <Clock className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[#F8FAFC] font-medium text-sm">Próxima cita</p>
                        <p className="text-[#64748B] text-xs">Martes 14 Ene • 10:00 AM</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate('/dashboard/appointments')}
                      size="sm"
                      className="bg-[#334155] hover:bg-[#475569] text-[#F8FAFC] px-3 min-h-[40px]"
                    >
                      Ver todas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </>
  );
};
