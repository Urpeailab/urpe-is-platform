import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { FileText, Book, Download, Trash2, Edit, Plus, Loader2, ArrowLeft, Scale, TrendingUp, Eye, Search, RefreshCw, BarChart3, Briefcase, Mail, Award, Globe, Languages, AlertCircle, Sparkles, BarChart, Filter, Info, List, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { API, BACKEND_URL } from '../utils/constants';
import { WordDownloadButton } from '../components/WordDownloadButton';

// ─── docType → /download-docx endpoint mapping ───────────────────────────
// Returns null when the document type does not support .docx (e.g.
// raw translations / certified scans where editability is not the goal).
const docxEndpointFor = (docType, doc) => {
  if (!doc?.id) return null;
  switch (docType) {
    case 'book':         return `${API}/books/${doc.id}/download-docx`;
    case 'niw':          return `${API}/business-plans/${doc.id}/download-docx`;
    case 'patent':       return `${API}/patents/${doc.id}/download-docx`;
    case 'whitepaper':   return `${API}/whitepapers/${doc.id}/download-docx`;
    case 'study':        return `${API}/econometric-studies/${doc.id}/download-docx`;
    case 'recommendation': return `${API}/recommendation-letters/${doc.id}/download-docx`;
    case 'expert':       return `${API}/expert-letters/${doc.id}/download-docx`;
    case 'selfpetition': return `${API}/self-petition-letters/${doc.id}/download-docx`;
    case 'intentletter': return `${API}/intent-letters/${doc.id}/download-docx`;
    case 'policypaper':  return `${API}/policy-papers/${doc.id}/download-docx`;
    case 'casestudy':    return `${API}/case-studies/${doc.id}/download-docx`;
    default: return null;  // translation / certified → no docx
  }
};

const ClientDocumentsList = () => {
  const { clientId, docType } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [autoRetrying, setAutoRetrying] = useState(false); // ✅ Estado para auto-retry
  const navigate = useNavigate();

  useEffect(() => {
    loadClientAndDocuments();
  }, [clientId, docType]);

  // Auto-refresh every 30 seconds if there are documents generating
  useEffect(() => {
    const hasGenerating = documents.some(doc => doc.status === 'generating' || doc.status === 'evaluating' || doc.status === 'in_progress');
    
    if (hasGenerating && (docType === 'book' || docType === 'books' || docType === 'niw' || docType === 'policypaper' || docType === 'patent' || docType === 'study' || docType === 'whitepaper' || docType === 'recommendation' || docType === 'expert' || docType === 'intentletter')) {
      const generatingCount = documents.filter(d => d.status === 'generating' || d.status === 'evaluating').length;
      console.log(`📝 Auto-refresh activado: ${generatingCount} documento(s) en progreso`);
      
      // Log details of generating documents
      documents.filter(d => d.status === 'generating' || d.status === 'evaluating').forEach((doc, idx) => {
        console.log(`📖 Documento ${idx + 1} generándose:`, {
          title: doc.book_title || doc.project_title || doc.invention_title,
          progress: (doc.progress_percentage || doc.progress || doc.generation_progress || 0) + '%',
          message: doc.progress_message,
          status: doc.status,
          updated: doc.updated_at
        });
      });
      
      // ✅ AUTO-RETRY: Detectar documentos atascados (sin actualizar por más de 10 minutos)
      const stuckDocs = documents.filter(doc => {
        if (doc.status !== 'generating' && doc.status !== 'evaluating' && doc.status !== 'in_progress') return false;
        const updatedAt = doc.updated_at ? new Date(doc.updated_at) : null;
        return updatedAt && (Date.now() - updatedAt.getTime() > 10 * 60 * 1000); // 10 minutos (V3 needs more time per section)
      });
      
      if (stuckDocs.length > 0 && !autoRetrying) {
        console.log(`⚠️ Detectados ${stuckDocs.length} documentos atascados, iniciando auto-retry...`);
        setAutoRetrying(true);
        
        stuckDocs.forEach(async (doc) => {
          try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            if (docType === 'book' || docType === 'books' || doc.genre) {
              console.log(`🔄 Auto-retrying libro: ${doc.title || doc.book_title}`);
              await axios.post(`${API}/books/${doc.id}/retry-generation`, {}, { headers });
              toast.info(`🔄 Reintentando generación de libro automáticamente...`);
            } else if (docType === 'niw' || doc.project_title) {
              console.log(`🔄 Auto-retrying NIW: ${doc.project_title}`);
              await axios.post(`${API}/business-plans/retry-generation/${doc.id}`, {}, { headers });
              toast.info(`🔄 Reintentando generación de NIW automáticamente...`);
            } else if (docType === 'patent' || doc.invention_title) {
              console.log(`🔄 Auto-retrying patente: ${doc.invention_title}`);
              await axios.post(`${API}/patents/${doc.id}/retry-generation`, {}, { headers });
              toast.info(`🔄 Reintentando generación de patente automáticamente...`);
            }
          } catch (error) {
            console.error(`Error en auto-retry para ${doc.id}:`, error);
          }
        });
        
        // Reset auto-retry flag después de 60 segundos para permitir otro intento
        setTimeout(() => setAutoRetrying(false), 60000);
      }
      
      const intervalId = setInterval(async () => {
        console.log('🔄 Auto-refreshing documents only (sin recargar página)...');
        // Solo refrescar documentos, no toda la página
        try {
          const token = localStorage.getItem('token');
          const headers = { 'Authorization': `Bearer ${token}` };
          let docs = [];
          
          if (docType === 'study') {
            const [inProgressRes, completedRes] = await Promise.all([
              axios.get(`${API}/econometric-studies/in-progress?client_id=${clientId}`, { headers }),
              axios.get(`${API}/econometric-studies?client_id=${clientId}`, { headers })
            ]);
            const inProgress = (inProgressRes.data || []).map(doc => ({
              ...doc,
              progress_percentage: doc.progress || doc.progress_percentage || 0,
              progress_message: doc.progress_message || doc.current_section || 'Generando...'
            }));
            const completed = (completedRes.data?.studies || completedRes.data || []).map(doc => ({
              ...doc,
              progress_percentage: 100,
              progress_message: 'Completado'
            }));
            docs = [...inProgress, ...completed];
          } else if (docType === 'book' || docType === 'books') {
            const [inProgressRes, completedRes] = await Promise.all([
              axios.get(`${API}/books-in-progress?client_id=${clientId}`, { headers }),
              axios.get(`${API}/books?client_id=${clientId}`, { headers })
            ]);
            const inProgress = (inProgressRes.data || []).map(doc => ({
              ...doc,
              progress_percentage: doc.progress_percentage || doc.progress || 0,
              progress_message: doc.progress_message || 'Generando...'
            }));
            docs = [...inProgress, ...(completedRes.data || [])];
          } else if (docType === 'niw') {
            const [completedRes, inProgressRes] = await Promise.all([
              axios.get(`${API}/business-plans?client_id=${clientId}`, { headers }),
              axios.get(`${API}/business-plans/in-progress?client_id=${clientId}`, { headers })
            ]);
            // Combinar completados e in-progress, evitando duplicados
            const completedIds = new Set((completedRes.data || []).map(d => d.id));
            const inProgress = (inProgressRes.data || [])
              .filter(doc => !completedIds.has(doc.id))
              .map(doc => ({
                ...doc,
                progress_percentage: doc.generation_progress || doc.progress || 0,
                progress_message: doc.progress_message || (doc.status === 'review_needed' ? 'Listo para revisión' : 'Generando...')
              }));
            docs = [...(completedRes.data || []), ...inProgress];
          } else if (docType === 'patent') {
            // ✅ FIX: Also fetch in-progress patents (not just completed)
            const [inProgressRes, completedRes] = await Promise.all([
              axios.get(`${API}/patents/in-progress?client_id=${clientId}`, { headers }),
              axios.get(`${API}/patents?client_id=${clientId}`, { headers })
            ]);
            const inProgress = (inProgressRes.data || []).map(doc => ({
              ...doc,
              progress_percentage: doc.progress || doc.progress_percentage || 0,
              progress_message: doc.progress_message || 'Generando...'
            }));
            const completed = (completedRes.data || []).map(doc => ({
              ...doc,
              progress_percentage: 100,
              progress_message: 'Completado'
            }));
            // Avoid duplicates
            const completedIds = new Set(completed.map(d => d.id));
            docs = [
              ...completed,
              ...inProgress.filter(d => !completedIds.has(d.id))
            ];
          } else if (docType === 'policypaper') {
            const res = await axios.get(`${API}/policy-papers?client_id=${clientId}`, { headers });
            docs = (res.data || []).map(doc => ({
              ...doc,
              progress_percentage: doc.progress || doc.progress_percentage || 0,
              progress_message: doc.progress_message || 'Generando...'
            }));
          } else if (docType === 'whitepaper') {
            const res = await axios.get(`${API}/whitepapers?client_id=${clientId}`, { headers });
            // ✅ Combinar in_progress y completed
            const allDocs = [
              ...(res.data.in_progress || []),
              ...(res.data.completed || [])
            ];
            docs = allDocs.map(doc => {
              // ✅ Si el documento está completado, mostrar 100%
              if (doc.status === 'completed' || doc.status === 'complete') {
                return {
                  ...doc,
                  progress_percentage: 100,
                  progress_message: 'Completado'
                };
              }
              
              // ✅ Aplicar el mapeo de progreso para documentos en generación
              if (doc.status === 'in_progress' || doc.status === 'generating') {
                // Usar el progress_message del backend si existe
                const progressMessage = doc.progress_message || (() => {
                  const progress = doc.progress || 0;
                  if (progress <= 0) return 'Iniciando generación...';
                  if (progress < 15) return 'Generando Resumen Ejecutivo...';
                  if (progress < 30) return 'Generando Marco Teórico...';
                  if (progress < 45) return 'Generando Metodología...';
                  if (progress < 60) return 'Generando Análisis Técnico...';
                  if (progress < 75) return 'Generando Resultados...';
                  if (progress < 90) return 'Generando Conclusiones...';
                  if (progress < 100) return 'Finalizando documento...';
                  return 'Evaluando coherencia...';
                })();
                
                return {
                  ...doc,
                  progress_percentage: doc.progress || 0,
                  progress_message: progressMessage
                };
              }
              
              // ✅ Otros estados (error, etc)
              return {
                ...doc,
                progress_percentage: doc.progress || 0,
                progress_message: doc.progress_message || 'Procesando...'
              };
            });
          } else if (docType === 'recommendation' || docType === 'expert' || docType === 'intentletter') {
            // Cartas: el endpoint devuelve { letters: [...] } y cada carta ya
            // trae progress_percentage / progress_message del background task.
            // Los completados muestran 100%; los en error muestran su mensaje.
            const endpoint = {
              recommendation: 'recommendation-letters',
              expert: 'expert-letters',
              intentletter: 'intent-letters',
            }[docType];
            const res = await axios.get(`${API}/${endpoint}?client_id=${clientId}`, { headers });
            docs = (res.data.letters || []).map(doc => ({
              ...doc,
              progress_percentage: doc.status === 'completed'
                ? 100
                : (doc.progress_percentage || 0),
              progress_message: doc.status === 'completed'
                ? 'Completado'
                : (doc.progress_message || 'Generando...'),
            }));
          }

          // Solo actualizar si hay documentos
          if (docs.length > 0) {
            console.log('📊 Actualizando documentos:', docs.map(d => ({
              id: d.id?.slice(0, 8),
              status: d.status,
              progress: d.progress_percentage
            })));
            setDocuments(docs);
          }
        } catch (error) {
          console.error('Error refreshing documents:', error);
        }
      }, 10000); // 10 seconds for faster updates during generation
      
      return () => {
        console.log('🛑 Deteniendo auto-refresh');
        clearInterval(intervalId);
      };
    }
  }, [documents, docType, autoRetrying]);

  const loadClientAndDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Load client info
      const clientRes = await axios.get(`${API}/clients/${clientId}`, { headers });
      setClient(clientRes.data);

      // Load documents based on type - filter by client_id with query param
      let docs = [];
      if (docType === 'niw') {
        const [inProgress, completed] = await Promise.all([
          axios.get(`${API}/business-plans/in-progress?client_id=${clientId}`, { headers }),
          axios.get(`${API}/business-plans?client_id=${clientId}`, { headers })
        ]);
        // Filter on frontend as additional safety
        docs = [
          ...inProgress.data.filter(d => d.client_id === clientId), 
          ...completed.data.filter(d => d.client_id === clientId)
        ];
      } else if (docType === 'patent') {
        const [inProgress, completed] = await Promise.all([
          axios.get(`${API}/patents/in-progress?client_id=${clientId}`, { headers }),
          axios.get(`${API}/patents?client_id=${clientId}`, { headers })
        ]);
        docs = [
          ...inProgress.data.filter(d => d.client_id === clientId),
          ...completed.data.filter(d => d.client_id === clientId)
        ];
      } else if (docType === 'book' || docType === 'books') {
        const [inProgress, completed] = await Promise.all([
          axios.get(`${API}/books/in-progress?client_id=${clientId}`, { headers }),
          axios.get(`${API}/books?client_id=${clientId}`, { headers })
        ]);
        docs = [
          ...inProgress.data.filter(d => d.client_id === clientId),
          ...completed.data.filter(d => d.client_id === clientId)
        ];
      } else if (docType === 'whitepaper') {
        const response = await axios.get(`${API}/whitepapers?client_id=${clientId}`, { headers });
        docs = [
          ...(response.data.in_progress || []).filter(d => d.client_id === clientId),
          ...(response.data.completed || []).filter(d => d.client_id === clientId)
        ];
      } else if (docType === 'study') {
        const [inProgress, completed] = await Promise.all([
          axios.get(`${API}/econometric-studies/in-progress?client_id=${clientId}`, { headers }),
          axios.get(`${API}/econometric-studies?client_id=${clientId}`, { headers })
        ]);
        docs = [
          ...inProgress.data.filter(d => d.client_id === clientId),
          ...(completed.data.studies || []).filter(d => d.client_id === clientId)
        ];
      } else if (docType === 'recommendation') {
        const response = await axios.get(`${API}/recommendation-letters?client_id=${clientId}`, { headers });
        docs = response.data.letters || [];
      } else if (docType === 'expert') {
        const response = await axios.get(`${API}/expert-letters?client_id=${clientId}`, { headers });
        docs = response.data.letters || [];
      } else if (docType === 'selfpetition') {
        const response = await axios.get(`${API}/self-petition-letters?client_id=${clientId}`, { headers });
        docs = response.data.letters || [];
      } else if (docType === 'intentletter') {
        const response = await axios.get(`${API}/intent-letters?client_id=${clientId}`, { headers });
        docs = response.data.letters || [];
      } else if (docType === 'policypaper') {
        const response = await axios.get(`${API}/policy-papers?client_id=${clientId}`, { headers });
        docs = (response.data.policy_papers || response.data.papers || []).filter(d => d.client_id === clientId);
      } else if (docType === 'casestudy') {
        const response = await axios.get(`${API}/case-studies?client_id=${clientId}`, { headers });
        docs = response.data.case_studies || [];
      } else if (docType === 'translation') {
        // Load both normal and certified translations
        const [normalRes, certifiedRes] = await Promise.all([
          axios.get(`${API}/translations?client_id=${clientId}`, { headers }),
          axios.get(`${API}/certified/translations?client_id=${clientId}`, { headers })
        ]);
        
        // Mark each translation with its type
        const normalDocs = (normalRes.data || []).map(d => ({ ...d, translation_type: 'normal' }));
        const certifiedDocs = (certifiedRes.data || []).map(d => ({ 
          ...d, 
          translation_type: 'certified',
          filename: d.original_filename || d.certificate_number // Use original_filename or certificate for display
        }));
        
        docs = [...normalDocs, ...certifiedDocs].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
      } else if (docType === 'certified') {
        const response = await axios.get(`${API}/certified/translations?client_id=${clientId}`, { headers });
        docs = response.data || [];
      }
      
      console.log(`Loaded ${docs.length} documents for client ${clientId}:`, docs);
      
      // Mapear campos específicos para consistencia en la UI
      docs = docs.map(doc => {
        // Para NIW, mapear generation_progress a progress_percentage con mensajes descriptivos
        if (docType === 'niw' && doc.generation_progress !== undefined) {
          const progress = doc.generation_progress || 0;
          let progressMessage = 'Generando...';
          
          if (doc.status === 'generating') {
            // Use backend progress_message if available (Brief Builder, section names, etc.)
            if (doc.progress_message && doc.progress_message !== 'Generando...') {
              progressMessage = doc.progress_message;
            } else if (progress <= 4) progressMessage = 'Analizando CV...';
            else if (progress <= 8) progressMessage = 'Verificando fuentes...';
            else if (progress < 20) progressMessage = 'Generando Resumen Ejecutivo...';
            else if (progress < 32) progressMessage = 'Generando Problema Nacional...';
            else if (progress < 42) progressMessage = 'Generando Plan de Ejecución...';
            else if (progress < 54) progressMessage = 'Generando Calificaciones...';
            else if (progress < 64) progressMessage = 'Generando Plan Financiero...';
            else if (progress < 73) progressMessage = 'Generando Impacto Nacional...';
            else if (progress < 81) progressMessage = 'Generando Justificación NIW...';
            else if (progress < 90) progressMessage = 'Generando Análisis de Riesgo...';
            else progressMessage = 'Finalizando documento...';
          } else if (doc.status === 'evaluating') {
            progressMessage = 'Evaluando calidad USCIS...';
          } else if (doc.status === 'translating') {
            progressMessage = 'Traduciendo al español...';
          } else if (doc.status === 'review_needed') {
            progressMessage = 'Requiere revisión';
          } else if (doc.status === 'error') {
            progressMessage = 'Error en generación';
          } else if (doc.status === 'completed') {
            progressMessage = 'Completado';
          }
          
          return {
            ...doc,
            progress_percentage: progress,
            progress_message: progressMessage
          };
        }
        
        // Para Policy Papers, mapear progress a progress_percentage
        if (docType === 'policypaper' && doc.progress !== undefined) {
          return {
            ...doc,
            progress_percentage: doc.progress,
            progress_message: doc.progress_message || 'Generando...'
          };
        }
        
        // Para Estudios Econométricos, calcular progreso basado en current_section
        if (docType === 'study' && (doc.status === 'in_progress' || doc.status === 'generating')) {
          const currentSection = doc.current_section || 1;
          const totalSections = 16; // Estudios econométricos tienen 16 secciones
          const progress = Math.round(((currentSection - 1) / totalSections) * 100);
          
          let progressMessage = 'Iniciando generación...';
          if (currentSection <= 2) progressMessage = 'Generando Introducción y Resumen...';
          else if (currentSection <= 5) progressMessage = 'Generando Marco Teórico...';
          else if (currentSection <= 8) progressMessage = 'Generando Metodología...';
          else if (currentSection <= 11) progressMessage = 'Generando Análisis de Datos...';
          else if (currentSection <= 14) progressMessage = 'Generando Resultados...';
          else if (currentSection <= 16) progressMessage = 'Finalizando Conclusiones...';
          else progressMessage = 'Completando estudio...';
          
          return {
            ...doc,
            progress_percentage: progress,
            progress_message: progressMessage
          };
        }
        
        // ✅ Para White Papers, manejar correctamente todos los estados
        if (docType === 'whitepaper') {
          // Si está completado, mostrar 100%
          if (doc.status === 'completed' || doc.status === 'complete') {
            return {
              ...doc,
              progress_percentage: 100,
              progress_message: 'Completado'
            };
          }
          
          // Si está en generación
          if (doc.status === 'in_progress' || doc.status === 'generating') {
            const progress = doc.progress || 0;
            
            // Usar progress_message del backend si existe
            const progressMessage = doc.progress_message || (() => {
              if (progress <= 0) return 'Iniciando generación...';
              if (progress < 15) return 'Generando Resumen Ejecutivo...';
              if (progress < 30) return 'Generando Marco Teórico...';
              if (progress < 45) return 'Generando Metodología...';
              if (progress < 60) return 'Generando Análisis Técnico...';
              if (progress < 75) return 'Generando Resultados...';
              if (progress < 90) return 'Generando Conclusiones...';
              if (progress < 100) return 'Finalizando documento...';
              return 'Evaluando coherencia...';
            })();
            
            return {
              ...doc,
              progress_percentage: progress,
              progress_message: progressMessage
            };
          }
          
          // Otros estados (error, etc)
          return {
            ...doc,
            progress_percentage: doc.progress || 0,
            progress_message: doc.progress_message || 'Procesando...'
          };
        }
        
        return doc;
      });
      
      // Log detailed info for documents that are generating
      docs.forEach((doc, idx) => {
        if (doc.status === 'generating' || doc.status === 'in_progress' || doc.status === 'processing') {
          console.log(`📖 [BOOK ${idx + 1}] En progreso:`, {
            id: doc.id,
            title: doc.book_title || doc.title,
            status: doc.status,
            progress_percentage: doc.progress_percentage,
            progress_message: doc.progress_message,
            created_at: doc.created_at,
            updated_at: doc.updated_at
          });
        }
      });
      
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const getDocTypeInfo = () => {
    const types = {
      'niw': { title: 'Propuestas EB-2 NIW', icon: FileText, createRoute: '/create-business-plan' },
      'patent': { title: 'Patentes USPTO', icon: Scale, createRoute: '/create-patent' },
      'book': { title: 'Libros Completos', icon: Book, createRoute: '/create-book' },
      'books': { title: 'Libros Completos', icon: Book, createRoute: '/create-book' }, // Support plural form
      'study': { title: 'Estudios Econométricos', icon: BarChart3, createRoute: '/create-econometric-study' },
      'whitepaper': { title: 'White Papers Técnicos', icon: FileText, createRoute: '/create-whitepaper' },
      'recommendation': { title: 'Cartas de Recomendación', icon: Mail, createRoute: '/create-recommendation-letter' },
      'expert': { title: 'Cartas de Expertos', icon: Award, createRoute: '/create-expert-letter' },
      'selfpetition': { title: 'Cartas de Autopetición', icon: Scale, createRoute: '/create-self-petition-v2' },
      'intentletter': { title: 'Cartas de Intención', icon: FileText, createRoute: '/create-intent-letter' },
      'policypaper': { title: 'Reportes de Impacto Social', icon: Globe, createRoute: '/create-policy-paper' },
      'casestudy': { title: 'Casos de Estudio Empresariales', icon: Briefcase, createRoute: '/create-case-study' },
      'translation': { title: 'Traducciones', icon: Languages, createRoute: '/client-translate' },
      'certified': { title: 'Traducciones Certificadas', icon: Award, createRoute: '/client-translate/certified' }
    };
    return types[docType] || types['niw'];
  };

  const handleCreateNew = () => {
    const info = getDocTypeInfo();
    navigate(`${info.createRoute}?client_id=${clientId}`);
  };

  const handleDeleteClick = (doc) => {
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    
    setDeleting(true);
    console.log('Deleting document:', documentToDelete.id, 'type:', docType);
    
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const endpoints = {
        'niw': `/business-plans/${documentToDelete.id}`,
        'patent': `/patents/${documentToDelete.id}`,
        'book': `/books/${documentToDelete.id}`,
        'books': `/books/${documentToDelete.id}`, // Support plural form
        'whitepaper': `/whitepapers/${documentToDelete.id}`,
        'study': `/econometric-studies/${documentToDelete.id}`,
        'recommendation': `/recommendation-letters/${documentToDelete.id}`,
        'expert': `/expert-letters/${documentToDelete.id}`,
        'selfpetition': `/self-petition-letters/${documentToDelete.id}`,
        'intentletter': `/intent-letters/${documentToDelete.id}`,
        'policypaper': `/policy-papers/${documentToDelete.id}`,
        'casestudy': `/case-studies/${documentToDelete.id}`,
        'translation': `/translations/${documentToDelete.id}`,
        'certified': `/certified/translations/${documentToDelete.id}`
      };
      
      const endpoint = endpoints[docType];
      console.log('Making DELETE request to:', `${API}${endpoint}`);
      
      const response = await axios.delete(`${API}${endpoint}`, { headers });
      console.log('Delete response:', response.data);
      
      toast.success('Documento eliminado exitosamente');
      
      // Close modal and clear state
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      
      // Reload documents
      await loadClientAndDocuments();
    } catch (error) {
      console.error('Error deleting document:', error.response?.data || error.message);
      toast.error('Error al eliminar documento: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
  };

  const handleViewDocument = (doc) => {
    // For in-progress whitepapers, navigate to creation page with resume_id
    if (docType === 'whitepaper' && doc.status !== 'completed' && doc.status !== 'complete') {
      navigate(`/create-whitepaper?client_id=${clientId}&resume_id=${doc.id}`);
      return;
    }
    
    // Handle translations - check if it's certified or normal
    if (docType === 'translation' && doc.translation_type === 'certified') {
      navigate(`/translate/certified/view/${doc.id}`);
      return;
    }
    
    const routes = {
      'niw': `/view-business-plan/${doc.id}`,
      'patent': `/view-patent/${doc.id}`,
      'book': `/view-book/${doc.id}`,
      'books': `/view-book/${doc.id}`, // Support both singular and plural
      'whitepaper': `/view-whitepaper/${doc.id}`,
      'study': `/view-econometric-study/${doc.id}`,
      'recommendation': `/view-recommendation-letter/${doc.id}`,
      'expert': `/view-expert-letter/${doc.id}`,
      'selfpetition': `/view-self-petition-letter/${doc.id}`,
      'intentletter': `/view-intent-letter/${doc.id}`,
      'policypaper': `/view-policy-paper/${doc.id}`,
      'casestudy': `/view-case-study/${doc.id}`,
      'translation': `/translate/view/${doc.id}`,
      'certified': `/translate/certified/view/${doc.id}`
    };
    navigate(routes[docType]);
  };

  const handleRetryGeneration = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/books/${doc.id}/retry-generation`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Reintentando generación del libro...');
      // Reload documents to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error retrying generation:', error);
      toast.error('Error al reintentar la generación');
    }
  };

  const handleRetryCaseStudyGeneration = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/case-studies/${doc.id}/retry-generation`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Reintentando generación del caso de estudio...');
      // Reload documents to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error retrying case study generation:', error);
      toast.error('Error al reintentar la generación del caso de estudio');
    }
  };

  const handleRetryNIWGeneration = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/business-plans/retry-generation/${doc.id}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Reintentando generación del plan de negocio...');
      // Reload documents to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error retrying NIW generation:', error);
      toast.error('Error al reintentar la generación');
    }
  };

  const handleRetryPatentGeneration = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/patents/${doc.id}/retry-generation`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Reintentando generación de la patente...');
      // Reload documents to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error retrying patent generation:', error);
      toast.error('Error al reintentar la generación de la patente');
    }
  };

  const handleRetryPolicyPaperGeneration = async (doc) => {
    try {
      await axios.post(`${API}/policy-papers/${doc.id}/retry`, {}, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Reintentando generación del reporte...');
      loadClientAndDocuments();
    } catch (error) {
      console.error('Error retrying policy paper generation:', error);
      toast.error('Error al reintentar la generación del reporte');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  const info = getDocTypeInfo();
  const Icon = info.icon;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(`/client-dashboard/${clientId}`)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver al Cliente
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div>
              <h1 className="app-title">
                <Icon className="mr-2" size={32} style={{ display: 'inline' }} />
                {info.title}
              </h1>
              <p className="app-subtitle">{client?.name}</p>
            </div>
            {docType === 'patent' ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button onClick={handleCreateNew}>
                  <Plus className="mr-2" size={18} />
                  Crear Patente
                </Button>
                <Button 
                  onClick={() => navigate(`/create-patent-direct?client_id=${clientId}`)}
                  variant="outline"
                  style={{ borderColor: '#000', color: '#000' }}
                >
                  <FileText className="mr-2" size={18} />
                  Redactar con Propuesta
                </Button>
              </div>
            ) : docType === 'selfpetition' ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button 
                  onClick={() => navigate(`/create-self-petition-v2?client_id=${clientId}`)}
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
                >
                  <Sparkles className="mr-2" size={18} />
                  Crear V2 (Multi-Doc)
                </Button>
              </div>
            ) : (
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2" size={18} />
                Crear Nuevo
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        {loading ? (
          <Card>
            <CardContent style={{ padding: '4rem', textAlign: 'center' }}>
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2" size={32} />
                <span>Cargando documentos...</span>
              </div>
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent style={{ padding: '4rem', textAlign: 'center' }}>
              <Icon size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#666' }}>
                No hay documentos aún
              </h3>
              <p style={{ color: '#999', marginBottom: '2rem' }}>
                Crea el primer documento para este cliente
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2" size={18} />
                Crear {info.title}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {documents.map((doc) => {
              // Determinar si el documento está generándose (no clickeable, muestra spinner)
              const isGenerating = doc.status === 'generating' || doc.status === 'evaluating' || doc.status === 'translating';
              
              // Detectar documentos "stale" (atascados por más de 20 minutos en generating/translating)
              const updatedAt = doc.updated_at ? new Date(doc.updated_at) : null;
              const isStale = isGenerating && updatedAt && (Date.now() - updatedAt.getTime() > 20 * 60 * 1000);
              
              // Determinar si el documento está en progreso manual (no clickeable)
              const isInProgress = doc.status === 'in_progress' || 
                                    doc.status === 'processing' ||
                                    doc.status === 'generating' ||  // Incluir generating para mostrar botón de retry
                                    doc.status === 'translating' ||  // Incluir translating
                                    doc.status === 'draft' ||  // ✅ Incluir draft para patentes
                                    (docType === 'whitepaper' && doc.status !== 'completed' && doc.status !== 'complete');
              
              // Determinar si el documento está completado (clickeable)
              // Para traducciones: si existe translated_preview, word_count_translated, o certificate_number, está completado
              const isCompleted = doc.status === 'completed' || 
                                 doc.status === 'complete' || 
                                 doc.status === 'generation_complete' ||
                                 doc.status === 'review_needed' ||
                                 (docType === 'translation' && (
                                   doc.translated_preview || 
                                   doc.word_count_translated || 
                                   doc.certificate_number ||  // For certified translations in translation list
                                   doc.translation_type === 'certified'  // Explicitly marked as certified
                                 )) ||
                                 (docType === 'certified' && (doc.translated_text || doc.certificate_number));
              
              // Determinar si el documento falló o está atascado
              const isFailed = doc.status === 'failed' || doc.status === 'error' || isStale;
              
              // ✅ Detectar patentes que necesitan retry (restauradas, atascadas, cualquier estado no-final)
              const needsRetry = (docType === 'patent' && !isCompleted && !isGenerating) ||
                                 isFailed || isInProgress;
              
              return (
              <div key={doc.id} style={{ position: 'relative' }}>
                <Card 
                  className={(isGenerating || isInProgress) ? "opacity-75" : isFailed ? "opacity-85" : "cursor-pointer hover:shadow-lg transition-shadow"}
                  onClick={() => isCompleted && handleViewDocument(doc)}
                  style={{ 
                    cursor: isCompleted ? 'pointer' : 'not-allowed',
                    filter: (isGenerating || isInProgress) ? 'grayscale(20%)' : 'none',
                    border: isFailed ? '2px solid #ef4444' : undefined
                  }}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span style={{ flex: 1 }}>
                        {docType === 'niw' ? doc.project_title : 
                         docType === 'patent' ? doc.invention_title :
                         docType === 'whitepaper' ? doc.project_title :
                         docType === 'study' ? (doc.study_title || 'Estudio Econométrico') :
                         docType === 'recommendation' ? `Carta para ${doc.candidate_name}` :
                         docType === 'expert' ? `Carta de ${doc.expert_name || 'Experto'}` :
                         docType === 'selfpetition' ? `Autopetición: ${doc.client_name || doc.beneficiary_name || 'Beneficiario'}` :
                         docType === 'intentletter' ? `Carta de Intención: ${doc.petitioner_name || doc.client_name || 'Peticionario'}` :
                         docType === 'policypaper' ? (doc.project_title || 'Reporte de Impacto Social') :
                         docType === 'casestudy' ? (doc.title || `Caso de Estudio: ${doc.client_name}`) :
                         docType === 'translation' ? (
                           doc.translation_type === 'certified' 
                             ? `🏅 ${doc.certificate_number} - ${doc.original_filename || 'Certificada'}`
                             : (doc.filename || 'Traducción directa')
                         ) :
                         docType === 'certified' ? (doc.certificate_number || 'Traducción Certificada') :
                         doc.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {isFailed ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span style={{ 
                              background: isStale ? '#f59e0b' : '#ef4444', 
                              color: 'white', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              {isStale ? <AlertCircle size={12} /> : <X size={12} />}
                              {isStale ? 'Atascado - Reintentar' : 'Error en generación'}
                            </span>
                            {(doc.error_message || isStale) && (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: isStale ? '#f59e0b' : '#ef4444',
                                maxWidth: '200px',
                                textAlign: 'right'
                              }}>
                                {isStale ? 'Lleva más de 20 min sin actualizar' : doc.error_message?.substring(0, 50) + '...'}
                              </span>
                            )}
                          </div>
                        ) : isGenerating ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span style={{ 
                              background: '#8b5cf6', 
                              color: 'white', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <Loader2 className="animate-spin" size={12} />
                              {doc.status === 'evaluating' ? 'Evaluando...' : 'Generando...'}
                              {doc.progress_percentage !== undefined && (
                                <span style={{ marginLeft: '0.25rem' }}>{doc.progress_percentage}%</span>
                              )}
                            </span>
                            {doc.progress_message && (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: '#8b5cf6',
                                fontWeight: '500',
                                maxWidth: '200px',
                                textAlign: 'right'
                              }}>
                                {doc.progress_message}
                              </span>
                            )}
                          </div>
                        ) : isInProgress ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span style={{ 
                              background: '#3b82f6', 
                              color: 'white', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <Loader2 className="animate-spin" size={12} />
                              {doc.progress_message || 'Generando...'}
                            </span>
                            {doc.progress_percentage !== undefined && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                color: '#3b82f6',
                                fontWeight: '600'
                              }}>
                                {doc.progress_percentage}%
                              </span>
                            )}
                          </div>
                        ) : isCompleted ? (
                          <span style={{ 
                            background: '#10b981', 
                            color: 'white', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            ✓ Completado
                          </span>
                        ) : (
                          <span style={{ 
                            background: '#f59e0b', 
                            color: 'white', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}>
                            {docType === 'whitepaper' ? (
                              <>
                                <Loader2 className="animate-spin" size={12} />
                                Generando...
                              </>
                            ) : (
                              'En progreso'
                            )}
                          </span>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {new Date(doc.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/Caracas'
                      })} • {new Date(doc.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'America/Caracas'
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {docType === 'patent' && (
                      <p style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Campo:</strong> {doc.technical_field}
                      </p>
                    )}
                    {docType === 'niw' && (
                      <p style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Aplicante:</strong> {doc.applicant_name}
                      </p>
                    )}
                    {docType === 'book' && (
                      <p style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Género:</strong> {doc.genre}
                      </p>
                    )}
                    {docType === 'recommendation' && (
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        <p style={{ margin: '0.25rem 0' }}>
                          <strong>Firmante:</strong> {doc.recommender_name}
                        </p>
                        <p style={{ margin: '0.25rem 0' }}>
                          <strong>Tipo de Visa:</strong> {doc.visa_type || 'EB-2 NIW'}
                        </p>
                      </div>
                    )}
                    {docType === 'expert' && (
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        <p style={{ margin: '0.25rem 0' }}>
                          <strong>Experto:</strong> {doc.expert_name}
                        </p>
                        <p style={{ margin: '0.25rem 0' }}>
                          <strong>Organización:</strong> {doc.expert_organization || 'N/A'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Action buttons positioned outside the Card */}
                <div style={{ 
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  display: 'flex', 
                  gap: '0.5rem',
                  zIndex: 10
                }}>
                  {/* 📄 Word EN download — for completed documents only.
                      Native .docx imports cleanly into Google Docs preserving
                      formatting, unlike PDFs which lose tables/styles when
                      converted. */}
                  {isCompleted && docxEndpointFor(docType, doc) && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <WordDownloadButton
                        url={docxEndpointFor(docType, doc)}
                        testId={`word-en-btn-${doc.id}`}
                        size="sm"
                        variant="outline"
                        className="bg-white shadow-sm"
                      >
                        <Download size={14} />
                        Word EN
                      </WordDownloadButton>
                    </div>
                  )}
                  {/* Botón Reintentar para libros, NIW, patentes, policy papers, white papers, estudios econométricos y casos de estudio atascados o fallidos */}
                  {(needsRetry || isFailed || isInProgress || (docType === 'study' && !isCompleted) || (docType === 'whitepaper' && !isCompleted) || (docType === 'casestudy' && !isCompleted)) && (docType === 'book' || docType === 'niw' || docType === 'patent' || docType === 'policypaper' || docType === 'study' || docType === 'whitepaper' || docType === 'casestudy') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (docType === 'niw') {
                          handleRetryNIWGeneration(doc);
                        } else if (docType === 'patent') {
                          handleRetryPatentGeneration(doc);
                        } else if (docType === 'policypaper') {
                          handleRetryPolicyPaperGeneration(doc);
                        } else if (docType === 'casestudy') {
                          // Retry case study
                          handleRetryCaseStudyGeneration(doc);
                        } else if (docType === 'whitepaper') {
                          // Retry whitepaper
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API}/whitepapers/${doc.id}/retry-generation`, {}, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            toast.success('Reintentando generación del white paper...');
                            loadClientAndDocuments();
                          } catch (error) {
                            console.error('Error retrying whitepaper generation:', error);
                            toast.error('Error al reintentar generación');
                          }
                        } else if (docType === 'study') {
                          // Retry econometric study
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API}/econometric-studies/${doc.id}/retry-generation`, {}, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            toast.success('Reintentando generación del estudio...');
                            loadClientAndDocuments();
                          } catch (error) {
                            console.error('Error retrying study generation:', error);
                            toast.error('Error al reintentar generación');
                          }
                        } else {
                          handleRetryGeneration(doc);
                        }
                      }}
                      style={{ 
                        color: '#f59e0b',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        minWidth: 'auto'
                      }}
                      title={isFailed ? 'Reintentar generación' : 'Continuar generación'}
                    >
                      <RefreshCw size={16} />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(doc);
                    }}
                    style={{ 
                      color: '#ef4444',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      minWidth: 'auto'
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este documento? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete} disabled={deleting}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete} 
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Admin Panel Component

export default ClientDocumentsList;
