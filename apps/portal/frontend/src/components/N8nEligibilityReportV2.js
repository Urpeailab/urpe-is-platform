import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Download,
  TrendingUp,
  Target,
  Sparkles
} from 'lucide-react';

/**
 * N8nEligibilityReportV2 - Rediseñado para cumplir con las 3 leyes de UX:
 * 
 * 1. LEY DE MILLER (7±2): Máximo 5 secciones visibles, contenido en acordeones
 * 2. LEY DE HICK: Solo 3 opciones principales visibles, un CTA claro
 * 3. LEY DE FITTS: Botones ≥48px, CTA sticky siempre visible
 */
export const N8nEligibilityReportV2 = ({ report, onDownloadPDF, downloading }) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('resumen');
  const [showAllOportunidades, setShowAllOportunidades] = useState(false);
  const [showAllRecomendaciones, setShowAllRecomendaciones] = useState(false);

  if (!report) return null;

  // Get badge style based on status
  const getBadgeStyle = () => {
    const status = report.estadoElegibilidad || '';
    if (status.includes('Elegible')) return 'bg-[#22C55E] text-white';
    if (status.includes('Potencialmente')) return 'bg-[#F59E0B] text-white';
    return 'bg-[#64748B] text-white';
  };

  // Section tabs - Miller's Law: Only 4 main sections
  const sections = [
    { id: 'resumen', label: 'Resumen', icon: Target },
    { id: 'perfil', label: 'Tu Perfil', icon: Sparkles },
    { id: 'oportunidades', label: 'Oportunidades', icon: TrendingUp },
    { id: 'plan', label: 'Plan de Acción', icon: ArrowRight },
  ];

  // Get top 3 oportunidades (Hick's Law)
  const topOportunidades = report.oportunidades?.slice(0, 3) || [];
  const remainingOportunidades = report.oportunidades?.slice(3) || [];

  // Get top 3 recomendaciones (Hick's Law)
  const topRecomendaciones = report.recomendaciones?.slice(0, 3) || [];
  const remainingRecomendaciones = report.recomendaciones?.slice(3) || [];

  return (
    <div className="relative pb-24" data-testid="eligibility-report-v2">
      {/* ========== HERO: Probabilidad de Éxito (Always visible - Key metric) ========== */}
      <Card className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#334155] mb-6" data-testid="probability-hero">
        <CardContent className="p-6">
          {/* Header with status */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[#64748B] text-sm">Tu Reporte de Elegibilidad</p>
              <h1 className="text-xl font-bold text-[#F8FAFC]">EB-2 NIW</h1>
            </div>
            <Badge className={`${getBadgeStyle()} px-4 py-2 text-sm font-semibold`}>
              {report.estadoElegibilidad || 'En Evaluación'}
            </Badge>
          </div>

          {/* Probability Display - 3 elements only (Miller) */}
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
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (report.probabilidadActual || 45) / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#F59E0B]">
                  {report.probabilidadActual || 45}%
                </span>
              </div>
              <p className="text-[#64748B] text-xs mt-2 uppercase tracking-wide">Actual</p>
            </div>

            {/* Increment */}
            <div className="text-center">
              <div className="bg-[#22C55E]/20 border border-[#22C55E]/30 rounded-xl px-4 py-3">
                <ArrowRight className="h-5 w-5 text-[#22C55E] mx-auto mb-1" />
                <span className="text-2xl font-bold text-[#22C55E]">+{report.incremento || 49}%</span>
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
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (report.probabilidadConServicios || 94) / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#22C55E]">
                  {report.probabilidadConServicios || 94}%
                </span>
              </div>
              <p className="text-[#64748B] text-xs mt-2 uppercase tracking-wide">Con URPE</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== TAB NAVIGATION - Miller's Law: 4 options max ========== */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="section-tabs">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              data-testid={`tab-${section.id}`}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all
                min-h-[48px]
                ${isActive 
                  ? 'bg-[#C9A96A] text-[#0F172A]' 
                  : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155]'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* ========== SECTION CONTENT ========== */}
      <div className="space-y-4">
        
        {/* RESUMEN Section */}
        {activeSection === 'resumen' && (
          <div className="space-y-4" data-testid="section-resumen">
            {/* Summary Card */}
            {report.resumenPerfil && (
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <h3 className="text-[#F8FAFC] font-semibold mb-3">Resumen de tu Perfil</h3>
                  <p className="text-[#94A3B8] text-sm leading-relaxed">{report.resumenPerfil}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats - 2 items only (Miller) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Strengths */}
              <Card className="bg-[#22C55E]/10 border border-[#22C55E]/30">
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-[#22C55E] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#22C55E]">{report.puntosFuertes?.length || 0}</p>
                  <p className="text-[#94A3B8] text-xs">Ventajas</p>
                </CardContent>
              </Card>

              {/* Areas to improve */}
              <Card className="bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#F59E0B]">{report.areasAFortalecer?.length || 0}</p>
                  <p className="text-[#94A3B8] text-xs">Áreas a mejorar</p>
                </CardContent>
              </Card>
            </div>

            {/* Key Message */}
            <Card className="bg-gradient-to-r from-[#C9A96A]/20 to-transparent border border-[#C9A96A]/30">
              <CardContent className="p-5">
                <p className="text-[#F8FAFC] text-sm">
                  Con los servicios especializados de URPE, tu probabilidad de éxito aumenta de{' '}
                  <span className="text-[#F59E0B] font-bold">{report.probabilidadActual || 45}%</span> a{' '}
                  <span className="text-[#22C55E] font-bold">{report.probabilidadConServicios || 94}%</span>.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PERFIL Section */}
        {activeSection === 'perfil' && (
          <div className="space-y-4" data-testid="section-perfil">
            {/* Strengths */}
            {report.puntosFuertes?.length > 0 && (
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                    </div>
                    <h3 className="text-[#22C55E] font-semibold">Tus Ventajas Competitivas</h3>
                  </div>
                  <ul className="space-y-3">
                    {report.puntosFuertes.slice(0, 5).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[#E2E8F0] text-sm">
                        <span className="text-[#22C55E] mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Areas to Improve */}
            {report.areasAFortalecer?.length > 0 && (
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                    </div>
                    <h3 className="text-[#F59E0B] font-semibold">Áreas a Fortalecer</h3>
                  </div>
                  <ul className="space-y-3">
                    {report.areasAFortalecer.slice(0, 5).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[#E2E8F0] text-sm">
                        <span className="text-[#F59E0B] mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Fortalezas con porcentajes */}
            {report.fortalezas?.length > 0 && (
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <h3 className="text-[#F8FAFC] font-semibold mb-4">Impacto de tus Fortalezas</h3>
                  <div className="space-y-3">
                    {report.fortalezas.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg">
                        <div>
                          <p className="text-[#F8FAFC] text-sm font-medium">{item.nombre}</p>
                          <p className="text-[#64748B] text-xs">{item.descripcion}</p>
                        </div>
                        <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-0">
                          +{item.porcentaje}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* OPORTUNIDADES Section - Hick's Law: Show only 3 initially */}
        {activeSection === 'oportunidades' && (
          <div className="space-y-4" data-testid="section-oportunidades">
            <Card className="bg-[#1E293B] border border-[#334155]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#F8FAFC] font-semibold">Servicios Recomendados</h3>
                  <Badge className="bg-[#C9A96A]/20 text-[#C9A96A] border-0">
                    {report.oportunidades?.length || 0} opciones
                  </Badge>
                </div>
                
                <p className="text-[#64748B] text-sm mb-4">
                  Los 3 servicios con mayor impacto para tu caso:
                </p>

                {/* Top 3 Oportunidades - Hick's Law */}
                <div className="space-y-3">
                  {topOportunidades.map((opp, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-[#0F172A] rounded-xl border border-[#334155] hover:border-[#C9A96A]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#C9A96A] text-[#0F172A] text-xs font-bold">
                              {idx + 1}
                            </span>
                            <h4 className="text-[#F8FAFC] font-medium text-sm">{opp.nombre}</h4>
                          </div>
                          <p className="text-[#64748B] text-xs ml-8">{opp.descripcion}</p>
                        </div>
                        <Badge className="bg-[#22C55E]/20 text-[#22C55E] border-0 ml-2">
                          +{opp.porcentaje}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show More Button - Hick's Law: Hidden by default */}
                {remainingOportunidades.length > 0 && (
                  <>
                    {showAllOportunidades && (
                      <div className="space-y-3 mt-3">
                        {remainingOportunidades.map((opp, idx) => (
                          <div 
                            key={idx + 3} 
                            className="p-4 bg-[#0F172A] rounded-xl border border-[#334155]"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#64748B] text-[#F8FAFC] text-xs font-bold">
                                    {idx + 4}
                                  </span>
                                  <h4 className="text-[#94A3B8] font-medium text-sm">{opp.nombre}</h4>
                                </div>
                                <p className="text-[#64748B] text-xs ml-8">{opp.descripcion}</p>
                              </div>
                              <Badge className="bg-[#64748B]/20 text-[#94A3B8] border-0 ml-2">
                                +{opp.porcentaje}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowAllOportunidades(!showAllOportunidades)}
                      className="w-full mt-4 py-3 text-[#C9A96A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C9A96A]/10 rounded-lg transition-colors"
                      data-testid="show-more-oportunidades"
                    >
                      {showAllOportunidades ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Ver {remainingOportunidades.length} más
                        </>
                      )}
                    </button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* PLAN DE ACCIÓN Section - Hick's Law: Show only 3 steps */}
        {activeSection === 'plan' && (
          <div className="space-y-4" data-testid="section-plan">
            {/* Top 3 Recomendaciones */}
            <Card className="bg-[#1E293B] border border-[#334155]">
              <CardContent className="p-5">
                <h3 className="text-[#F8FAFC] font-semibold mb-4">Tus Próximos 3 Pasos</h3>
                
                <div className="space-y-4">
                  {topRecomendaciones.map((rec, idx) => (
                    <div 
                      key={idx}
                      className="p-4 bg-[#0F172A] rounded-xl border-l-4 border-[#C9A96A]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#C9A96A] text-[#0F172A] font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-[#F8FAFC] text-sm">{rec}</p>
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
                          <div 
                            key={idx + 3}
                            className="p-4 bg-[#0F172A] rounded-xl border-l-4 border-[#64748B]"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#64748B] text-[#F8FAFC] font-bold flex-shrink-0">
                                {idx + 4}
                              </span>
                              <p className="text-[#94A3B8] text-sm">{rec}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowAllRecomendaciones(!showAllRecomendaciones)}
                      className="w-full mt-4 py-3 text-[#C9A96A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C9A96A]/10 rounded-lg transition-colors"
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

            {/* Próximos Pasos Quick List */}
            {report.proximosPasos?.length > 0 && (
              <Card className="bg-[#1E293B] border border-[#334155]">
                <CardContent className="p-5">
                  <h3 className="text-[#F8FAFC] font-semibold mb-4">Acciones Inmediatas</h3>
                  <ul className="space-y-2">
                    {report.proximosPasos.slice(0, 3).map((step, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-[#94A3B8] text-sm">
                        <CheckCircle2 className="h-4 w-4 text-[#C9A96A] flex-shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ========== STICKY CTA - Fitts' Law: Always visible, large touch target ========== */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent p-4 sm:pl-[280px]" data-testid="sticky-cta">
        <div className="max-w-2xl mx-auto flex gap-3">
          {/* Secondary CTA */}
          <Button
            onClick={onDownloadPDF}
            disabled={downloading}
            variant="outline"
            className="flex-1 h-14 border-[#C9A96A] text-[#C9A96A] hover:bg-[#C9A96A]/10 font-semibold"
            data-testid="download-pdf-btn"
          >
            <Download className="h-5 w-5 mr-2" />
            {downloading ? 'Descargando...' : 'Descargar PDF'}
          </Button>
          
          {/* Primary CTA - Fitts: 56px height (≥44px) */}
          <Button
            onClick={() => navigate('/dashboard/appointments')}
            className="flex-1 h-14 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-bold text-base"
            data-testid="schedule-consultation-btn"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Agendar Consulta
          </Button>
        </div>
      </div>
    </div>
  );
};
