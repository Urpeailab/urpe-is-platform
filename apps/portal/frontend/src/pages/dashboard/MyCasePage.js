import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  CheckCircle,
  Lock,
  Clock,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  FileCheck,
  DollarSign,
  Users,
  Award,
  FileText,
  Briefcase,
  Target,
  Send,
  Star,
  Sparkles,
  Plane
} from 'lucide-react';
import { USCISStatusCard } from '../../components/uscis/USCISStatusCard';
import { AppointmentRequestModal } from '../../components/AppointmentRequestModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Icon mapping for stages - Rappi style with distinct icons per stage
const STAGE_ICONS = {
  1: { icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-400/20' },
  2: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/20' },
  3: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/20' },
  4: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/20' },
  5: { icon: Award, color: 'text-pink-400', bg: 'bg-pink-400/20' },
  6: { icon: Briefcase, color: 'text-cyan-400', bg: 'bg-cyan-400/20' },
  7: { icon: Target, color: 'text-orange-400', bg: 'bg-orange-400/20' },
  8: { icon: FileCheck, color: 'text-teal-400', bg: 'bg-teal-400/20' },
  9: { icon: Send, color: 'text-indigo-400', bg: 'bg-indigo-400/20' },
  10: { icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  11: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/20' },
  12: { icon: Plane, color: 'text-sky-300', bg: 'bg-sky-300/20' },
};

export const MyCasePage = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [uscisCase, setUscisCase] = useState(null);

  // Appointment booking modal state
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptRole, setApptRole] = useState('coordinator');

  useEffect(() => {
    fetchMyCaseData();
  }, []);

  const fetchMyCaseData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
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

      setCaseData(response.data);
      setLastUpdated(new Date());

      // Fetch USCIS cases
      try {
        const uscisRes = await axios.get(`${BACKEND_URL}/api/uscis/cases`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const cases = uscisRes.data.cases || [];
        if (cases.length > 0) setUscisCase(cases[0]);
      } catch { /* no uscis cases */ }
    } catch (error) {
      console.error('Error fetching case data:', error);
      if (error.response?.status === 404) {
        setCaseData(null);
      } else {
        toast.error('Error al cargar los datos del caso');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center" data-testid="loading-state">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#C9A96A] border-t-transparent" />
      </div>
    );
  }

  // No case found
  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4" data-testid="no-case-state">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-[#334155] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#F8FAFC] mb-2">
            No tienes un caso activo
          </h2>
          <p className="text-[#94A3B8] mb-6">
            Contacta a nuestro equipo para iniciar tu proceso de visa
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold px-6 py-3 rounded-lg transition-colors"
            data-testid="back-to-dashboard-btn"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { case: visaCase, stages, progress } = caseData;

  // Helper to get stage status
  const getStageStatus = (stage) => {
    const isPaid = progress.paidStages?.includes(stage.stageNumber);
    const isCompleted = progress.completedStages?.includes(stage.stageNumber) || stage.status === 'completed';
    const isCurrent = stage.stageNumber === visaCase.currentStage;
    const isLocked = !isPaid && stage.status !== 'unlocked';
    return { isPaid, isCompleted, isCurrent, isLocked };
  };

  // Get stage icon config
  const getStageIcon = (stageNumber) => {
    return STAGE_ICONS[stageNumber] || STAGE_ICONS[1];
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24 sm:pb-8" data-testid="my-case-page">
      <div className="px-4 sm:px-6 pt-6">
        <div className="max-w-4xl mx-auto">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[#64748B] text-sm">Tu caso de visa</p>
              <h1 className="text-2xl font-bold text-[#F8FAFC]" data-testid="visa-type-title">{visaCase.visaType}</h1>
              <p className="text-[#475569] text-xs mt-1">
                Actualizado {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={() => fetchMyCaseData(true)}
              disabled={refreshing}
              className="p-3 bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] rounded-full transition-colors border border-[#334155]"
              data-testid="refresh-btn"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* ========== PROGRESS HERO CARD ========== */}
          <div className="bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] rounded-3xl p-6 border border-[#334155] mb-8" data-testid="progress-card">
            <div className="flex items-center gap-6">
              {/* Circular Progress - Large */}
              <div className="relative flex-shrink-0">
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="#334155"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="url(#goldGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress.overallProgress / 100)}`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C9A96A" />
                      <stop offset="100%" stopColor="#E6D5B7" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-[#C9A96A]" data-testid="progress-percentage">{progress.overallProgress}%</span>
                </div>
              </div>
              
              {/* Progress Info */}
              <div className="flex-1">
                <h2 className="text-[#F8FAFC] text-xl font-semibold mb-2">Progreso General</h2>
                <p className="text-[#94A3B8] text-base mb-3">
                  <span className="text-[#22C55E] font-semibold">{progress.completedCount}</span> de <span className="font-semibold">{progress.totalStages}</span> etapas completadas
                </p>
                
                {/* Financial Summary - Only Invested */}
                <div className="bg-[#1E293B] rounded-lg p-3 mb-3 inline-block">
                  <p className="text-[#64748B] text-xs uppercase tracking-wide mb-1">Invertido</p>
                  <p className="text-[#22C55E] text-lg font-semibold">
                    ${(caseData?.financials?.totalInvested || 0).toLocaleString()} <span className="text-xs text-[#64748B]">USD</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C9A96A]/20 text-[#C9A96A] rounded-full text-sm font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    En progreso
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========== STAGES GRID - RAPPI STYLE ========== */}
          <h3 className="text-[#94A3B8] text-sm font-semibold uppercase tracking-wider mb-4">
            Etapas de tu Proceso
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8" data-testid="stages-grid">
            {stages.map((stage) => {
              const { isPaid, isCompleted, isCurrent, isLocked } = getStageStatus(stage);
              const isDone = isCompleted || isPaid;
              const stageName = stage.name?.es || stage.name?.en || `Etapa ${stage.stageNumber}`;
              const iconConfig = getStageIcon(stage.stageNumber);
              const IconComponent = iconConfig.icon;
              const isFinalStage = stage.stageNumber === stages.length || stage.stageNumber === 12;
              
              return (
                <button
                  key={stage._id || stage.stageNumber}
                  onClick={() => navigate(`/dashboard/my-case/stage/${stage.stageNumber}`)}
                  data-testid={`stage-card-${stage.stageNumber}`}
                  className={`
                    relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200 active:scale-[0.98]
                    ${isFinalStage
                      ? 'bg-gradient-to-br from-sky-900/60 via-indigo-900/40 to-purple-900/30 border-2 border-sky-400/40 shadow-lg shadow-sky-500/10'
                      : isCurrent 
                        ? 'bg-gradient-to-br from-[#C9A96A]/25 to-[#C9A96A]/10 border-2 border-[#C9A96A]/50 shadow-lg shadow-[#C9A96A]/10' 
                        : isDone 
                          ? 'bg-[#1E293B] border border-[#22C55E]/30 hover:border-[#22C55E]/50' 
                          : 'bg-[#1E293B] border border-[#334155] hover:border-[#475569]'
                    }
                  `}
                >
                  {/* Current Stage Badge */}
                  {isCurrent && (
                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold text-[#0F172A] bg-[#C9A96A] px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Activa
                      </span>
                    </div>
                  )}
                  
                  {/* Completed Badge */}
                  {isDone && !isCurrent && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-[#22C55E]" />
                    </div>
                  )}
                  
                  {/* Locked Badge */}
                  {isLocked && !isDone && !isCurrent && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-[#475569]" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`
                    h-14 w-14 rounded-2xl flex items-center justify-center mb-4
                    ${isDone ? 'bg-[#22C55E]/20' : isCurrent ? 'bg-[#C9A96A]/20' : iconConfig.bg}
                  `}>
                    {isDone ? (
                      <CheckCircle className="h-7 w-7 text-[#22C55E]" />
                    ) : (
                      <IconComponent className={`h-7 w-7 ${isCurrent ? 'text-[#C9A96A]' : iconConfig.color}`} />
                    )}
                  </div>

                  {/* Stage Number */}
                  <p className={`text-xs font-medium mb-1 ${isCurrent ? 'text-[#C9A96A]' : 'text-[#64748B]'}`}>
                    Etapa {stage.stageNumber}
                  </p>

                  {/* Stage Name */}
                  <h4 className={`text-sm font-semibold leading-tight line-clamp-2 ${
                    isCurrent ? 'text-[#F8FAFC]' : isDone ? 'text-[#E2E8F0]' : 'text-[#94A3B8]'
                  }`}>
                    {stageName}
                  </h4>

                  {/* Price Tag - Hidden from client view */}
                  {/* Stage price is intentionally not shown to clients */}

                  {/* Chevron indicator */}
                  <div className="absolute bottom-3 right-3">
                    <ChevronRight className={`h-5 w-5 ${isCurrent ? 'text-[#C9A96A]' : 'text-[#475569]'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* ========== USCIS STATUS CARD ========== */}
          {uscisCase && (
            <div className="mb-6">
              <USCISStatusCard
                receiptNumber={uscisCase.receiptNumber}
                status={uscisCase.status}
                statusTitle={uscisCase.statusTitle}
                formType={uscisCase.formType}
                lastUpdated={uscisCase.statusDate}
                onClick={() => navigate('/dashboard/uscis-tracker')}
              />
            </div>
          )}

          {/* ========== SUMMARY CARDS ========== */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Completed */}
            <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155]" data-testid="completed-summary-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#22C55E]/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-[#22C55E]" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#22C55E]">{progress.completedCount}</p>
              <p className="text-[#94A3B8] text-sm">Etapas Completadas</p>
            </div>

            {/* Pending */}
            <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155]" data-testid="pending-summary-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#64748B]/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#64748B]" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#94A3B8]">{progress.totalStages - progress.completedCount}</p>
              <p className="text-[#64748B] text-sm">Etapas Pendientes</p>
            </div>
          </div>

          {/* ========== HELP BANNER ========== */}
          <div className="bg-gradient-to-r from-[#1E293B] to-[#1E293B]/80 rounded-2xl p-5 border border-[#334155]/50" data-testid="help-banner">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#C9A96A]/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-[#C9A96A]" />
              </div>
              <div className="flex-1">
                <p className="text-[#F8FAFC] font-semibold">¿Tienes preguntas?</p>
                <p className="text-[#64748B] text-sm">Tu asesor está disponible para ayudarte</p>
              </div>
              <button
                onClick={() => {
                  // Default to whichever role the case actually has
                  const role = visaCase?.coordinatorId ? 'coordinator' : (visaCase?.salesRepId || visaCase?.advisorId ? 'salesRep' : 'coordinator');
                  setApptRole(role);
                  setShowApptModal(true);
                }}
                className="bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                data-testid="contact-advisor-btn"
              >
                Contactar
              </button>
            </div>
          </div>
        </div>
      </div>

      <AppointmentRequestModal
        isOpen={showApptModal}
        onClose={() => setShowApptModal(false)}
        visaCase={visaCase}
        defaultRole={apptRole}
      />
    </div>
  );
};
