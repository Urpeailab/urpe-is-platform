import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  FileText,
  Users,
  Globe,
  Target,
  ArrowRight,
  Lightbulb,
  GraduationCap,
  Mail,
  MessageCircle,
  Smartphone,
  Image,
  Share2,
  Folder,
  File,
  Loader2,
  Download,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Sparkles,
  Clock,
  RefreshCw
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * SuccessCalculatorPage - REDISEÑADO para cumplir las 3 leyes de UX:
 * 
 * 1. LEY DE MILLER (7±2): Máximo 4 tabs, contenido en acordeones colapsables
 * 2. LEY DE HICK: Solo Top 3 opciones visibles, un CTA claro principal
 * 3. LEY DE FITTS: Botones ≥48px, CTA sticky siempre visible al fondo
 */

// Icon mapping
const iconMap = {
  'graduation-cap': GraduationCap,
  'briefcase': Briefcase,
  'file-text': FileText,
  'mail': Mail,
  'message-circle': MessageCircle,
  'award': Award,
  'book': BookOpen,
  'book-open': BookOpen,
  'file': File,
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  'users': Users,
  'globe': Globe,
  'smartphone': Smartphone,
  'image': Image,
  'share-2': Share2,
  'folder': Folder
};

export const SuccessCalculatorPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [calculatorData, setCalculatorData] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [noReport, setNoReport] = useState(false);
  const [checking, setChecking] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);
  
  // UX State: Tab navigation (Miller's Law - only 4 options)
  const [activeTab, setActiveTab] = useState('resumen');
  
  // UX State: Expandable sections (Hick's Law - show less by default)
  const [showAllOportunidades, setShowAllOportunidades] = useState(false);
  const [showAllRecomendaciones, setShowAllRecomendaciones] = useState(false);
  const [showAllServicios, setShowAllServicios] = useState(false);

  // Check if user has a REAL report (not just default/empty)
  const hasRealReport = useCallback(() => {
    const report = user?.report;
    if (!report || typeof report !== 'object') return false;
    // Check for real data markers
    return !!(
      report.nombreCompleto || 
      report.proyectoTitulo || 
      report.ocupacion ||
      (report.probabilidadActual && report.probabilidadActual !== 45) ||
      report.analisisPerfil?.resumen
    );
  }, [user?.report]);

  // Auto-refresh function
  const checkForReport = useCallback(async () => {
    if (!noReport) return;
    
    setChecking(true);
    try {
      if (refreshUser) {
        await refreshUser();
        // Check if report is now available
        if (hasRealReport()) {
          setNoReport(false);
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error checking for report:', error);
    } finally {
      setChecking(false);
    }
  }, [noReport, refreshUser, hasRealReport]);

  // Countdown timer for auto-refresh when no report
  useEffect(() => {
    if (!noReport) return;

    const countdownInterval = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          checkForReport();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [noReport, checkForReport]);

  const handleManualRefresh = () => {
    setSecondsUntilRefresh(30);
    checkForReport();
  };

  const handleContactSupport = () => {
    window.open('https://wa.me/18094441000?text=Hola,%20mi%20reporte%20de%20elegibilidad%20no%20se%20ha%20generado', '_blank');
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    toast.info('Generando PDF...');
    
    try {
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

  useEffect(() => {
    const fetchCalculatorData = async () => {
      // First try to use user.report if available (fallback)
      if (user?.report) {
        console.log('Using user.report as data source');
        setCalculatorData({
          probabilidadActual: user.report.probabilidadActual || 45,
          probabilidadConServicios: user.report.probabilidadConServicios || 94,
          incremento: user.report.incremento || 49,
          estadoElegibilidad: user.report.estadoElegibilidad || 'Elegible',
          analisisPerfil: {
            resumen: user.report.resumenPerfil || 'Tu perfil muestra un potencial significativo para la visa EB-2 NIW.',
            ventajasCompetitivas: user.report.puntosFuertes || [],
            requiereAtencion: user.report.areasAFortalecer || []
          },
          fortalezasActuales: user.report.fortalezas || [],
          oportunidadesCrecimiento: user.report.oportunidades?.map(o => ({
            servicios: [{ 
              nombre: o.nombre, 
              descripcion: o.descripcion, 
              impactoPorcentaje: `+${o.porcentaje}%`,
              icono: 'award'
            }]
          })) || [],
          recomendacionesPersonalizadas: user.report.recomendaciones?.map((r, i) => ({
            titulo: `Recomendación ${i + 1}`,
            descripcion: r,
            impactoAlto: 'Alto'
          })) || []
        });
        setLoading(false);
        return;
      }

      // Try webhook if phone is available
      if (user?.phone) {
        try {
          setLoading(true);
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

            if (parsedData && Object.keys(parsedData).length > 0) {
              setCalculatorData(parsedData);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Webhook error:', err);
        }
      }

      // If no data from webhook or report, set noReport state instead of demo data
      console.log('No report data available');
      setNoReport(true);
      setLoading(false);
    };

    fetchCalculatorData();
  }, [user?.phone, user?.report, hasRealReport]);

  const getIconComponent = (iconName) => iconMap[iconName] || Award;

  // Tabs for navigation (Miller's Law: 4 options max)
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: Target },
    { id: 'perfil', label: 'Tu Perfil', icon: Sparkles },
    { id: 'oportunidades', label: 'Oportunidades', icon: TrendingUp },
    { id: 'plan', label: 'Plan', icon: ArrowRight },
  ];

  // Get top 3 items (Hick's Law)
  const allServicios = calculatorData?.oportunidadesCrecimiento?.flatMap(c => c.servicios || []) || [];
  const sortedServicios = [...allServicios].sort((a, b) => {
    const getNum = (str) => parseInt(str?.match(/\d+/)?.[0] || 0);
    return getNum(b.impactoPorcentaje) - getNum(a.impactoPorcentaje);
  });
  const topServicios = sortedServicios.slice(0, 3);
  const remainingServicios = sortedServicios.slice(3);

  const topRecomendaciones = calculatorData?.recomendacionesPersonalizadas?.slice(0, 3) || [];
  const remainingRecomendaciones = calculatorData?.recomendacionesPersonalizadas?.slice(3) || [];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center" data-testid="loading">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#C9A96A] mx-auto mb-4" />
          <p className="text-[#F8FAFC] font-semibold">Calculando tu probabilidad...</p>
          <p className="text-[#64748B] text-sm">Analizando tu perfil</p>
        </div>
      </div>
    );
  }

  // No Report state - Show "generating" message with auto-refresh
  if (noReport) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4" data-testid="no-report-state">
        <Card className="bg-[#1E293B] border border-[#334155] max-w-md w-full">
          <CardContent className="p-8 text-center">
            {/* Animated loader */}
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-[#334155] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#C9A96A] rounded-full animate-spin"></div>
              <Clock className="absolute inset-0 m-auto h-8 w-8 text-[#C9A96A]" />
            </div>
            
            <h2 className="text-xl font-bold text-[#F8FAFC] mb-2">
              Tu reporte está en proceso
            </h2>
            
            <p className="text-[#94A3B8] mb-4 text-sm">
              Estamos generando tu análisis personalizado de elegibilidad EB-2 NIW. 
              Este proceso puede tomar entre <span className="text-[#C9A96A] font-semibold">10-20 minutos</span>.
            </p>
            
            {/* Auto-refresh indicator */}
            <div className="bg-[#0F172A] rounded-lg p-3 mb-6 border border-[#334155]">
              <div className="flex items-center justify-center gap-2 text-sm">
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 text-[#C9A96A] animate-spin" />
                    <span className="text-[#94A3B8]">Verificando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 text-[#64748B]" />
                    <span className="text-[#64748B]">
                      Verificación automática en <span className="text-[#C9A96A] font-mono">{secondsUntilRefresh}s</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Manual refresh button */}
            <Button
              onClick={handleManualRefresh}
              disabled={checking}
              variant="outline"
              className="w-full h-12 mb-3 border-[#334155] text-[#F8FAFC] hover:bg-[#334155] hover:text-[#F8FAFC]"
              data-testid="refresh-btn"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar ahora
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#334155]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#1E293B] text-[#64748B]">¿Más de 20 minutos?</span>
              </div>
            </div>

            {/* Contact support suggestion */}
            <p className="text-[#94A3B8] text-sm">
              Si han pasado más de 20 minutos y tu reporte no aparece, 
              por favor contacta a nuestro equipo de soporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !calculatorData) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4" data-testid="error">
        <Card className="bg-[#1E293B] border border-[#334155] max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-[#F59E0B] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#F8FAFC] mb-2">Error al cargar</h2>
            <p className="text-[#94A3B8] mb-6 text-sm">{error || 'No se pudieron cargar los datos'}</p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full h-14 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-bold"
            >
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28" data-testid="success-calculator-page">
      <div className="px-4 sm:px-6 pt-6 max-w-4xl mx-auto">
        
        {/* ========== HERO: Probabilidad (Always visible - Key metric) ========== */}
        <Card className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#334155] mb-6" data-testid="probability-hero">
          <CardContent className="p-6">
            {/* Header with Logo and UIS branding */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#C9A96A] to-[#B8956A] flex items-center justify-center shadow-lg shadow-[#C9A96A]/20">
                  <Award className="h-7 w-7 text-[#0F172A]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">UIS</h1>
                  <p className="text-[#C9A96A] text-xs font-medium tracking-wide">Your Path to Success</p>
                </div>
              </div>
              <Badge className="bg-[#22C55E] text-white px-4 py-2 text-sm font-semibold">
                {calculatorData.estadoElegibilidad || 'Elegible'}
              </Badge>
            </div>

            {/* Probability Display - 3 elements (Miller) */}
            <div className="flex items-center justify-between gap-4">
              {/* Current */}
              <div className="text-center flex-1">
                <div className="relative inline-block">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#334155" strokeWidth="8" fill="none" />
                    <circle
                      cx="48" cy="48" r="40"
                      stroke="#F59E0B"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - (calculatorData.probabilidadActual || 45) / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#F59E0B]">
                    {calculatorData.probabilidadActual || 45}%
                  </span>
                </div>
                <p className="text-[#64748B] text-xs mt-2 uppercase tracking-wide">Actual</p>
              </div>

              {/* Increment */}
              <div className="text-center">
                <div className="bg-[#22C55E]/20 border border-[#22C55E]/30 rounded-xl px-4 py-3">
                  <ArrowRight className="h-5 w-5 text-[#22C55E] mx-auto mb-1" />
                  <span className="text-2xl font-bold text-[#22C55E]">+{calculatorData.incremento || 49}%</span>
                </div>
              </div>

              {/* With Services */}
              <div className="text-center flex-1">
                <div className="relative inline-block">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#334155" strokeWidth="8" fill="none" />
                    <circle
                      cx="48" cy="48" r="40"
                      stroke="#22C55E"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - (calculatorData.probabilidadConServicios || 94) / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#22C55E]">
                    {calculatorData.probabilidadConServicios || 94}%
                  </span>
                </div>
                <p className="text-[#64748B] text-xs mt-2 uppercase tracking-wide">Con URPE</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========== TAB NAVIGATION - Miller's Law: 4 options ========== */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`
                  flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all min-h-[48px]
                  ${isActive 
                    ? 'bg-[#C9A96A] text-[#0F172A]' 
                    : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155]'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========== TAB CONTENT ========== */}
        <div className="space-y-4">
          
          {/* RESUMEN Tab */}
          {activeTab === 'resumen' && (
            <div className="space-y-4" data-testid="tab-content-resumen">
              {/* Summary */}
              {calculatorData.analisisPerfil?.resumen && (
                <Card className="bg-[#1E293B] border border-[#334155]">
                  <CardContent className="p-5">
                    <h3 className="text-[#F8FAFC] font-semibold mb-3">Resumen de tu Perfil</h3>
                    <p className="text-[#94A3B8] text-sm leading-relaxed">{calculatorData.analisisPerfil.resumen}</p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats - 2 items (Miller) */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-[#22C55E]/10 border border-[#22C55E]/30">
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-[#22C55E] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#22C55E]">
                      {calculatorData.analisisPerfil?.ventajasCompetitivas?.length || calculatorData.fortalezasActuales?.filter(f => f.tiene)?.length || 0}
                    </p>
                    <p className="text-[#94A3B8] text-xs">Ventajas</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#F59E0B]">
                      {calculatorData.analisisPerfil?.requiereAtencion?.length || 0}
                    </p>
                    <p className="text-[#94A3B8] text-xs">Áreas a mejorar</p>
                  </CardContent>
                </Card>
              </div>

              {/* Key Message */}
              <Card className="bg-gradient-to-r from-[#C9A96A]/20 to-transparent border border-[#C9A96A]/30">
                <CardContent className="p-5">
                  <p className="text-[#F8FAFC] text-sm">
                    Con URPE, tu probabilidad aumenta de{' '}
                    <span className="text-[#F59E0B] font-bold">{calculatorData.probabilidadActual}%</span> a{' '}
                    <span className="text-[#22C55E] font-bold">{calculatorData.probabilidadConServicios}%</span>.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PERFIL Tab */}
          {activeTab === 'perfil' && (
            <div className="space-y-4" data-testid="tab-content-perfil">
              {/* Ventajas */}
              {calculatorData.analisisPerfil?.ventajasCompetitivas?.length > 0 && (
                <Card className="bg-[#1E293B] border border-[#334155]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                      </div>
                      <h3 className="text-[#22C55E] font-semibold">Ventajas Competitivas</h3>
                    </div>
                    <ul className="space-y-3">
                      {calculatorData.analisisPerfil.ventajasCompetitivas.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[#E2E8F0] text-sm">
                          <span className="text-[#22C55E] mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Requiere Atención */}
              {calculatorData.analisisPerfil?.requiereAtencion?.length > 0 && (
                <Card className="bg-[#1E293B] border border-[#334155]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-[#F59E0B]" />
                      </div>
                      <h3 className="text-[#F59E0B] font-semibold">Requiere Atención</h3>
                    </div>
                    <ul className="space-y-3">
                      {calculatorData.analisisPerfil.requiereAtencion.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[#E2E8F0] text-sm">
                          <span className="text-[#F59E0B] mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Fortalezas con % */}
              {calculatorData.fortalezasActuales?.filter(f => f.tiene)?.length > 0 && (
                <Card className="bg-[#1E293B] border border-[#334155]">
                  <CardContent className="p-5">
                    <h3 className="text-[#F8FAFC] font-semibold mb-4">Impacto de tus Fortalezas</h3>
                    <div className="space-y-3">
                      {calculatorData.fortalezasActuales.filter(f => f.tiene).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg">
                          <div>
                            <p className="text-[#F8FAFC] text-sm font-medium">{item.nombre}</p>
                            <p className="text-[#64748B] text-xs">{item.descripcion}</p>
                          </div>
                          <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-0">
                            {item.impactoPorcentaje}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* OPORTUNIDADES Tab - Hick's Law: Top 3 visible */}
          {activeTab === 'oportunidades' && (
            <div className="space-y-4" data-testid="tab-content-oportunidades">
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[#F8FAFC] font-semibold">Top 3 Servicios Recomendados</h3>
                    <Badge className="bg-[#C9A96A]/20 text-[#C9A96A] border-0">
                      {allServicios.length} total
                    </Badge>
                  </div>

                  {/* Top 3 */}
                  <div className="space-y-3">
                    {topServicios.map((servicio, idx) => {
                      const Icon = getIconComponent(servicio.icono);
                      return (
                        <div key={idx} className="p-4 bg-[#0F172A] rounded-xl border border-[#22C55E]/30">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-5 w-5 text-[#22C55E]" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-[#F8FAFC] font-medium text-sm">{servicio.nombre}</h4>
                                <Badge className="bg-[#22C55E] text-white">
                                  {servicio.impactoPorcentaje}
                                </Badge>
                              </div>
                              <p className="text-[#64748B] text-xs">{servicio.descripcion}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Show More */}
                  {remainingServicios.length > 0 && (
                    <>
                      {showAllServicios && (
                        <div className="space-y-3 mt-3">
                          {remainingServicios.map((servicio, idx) => {
                            const Icon = getIconComponent(servicio.icono);
                            return (
                              <div key={idx} className="p-4 bg-[#0F172A] rounded-xl border border-[#334155]">
                                <div className="flex items-start gap-3">
                                  <div className="h-10 w-10 rounded-full bg-[#64748B]/20 flex items-center justify-center flex-shrink-0">
                                    <Icon className="h-5 w-5 text-[#64748B]" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-[#94A3B8] font-medium text-sm">{servicio.nombre}</h4>
                                      <Badge className="bg-[#64748B]/20 text-[#94A3B8] border-0">
                                        {servicio.impactoPorcentaje}
                                      </Badge>
                                    </div>
                                    <p className="text-[#64748B] text-xs">{servicio.descripcion}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <button
                        onClick={() => setShowAllServicios(!showAllServicios)}
                        className="w-full mt-4 py-3 text-[#C9A96A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C9A96A]/10 rounded-lg transition-colors min-h-[48px]"
                        data-testid="show-more-servicios"
                      >
                        {showAllServicios ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Ver menos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Ver {remainingServicios.length} más
                          </>
                        )}
                      </button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PLAN Tab - Hick's Law: Top 3 */}
          {activeTab === 'plan' && (
            <div className="space-y-4" data-testid="tab-content-plan">
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <h3 className="text-[#F8FAFC] font-semibold mb-4">Tus 3 Próximos Pasos</h3>
                  
                  <div className="space-y-4">
                    {topRecomendaciones.map((rec, idx) => (
                      <div key={idx} className="p-4 bg-[#0F172A] rounded-xl border-l-4 border-[#C9A96A]">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#C9A96A] text-[#0F172A] font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-[#F8FAFC] font-medium text-sm">{rec.titulo}</h4>
                              <Badge className="bg-[#3B82F6] text-white text-xs">
                                {rec.impactoAlto}
                              </Badge>
                            </div>
                            <p className="text-[#94A3B8] text-xs">{rec.descripcion}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Show More Recomendaciones */}
                  {remainingRecomendaciones.length > 0 && (
                    <>
                      {showAllRecomendaciones && (
                        <div className="space-y-4 mt-4">
                          {remainingRecomendaciones.map((rec, idx) => (
                            <div key={idx} className="p-4 bg-[#0F172A] rounded-xl border-l-4 border-[#64748B]">
                              <div className="flex items-start gap-3">
                                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#64748B] text-[#F8FAFC] font-bold flex-shrink-0">
                                  {idx + 4}
                                </span>
                                <div className="flex-1">
                                  <h4 className="text-[#94A3B8] font-medium text-sm mb-1">{rec.titulo}</h4>
                                  <p className="text-[#64748B] text-xs">{rec.descripcion}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button
                        onClick={() => setShowAllRecomendaciones(!showAllRecomendaciones)}
                        className="w-full mt-4 py-3 text-[#C9A96A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C9A96A]/10 rounded-lg transition-colors min-h-[48px]"
                        data-testid="show-more-recomendaciones"
                      >
                        {showAllRecomendaciones ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Ver menos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Ver {remainingRecomendaciones.length} más
                          </>
                        )}
                      </button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ========== STICKY CTA - Fitts' Law: Always visible, 56px height ========== */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent p-4 sm:pl-[280px]" data-testid="sticky-cta">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            variant="outline"
            className="flex-1 h-14 border-[#C9A96A] text-[#C9A96A] hover:bg-[#C9A96A]/10 font-semibold"
            data-testid="download-btn"
          >
            <Download className="h-5 w-5 mr-2" />
            {downloadingPDF ? 'Generando...' : 'PDF'}
          </Button>
          
          <Button
            onClick={() => navigate('/dashboard/appointments')}
            className="flex-[2] h-14 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-bold text-base"
            data-testid="cta-agendar"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Agendar Consulta
          </Button>
        </div>
      </div>
    </div>
  );
};
