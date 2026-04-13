import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { N8nEligibilityReportV2 } from '../../components/N8nEligibilityReportV2';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Clock, MessageCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * EligibilityReportPage - Rediseñada para cumplir las 3 leyes de UX:
 * 
 * 1. MILLER (7±2): Contenido organizado en tabs, máximo 5 secciones
 * 2. HICK: Solo 3 opciones principales visibles, CTA único y claro
 * 3. FITTS: Botones ≥48px, CTA sticky siempre accesible
 */
export const EligibilityReportPage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);
  
  // Check if user has a valid report (not null, not empty object, has real data)
  const hasReport = user?.report && 
    typeof user.report === 'object' && 
    Object.keys(user.report).length > 0 &&
    (user.report.nombreCompleto || user.report.proyectoTitulo || user.report.estadoElegibilidad);

  // Auto-refresh every 30 seconds if no report
  const checkForReport = useCallback(async () => {
    if (hasReport) return;
    
    setChecking(true);
    try {
      // Refresh user data to check if report is ready
      if (refreshUser) {
        await refreshUser();
      } else {
        // Fallback: fetch user data manually
        const userDataStr = localStorage.getItem('urpe_user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const token = userData?.token;
          
          if (token) {
            const response = await fetch(`${BACKEND_URL}/api/client/profile`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.ok) {
              const profileData = await response.json();
              if (profileData.report && Object.keys(profileData.report).length > 0) {
                // Update local storage and reload
                const updatedUser = { ...userData, report: profileData.report };
                localStorage.setItem('urpe_user', JSON.stringify(updatedUser));
                window.location.reload();
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for report:', error);
    } finally {
      setChecking(false);
    }
  }, [hasReport, refreshUser]);

  // Countdown timer for auto-refresh
  useEffect(() => {
    if (hasReport) return;

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
  }, [hasReport, checkForReport]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    toast.info('Generando PDF...');
    
    try {
      const isN8nReport = user?.report?.nombreCompleto || user?.report?.proyectoTitulo;
      
      let result;
      if (isN8nReport) {
        const { generateSimpleN8nPDF } = await import('../../utils/simpleN8nPdfGenerator');
        result = generateSimpleN8nPDF(user.report, user);
      } else {
        const { generateReportPDF } = await import('../../utils/pdfGenerator');
        const { getDisplayName } = await import('../../utils/userUtils');
        result = await generateReportPDF(getDisplayName(user), user?.report?.profession || 'Report');
      }
      
      if (result.success) {
        toast.success(result.message || 'Reporte descargado exitosamente');
      } else {
        toast.error(result.message || 'Error al descargar el reporte');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleManualRefresh = () => {
    setSecondsUntilRefresh(30);
    checkForReport();
  };

  const handleContactSupport = () => {
    // Open WhatsApp or support link
    window.open('https://wa.me/18094441000?text=Hola,%20mi%20reporte%20de%20elegibilidad%20no%20se%20ha%20generado', '_blank');
  };

  // No report state - Show "generating" message with auto-refresh
  if (!hasReport) {
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

            {/* Contact support */}
            <Button
              onClick={handleContactSupport}
              className="w-full h-12 bg-[#C9A96A] hover:bg-[#B8956A] text-[#0F172A] font-semibold"
              data-testid="support-btn"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Contactar Soporte
            </Button>
            
            <p className="text-[#64748B] text-xs mt-4">
              Si han pasado más de 20 minutos y tu reporte no aparece, 
              por favor contacta a nuestro equipo de soporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A]" data-testid="eligibility-report-page">
      <div className="px-4 sm:px-6 pt-6 max-w-3xl mx-auto">
        <N8nEligibilityReportV2 
          report={user.report} 
          onDownloadPDF={handleDownloadPDF}
          downloading={downloading}
        />
      </div>
    </div>
  );
};
