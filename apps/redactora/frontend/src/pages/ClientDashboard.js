import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { FileText, Book, Download, Trash2, Edit, Plus, Loader2, ArrowLeft, Scale, TrendingUp, CheckCircle, RefreshCw, Upload, Briefcase, Globe, Mail, User, Award, FileBarChart, History, Languages, Shield, Copy, Eye, BarChart, File, Info, List, Monitor, Star, Target, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { API, BACKEND_URL } from '../utils/constants';

// NIW Section titles (shared)
const NIW_SECTION_TITLES = [
  "I. Cover Page",
  "II. Executive Summary",
  "III. Statement of Substantial Merit & National Importance (Prong 1)",
  "IV. Problem & National Context",
  "IV-B. Petitioner's Qualifications & Demonstrated Capacity (Prong 2)",
  "V. Objectives",
  "VI. Indicators & Metrics",
  "VII. Scope & Deliverables",
  "VIII. Execution Plan by Phases",
  "IX. Capital-Free Start Strategy",
  "X. Methodology",
  "XI. Risk Management & Assumptions",
  "XII. Expected Results & Impact",
  "XIII. Governance, Ethics & Compliance",
  "XIV. Monitoring & Evaluation",
  "XV. Empirical Basis & References",
  "XVI. Annexes",
  "XVII. Balance of Factors & Waiver Justification (Prong 3)"
];

const ClientDashboard = () => {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/clients/${clientId}/stats`);
      setClient(response.data.client);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading client data:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.response?.status === 404) {
        toast.error('Cliente no encontrado. Es posible que haya sido eliminado.');
        // NO redirigir inmediatamente, dar tiempo al usuario
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('No tienes acceso a este cliente');
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } else {
        // Para otros errores, intentar cargar solo datos básicos del cliente
        toast.warning('Cargando datos del cliente...');
        try {
          const basicResponse = await axios.get(`${API}/clients/${clientId}`);
          setClient(basicResponse.data);
          // No hay stats, pero al menos tenemos los datos del cliente
        } catch (basicError) {
          console.error('Error loading basic client data:', basicError);
          toast.error('Error al cargar datos del cliente');
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocuments = (type) => {
    // Navigate to view list of documents for this client
    navigate(`/client-documents/${clientId}/${type}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!client) {
    return <div>Cliente no encontrado</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ color: '#374151', flexShrink: 0 }}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
          <div style={{ width: '1px', height: '24px', background: '#E5E7EB', flexShrink: 0 }} />
          <div style={{ width: '32px', height: '32px', background: '#FFFBEB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={16} style={{ color: '#F8BF13' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: '700', fontSize: '1rem', color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</h1>
            <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0 }}>{client.email}</p>
          </div>
          <Button onClick={() => navigate(`/trash/${clientId}`)} variant="outline" size="sm" style={{ color: '#DC2626', borderColor: '#FECACA', flexShrink: 0 }}>
            <Trash2 className="mr-1" size={14} />
            Papelera
          </Button>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', background: '#F9FAFB', minHeight: 'calc(100vh - 80px)' }}>
        
        {/* Client Info Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: '700', fontSize: '1rem', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} style={{ color: '#F8BF13' }} />
            Información del Cliente
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {client.company && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Empresa</p>
                <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{client.company}</p>
              </div>
            )}
            {client.country && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>País</p>
                <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{client.country}</p>
              </div>
            )}
            {client.industry && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Industria</p>
                <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{client.industry}</p>
              </div>
            )}
            {client.phone && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Teléfono</p>
                <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{client.phone}</p>
              </div>
            )}
          </div>
          {client.notes && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Notas</p>
              <p style={{ color: '#374151', fontSize: '0.9rem' }}>{client.notes}</p>
            </div>
          )}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Creado por</p>
              <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.875rem' }}>{client.created_by_name || 'N/A'}</p>
              <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{client.created_at ? new Date(client.created_at).toLocaleString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
            </div>
            {client.updated_by_name && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Última modificación</p>
                <p style={{ fontWeight: '600', color: '#111827', fontSize: '0.875rem' }}>{client.updated_by_name}</p>
                <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{client.updated_at ? new Date(client.updated_at).toLocaleString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.5rem', color: '#111827' }}>
          Documentos de {client.name}
        </h2>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))',
          gap: '1rem'
        }}>
          
          {/* NIW Card */}
          <div 
            onClick={() => handleViewDocuments('niw')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#F8BF13'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#FFFBEB', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <FileText size={19} style={{ color: '#F8BF13' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Propuestas EB-2 NIW</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Documentos profesionales alineados con USCIS</p>
            <span style={{ background: '#FFFBEB', color: '#92400E', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {(stats.niw_count || 0) + (stats.niw_completed || 0)} creados
            </span>
          </div>

          {/* Patents Card */}
          <div 
            onClick={() => handleViewDocuments('patent')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#3B82F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#EFF6FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Scale size={19} style={{ color: '#3B82F6' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Patentes USPTO</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Aplicaciones provisionales completas</p>
            <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {(stats.patent_count || 0) + (stats.patent_completed || 0)} creadas
            </span>
          </div>

          {/* Books Card */}
          <div 
            onClick={() => handleViewDocuments('book')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#EC4899'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#FDF2F8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Book size={19} style={{ color: '#EC4899' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Libros Completos</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Escribe libros con capítulos estructurados</p>
            <span style={{ background: '#FDF2F8', color: '#9D174D', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {(stats.book_count || 0) + (stats.book_completed || 0)} creados
            </span>
          </div>

          {/* Econometric Studies Card */}
          <div 
            onClick={() => handleViewDocuments('study')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#8B5CF6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#F5F3FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <TrendingUp size={19} style={{ color: '#8B5CF6' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Estudios Econométricos</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Análisis riguroso con 16 secciones</p>
            <span style={{ background: '#F5F3FF', color: '#5B21B6', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.study_count || 0} creados
            </span>
          </div>

          {/* White Paper Card */}
          <div 
            onClick={() => handleViewDocuments('whitepaper')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#10B981'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#ECFDF5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <FileBarChart size={19} style={{ color: '#10B981' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>White Paper Técnico</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Documentos técnicos de 16 secciones profesionales</p>
            <span style={{ background: '#ECFDF5', color: '#065F46', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {(stats.whitepaper_count || 0) + (stats.whitepaper_completed || 0)} creados
            </span>
          </div>

          {/* Recommendation Letter Card */}
          <div 
            onClick={() => handleViewDocuments('recommendation')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#F97316'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#FFF7ED', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Mail size={19} style={{ color: '#F97316' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Cartas de Recomendación</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Cartas profesionales para visas EB-2 NIW y O-1</p>
            <span style={{ background: '#FFF7ED', color: '#9A3412', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.recommendation_letter_count || 0} creadas
            </span>
          </div>

          {/* Case Studies Card */}
          <div 
            onClick={() => handleViewDocuments('casestudy')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#047857'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#ECFDF5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Briefcase size={19} style={{ color: '#047857' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Casos de Estudio Empresariales</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Análisis estilo Harvard Business School</p>
            <span style={{ background: '#ECFDF5', color: '#064E3B', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.case_study_count || 0} {(stats.case_study_count || 0) === 1 ? 'creado' : 'creados'}
            </span>
          </div>

          {/* Policy Paper Card */}
          <div 
            onClick={() => handleViewDocuments('policypaper')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#EC4899'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#FDF2F8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Globe size={19} style={{ color: '#EC4899' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Reporte de Impacto Social</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Policy papers con impacto social</p>
            <span style={{ background: '#FDF2F8', color: '#9D174D', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.policypaper_count || 0} creados
            </span>
          </div>

          {/* Expert Letter Card */}
          <div 
            onClick={() => handleViewDocuments('expert')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#7C3AED'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#F5F3FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Award size={19} style={{ color: '#7C3AED' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Cartas de Expertos</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Cartas profesionales de expertos para visas</p>
            <span style={{ background: '#F5F3FF', color: '#4C1D95', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.expert_count || 0} creadas
            </span>
          </div>

          {/* Self-Petition Letter Card */}
          <div 
            onClick={() => handleViewDocuments('selfpetition')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#EA580C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#FFF7ED', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Scale size={19} style={{ color: '#EA580C' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Cartas de Autopetición</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Cover Letters EB-2 NIW (I-140)</p>
            <span style={{ background: '#FFF7ED', color: '#9A3412', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.selfpetition_count || 0} creadas
            </span>
          </div>

          {/* Intent Letter Card */}
          <div 
            onClick={() => handleViewDocuments('intentletter')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#0369A1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#F0F9FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <FileText size={19} style={{ color: '#0369A1' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Cartas de Intención</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Personal Statement EB-2 NIW (Dhanasar)</p>
            <span style={{ background: '#F0F9FF', color: '#075985', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {stats.intent_letter_count || 0} creadas
            </span>
          </div>

          {/* Translations Card */}
          <div 
            onClick={() => handleViewDocuments('translation')}
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#0F766E'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{ width: '38px', height: '38px', background: '#F0FDFA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Languages size={19} style={{ color: '#0F766E' }} />
            </div>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>Traducciones</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Traducciones profesionales ES → EN</p>
            <span style={{ background: '#F0FDFA', color: '#134E4A', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
              {(stats.translation_count || 0) + (stats.certified_translation_count || 0)} creadas
            </span>
          </div>

        </div>
      </main>
    </div>
  );
};


// Component removed - books must always be associated with a client

export default ClientDashboard;
