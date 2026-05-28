import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useNavigate, Link, Navigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from './components/ui/button';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { toast } from 'sonner';
import { FileText, Book, Download, Trash2, Edit, Plus, Loader2, ArrowLeft, ArrowRight, Save, Scale, TrendingUp, CheckCircle, RefreshCw, Upload, FileBarChart, Briefcase, Globe, Mail, UserCheck, Award, BarChart3, History, MessageSquare, Send, Check, X, User, Users, Reply, MoreVertical, Play, AlertCircle, Paperclip, XCircle, AlertTriangle, Lightbulb, Grid3x3, List, Search, Rocket, Languages, Shield, Columns, Copy, Settings, Sparkles, Layers, FileCheck, RefreshCcw, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './components/ui/dialog';
import { Eye } from 'lucide-react';
import AsyncSelect from 'react-select/async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import { marked } from 'marked';
import TurndownService from 'turndown';

// ========== IMPORTED PAGE COMPONENTS ==========
import Dashboard from './pages/Dashboard';
import PromptManager from './pages/PromptManager';
import ChatPage from './pages/ChatPage';
import ClientDashboard from './pages/ClientDashboard';
import ClientDocumentsList from './pages/ClientDocumentsList';
import { WordDownloadButton } from './components/WordDownloadButton';
import CreateNIWInteractive from './pages/CreateNIWInteractive';
import CreateBookInteractive from './pages/CreateBookInteractive';
import CreatePatentInteractive from './pages/CreatePatentInteractive';
import CreateWhitepaperInteractive from './pages/CreateWhitepaperInteractive';
import CreateSelfPetitionV2 from './pages/CreateSelfPetitionV2';
import CreateEconometricStudy from './pages/CreateEconometricStudy';
import ViewBook from './pages/ViewBook';
import ViewBusinessPlan from './pages/ViewBusinessPlan';
import ViewPatent from './pages/ViewPatent';
// ========== END IMPORTED PAGE COMPONENTS ==========

const BACKEND_URL = window.location.origin;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:');
const LOGO_URL = process.env.REACT_APP_LOGO_URL || 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

// Polling Hook - Replaces WebSocket for better production stability
const useActivityPolling = (userId) => {
  const [activities, setActivities] = useState([]);
  const [isConnected, setIsConnected] = useState(true); // Always true for polling

  useEffect(() => {
    if (!userId) return;

    // Función para obtener actividades
    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/api/dashboard/recent-activity?limit=10`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setActivities(data);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
        setIsConnected(false);
      }
    };

    // Fetch inicial
    fetchActivities();

    // Polling cada 15 segundos
    const interval = setInterval(fetchActivities, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  return { activities, isConnected };
};

// ProtectedRoute component for authenticated pages
const PANEL_URL = process.env.REACT_APP_PANEL_URL || 'https://redaccion.urpeintegralservices.co';

// ProtectedRoute — NO bloquea, solo muestra loading mientras carga
const ProtectedRoute = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Cargando...</p>
      </div>
    );
  }

  return children;
};

// ============================================================================
// LandingOrDashboard — siempre va al dashboard
// ============================================================================
const LandingOrDashboard = () => {
  return <Navigate to="/dashboard" replace />;
};
// ============================================================================
// SSO Handler - Lee ?token= y hace SSO silencioso en background (NO bloquea)
// ============================================================================
const SSOHandler = ({ children }) => {
  const { isAuthenticated, loading, ssoLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ssoTriggered = useRef(false);

  useEffect(() => {
    const externalToken = searchParams.get('token');
    if (!externalToken) return;
    if (loading) return;
    if (ssoTriggered.current) return;
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    ssoTriggered.current = true;
    const doSSO = async () => {
      const result = await ssoLogin(externalToken);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      }
      // Si falla, no bloquea — el usuario sigue usando la app
    };
    doSSO();
  }, [loading, isAuthenticated]);

  // Mientras AuthContext está haciendo auto-SSO, mostrar spinner
  if (loading && searchParams.get('token')) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', background: '#FFFFFF', gap: '1rem'
      }}>
        <Loader2 className="animate-spin" size={48} style={{ color: '#F8BF13' }} />
        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: '600', color: '#374151', fontSize: '1.1rem' }}>
          Verificando acceso...
        </p>
      </div>
    );
  }

  return children;
};
// ============================================================================

const AllBooksListRemoved = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllBooks();
  }, []);

  const loadAllBooks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Load all books (in progress and completed) without filtering by client_id
      const [inProgress, completed] = await Promise.all([
        axios.get(`${API}/books/in-progress`, { headers }),
        axios.get(`${API}/books`, { headers })
      ]);
      
      // Combine and sort by creation date
      const allBooks = [...inProgress.data, ...completed.data].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      
      console.log(`Loaded ${allBooks.length} books total:`, allBooks);
      setBooks(allBooks);
    } catch (error) {
      console.error('Error loading books:', error);
      toast.error('Error al cargar libros');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (book) => {
    setBookToDelete(book);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!bookToDelete) return;
    
    setDeleting(true);
    console.log('Deleting book:', bookToDelete.id);
    
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Determine if it's in progress or completed based on status
      const endpoint = bookToDelete.status === 'completed' 
        ? `/books/${bookToDelete.id}`
        : `/books/in-progress/${bookToDelete.id}`;
      
      console.log('Making DELETE request to:', `${API}${endpoint}`);
      
      await axios.delete(`${API}${endpoint}`, { headers });
      
      toast.success('Libro eliminado exitosamente');
      
      // Close modal and clear state
      setDeleteModalOpen(false);
      setBookToDelete(null);
      
      // Reload books
      await loadAllBooks();
    } catch (error) {
      console.error('Error deleting book:', error.response?.data || error.message);
      toast.error('Error al eliminar libro: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setBookToDelete(null);
  };

  const handleViewBook = (book) => {
    // Check if book has complete information
    const hasCompleteInfo = book.title && book.synopsis && book.synopsis.length > 20 && book.author_name;
    
    // If book is a draft WITHOUT complete info, go to create-book-interactive to complete
    if (book.status === 'draft' && !hasCompleteInfo) {
      navigate(`/create-book-interactive?resumeId=${book.id}`);
    }
    // If book has complete info but NO chapters, go to create-book-interactive to start generation
    else if ((!book.chapters || book.chapters.length === 0) && hasCompleteInfo) {
      navigate(`/create-book-interactive?resumeId=${book.id}`);
    }
    // If book has chapters, go to view mode
    else if (book.chapters && book.chapters.length > 0) {
      navigate(`/view-book/${book.id}`);
    }
    // Fallback: incomplete book, go to create to complete
    else {
      navigate(`/create-book-interactive?resumeId=${book.id}`);
    }
  };

  const handleCreateNew = () => {
    navigate('/create-book');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver a Dashboard
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div>
              <h1 className="app-title">
                <Book className="mr-2" size={32} style={{ display: 'inline' }} />
                Mis Libros
              </h1>
              <p className="app-subtitle">Todos los libros que has creado</p>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2" size={18} />
              Crear Nuevo
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        {loading ? (
          <Card>
            <CardContent style={{ padding: '4rem', textAlign: 'center' }}>
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2" size={32} />
                <span>Cargando libros...</span>
              </div>
            </CardContent>
          </Card>
        ) : books.length === 0 ? (
          <Card>
            <CardContent style={{ padding: '4rem', textAlign: 'center' }}>
              <Book size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#666' }}>
                No tienes libros aún
              </h3>
              <p style={{ color: '#999', marginBottom: '2rem' }}>
                Crea tu primer libro
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2" size={18} />
                Crear Libro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {books.map((book) => (
              <div key={book.id} style={{ position: 'relative' }}>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleViewBook(book)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span style={{ flex: 1 }}>
                        {book.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {(book.status === 'completed' || book.status === 'complete') ? (
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
                            fontWeight: '600'
                          }}>
                            En progreso
                          </span>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {book.genre && `${book.genre} • `}
                      {new Date(book.created_at).toLocaleDateString('es', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                      })}
                    </CardDescription>
                    {book.synopsis && (
                      <CardDescription style={{ marginTop: '0.5rem' }}>
                        {book.synopsis.length > 150 ? `${book.synopsis.substring(0, 150)}...` : book.synopsis}
                      </CardDescription>
                    )}
                    {book.client_id && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{
                          background: '#e0e7ff',
                          color: '#4f46e5',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          👤 Asociado a cliente
                        </span>
                      </div>
                    )}
                  </CardHeader>
                </Card>
                
                {/* Delete button positioned absolutely */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(book);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.9)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  <Trash2 size={16} style={{ color: '#ef4444' }} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar el libro "{bookToDelete?.title}"?
                Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelDelete} disabled={deleting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmDelete} 
                disabled={deleting}
                style={{ background: '#ef4444', color: 'white' }}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={16} />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2" size={16} />
                    Eliminar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

// Client Documents List Component
const AdminPanel = () => {
  const [operators, setOperators] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedClientForTransfer, setSelectedClientForTransfer] = useState(null);
  const [newOperatorData, setNewOperatorData] = useState({
    email: '',
    full_name: '',
    password: '',
    language_preference: 'es'
  });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Acceso denegado. Solo administradores.');
      navigate('/');
      return;
    }
    loadAdminData();
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [operatorsRes, statsRes, clientsRes] = await Promise.all([
        axios.get(`${API}/admin/operators`),
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/clients?limit=200`) // Get all clients for transfer
      ]);
      
      setOperators(operatorsRes.data.operators || []);
      setAdminStats(statsRes.data);
      setAllClients(clientsRes.data.clients || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Error al cargar datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperator = async () => {
    try {
      if (!newOperatorData.email || !newOperatorData.full_name || !newOperatorData.password) {
        toast.error('Todos los campos son requeridos');
        return;
      }

      await axios.post(`${API}/admin/operators`, newOperatorData);
      toast.success('Operador creado exitosamente');
      setShowCreateModal(false);
      setNewOperatorData({ email: '', full_name: '', password: '', language_preference: 'es' });
      loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear operador');
    }
  };

  const handleUpdateStatus = async (operatorId, newStatus) => {
    try {
      await axios.put(`${API}/admin/operators/${operatorId}/status`, { status: newStatus });
      toast.success(`Estado actualizado a: ${newStatus}`);
      loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar estado');
    }
  };

  const handleTransferClient = async (clientId, newOperatorId) => {
    try {
      const result = await axios.post(`${API}/admin/clients/${clientId}/transfer`, {
        new_operator_id: newOperatorId
      });
      
      toast.success(`Cliente transferido exitosamente. ${result.data.documents_updated} documentos actualizados.`);
      setShowTransferModal(false);
      setSelectedClientForTransfer(null);
      loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al transferir cliente');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <img src={LOGO_URL} alt="Monica Logo" className="logo-image" />
            <div>
              <h1 className="app-title">Admin Panel</h1>
              <p className="app-subtitle">Gestión de operadores y sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2" size={18} />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        
        {/* Admin Stats */}
        {adminStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                  {adminStats.total_operators}
                </CardTitle>
                <CardDescription>Operadores Totales</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                  {adminStats.active_operators}
                </CardTitle>
                <CardDescription>Operadores Activos</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f5576c' }}>
                  {adminStats.total_clients}
                </CardTitle>
                <CardDescription>Clientes Totales</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00f2fe' }}>
                  {adminStats.total_documents}
                </CardTitle>
                <CardDescription>Documentos Totales</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Operators Management */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Gestión de Operadores</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2" size={18} />
            Crear Operador
          </Button>
        </div>

        <Card>
          <CardContent style={{ padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Operador</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Clientes</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Documentos</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Estado</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op, idx) => (
                  <tr key={op.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600' }}>{op.full_name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>ID: {op.id.slice(0, 8)}...</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{op.email}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ 
                        background: '#e0e7ff', 
                        color: '#4f46e5',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}>
                        {op.clients_count}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ 
                        background: '#fef3c7', 
                        color: '#92400e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}>
                        {op.documents_count}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Select 
                        value={op.status} 
                        onValueChange={(newStatus) => handleUpdateStatus(op.id, newStatus)}
                      >
                        <SelectTrigger style={{ width: '120px', margin: '0 auto' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">✅ Activo</SelectItem>
                          <SelectItem value="suspended">⏸️ Suspendido</SelectItem>
                          <SelectItem value="inactive">❌ Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Show clients of this operator
                          const operatorClients = allClients.filter(c => c.operator_id === op.id);
                          console.log('Operator clients:', operatorClients);
                        }}
                      >
                        Ver Clientes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Client Transfer Section */}
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '3rem', marginBottom: '1.5rem' }}>
          Transferencia de Clientes
        </h2>

        <Card>
          <CardContent style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
              Selecciona un cliente para transferirlo a otro operador
            </p>
            <Select onValueChange={(clientId) => {
              const client = allClients.find(c => c.id === clientId);
              setSelectedClientForTransfer(client);
              setShowTransferModal(true);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {allClients.map(client => {
                  const operator = operators.find(op => op.id === client.operator_id);
                  return (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.email}) - Operador: {operator?.full_name || 'Unknown'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

      </main>

      {/* Create Operator Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Operador</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo operador
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <Label>Nombre Completo *</Label>
              <Input
                value={newOperatorData.full_name}
                onChange={(e) => setNewOperatorData({...newOperatorData, full_name: e.target.value})}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newOperatorData.email}
                onChange={(e) => setNewOperatorData({...newOperatorData, email: e.target.value})}
                placeholder="juan@example.com"
              />
            </div>
            <div>
              <Label>Contraseña *</Label>
              <Input
                type="password"
                value={newOperatorData.password}
                onChange={(e) => setNewOperatorData({...newOperatorData, password: e.target.value})}
                placeholder="Contraseña segura"
              />
            </div>
            <div>
              <Label>Idioma</Label>
              <Select value={newOperatorData.language_preference} onValueChange={(val) => setNewOperatorData({...newOperatorData, language_preference: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Button onClick={handleCreateOperator} style={{ flex: 1 }}>
                Crear Operador
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Client Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Cliente</DialogTitle>
            <DialogDescription>
              {selectedClientForTransfer && (
                <>Cliente: {selectedClientForTransfer.name} ({selectedClientForTransfer.email})</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedClientForTransfer && (
            <div style={{ marginTop: '1rem' }}>
              <Label>Nuevo Operador</Label>
              <Select onValueChange={(newOpId) => handleTransferClient(selectedClientForTransfer.id, newOpId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar operador..." />
                </SelectTrigger>
                <SelectContent>
                  {operators.filter(op => op.status === 'active' && op.id !== selectedClientForTransfer.operator_id).map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.full_name} ({op.email}) - {op.clients_count} clientes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DesignDocument = () => {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    design_description: '',
    should_summarize: false,
    use_gamma: false
  });
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validExtensions = ['.docx', '.pdf', '.txt', '.doc'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        toast.error('Formato no soportado. Use .docx, .pdf o .txt');
        return;
      }
      
      setFile(selectedFile);
      toast.success(`Archivo "${selectedFile.name}" seleccionado`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      formDataToSend.append('design_description', formData.design_description);
      formDataToSend.append('should_summarize', formData.should_summarize);
      formDataToSend.append('use_gamma', formData.use_gamma);

      const response = await axios.post(`${API}/design-document/upload`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('¡Documento diseñado exitosamente!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el documento');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="create-container">
      <div className="create-header">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} data-testid="back-button">
          <ArrowLeft className="mr-2" size={18} />
          {t('form.back')}
        </Button>
      </div>

      <div className="create-content">
        <div className="form-header">
          <Edit size={48} className="form-icon" />
          <h1 className="form-title">Diseñar Documento</h1>
          <p className="form-subtitle">
            Sube tu documento y Monica lo diseñará gráficamente según tus especificaciones
          </p>
        </div>

        <Card className="form-card">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="form-field full-width">
                <Label htmlFor="file">Documento *</Label>
                <div className="file-upload-area">
                  <Input
                    id="file"
                    type="file"
                    accept=".docx,.pdf,.txt,.doc"
                    onChange={handleFileChange}
                    data-testid="file-input"
                    required
                    className="file-input"
                  />
                  {file && (
                    <div className="file-selected">
                      <FileText size={20} />
                      <span>{file.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Formatos soportados: .docx, .pdf, .txt
                </p>
              </div>

              <div className="form-field full-width">
                <Label htmlFor="design_description">Descripción del Diseño Deseado *</Label>
                <Textarea
                  id="design_description"
                  data-testid="design-description-input"
                  value={formData.design_description}
                  onChange={(e) => setFormData({ ...formData, design_description: e.target.value })}
                  required
                  placeholder="Describe cómo quieres que se vea el documento: colores, estilo de fuente, espaciado, estructura de secciones, etc. Por ejemplo: 'Diseño minimalista con títulos en negrita, espaciado amplio entre párrafos, estilo corporativo profesional...'"
                  rows={5}
                />
              </div>

              <div className="form-field full-width">
                <Label className="text-base font-semibold mb-3">Opciones de Diseño</Label>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="use_gamma"
                      data-testid="gamma-checkbox"
                      checked={formData.use_gamma}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        use_gamma: e.target.checked,
                        should_summarize: e.target.checked ? false : formData.should_summarize
                      })}
                      className="w-4 h-4 mt-1"
                    />
                    <div>
                      <Label htmlFor="use_gamma" className="cursor-pointer font-semibold">
                        ✨ Usar Gamma (Diseño Visual Impresionante)
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Genera documentos con diseño profesional y visual usando Gamma.app. 
                        <strong> Mantiene TODO el texto original.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="should_summarize"
                      data-testid="summarize-checkbox"
                      checked={formData.should_summarize}
                      disabled={formData.use_gamma}
                      onChange={(e) => setFormData({ ...formData, should_summarize: e.target.checked })}
                      className="w-4 h-4 mt-1"
                    />
                    <div>
                      <Label 
                        htmlFor="should_summarize" 
                        className={`cursor-pointer ${formData.use_gamma ? 'opacity-50' : ''}`}
                      >
                        📝 Resumir contenido (Solo PDF Simple)
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        {formData.use_gamma 
                          ? '⚠️ No disponible con Gamma - Gamma mantiene todo el texto'
                          : 'Reduce el contenido manteniendo los puntos clave'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={uploading} 
                className="submit-button"
                data-testid="upload-design-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando Documento...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2" size={18} />
                    Diseñar Documento
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [generationTimes, setGenerationTimes] = useState(null);
  const [approvalRates, setApprovalRates] = useState(null);
  const [qualityScores, setQualityScores] = useState(null);
  const [documentsByMonth, setDocumentsByMonth] = useState(null);
  const [roi, setRoi] = useState(null);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const BACKEND_URL = window.location.origin;

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  const loadAllAnalytics = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [summaryRes, timesRes, ratesRes, scoresRes, monthsRes, roiRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/analytics/summary`, { headers }),
        fetch(`${BACKEND_URL}/api/analytics/generation-times`, { headers }),
        fetch(`${BACKEND_URL}/api/analytics/approval-rate`, { headers }),
        fetch(`${BACKEND_URL}/api/analytics/quality-scores`, { headers }),
        fetch(`${BACKEND_URL}/api/analytics/documents-by-month`, { headers }),
        fetch(`${BACKEND_URL}/api/analytics/client-roi`, { headers })
      ]);

      const [summaryData, timesData, ratesData, scoresData, monthsData, roiData] = await Promise.all([
        summaryRes.json(),
        timesRes.json(),
        ratesRes.json(),
        scoresRes.json(),
        monthsRes.json(),
        roiRes.json()
      ]);

      if (summaryData.success) setSummary(summaryData.summary);
      if (timesData.success) setGenerationTimes(timesData.generation_times);
      if (ratesData.success) setApprovalRates(ratesData.approval_rates);
      if (scoresData.success) setQualityScores(scoresData.quality_scores);
      if (monthsData.success) setDocumentsByMonth(monthsData);
      if (roiData.success) setRoi(roiData.roi);

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error(t('error_loading_analytics') || 'Error cargando analytics');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {i18n.language === 'es' ? '📊 Dashboard de Analytics' : '📊 Analytics Dashboard'}
          </h1>
          <p className="text-gray-600 mt-1">
            {i18n.language === 'es' ? 'Métricas e insights de tus documentos' : 'Metrics and insights from your documents'}
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="mr-2" size={16} />
          {i18n.language === 'es' ? 'Volver' : 'Back'}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Total Documentos' : 'Total Documents'}</p>
                  <p className="text-3xl font-bold">{summary.total_documents}</p>
                </div>
                <FileText size={32} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'En Progreso' : 'In Progress'}</p>
                  <p className="text-3xl font-bold">{summary.in_progress.total}</p>
                </div>
                <Loader2 size={32} className="text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Quality Score' : 'Quality Score'}</p>
                  <p className="text-3xl font-bold">{summary.quality_metrics.average_score}/10</p>
                </div>
                <Award size={32} className="text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Comentarios' : 'Comments'}</p>
                  <p className="text-3xl font-bold">{summary.collaboration.total_comments}</p>
                  <p className="text-xs text-orange-600">{summary.collaboration.open_comments} {i18n.language === 'es' ? 'abiertos' : 'open'}</p>
                </div>
                <MessageSquare size={32} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generation Times Chart */}
      {generationTimes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? '⏱️ Tiempo Promedio de Generación' : '⏱️ Average Generation Time'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(generationTimes).map(([name, data]) => ({
                name,
                minutes: data.avg_minutes,
                count: data.count
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis label={{ value: i18n.language === 'es' ? 'Minutos' : 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="minutes" fill="#8884d8" name={i18n.language === 'es' ? 'Tiempo (min)' : 'Time (min)'} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(generationTimes).map(([name, data]) => (
                <div key={name} className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-2xl font-bold text-blue-600">{data.avg_minutes}</p>
                  <p className="text-xs text-gray-600">{i18n.language === 'es' ? 'minutos' : 'minutes'}</p>
                  <p className="text-xs text-gray-500">({data.count} {i18n.language === 'es' ? 'docs' : 'docs'})</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Rates */}
      {approvalRates && Object.keys(approvalRates).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? '✅ Tasa de Aprobación de Secciones' : '✅ Section Approval Rate'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(approvalRates).map(([docType, data]) => (
                <div key={docType} className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">{docType}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-500"
                          style={{ width: `${data.approval_rate}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-green-600">{data.approval_rate}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>✅ {data.total_approvals} {i18n.language === 'es' ? 'aprobadas' : 'approved'}</span>
                    <span>✏️ {data.total_edits} {i18n.language === 'es' ? 'editadas' : 'edited'}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents by Month */}
      {documentsByMonth && documentsByMonth.data && documentsByMonth.data.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? '📈 Documentos Creados por Mes' : '📈 Documents Created by Month'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={documentsByMonth.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="NIW Proposals" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="Patents" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Area type="monotone" dataKey="Books" stackId="1" stroke="#ffc658" fill="#ffc658" />
                <Area type="monotone" dataKey="Econometric Studies" stackId="1" stroke="#ff8042" fill="#ff8042" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-center mt-4 text-gray-600">
              {i18n.language === 'es' ? 'Total de documentos' : 'Total documents'}: <span className="font-bold">{documentsByMonth.total_documents}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ROI Calculator */}
      {roi && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? '💰 ROI - Tiempo Ahorrado' : '💰 ROI - Time Saved'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Horas Ahorradas' : 'Hours Saved'}</p>
                <p className="text-4xl font-bold text-green-600">{roi.totals.total_saved_hours.toLocaleString()}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Dinero Ahorrado' : 'Money Saved'}</p>
                <p className="text-4xl font-bold text-blue-600">${roi.totals.total_saved_money.toLocaleString()}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Tarifa Horaria' : 'Hourly Rate'}</p>
                <p className="text-4xl font-bold text-purple-600">${roi.totals.hourly_rate}</p>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(roi.by_document_type).map(([docType, data]) => (
                data.count > 0 && (
                  <div key={docType} className="p-4 border rounded-lg flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{docType}</h4>
                      <p className="text-sm text-gray-600">
                        {data.count} {i18n.language === 'es' ? 'documentos' : 'documents'} • 
                        {data.saved_hours.toFixed(1)}h {i18n.language === 'es' ? 'ahorradas' : 'saved'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">${data.saved_money.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{data.efficiency_gain}% {i18n.language === 'es' ? 'eficiencia' : 'efficiency'}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Pie Chart */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? '📊 Distribución de Documentos' : '📊 Document Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'NIW Proposals', value: summary.by_type.niw_proposals },
                    { name: 'Patents', value: summary.by_type.patents },
                    { name: 'Books', value: summary.by_type.books },
                    { name: 'Econometric Studies', value: summary.by_type.econometric_studies }
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// END ANALYTICS DASHBOARD COMPONENT
// ============================================================================

// ============================================================================
// DRAFTS MANAGEMENT COMPONENT
// ============================================================================

const DraftsManager = () => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const BACKEND_URL = window.location.origin;

  useEffect(() => {
    loadDrafts();
    loadStats();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDrafts(data.drafts);
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
      toast.error(t('error_loading_drafts') || 'Error cargando borradores');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/drafts/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleDelete = async (draftId) => {
    if (!window.confirm(i18n.language === 'es' ? '¿Eliminar este borrador?' : 'Delete this draft?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.success(i18n.language === 'es' ? 'Borrador eliminado' : 'Draft deleted');
        loadDrafts();
        loadStats();
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error(t('error_deleting') || 'Error al eliminar');
    }
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      'niw': i18n.language === 'es' ? 'Propuesta EB-2 NIW' : 'EB-2 NIW Proposal',
      'patent': i18n.language === 'es' ? 'Patente USPTO' : 'USPTO Patent',
      'book': i18n.language === 'es' ? 'Libro' : 'Book',
      'econometric_study': i18n.language === 'es' ? 'Estudio Econométrico' : 'Econometric Study',
      'white_paper': i18n.language === 'es' ? 'White Paper' : 'White Paper',
      'case_study': i18n.language === 'es' ? 'Caso de Estudio' : 'Case Study'
    };
    return labels[type] || type;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {i18n.language === 'es' ? '📝 Mis Borradores' : '📝 My Drafts'}
          </h1>
          <p className="text-gray-600 mt-1">
            {i18n.language === 'es' ? 'Documentos guardados como borrador' : 'Documents saved as draft'}
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="mr-2" size={16} />
          {i18n.language === 'es' ? 'Volver' : 'Back'}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{i18n.language === 'es' ? 'Total Borradores' : 'Total Drafts'}</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <FileText size={32} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>
          {Object.entries(stats.by_type).map(([type, count]) => (
            <Card key={type}>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm text-gray-600">{getDocumentTypeLabel(type)}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 text-lg">
              {i18n.language === 'es' ? 'No tienes borradores guardados' : 'No saved drafts'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {i18n.language === 'es' ? 'Los borradores aparecerán aquí cuando los guardes' : 'Drafts will appear here when you save them'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <Card key={draft.draft_id} className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{draft.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{getDocumentTypeLabel(draft.document_type)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(draft.draft_id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <p>{i18n.language === 'es' ? 'Actualizado' : 'Updated'}: {formatDate(draft.updated_at)}</p>
                  </div>

                  {draft.completion_percentage > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{i18n.language === 'es' ? 'Progreso' : 'Progress'}</span>
                        <span>{draft.completion_percentage}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${draft.completion_percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {draft.notes && (
                    <p className="text-sm text-gray-500 italic line-clamp-2">
                      {draft.notes}
                    </p>
                  )}

                  <Button 
                    onClick={() => {
                      // Store draft data in sessionStorage and redirect to create page
                      sessionStorage.setItem('draft_to_load', JSON.stringify(draft));
                      // Map document types to correct routes
                      const routeMap = {
                        'niw': '/create-business-plan',
                        'patent': '/create-patent',
                        'book': '/create-book',
                        'econometric_study': '/create-econometric-study'
                      };
                      const route = routeMap[draft.document_type] || `/create-${draft.document_type}`;
                      navigate(route);
                    }}
                    className="w-full"
                  >
                    <Edit className="mr-2" size={16} />
                    {i18n.language === 'es' ? 'Continuar Editando' : 'Continue Editing'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// END DRAFTS MANAGEMENT COMPONENT
// ============================================================================


// ============================================================================
// VIEW WHITEPAPER COMPONENT
// ============================================================================

const ViewWhitepaper = () => {
  const [whitepaper, setWhitepaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('es');
  // ⭐ Estados para edición con IA
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadWhitepaper();
  }, [id]);

  useEffect(() => {
    // Set up polling if whitepaper is generating
    if (whitepaper && whitepaper.status === 'generating') {
      const pollInterval = setInterval(() => {
        loadWhitepaper();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(pollInterval);
    }
  }, [whitepaper?.status]);

  const loadWhitepaper = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/whitepapers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setWhitepaper(response.data);
      
      // Show progress update if generating
      if (response.data.status === 'generating') {
        const progress = response.data.progress || 0;
        if (progress > 0) {
          toast.loading(`Generando white paper... ${progress}% completado`, {
            id: 'whitepaper-progress'
          });
        }
      } else if (response.data.status === 'completed') {
        toast.dismiss('whitepaper-progress');
        toast.success('✅ White paper generado exitosamente!');
      } else if (response.data.status === 'error') {
        toast.dismiss('whitepaper-progress');
        toast.error('❌ Error al generar el white paper: ' + (response.data.error_message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error loading whitepaper:', error);
      const errorMessage = error.response?.data?.detail || 'Error al cargar el white paper';
      toast.error(errorMessage);
      // Don't redirect immediately, show error state instead
      setWhitepaper({ error: errorMessage, id: id });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (whitepaper?.client_id) {
      navigate(`/client-documents/${whitepaper.client_id}/whitepaper`);
    } else {
      navigate('/dashboard');
    }
  };

  const downloadPDF = async (language) => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      toast.info(`Generando PDF en ${language === 'es' ? 'español' : 'inglés'}...`);
      
      const response = await axios.get(
        `${API}/whitepapers/${id}/download?language=${language}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Extract filename from Content-Disposition header
      // NOTE: Axios normalizes all headers to lowercase
      let filename = `Whitepaper_${whitepaper.project_title}_${language}.pdf`; // fallback
      
      const contentDisposition = response.headers['content-disposition'];
      
      if (contentDisposition) {
        // Extract filename from Content-Disposition header
        // Handles formats like: filename="value" or filename=value
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          // Remove quotes if present
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF descargado exitosamente');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF');
    } finally {
      setDownloading(false);
    }
  };

  // ⭐ FUNCIÓN PARA EDITAR CON IA
  const editWhitepaperWithAI = async () => {
    if (!aiEditInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setAiEditLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Obtener todo el contenido actual del documento
      let fullContent = '';
      whitepaper.sections?.sort((a, b) => a.number - b.number).forEach(section => {
        const content = currentLanguage === 'en' 
          ? (section.content_en || section.content || '')
          : (section.content_es || section.content || '');
        fullContent += `## Section ${section.number}: ${section.title}\n\n${content}\n\n`;
      });
      
      const response = await axios.post(
        `${API}/whitepapers/${id}/edit-document`,
        {
          edit_instructions: aiEditInstructions,
          current_content: fullContent,
          target_language: currentLanguage
        },
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 60000
        }
      );
      
      if (response.data.success) {
        toast.success('✅ Edición aplicada. Recargando...');
        setShowAIEditModal(false);
        setAiEditInstructions('');
        
        setTimeout(async () => {
          await loadWhitepaper();
        }, 2000);
      } else {
        toast.error('Error al editar con IA');
      }
    } catch (error) {
      console.error('Error editing with AI:', error);
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.info('⏳ La edición está en proceso. Espera unos segundos y recarga.');
        setShowAIEditModal(false);
        setAiEditInstructions('');
      } else {
        toast.error('Error al editar: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setAiEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!whitepaper) {
    return <div>White paper no encontrado</div>;
  }

  // Show error state for corrupted/failed whitepapers
  if (whitepaper.error) {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2" size={20} />
              Volver
            </Button>
            <div style={{ flex: 1 }}>
              <h1 className="app-title">Error al Cargar White Paper</h1>
            </div>
          </div>
        </header>
        <main className="dashboard-main" style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Card style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem 2rem', borderColor: '#f87171' }}>
            <AlertCircle size={64} style={{ color: '#f87171', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#f87171' }}>
              White Paper Corrupto
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {whitepaper.error}
            </p>
            <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
              Este whitepaper tiene un problema y no se puede mostrar. Te recomendamos eliminarlo y crear uno nuevo.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="outline" onClick={handleBack}>
                Volver a la Lista
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Show generating status
  if (whitepaper.status === 'generating') {
    const progress = whitepaper.progress || 0;
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2" size={20} />
              Volver
            </Button>
            <div style={{ flex: 1 }}>
              <h1 className="app-title">{whitepaper.project_title}</h1>
              <p className="app-subtitle">White Paper Técnico</p>
            </div>
          </div>
        </header>
        <main className="dashboard-main" style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Card style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
            <Loader2 className="animate-spin mx-auto mb-4" size={64} style={{ color: '#3b82f6' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
              🚀 Generando White Paper Completo
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1.1rem' }}>
              Este proceso toma aproximadamente 5-10 minutos.<br />
              Puedes cerrar esta página y continuar trabajando. Te notificaremos cuando esté listo.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                width: '100%', 
                height: '24px', 
                backgroundColor: '#e5e7eb', 
                borderRadius: '12px', 
                overflow: 'hidden',
                marginBottom: '0.5rem'
              }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: '100%', 
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.5s ease',
                  borderRadius: '12px'
                }} />
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                {progress}% completado
              </p>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '2rem' }}>
              💡 Puedes cerrar esta página. La generación continuará en segundo plano.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  // Show error status
  if (whitepaper.status === 'error') {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2" size={20} />
              Volver
            </Button>
            <div style={{ flex: 1 }}>
              <h1 className="app-title">{whitepaper.project_title}</h1>
              <p className="app-subtitle">White Paper Técnico</p>
            </div>
          </div>
        </header>
        <main className="dashboard-main" style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Card style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem 2rem', borderColor: '#f87171' }}>
            <AlertCircle size={64} style={{ color: '#f87171', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#f87171' }}>
              Error en la Generación
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              {whitepaper.error_message || 'Ocurrió un error al generar el white paper'}
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Volver al Dashboard
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="create-container">
      {/* Header similar al estudio econométrico */}
      <div className="create-header">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2" size={18} />
          {whitepaper.client_id ? 'Volver a White Papers' : 'Volver al Dashboard'}
        </Button>
      </div>

      <div className="create-content">
        {/* Portada Profesional del White Paper */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                <CardTitle className="text-2xl mb-2">
                  <FileText className="inline mr-2" size={24} />
                  {whitepaper.project_title}
                </CardTitle>
                <CardDescription>
                  <div className="space-y-1">
                    <p><strong>Autor:</strong> {whitepaper.author_name}</p>
                    <p><strong>Credenciales:</strong> {whitepaper.author_credentials}</p>
                    <p><strong>Secciones:</strong> {whitepaper.sections?.length || 0} de 16</p>
                    <p><strong>Creado:</strong> {whitepaper.created_at ? new Date(whitepaper.created_at).toLocaleString('es-VE', { timeZone: 'America/Caracas' }) : 'N/A'}</p>
                  </div>
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap items-center shrink-0">
                {/* Selector de Idioma */}
                <select
                  value={currentLanguage}
                  onChange={(e) => setCurrentLanguage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                  data-testid="language-selector"
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
                {/* Botón de Edición con IA */}
                <Button 
                  onClick={() => setShowAIEditModal(true)} 
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                  data-testid="edit-with-ai-btn"
                >
                  🤖 Editar con IA
                </Button>
                <Button onClick={() => downloadPDF('es')} variant="outline" disabled={downloading} data-testid="download-pdf-es">
                  {downloading ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Download className="mr-2" size={16} />}
                  PDF Español
                </Button>
                <Button onClick={() => downloadPDF('en')} variant="outline" disabled={downloading} data-testid="download-pdf-en">
                  {downloading ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Download className="mr-2" size={16} />}
                  PDF English
                </Button>
                {whitepaper?.id && (
                  <WordDownloadButton
                    url={`${API}/whitepapers/${whitepaper.id}/download-docx`}
                    testId="download-word-en"
                  />
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Evaluación de Coherencia - Obligatoria y destacada */}
        {whitepaper.coherence_evaluation && (
          <Card className="mb-4" style={{ 
            borderColor: whitepaper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        whitepaper.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444',
            backgroundColor: whitepaper.coherence_evaluation.coherence_score >= 80 ? '#f0fdf4' : 
                            whitepaper.coherence_evaluation.coherence_score >= 50 ? '#fffbeb' : '#fef2f2'
          }} data-testid="coherence-evaluation-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle size={20} className={whitepaper.coherence_evaluation.coherence_score >= 80 ? 'text-green-500' : 'text-yellow-500'} />
                  Evaluación de Coherencia
                </CardTitle>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: whitepaper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        whitepaper.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444'
                }} data-testid="coherence-score">
                  {whitepaper.coherence_evaluation.coherence_score}/100
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-700">{whitepaper.coherence_evaluation.summary}</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Refleja CV: </span>
                  <span className="font-medium">{whitepaper.coherence_evaluation.reflects_cv || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Proyecto integrado: </span>
                  <span className="font-medium">{whitepaper.coherence_evaluation.project_integrated || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Años experiencia: </span>
                  <span className="font-medium">{whitepaper.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Info inventada: </span>
                  <span className={`font-medium ${whitepaper.coherence_evaluation.invented_info === 'No' ? 'text-green-600' : 'text-red-600'}`}>
                    {whitepaper.coherence_evaluation.invented_info || 'N/A'}
                  </span>
                </div>
              </div>
              {whitepaper.coherence_evaluation.recommendation && (
                <div className="bg-white p-3 rounded text-sm">
                  <span className="font-medium text-gray-700">Recomendación: </span>
                  <span className="text-gray-600">{whitepaper.coherence_evaluation.recommendation}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información del Proyecto */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500">Dominio Técnico</Label>
                <p className="font-semibold">{whitepaper.technical_domain}</p>
              </div>
              <div>
                <Label className="text-gray-500">Audiencia Objetivo</Label>
                <p className="font-semibold">{whitepaper.target_audience}</p>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-gray-500">Descripción del Proyecto</Label>
              <p className="mt-2 text-gray-700" style={{ textAlign: 'justify' }}>{whitepaper.project_description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Contenido del White Paper */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-xl">Contenido del White Paper</CardTitle>
          </CardHeader>
          <CardContent>
            {whitepaper.sections && whitepaper.sections.length > 0 ? (
              <div className="econometric-content econometric-complete">
                {whitepaper.sections.map((section, idx) => {
                  const sectionContent = currentLanguage === 'es' 
                    ? (section.content_es || section.content || '') 
                    : (section.content_en || section.content_es || section.content || '');
                  
                  // ✅ Eliminar títulos duplicados del contenido
                  let cleanedContent = sectionContent;
                  
                  // Eliminar primera línea si es un título H1 o H2 que duplica el título de la sección
                  // Patrones a eliminar:
                  // - "# Resumen Ejecutivo" o "## Resumen Ejecutivo"
                  // - "# Parte 1. Resumen Ejecutivo" o "## Parte 1. Resumen Ejecutivo"
                  // - "# Part 1. Executive Summary" o "## Part 1. Executive Summary"
                  cleanedContent = cleanedContent.replace(/^#{1,2}\s*(Parte|Part)?\s*\d*\.?\s*[^\n]+\n+/i, '');
                  
                  // También eliminar si hay un segundo H2 que sea "Parte X. Título"
                  cleanedContent = cleanedContent.replace(/^##\s*(Parte|Part)\s*\d+[.:]\s*[^\n]+\n+/gim, '');
                  
                  // Convertir Markdown a HTML usando marked
                  const htmlContent = cleanedContent ? marked.parse(cleanedContent) : '';
                  
                  return (
                    <div key={`${idx}-${currentLanguage}`} className="section-block" data-testid={`whitepaper-section-${section.number}`}>
                      <h2 className="section-title-simple">
                        {currentLanguage === 'en' ? 'Section' : 'Sección'} {section.number}: {section.title}
                      </h2>
                      {htmlContent ? (
                        <div 
                          className="prose max-w-none"
                          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      ) : (
                        <p className="text-gray-400 italic">
                          Contenido no disponible para esta sección
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No hay secciones disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ⭐ MODAL DE EDICIÓN CON IA */}
      {showAIEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Editar White Paper con IA
              </CardTitle>
              <CardDescription>
                Describe los cambios que deseas realizar y la IA editará el documento completo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Instrucciones de edición:</Label>
                  <textarea
                    value={aiEditInstructions}
                    onChange={(e) => setAiEditInstructions(e.target.value)}
                    placeholder="Ej: Mejora la redacción del resumen ejecutivo, añade más datos estadísticos, corrige errores gramaticales..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={aiEditLoading}
                  />
                </div>
                <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Sé específico en tus instrucciones. Por ejemplo: "Mejora la sección de metodología añadiendo referencias a estudios recientes" o "Simplifica el lenguaje técnico para una audiencia no especializada".
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAIEditModal(false);
                  setAiEditInstructions('');
                }}
                disabled={aiEditLoading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={editWhitepaperWithAI}
                disabled={aiEditLoading || !aiEditInstructions.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {aiEditLoading ? (
                  <><Loader2 className="mr-2 animate-spin" size={16} />Editando...</>
                ) : (
                  '🤖 Aplicar Edición con IA'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// END VIEW WHITEPAPER COMPONENT
// ============================================================================



// ============================================================================
// CREATE WHITEPAPER INTERACTIVE COMPONENT
// ============================================================================

const ViewEconometricStudy = () => {
  // Configurar marked para procesamiento robusto de Markdown
  marked.setOptions({
    breaks: true,
    gfm: true, // GitHub Flavored Markdown
    pedantic: false,
    sanitize: false
  });

  // ⭐ FUNCIÓN PARA LIMPIAR SINTAXIS LATEX DEL CONTENIDO
  const cleanLatexContent = (content) => {
    if (!content) return '';
    
    let cleaned = content;

    // ── Eliminar placeholders de fuentes ─────────────────────────────────────
    // [FUENTE A VERIFICAR: ...], [CITACIÓN NECESARIA: ...], etc.
    cleaned = cleaned.replace(/\[FUENTE A VERIFICAR:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[FUENTE:\s*A\s*VERIFICAR[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[CITACI[ÓO]N NECESARIA:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[CITA NECESARIA:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[CITATION NEEDED:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[SOURCE TO VERIFY:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[REFERENCIA NECESARIA:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[INSERTAR FUENTE[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[VERIFICAR FUENTE:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[DATO A VERIFICAR:[^\]]{0,2000}\]/gi, '');
    cleaned = cleaned.replace(/\[ESTAD[IÍ]STICA A VERIFICAR:[^\]]{0,2000}\]/gi, '');

    // Eliminar \text{} wrapper - mantener contenido interno
    cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
    
    // Eliminar \textbf{} y \textit{} wrappers
    cleaned = cleaned.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
    cleaned = cleaned.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
    
    // Reemplazar \frac{a}{b} con (a/b)
    cleaned = cleaned.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)');
    
    // Reemplazar operadores matemáticos comunes
    cleaned = cleaned.replace(/\\times/g, '×');
    cleaned = cleaned.replace(/\\cdot/g, '·');
    cleaned = cleaned.replace(/\\approx/g, '≈');
    cleaned = cleaned.replace(/\\neq/g, '≠');
    cleaned = cleaned.replace(/\\leq/g, '≤');
    cleaned = cleaned.replace(/\\geq/g, '≥');
    cleaned = cleaned.replace(/\\pm/g, '±');
    cleaned = cleaned.replace(/\\sum/g, 'Σ');
    cleaned = cleaned.replace(/\\Delta/g, 'Δ');
    
    // Reemplazar letras griegas comunes
    const greekLetters = {
      '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
      '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\theta': 'θ', '\\lambda': 'λ',
      '\\mu': 'μ', '\\sigma': 'σ', '\\phi': 'φ', '\\omega': 'ω',
      '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Theta': 'Θ',
      '\\Lambda': 'Λ', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Omega': 'Ω'
    };
    for (const [latex, unicode] of Object.entries(greekLetters)) {
      cleaned = cleaned.split(latex).join(unicode);
    }
    
    // Eliminar delimitadores de modo matemático
    cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, '$1');
    cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');
    cleaned = cleaned.replace(/\\\[([^\]]+)\\\]/g, '$1');
    cleaned = cleaned.replace(/\\\(([^)]+)\\\)/g, '$1');
    
    // Limpiar subíndices y superíndices LaTeX
    cleaned = cleaned.replace(/_\{([^}]+)\}/g, '₍$1₎');
    cleaned = cleaned.replace(/\^\{([^}]+)\}/g, '^$1');
    
    // Eliminar comandos LaTeX restantes
    cleaned = cleaned.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');
    
    // Limpiar espacios múltiples
    cleaned = cleaned.replace(/  +/g, ' ');
    
    return cleaned;
  };

  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingEs, setDownloadingEs] = useState(false);
  const [downloadingEn, setDownloadingEn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [viewMode, setViewMode] = useState('complete'); // 'complete' or 'sections'
  const [editingComplete, setEditingComplete] = useState(false); // Para editar todo el documento
  const [completeContent, setCompleteContent] = useState(''); // Contenido completo del documento
  const [currentLanguage, setCurrentLanguage] = useState('es'); // Idioma actual (es/en)
  
  // ⭐ NUEVOS ESTADOS PARA EDICIÓN CON IA
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditSectionNumber, setAiEditSectionNumber] = useState(null);
  const [currentSectionForEdit, setCurrentSectionForEdit] = useState(null);
  
  const { id } = useParams();
  const navigate = useNavigate();

  // ⭐ FUNCIÓN PARA EDITAR TODO EL DOCUMENTO CON IA
  const editDocumentWithAI = async () => {
    if (!aiEditInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setAiEditLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Obtener todo el contenido actual del documento
      let fullContent = '';
      study.sections?.sort((a, b) => a.number - b.number).forEach(section => {
        const content = currentLanguage === 'en' 
          ? (section.content_en || section.content || '')
          : (section.content_es || section.content || '');
        fullContent += `## Section ${section.number}: ${section.title}\n\n${content}\n\n`;
      });
      
      // Llamar al endpoint para editar todo el documento (ahora es asíncrono)
      const response = await axios.post(
        `${API}/econometric-studies/${id}/edit-document`,
        {
          edit_instructions: aiEditInstructions,
          current_content: fullContent,
          target_language: currentLanguage
        },
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 30000 // 30 segundos de timeout
        }
      );
      
      if (response.data.success) {
        toast.success('✅ Edición iniciada. Recargando en 5 segundos...');
        setShowAIEditModal(false);
        setAiEditInstructions('');
        
        // Esperar y recargar automáticamente
        setTimeout(async () => {
          await loadStudy();
          toast.info('📄 Documento recargado. Si los cambios no aparecen, espera unos segundos más y recarga manualmente.');
        }, 5000);
      } else {
        toast.error('Error al editar con IA');
      }
    } catch (error) {
      console.error('Error editing with AI:', error);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.info('⏳ La edición está en proceso. Por favor espera unos segundos y recarga la página.');
        setShowAIEditModal(false);
        setAiEditInstructions('');
      } else {
        toast.error('Error al editar documento con IA: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setAiEditLoading(false);
    }
  };

  // Función alternativa para editar secciones individualmente
  const editSectionsIndividually = async () => {
    try {
      const token = localStorage.getItem('token');
      let successCount = 0;
      
      for (const section of study.sections || []) {
        const currentContent = currentLanguage === 'en' 
          ? (section.content_en || section.content || '')
          : (section.content_es || section.content || '');
        
        try {
          await axios.post(
            `${API}/econometric-studies/edit-section/${id}`,
            {
              section_number: section.number,
              edit_instructions: aiEditInstructions,
              current_section_content: currentContent,
              current_section_title: section.title || `Sección ${section.number}`
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          successCount++;
        } catch (sectionError) {
          console.error(`Error editando sección ${section.number}:`, sectionError);
        }
      }
      
      if (successCount > 0) {
        toast.success(`✅ ${successCount} secciones actualizadas con IA`);
        setShowAIEditModal(false);
        setAiEditInstructions('');
        await loadStudy();
      } else {
        toast.error('No se pudo actualizar ninguna sección');
      }
    } catch (error) {
      console.error('Error en edición individual:', error);
      toast.error('Error al editar secciones');
    }
  };

  // ⭐ FUNCIÓN PARA ABRIR MODAL DE EDICIÓN CON IA (ya no necesita sección específica)
  const openAIEditModal = (section = null) => {
    setCurrentSectionForEdit(section);
    setAiEditSectionNumber(section?.number || null);
    setAiEditInstructions('');
    setShowAIEditModal(true);
  };

  // TiptapEditor component with toolbar
  const TiptapEditor = ({ content, onChange }) => {
    const editor = useEditor({
      extensions: [
        StarterKit,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Underline,
        FontFamily.configure({
          types: ['textStyle'],
        }),
      ],
      content: content,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      autofocus: false, // Evitar auto-focus que causa scroll
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
        },
      },
    }, [content]); // Agregar content como dependencia

    // No re-renderizar si el contenido no ha cambiado significativamente
    React.useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        const { from, to } = editor.state.selection;
        editor.commands.setContent(content, false); // false = no emitir update
        editor.commands.setTextSelection({ from, to }); // Restaurar selección
      }
    }, [content, editor]);

    if (!editor) {
      return null;
    }

    return (
      <div className="tiptap-editor">
        <div className="tiptap-toolbar">
          {/* Font Family Selector */}
          <select
            onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            className="font-selector"
          >
            <option value="">Fuente por defecto</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
            <option value="Impact, sans-serif">Impact</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          </select>
          <span className="divider"></span>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
            type="button"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'is-active' : ''}
            type="button"
          >
            <u>U</u>
          </button>
          <span className="divider"></span>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            type="button"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
            type="button"
          >
            H3
          </button>
          <span className="divider"></span>
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
            type="button"
            title="Alinear izquierda"
          >
            ←
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
            type="button"
            title="Centrar"
          >
            ↔
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
            type="button"
            title="Alinear derecha"
          >
            →
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}
            type="button"
            title="Justificar"
          >
            ⚏
          </button>
          <span className="divider"></span>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
            type="button"
          >
            • List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
            type="button"
          >
            1. List
          </button>
        </div>
        <EditorContent editor={editor} className="tiptap-content" />
      </div>
    );
  };

  useEffect(() => {
    loadStudy();
    // loadCommentStats(); // DISABLED: CommentsPanel not available
  }, [id]);

  const loadStudy = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/econometric-studies/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Study loaded:', response.data);
      console.log('Sections:', response.data.sections);
      setStudy(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar el estudio');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadCommentStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/comments/${id}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setCommentStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading comment stats:', error);
    }
  };

  const startEditing = (section) => {
    console.log('Starting edit for section:', section.number);
    console.log('Section content:', section.content);
    setEditingSection(section.number);
    // Parse markdown to HTML for WYSIWYG editing
    const rawContent = section.content || section.content_es || section.content_en || '';
    const htmlContent = rawContent ? marked.parse(rawContent) : '';
    setEditedContent(htmlContent);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditedContent('');
    setEditingComplete(false);
    setCompleteContent('');
  };

  // Funciones para editar documento completo
  const startCompleteEditing = () => {
    if (!study || !study.sections) return;
    
    // Generar portada profesional basada en el formato del documento de ejemplo
    const coverPage = `
<div class="document-cover-page">
  <h1 style="font-size: 20pt; font-weight: 700; line-height: 1.3; margin-bottom: 3rem; text-align: center;">
    Econometric Study on ${study.applicant_name || 'Petitioner'}'s National Interest Project<br/>
    ${study.study_title || 'Economic Assessment Study'}
  </h1>
  
  <div class="cover-info" style="text-align: left; max-width: 650px; margin: 0 auto;">
    <p style="margin-bottom: 0.75rem;"><strong>Petitioner:</strong> ${study.applicant_name || 'N/A'}</p>
    <p style="margin-bottom: 0.75rem;"><strong>Field:</strong> ${study.field || 'Economics / National Interest'}</p>
    <p style="margin-bottom: 1.5rem; text-align: justify;">
      <strong>Purpose of Study:</strong> To provide a rigorous, data-driven econometric assessment of the expected national economic and public-health benefits of the petitioner's proposed project, in support of the EB-2 National Interest Waiver (NIW) criteria under <em>Matter of Dhanasar</em>, 26 I&N Dec. 884 (AAO 2016).
    </p>
  </div>
</div>
<div class="page-break"></div>

<h2 style="font-size: 18pt; font-weight: 700; margin: 16pt 0 12pt 0;">Executive Summary of Findings</h2>
<p style="text-align: justify; margin-bottom: 10pt;">
  This econometric study demonstrates the substantial merit and national importance of the petitioner's proposed endeavor. The analysis shows measurable benefits to the U.S. economy, workforce development, and alignment with federal policy priorities.
</p>
<div class="page-break"></div>
`;
    
    // Combinar portada + todas las secciones en un solo HTML según el idioma actual
    const sectionsContent = study.sections
      .sort((a, b) => a.number - b.number)
      .map((section, index) => {
        const sectionTitle = `<h2>Section ${section.number}: ${section.title}</h2>`;
        
        // Usar contenido según idioma
        let sectionContent = '';
        if (currentLanguage === 'en' && section.content_en) {
          sectionContent = marked.parse(cleanLatexContent(section.content_en));
        } else if (currentLanguage === 'es' && section.content_es) {
          sectionContent = marked.parse(cleanLatexContent(section.content_es));
        } else {
          // Fallback al campo 'content'
          sectionContent = section.content ? marked.parse(cleanLatexContent(section.content)) : '';
        }
        
        // Agregar page break cada 2 secciones aproximadamente
        const pageBreak = (index > 0 && (index + 1) % 2 === 0) ? '<div class="page-break"></div>' : '';
        
        return sectionTitle + sectionContent + pageBreak;
      })
      .join('\n\n');
    
    const fullContent = coverPage + sectionsContent;
    
    setCompleteContent(fullContent);
    setEditingComplete(true);
  };

  const saveCompleteDocument = async () => {
    console.log('Saving complete document');
    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Inicializar Turndown para convertir HTML a Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        br: '\n',  // Convert <br> to newline
        emDelimiter: '*',
        strongDelimiter: '**'
      });
      
      // Reglas personalizadas para mejor conversión
      turndownService.addRule('lineBreak', {
        filter: 'br',
        replacement: function () {
          return '\n\n';  // Double newline for paragraph breaks
        }
      });
      
      // Crear un div temporal para parsear el HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = completeContent;
      
      // Limpiar y normalizar el HTML antes de convertir
      // Agregar saltos de línea entre tags para mejor conversión
      let cleanedHTML = completeContent;
      cleanedHTML = cleanedHTML.replace(/<\/p><p>/g, '</p>\n\n<p>');
      cleanedHTML = cleanedHTML.replace(/<\/h([1-6])>/g, '</h$1>\n\n');
      cleanedHTML = cleanedHTML.replace(/<\/ul>/g, '</ul>\n\n');
      cleanedHTML = cleanedHTML.replace(/<\/ol>/g, '</ol>\n\n');
      cleanedHTML = cleanedHTML.replace(/<br\s*\/?>/g, '\n\n');
      
      tempDiv.innerHTML = cleanedHTML;
      
      // Buscar todos los h2 que son títulos de sección
      const h2Elements = tempDiv.querySelectorAll('h2');
      const sectionUpdates = [];
      
      h2Elements.forEach((h2, index) => {
        // Extraer el número de sección del título
        const match = h2.textContent.match(/Se[cc]tion (\d+):|Sección (\d+):/);
        if (match) {
          const sectionNumber = parseInt(match[1] || match[2]);
          
          // Obtener el contenido HTML hasta el siguiente h2 o hasta el final
          let contentHTML = '';
          let currentElement = h2.nextElementSibling;
          
          while (currentElement && currentElement.tagName !== 'H2') {
            contentHTML += currentElement.outerHTML;
            currentElement = currentElement.nextElementSibling;
          }
          
          // Limpiar HTML antes de convertir
          contentHTML = contentHTML.replace(/<\/p><p>/g, '</p>\n\n<p>');
          contentHTML = contentHTML.replace(/<br\s*\/?>/g, '\n\n');
          
          // Convertir HTML a Markdown
          let contentMarkdown = turndownService.turndown(contentHTML);
          
          // Post-procesamiento del Markdown para asegurar saltos de línea
          contentMarkdown = contentMarkdown.replace(/\n{3,}/g, '\n\n');  // Max 2 newlines
          contentMarkdown = contentMarkdown.trim();
          
          sectionUpdates.push({
            number: sectionNumber,
            content: contentMarkdown
          });
        }
      });
      
      // Guardar cada sección según el idioma actual
      for (const update of sectionUpdates) {
        const params = {};
        if (currentLanguage === 'es') {
          params.content_es = update.content;
        } else {
          params.content_en = update.content;
        }
        
        await axios.put(
          `${API}/econometric-studies/${id}/sections/${update.number}`,
          null,
          { 
            params: params,
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
      }
      
      // Recargar el estudio
      await loadStudy();
      setEditingComplete(false);
      setCompleteContent('');
      toast.success(`Documento guardado exitosamente en ${currentLanguage === 'es' ? 'Español' : 'Inglés'}`);
      
    } catch (error) {
      console.error('Error saving complete document:', error);
      toast.error('Error al guardar el documento: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionNumber) => {
    console.log('Saving section:', sectionNumber);
    console.log('Content length:', editedContent.length);
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Save manually edited content (both languages from editedContent)
      await axios.put(
        `${API}/econometric-studies/${id}/sections/${sectionNumber}`,
        null,
        { 
          params: {
            content_es: editedContent,
            content_en: editedContent  // For now, save same content for both
          },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      // Update local state
      const updatedSections = study.sections.map(s => 
        s.number === sectionNumber ? { ...s, content: editedContent, content_es: editedContent } : s
      );
      setStudy({ ...study, sections: updatedSections });
      
      setEditingSection(null);
      toast.success('Sección actualizada');
    } catch (error) {
      console.error('Error saving section:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Error al guardar cambios: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = async (language = 'es') => {
    const setDownloading = language === 'es' ? setDownloadingEs : setDownloadingEn;
    setDownloading(true);
    try {
      toast.info(`📥 Generando PDF en ${language === 'es' ? 'español' : 'inglés'}...`);
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
        navigate('/login');
        return;
      }
      
      const response = await axios.get(
        `${API}/econometric-studies/${id}/download?language=${language}`,
        { 
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      // Create blob URL for download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${study.study_title}${langSuffix}_econometric_study.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up
      toast.success(`✅ PDF descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMsg = error.response?.data?.detail || error.response?.statusText || error.message || 'Error desconocido';
      toast.error(`Error al descargar PDF: ${errorMsg}`);
      
      // If 401/403, redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Sesión expirada. Redirigiendo al login...');
        setTimeout(() => navigate('/login'), 1500);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="create-container">
        <div className="loading-state">
          <Loader2 className="animate-spin" size={48} />
          <p>Cargando estudio...</p>
        </div>
      </div>
    );
  }

  if (!study) {
    return null;
  }

  return (
    <div className="create-container">
      <div className="create-header">
        <Button variant="ghost" onClick={() => {
          if (study.client_id) {
            navigate(`/client-documents/${study.client_id}/study`);
          } else {
            navigate('/dashboard');
          }
        }}>
          <ArrowLeft className="mr-2" size={18} />
          {study.client_id ? 'Volver a Estudios' : 'Volver al Dashboard'}
        </Button>
      </div>

      <div className="create-content">
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">
                  <TrendingUp className="inline mr-2" size={24} />
                  {study.study_title}
                </CardTitle>
                <CardDescription>
                  <div className="space-y-1">
                    <p><strong>Solicitante:</strong> {study.applicant_name}</p>
                    <p><strong>Secciones:</strong> {study.sections?.length || 0} de 16</p>
                    <p><strong>Creado:</strong> {new Date(study.created_at).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</p>
                  </div>
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {/* Selector de Idioma */}
                <select
                  value={currentLanguage}
                  onChange={(e) => setCurrentLanguage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
                {/* Botón de Edición con IA */}
                <Button 
                  onClick={() => setShowAIEditModal(true)} 
                  variant="outline"
                  size="sm"
                  disabled={editingComplete}
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                >
                  🤖 Editar con IA
                </Button>
                {/* Botón de Edición Manual */}
                <Button 
                  onClick={() => {
                    if (!editingComplete) {
                      // Preparar contenido completo para edición - convertir Markdown a HTML
                      let fullContent = '';
                      study.sections?.sort((a, b) => a.number - b.number).forEach(section => {
                        const rawContent = currentLanguage === 'en' 
                          ? (section.content_en || section.content || '')
                          : (section.content_es || section.content || '');
                        
                        // Convertir Markdown a HTML usando marked y limpiar LaTeX
                        const cleanedContent = cleanLatexContent(rawContent);
                        const htmlContent = marked.parse(cleanedContent);
                        fullContent += `<h2>Sección ${section.number}: ${section.title}</h2>${htmlContent}`;
                      });
                      setCompleteContent(fullContent);
                      setEditingComplete(true);
                    }
                  }} 
                  variant="outline"
                  size="sm"
                  disabled={editingComplete}
                >
                  <Edit className="mr-2" size={16} />
                  ✏️ Edición Manual
                </Button>
                {editingComplete && (
                  <>
                    <Button 
                      onClick={saveCompleteDocument} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />💾 Guardar Todo</>
                      )}
                    </Button>
                    <Button 
                      onClick={cancelEditing} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
                <Button onClick={() => downloadPDF('es')} variant="outline" disabled={downloadingEs || editingComplete}>
                  {downloadingEs ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Download className="mr-2" size={16} />}
                  📄 Descargar PDF (ES)
                </Button>
                <Button onClick={() => downloadPDF('en')} variant="outline" disabled={downloadingEn || editingComplete}>
                  {downloadingEn ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Download className="mr-2" size={16} />}
                  📄 Descargar PDF (EN)
                </Button>
                {study?.id && (
                  <WordDownloadButton
                    url={`${API}/econometric-studies/${study.id}/download-docx`}
                    testId="download-word-en-econometric"
                  />
                )}
                {/* History button - DISABLED: VersionHistory component not available
                <Button onClick={() => setShowHistory(true)} variant="outline" className="bg-purple-50" disabled={editingComplete}>
                  <History className="mr-2" size={16} />
                  Ver Historial
                </Button>
                */}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* ✅ Evaluación de Coherencia para Estudios Econométricos */}
        {study.coherence_evaluation && (
          <Card className="mb-4" style={{ 
            borderColor: study.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        study.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444',
            backgroundColor: study.coherence_evaluation.coherence_score >= 80 ? '#f0fdf4' : 
                            study.coherence_evaluation.coherence_score >= 50 ? '#fffbeb' : '#fef2f2'
          }}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle size={20} className={study.coherence_evaluation.coherence_score >= 80 ? 'text-green-500' : 'text-yellow-500'} />
                  Evaluación de Coherencia
                </CardTitle>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: study.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        study.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {study.coherence_evaluation.coherence_score}/100
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-700">{study.coherence_evaluation.summary}</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Refleja CV: </span>
                  <span className="font-medium">{study.coherence_evaluation.reflects_cv || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Proyecto integrado: </span>
                  <span className="font-medium">{study.coherence_evaluation.project_integrated || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Años experiencia: </span>
                  <span className="font-medium">{study.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="text-gray-500">Info inventada: </span>
                  <span className={`font-medium ${study.coherence_evaluation.invented_info === 'No' ? 'text-green-600' : 'text-red-600'}`}>
                    {study.coherence_evaluation.invented_info || 'N/A'}
                  </span>
                </div>
              </div>
              {study.coherence_evaluation.recommendation && (
                <div className="bg-white p-3 rounded text-sm">
                  <span className="font-medium text-gray-700">💡 Recomendación: </span>
                  <span className="text-gray-600">{study.coherence_evaluation.recommendation}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alert for in-progress documents */}
        {study.status === 'in_progress' && study.current_section && study.current_section <= 16 && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Estudio Econométrico en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Este estudio tiene {study.current_section - 1} de 16 secciones completadas. 
                  Puedes continuar generando las secciones restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((study.current_section - 1) / 16) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-econometric-study?resume_id=${study.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        {/* Estudio Completo - Vista o Edición */}
        {editingComplete ? (
          <div className="complete-editor">
            <div className="editor-controls" style={{
              position: 'sticky',
              top: 0,
              background: 'white',
              padding: '1rem',
              borderBottom: '2px solid #cbd5e1',
              zIndex: 1001,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              maxWidth: '8.5in',
              margin: '0 auto',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                  ✏️ Editando: {study.study_title}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {currentLanguage === 'es' ? 'Español' : 'English'} • Vista de documento completo
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button 
                  onClick={saveCompleteDocument} 
                  variant="default" 
                  size="sm"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                  ) : (
                    <><Save className="mr-2" size={16} />💾 Guardar Todo</>
                  )}
                </Button>
                <Button 
                  onClick={cancelEditing} 
                  variant="outline" 
                  size="sm"
                >
                  ✕ Cerrar
                </Button>
              </div>
            </div>
            <TiptapEditor
              content={completeContent}
              onChange={setCompleteContent}
            />
          </div>
        ) : (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-xl">📄 Estudio Completo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="econometric-content econometric-complete">
                {study.sections && study.sections.sort((a, b) => a.number - b.number).map((section) => {
                  // Seleccionar contenido según idioma
                  let content = '';
                  if (currentLanguage === 'en' && section.content_en) {
                    content = section.content_en;
                  } else if (currentLanguage === 'es' && section.content_es) {
                    content = section.content_es;
                  } else {
                    content = section.content || '';
                  }
                  
                  return (
                    <div key={section.number} className="section-block">
                      <h2 className="section-title-simple">
                        Sección {section.number}: {section.title}
                      </h2>
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: content ? marked.parse(cleanLatexContent(content)) : '' 
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version History Modal - DISABLED: Component not imported
      <VersionHistory
        documentId={id}
        documentType="econometric_study"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => {
          setShowHistory(false);
          loadStudy();
        }}
      />
      */}

      {/* Comments Panel - DISABLED: Component not imported
      <CommentsPanel
        documentId={id}
        documentType="econometric_study"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />
      */}

      {/* ⭐ Modal de Edición con IA - Para todo el documento */}
      {showAIEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                🤖 Editar Documento con IA
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                {study.study_title}
              </p>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              {/* Alerta informativa */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <div>
                  <strong style={{ color: '#1e40af', display: 'block', marginBottom: '0.25rem' }}>
                    La IA analizará y editará todas las secciones del documento
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#1e3a8a' }}>
                    <li>Describe claramente qué cambios necesitas</li>
                    <li>Puedes pedir mejoras de estilo, contenido o formato</li>
                    <li>La IA identificará qué secciones necesitan cambios</li>
                  </ul>
                </div>
              </div>
              
              <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                Instrucciones de edición:
              </label>
              <textarea
                value={aiEditInstructions}
                onChange={(e) => setAiEditInstructions(e.target.value)}
                placeholder="Ejemplos:
• 'Añade más datos estadísticos y citas académicas en todas las secciones'
• 'Mejora el análisis del impacto económico con proyecciones más detalladas'
• 'Hazlo más conciso manteniendo los puntos clave'
• 'Corrige el formato de las tablas y mejora la presentación visual'
• 'Actualiza las referencias bibliográficas'"
                style={{
                  width: '100%',
                  minHeight: '180px',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              
              {/* Resumen del documento */}
              <div style={{ 
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: '#f8fafc',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#475569'
              }}>
                <strong>📊 Documento actual:</strong> {study.sections?.length || 0} secciones • 
                Idioma: {currentLanguage === 'es' ? 'Español' : 'English'}
              </div>
            </div>
            
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAIEditModal(false);
                  setAiEditInstructions('');
                }}
                disabled={aiEditLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={editDocumentWithAI}
                disabled={aiEditLoading || !aiEditInstructions.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {aiEditLoading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={16} />
                    Procesando con IA...
                  </>
                ) : (
                  <>
                    🤖 Aplicar Edición con IA
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



// ============================================================================
// CREATE RECOMMENDATION LETTER COMPONENT
// ============================================================================
const CreateRecommendationLetter = () => {
  // File states for 3 mandatory uploads
  const [candidateCV, setCandidateCV] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [recommenderCV, setRecommenderCV] = useState(null);
  
  const [generating, setGenerating] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterContentEn, setLetterContentEn] = useState('');
  const [letterContentEs, setLetterContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterId, setLetterId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [step, setStep] = useState('upload'); // upload, generating, generated
  const [extractedData, setExtractedData] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(5);
  const [progressMessage, setProgressMessage] = useState('Iniciando generación...');
  const pollRefRec = React.useRef(null);
  
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');

  // Polling: check progress while generating
  React.useEffect(() => {
    if (step === 'generating' && letterId) {
      const token = localStorage.getItem('token');
      pollRefRec.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/recommendation-letters/${letterId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = res.data;
          setGenerationProgress(data.progress_percentage || 5);
          setProgressMessage(data.progress_message || 'Procesando...');
          if (data.status === 'completed') {
            clearInterval(pollRefRec.current);
            setStep('generated');
            setLetterContentEn(data.content_en || '');
            setLetterContentEs(data.content_es || '');
            setLetterContent(data.content_en || '');
            setExtractedData(data.extracted_data || null);
            setGenerating(false);
            toast.success('✅ Carta generada exitosamente en inglés y español');
          } else if (data.status === 'error') {
            clearInterval(pollRefRec.current);
            setGenerating(false);
            setStep('upload');
            toast.error(data.error_message || 'Error al generar la carta');
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 4000);
      return () => clearInterval(pollRefRec.current);
    }
  }, [step, letterId]);

  const handleFileUpload = (fileType, file) => {
    if (!file) return;
    
    // Validate file type (ahora acepta TXT también para pruebas)
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExt)) {
      toast.error('Formato no válido. Solo PDF, DOC, DOCX o TXT');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 10MB');
      return;
    }
    
    // Set file based on type
    if (fileType === 'candidate_cv') {
      setCandidateCV(file);
      toast.success(`✅ CV del Candidato: ${file.name}`);
    } else if (fileType === 'project_info') {
      setProjectInfo(file);
      toast.success(`✅ Información del Proyecto: ${file.name}`);
    } else if (fileType === 'recommender_cv') {
      setRecommenderCV(file);
      toast.success(`✅ CV del Firmante: ${file.name}`);
    }
  };

  const handleGenerateLetter = async () => {
    // Validation: All 3 files are mandatory
    if (!candidateCV || !projectInfo || !recommenderCV) {
      toast.error('Los 3 archivos son obligatorios para generar la carta');
      return;
    }

    setGenerating(true);
    setStep('generating');
    setGenerationProgress(5);
    setProgressMessage('Enviando documentos...');
    
    try {
      const formData = new FormData();
      formData.append('candidate_cv', candidateCV);
      formData.append('project_info', projectInfo);
      formData.append('recommender_cv', recommenderCV);
      
      // Agregar client_id si está disponible
      if (clientId) {
        formData.append('client_id', clientId);
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/generate`,
        formData,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      // New async flow: backend returns immediately with letter_id
      setLetterId(response.data.letter_id);
      setProgressMessage('Generando carta en segundo plano...');
      // Polling starts via useEffect when step='generating' && letterId is set
    } catch (error) {
      console.error('Error generating letter:', error);
      setGenerating(false);
      setStep('upload');
      toast.error(error.response?.data?.detail || 'Error al generar la carta');
    }
  };

  const handleSwitchLanguage = (lang) => {
    if (lang === 'en') {
      setCurrentLanguage('en');
      setLetterContent(letterContentEn);
    } else if (lang === 'es') {
      setCurrentLanguage('es');
      setLetterContent(letterContentEs);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      // Pass current language to download endpoint
      const response = await axios.get(
        `${API}/recommendation-letters/${letterId}/download?language=${currentLanguage}`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = currentLanguage === 'es' ? '_ES' : '_EN';
      const filename = `recommendation_letter${langSuffix}_${letterId.substring(0, 8)}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Clean up the URL
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      const langText = currentLanguage === 'es' ? 'español' : 'inglés';
      toast.success(`✅ PDF descargado en ${langText}: ${filename}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  const handleEditLetter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor ingresa instrucciones de edición');
      return;
    }

    setGenerating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/${letterId}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setLetterContent(response.data.content);
      setLetterContentEn(response.data.content);
      setLetterContentEs(null); // Clear Spanish after edit
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) {
      console.error('Error editing letter:', error);
      toast.error(error.response?.data?.detail || 'Error al editar la carta');
    } finally {
      setGenerating(false);
    }
  };

  const FileUploadCard = ({ title, description, fileType, currentFile, icon, color }) => {
    return (
      <Card style={{ border: `2px solid ${currentFile ? '#10b981' : '#e5e7eb'}` }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            {icon}
            {title}
            {currentFile && <CheckCircle size={20} style={{ color: '#10b981', marginLeft: 'auto' }} />}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentFile ? (
            <div style={{ 
              padding: '1rem',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #86efac'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: '#16a34a' }} />
                  <div>
                    <p style={{ fontWeight: '600', color: '#166534', margin: 0 }}>{currentFile.name}</p>
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                      {(currentFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (fileType === 'candidate_cv') setCandidateCV(null);
                    else if (fileType === 'project_info') setProjectInfo(null);
                    else if (fileType === 'recommender_cv') setRecommenderCV(null);
                    toast.info('Archivo eliminado');
                  }}
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '12px', 
              padding: '2rem', 
              textAlign: 'center',
              background: '#f9fafb'
            }}>
              <Upload size={40} style={{ margin: '0 auto 1rem', color: color }} />
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                PDF, DOC, DOCX o TXT (máx. 10MB)
              </p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileUpload(fileType, e.target.files[0])}
                style={{ display: 'none' }}
                id={`file-${fileType}`}
              />
              <button
                type="button"
                onClick={() => document.getElementById(`file-${fileType}`).click()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Upload size={16} />
                Seleccionar Archivo
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">✉️ Carta de Recomendación</h1>
            <p className="app-subtitle">
              Cartas profesionales para EB-2 NIW
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        {step === 'generating' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', border: '5px solid #e2e8f0', borderTop: '5px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: '600', color: '#1a202c' }}>Generando carta de recomendación...</h2>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>{progressMessage}</p>
            <div style={{ width: '400px', background: '#e2e8f0', borderRadius: '9999px', height: '10px' }}>
              <div style={{ height: '10px', background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '9999px', width: `${generationProgress}%`, transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{generationProgress}% completado</p>
          </div>
        ) : step === 'upload' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Instructions */}
            <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem' }}>
                  📋 Instrucciones: 3 Archivos Obligatorios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      1️⃣ CV del Candidato
                    </h3>
                    <p style={{ opacity: 0.9, margin: 0 }}>
                      Currículum vitae completo con logros, publicaciones, premios
                    </p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      2️⃣ Información del Proyecto
                    </h3>
                    <p style={{ opacity: 0.9, margin: 0 }}>
                      Descripción detallada del proyecto de interés nacional
                    </p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      3️⃣ CV del Firmante
                    </h3>
                    <p style={{ opacity: 0.9, margin: 0 }}>
                      CV del recomendante para establecer credibilidad
                    </p>
                  </div>
                </div>
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}>
                  <strong>📄 Nota:</strong> La carta se generará automáticamente en <strong>inglés</strong> y se traducirá a <strong>español</strong>. Ambas versiones estarán disponibles para descarga.
                </div>
              </CardContent>
            </Card>

            {/* File Upload Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              <FileUploadCard
                title="CV del Candidato"
                description="Sube el currículum vitae del candidato"
                fileType="candidate_cv"
                currentFile={candidateCV}
                icon="👤"
                color="#667eea"
              />
              <FileUploadCard
                title="Información del Proyecto"
                description="Documento con detalles del proyecto de interés nacional"
                fileType="project_info"
                currentFile={projectInfo}
                icon="📊"
                color="#f5576c"
              />
              <FileUploadCard
                title="CV del Firmante"
                description="Currículum del recomendante que firma la carta"
                fileType="recommender_cv"
                currentFile={recommenderCV}
                icon="✍️"
                color="#00f2fe"
              />
            </div>

            {/* Generate Button */}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Button
                onClick={handleGenerateLetter}
                disabled={!candidateCV || !projectInfo || !recommenderCV || generating}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  background: (!candidateCV || !projectInfo || !recommenderCV) 
                    ? '#d1d5db' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  minWidth: '300px'
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={20} />
                    Generando Carta (puede tomar 30-60 segundos)...
                  </>
                ) : (
                  <>
                    <Send className="mr-2" size={20} />
                    Generar Carta de Recomendación
                  </>
                )}
              </Button>
              {(!candidateCV || !projectInfo || !recommenderCV) && (
                <p style={{ color: '#6b7280', marginTop: '1rem', fontSize: '0.95rem' }}>
                  ⚠️ Debes subir los 3 archivos antes de generar
                </p>
              )}
            </div>
          </div>
        ) : step === 'generated' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Extracted Data Summary */}
            {extractedData && (
              <Card style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#166534' }}>✅ Documentos Procesados Exitosamente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <strong>Candidato:</strong> {extractedData.candidate_name}<br/>
                      <strong>Campo:</strong> {extractedData.candidate_field}
                    </div>
                    <div>
                      <strong>Proyecto:</strong> {extractedData.project_title || 'N/A'}<br/>
                      <strong>Firmante:</strong> {extractedData.recommender_name}
                    </div>
                    <div>
                      <strong>Organización:</strong> {extractedData.recommender_organization}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language Toggle & Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Language Switcher */}
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                background: '#f3f4f6', 
                padding: '0.25rem', 
                borderRadius: '8px',
                marginRight: 'auto'
              }}>
                <Button 
                  variant={currentLanguage === 'en' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSwitchLanguage('en')}
                  style={{ 
                    background: currentLanguage === 'en' ? '#2563eb' : 'transparent',
                    color: currentLanguage === 'en' ? 'white' : '#374151'
                  }}
                >
                  🇺🇸 English
                </Button>
                <Button 
                  variant={currentLanguage === 'es' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSwitchLanguage('es')}
                  style={{ 
                    background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                    color: currentLanguage === 'es' ? 'white' : '#374151'
                  }}
                >
                  🇪🇸 Español
                </Button>
              </div>

              {/* Download Buttons */}
              <Button 
                onClick={() => {
                  // Download English version
                  const downloadEN = async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await axios.get(
                        `${API}/recommendation-letters/${letterId}/download?language=en`,
                        { 
                          headers: { 'Authorization': `Bearer ${token}` },
                          responseType: 'blob'
                        }
                      );
                      
                      // Extract filename from Content-Disposition header
                      const contentDisposition = response.headers['content-disposition'];
                      let filename = `Carta_Recomendacion_EN.pdf`; // Default fallback
                      
                      if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                          filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                      }
                      
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', filename);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      setTimeout(() => window.URL.revokeObjectURL(url), 100);
                      toast.success(`✅ PDF descargado: ${filename}`);
                    } catch (error) {
                      console.error('Error downloading letter:', error);
                      toast.error('Error al descargar la carta');
                    }
                  };
                  downloadEN();
                }}
                variant="outline"
                style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
              >
                <Download className="mr-2" size={16} />
                PDF (English)
              </Button>
              
              <Button 
                onClick={() => {
                  // Download Spanish version
                  const downloadES = async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await axios.get(
                        `${API}/recommendation-letters/${letterId}/download?language=es`,
                        { 
                          headers: { 'Authorization': `Bearer ${token}` },
                          responseType: 'blob'
                        }
                      );
                      
                      // Extract filename from Content-Disposition header
                      const contentDisposition = response.headers['content-disposition'];
                      let filename = `Carta_Recomendacion_ES.pdf`; // Default fallback
                      
                      if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                          filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                      }
                      
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', filename);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      setTimeout(() => window.URL.revokeObjectURL(url), 100);
                      toast.success(`✅ PDF descargado: ${filename}`);
                    } catch (error) {
                      console.error('Error downloading letter:', error);
                      toast.error('Error al descargar la carta');
                    }
                  };
                  downloadES();
                }}
                variant="outline"
                style={{ borderColor: '#10b981', color: '#10b981' }}
              >
                <Download className="mr-2" size={16} />
                PDF (Español)
              </Button>
              
              <Button variant="outline" onClick={() => setEditMode(!editMode)}>
                <Edit className="mr-2" size={16} />
                Editar Carta
              </Button>
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setLetterContent('');
                setLetterContentEn('');
                setLetterContentEs('');
                setLetterId(null);
                setCurrentLanguage('en');
                setCandidateCV(null);
                setProjectInfo(null);
                setRecommenderCV(null);
                setExtractedData(null);
              }}>
                <Plus className="mr-2" size={16} />
                Nueva Carta
              </Button>
            </div>

            {/* Edit Mode */}
            {editMode && (
              <Card>
                <CardHeader>
                  <CardTitle>Editar Carta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder="Describe los cambios que quieres hacer a la carta..."
                      rows={4}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button onClick={handleEditLetter} disabled={generating}>
                        {generating ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={16} />
                            Editando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2" size={16} />
                            Aplicar Cambios
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setEditMode(false);
                        setEditInstructions('');
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Letter Content */}
            <Card>
              <CardHeader>
                <CardTitle>Carta Generada ({currentLanguage === 'en' ? 'Inglés' : 'Español'})</CardTitle>
                <CardDescription>
                  Carta profesional para solicitud EB-2 NIW
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ 
                  lineHeight: '1.8',
                  fontFamily: 'Georgia, serif',
                  fontSize: '1rem',
                  padding: '2rem',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  maxHeight: '800px',
                  overflowY: 'auto'
                }}>
                  <div
                    className="letter-html-preview"
                    dangerouslySetInnerHTML={{ __html: renderLetterHTML(letterContent) }}
                    style={{ textAlign: "justify", lineHeight: "1.8", fontFamily: "Georgia, serif", fontSize: "1rem" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
};



// Helper: Converts plain text OR HTML letter content to renderable HTML
function renderLetterHTML(raw) {
  if (!raw) return '';
  let text = raw.trim();

  // Remove code fences — plain or wrapped in <p> tags
  text = text.replace(/^```(?:html|markdown)?\s*\n?/i, '');
  text = text.replace(/\n?```\s*$/i, '');
  text = text.replace(/<p>\s*`{1,3}\s*(?:html|markdown)?\s*<\/p>\s*/gi, '');

  if (text.includes('<p') || text.includes('<div')) {
    // HTML content: clean placeholders then render
    // Remove ALL [bracket content] — any [text] except single-digit [1]
    text = text.replace(/\[[^\[\]]+\]/g, (m) => /^\[\d\]$/.test(m) ? m : '');
    // Remove empty <p> tags (including those left after placeholder removal)
    text = text.replace(/<p>\s*<\/p>/g, '');
    text = text.replace(/<p>\s*[,.:;]\s*<\/p>/g, '');
    // Fix double spaces and stray punctuation
    text = text.replace(/  +/g, ' ');
    text = text.replace(/ ([,.:;])/g, '$1');
    return text.trim();
  }

  // Plain text: wrap in <p> tags
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.match(/^`{1,3}/) && !l.match(/^\[[^\[\]]+\]$/))
    .map(l => `<p style="margin-bottom:0.75rem;text-align:justify">${l}</p>`)
    .join('');
}

// ============================================================================
// VIEW RECOMMENDATION LETTER COMPONENT (Temporary - will expand later)
// ============================================================================
const ViewRecommendationLetter = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterContent, setLetterContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [editing, setEditing] = useState(false);
  
  useEffect(() => {
    loadLetter();
  }, [id]);
  
  const loadLetter = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/recommendation-letters/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setLetter(response.data);
      setLetterContent(response.data.content_en);
      setCurrentLanguage('en');
      setLoading(false);
    } catch (error) {
      console.error('Error loading letter:', error);
      toast.error('Error al cargar la carta');
      setLoading(false);
    }
  };
  
  const handleSwitchLanguage = (lang) => {
    if (lang === 'en') {
      setCurrentLanguage('en');
      setLetterContent(letter.content_en);
    } else if (lang === 'es') {
      setCurrentLanguage('es');
      setLetterContent(letter.content_es || letter.content_en);
    }
  };
  
  const handleDownload = async (language) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/recommendation-letters/${id}/download?language=${language}`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Carta_Recomendacion_${language.toUpperCase()}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast.success(`✅ PDF descargado: ${filename}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };
  
  const handleEdit = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor ingresa instrucciones de edición');
      return;
    }
    
    setEditing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/${id}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setLetter({
        ...letter,
        content_en: response.data.content,
        content_es: null
      });
      setLetterContent(response.data.content);
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) {
      console.error('Error editing letter:', error);
      toast.error('Error al editar la carta');
    } finally {
      setEditing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Loader2 className="animate-spin" size={48} />
        </div>
      </div>
    );
  }
  
  if (!letter) {
    return (
      <div className="dashboard-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Carta no encontrada</p>
          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Volver
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => {
            // Si la carta tiene client_id, volver a la lista de cartas de recomendación del cliente
            if (letter.client_id) {
              navigate(`/client-documents/${letter.client_id}/recommendation`);
            } else {
              navigate(-1);
            }
          }} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">✉️ Carta de Recomendación</h1>
            <p className="app-subtitle">
              {letter.candidate_name} • Firmada por {letter.recommender_name}
            </p>
          </div>
        </div>
      </header>
      
      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Info Card */}
          <Card style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <CardHeader>
              <CardTitle style={{ color: '#166534' }}>📋 Información de la Carta</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <strong>Candidato:</strong> {letter.candidate_name}<br/>
                  <strong>Campo:</strong> {letter.candidate_field || 'N/A'}
                </div>
                <div>
                  <strong>Firmante:</strong> {letter.recommender_name}<br/>
                  <strong>Organización:</strong> {letter.recommender_organization || 'N/A'}
                </div>
                <div>
                  <strong>Tipo de Visa:</strong> {letter.visa_type || 'EB-2 NIW'}<br/>
                  <strong>Creada:</strong> {new Date(letter.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Language Switcher */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              background: '#f3f4f6', 
              padding: '0.25rem', 
              borderRadius: '8px',
              marginRight: 'auto'
            }}>
              <Button 
                variant={currentLanguage === 'en' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSwitchLanguage('en')}
                style={{ 
                  background: currentLanguage === 'en' ? '#2563eb' : 'transparent',
                  color: currentLanguage === 'en' ? 'white' : '#374151'
                }}
              >
                🇺🇸 English
              </Button>
              <Button 
                variant={currentLanguage === 'es' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSwitchLanguage('es')}
                style={{ 
                  background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                  color: currentLanguage === 'es' ? 'white' : '#374151'
                }}
              >
                🇪🇸 Español
              </Button>
            </div>

            {/* Download Buttons */}
            <Button 
              onClick={() => handleDownload('en')}
              variant="outline"
              style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
            >
              <Download className="mr-2" size={16} />
              PDF (English)
            </Button>
            
            <Button 
              onClick={() => handleDownload('es')}
              variant="outline"
              style={{ borderColor: '#10b981', color: '#10b981' }}
            >
              <Download className="mr-2" size={16} />
              PDF (Español)
            </Button>
            
            <WordDownloadButton
              url={`${API}/recommendation-letters/${id}/download-docx`}
              testId="download-word-en-recommendation"
            />

            <Button variant="outline" onClick={() => setEditMode(!editMode)}>
              <Edit className="mr-2" size={16} />
              Editar Carta
            </Button>
          </div>

          {/* Edit Mode */}
          {editMode && (
            <Card>
              <CardHeader>
                <CardTitle>Editar Carta</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="Describe los cambios que quieres hacer a la carta..."
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button onClick={handleEdit} disabled={editing}>
                      {editing ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          Editando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2" size={16} />
                          Aplicar Cambios
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Letter Content */}
          <Card>
            <CardHeader>
              <CardTitle>Carta Generada ({currentLanguage === 'en' ? 'Inglés' : 'Español'})</CardTitle>
              <CardDescription>
                Carta profesional para solicitud EB-2 NIW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ 
                lineHeight: '1.8',
                fontFamily: 'Georgia, serif',
                fontSize: '1rem',
                padding: '2rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                maxHeight: '800px',
                overflowY: 'auto'
              }}>
                <div
                  className="letter-html-preview"
                  dangerouslySetInnerHTML={{ __html: renderLetterHTML(letterContent) }}
                  style={{ textAlign: "justify", lineHeight: "1.8", fontFamily: "Georgia, serif", fontSize: "1rem" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};




// ==========================================
// VIEW POLICY PAPER COMPONENT  
// ==========================================
const ViewPolicyPaper = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  useEffect(() => {
    fetchPaper();
  }, [id]);

  const fetchPaper = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/policy-papers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPaper(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching policy paper:', error);
      toast.error('Error al cargar el reporte');
      setLoading(false);
    }
  };

  // Function to process bold text in a string
  const processBoldText = (text) => {
    if (!text) return text;
    
    // Split by ** markers
    const parts = [];
    let currentIndex = 0;
    let inBold = false;
    let currentText = '';
    
    for (let i = 0; i < text.length - 1; i++) {
      if (text[i] === '*' && text[i + 1] === '*') {
        if (currentText) {
          parts.push({ text: currentText, bold: inBold });
          currentText = '';
        }
        inBold = !inBold;
        i++; // Skip next *
      } else {
        currentText += text[i];
      }
    }
    
    // Add last character if not processed
    if (currentText || text[text.length - 1] !== '*') {
      currentText += text[text.length - 1];
      parts.push({ text: currentText, bold: inBold });
    }
    
    return parts.map((part, i) => 
      part.bold ? <strong key={i}>{part.text}</strong> : part.text
    );
  };

  // Function to render Markdown-style text to JSX
  const renderMarkdownContent = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let inTable = false;
    let tableRows = [];
    
    lines.forEach((line, index) => {
      // Check if it's a table line
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        
        // Skip separator lines (|---|---|)
        if (line.includes('---')) {
          return;
        }
        
        const cells = line.split('|').filter(cell => cell.trim());
        tableRows.push(
          <tr key={`row-${index}`}>
            {cells.map((cell, i) => (
              <td key={i} style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                {processBoldText(cell.trim())}
              </td>
            ))}
          </tr>
        );
        inTable = true;
        return;
      } else if (inTable && tableRows.length > 0) {
        // End of table
        elements.push(
          <table key={`table-${index}`} style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>{tableRows}</tbody>
          </table>
        );
        tableRows = [];
        inTable = false;
      }
      
      // Headings
      if (line.startsWith('# ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(2);
        elements.push(
          <h1 key={index} style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: '#1a202c' }}>
            {processBoldText(content)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(3);
        elements.push(
          <h2 key={index} style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1.5rem', marginBottom: '0.75rem', color: '#2d3748' }}>
            {processBoldText(content)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(4);
        elements.push(
          <h3 key={index} style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem', color: '#4a5568' }}>
            {processBoldText(content)}
          </h3>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // List items
        const content = line.trim().substring(2);
        listItems.push(
          <li key={index} style={{ marginBottom: '0.5rem', lineHeight: '1.6' }}>
            {processBoldText(content)}
          </li>
        );
      } else if (line.trim() === '---' || line.trim() === '___') {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        elements.push(<hr key={index} style={{ margin: '1.5rem 0', border: 'none', borderTop: '2px solid #e2e8f0' }} />);
      } else if (line.trim() !== '') {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        // Regular paragraph with bold text support
        elements.push(
          <p key={index} style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#4a5568' }}>
            {processBoldText(line)}
          </p>
        );
      } else {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
      }
    });
    
    // Add remaining table rows
    if (tableRows.length > 0) {
      elements.push(
        <table key="table-final" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>{tableRows}</tbody>
        </table>
      );
    }
    
    // Add remaining list items
    if (listItems.length > 0) {
      elements.push(<ul key="list-final" style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
    }
    
    return <div>{elements}</div>;
  };

  const handleDownload = async (language) => {
    try {
      const token = localStorage.getItem('token');
      
      const downloadUrl = `${API}/policy-papers/${id}/download?language=${language}`;
      
      // Crear un elemento a de forma diferente usando innerHTML (patrón seguro)
      const container = window.document.body;
      const tempDiv = window.document.createElement('div');
      tempDiv.innerHTML = `<a id="temp-download-link-view-${language}" style="display:none"></a>`;
      container.appendChild(tempDiv);
      
      const link = window.document.getElementById(`temp-download-link-view-${language}`);
      
      // Fetch el blob
      const response = await axios.get(downloadUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });

      // Construir nombre de archivo con cliente y proyecto
      const authorName = paper.author_name || 'Author';
      const projectTitle = paper.project_title || 'National_Interest_Project';
      
      // Sanitizar nombres para nombre de archivo
      const sanitize = (str) => str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
      const filenameParts = [
        'Social_Impact_Report',
        sanitize(authorName),
        sanitize(projectTitle),
        language.toUpperCase()
      ];
      const filename = `${filenameParts.join('_')}.pdf`;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      link.click();
      
      // Cleanup
      setTimeout(() => {
        container.removeChild(tempDiv);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success(`✅ PDF descargado en ${language === 'en' ? 'inglés' : 'español'}`);
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Error al descargar el reporte');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="dashboard-container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Reporte no encontrado</p>
          <Button onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">📊 {paper.project_title || 'Reporte de Impacto Social'}</h1>
            <p className="app-subtitle">Policy Paper - Prong 1: Substantial Merit & National Importance</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* ✅ Evaluación de Coherencia para Reportes de Impacto Social */}
        {paper.coherence_evaluation && (
          <Card style={{ 
            marginBottom: '1.5rem',
            borderColor: paper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        paper.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444',
            backgroundColor: paper.coherence_evaluation.coherence_score >= 80 ? '#f0fdf4' : 
                            paper.coherence_evaluation.coherence_score >= 50 ? '#fffbeb' : '#fef2f2'
          }}>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} style={{ color: paper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : '#f59e0b' }} />
                  Evaluación de Coherencia
                </CardTitle>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: paper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        paper.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {paper.coherence_evaluation.coherence_score}/100
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p style={{ marginBottom: '1rem', color: '#374151' }}>
                {paper.coherence_evaluation.summary}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Proyecto integrado: </span>
                  <span style={{ fontWeight: '500' }}>{paper.coherence_evaluation.project_integrated || 'N/A'}</span>
                </div>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Calidad argumentativa: </span>
                  <span style={{ fontWeight: '500', color: paper.coherence_evaluation.coherence_score >= 80 ? '#10b981' : paper.coherence_evaluation.coherence_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                    {paper.coherence_evaluation.coherence_score || 'N/A'}
                  </span>
                </div>
              </div>
              {paper.coherence_evaluation.recommendation && (
                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: '500', color: '#374151' }}>💡 Recomendación: </span>
                  <span style={{ color: '#6b7280' }}>{paper.coherence_evaluation.recommendation}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Reporte Completo</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <Button 
                onClick={() => handleDownload('en')}
                variant="outline"
                style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
              >
                <Download className="mr-2" size={16} />
                PDF (English)
              </Button>
              
              <Button 
                onClick={() => handleDownload('es')}
                variant="outline"
                style={{ borderColor: '#10b981', color: '#10b981' }}
              >
                <Download className="mr-2" size={16} />
                PDF (Español)
              </Button>

              <WordDownloadButton
                url={`${API}/policy-papers/${id}/download-docx`}
                testId="download-word-en-policy"
              />

              <Button 
                variant="outline" 
                onClick={() => setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en')}
              >
                <Globe className="mr-2" size={16} />
                {currentLanguage === 'en' ? 'Ver en Español' : 'View in English'}
              </Button>
            </div>

            <div style={{ 
              background: '#ffffff', 
              padding: '3rem', 
              borderRadius: '8px',
              maxHeight: '600px',
              overflowY: 'auto',
              fontSize: '0.95rem',
              lineHeight: '1.8',
              border: '1px solid #e2e8f0'
            }}>
              {renderMarkdownContent(currentLanguage === 'en' ? paper.content_en : paper.content_es)}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};


// ==========================================
// CREATE POLICY PAPER COMPONENT
// ==========================================
const CreatePolicyPaper = () => {
  const [document, setDocument] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportContentEn, setReportContentEn] = useState('');
  const [reportContentEs, setReportContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [paperId, setPaperId] = useState(null);
  const [step, setStep] = useState('upload'); // upload, redirecting, generated
  const [countdown, setCountdown] = useState(5);
  
  const navigate = useNavigate();
  const clientId = new URLSearchParams(window.location.search).get('client_id');

  // Countdown and redirect effect
  useEffect(() => {
    if (step === 'redirecting' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (step === 'redirecting' && countdown === 0 && clientId) {
      navigate(`/client-documents/${clientId}/policypaper`);
    }
  }, [step, countdown, clientId, navigate]);

  // Function to process bold text in a string
  const processBoldText = (text) => {
    if (!text) return text;
    
    // Split by ** markers
    const parts = [];
    let currentIndex = 0;
    let inBold = false;
    let currentText = '';
    
    for (let i = 0; i < text.length - 1; i++) {
      if (text[i] === '*' && text[i + 1] === '*') {
        if (currentText) {
          parts.push({ text: currentText, bold: inBold });
          currentText = '';
        }
        inBold = !inBold;
        i++; // Skip next *
      } else {
        currentText += text[i];
      }
    }
    
    // Add last character if not processed
    if (currentText || text[text.length - 1] !== '*') {
      currentText += text[text.length - 1];
      parts.push({ text: currentText, bold: inBold });
    }
    
    return parts.map((part, i) => 
      part.bold ? <strong key={i}>{part.text}</strong> : part.text
    );
  };

  // Function to render Markdown-style text to JSX
  const renderMarkdownContent = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let inTable = false;
    let tableRows = [];
    
    lines.forEach((line, index) => {
      // Check if it's a table line
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        
        // Skip separator lines (|---|---|)
        if (line.includes('---')) {
          return;
        }
        
        const cells = line.split('|').filter(cell => cell.trim());
        tableRows.push(
          <tr key={`row-${index}`}>
            {cells.map((cell, i) => (
              <td key={i} style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                {processBoldText(cell.trim())}
              </td>
            ))}
          </tr>
        );
        inTable = true;
        return;
      } else if (inTable && tableRows.length > 0) {
        // End of table
        elements.push(
          <table key={`table-${index}`} style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>{tableRows}</tbody>
          </table>
        );
        tableRows = [];
        inTable = false;
      }
      
      // Headings
      if (line.startsWith('# ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(2);
        elements.push(
          <h1 key={index} style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: '#1a202c' }}>
            {processBoldText(content)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(3);
        elements.push(
          <h2 key={index} style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1.5rem', marginBottom: '0.75rem', color: '#2d3748' }}>
            {processBoldText(content)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        const content = line.substring(4);
        elements.push(
          <h3 key={index} style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem', color: '#4a5568' }}>
            {processBoldText(content)}
          </h3>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // List items
        const content = line.trim().substring(2);
        listItems.push(
          <li key={index} style={{ marginBottom: '0.5rem', lineHeight: '1.6' }}>
            {processBoldText(content)}
          </li>
        );
      } else if (line.trim() === '---' || line.trim() === '___') {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        elements.push(<hr key={index} style={{ margin: '1.5rem 0', border: 'none', borderTop: '2px solid #e2e8f0' }} />);
      } else if (line.trim() !== '') {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
        // Regular paragraph with bold text support
        elements.push(
          <p key={index} style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#4a5568' }}>
            {processBoldText(line)}
          </p>
        );
      } else {
        if (listItems.length > 0) {
          elements.push(<ul key={`list-${index}`} style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
          listItems = [];
        }
      }
    });
    
    // Add remaining table rows
    if (tableRows.length > 0) {
      elements.push(
        <table key="table-final" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>{tableRows}</tbody>
        </table>
      );
    }
    
    // Add remaining list items
    if (listItems.length > 0) {
      elements.push(<ul key="list-final" style={{ marginLeft: '2rem', marginBottom: '1rem' }}>{listItems}</ul>);
    }
    
    return <div>{elements}</div>;
  };

  const handleFileUpload = (file) => {
    setDocument(file);
  };

  const handleGenerate = async () => {
    if (!document) {
      toast.error('Por favor carga el documento de descripción del proyecto');
      return;
    }

    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('file', document);
      if (clientId) {
        formData.append('client_id', clientId);
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/policy-papers/generate`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setPaperId(response.data.paper_id);
      
      // NEW: Async generation - redirect to dashboard
      if (response.data.status === 'generating') {
        toast.success('¡Generación iniciada! Redirigiendo al panel de documentos...');
        setStep('redirecting');
        setCountdown(5);
      } else if (response.data.content_en) {
        // Legacy: If content is returned directly
        setReportContentEn(response.data.content_en);
        setReportContentEs(response.data.content_es);
        setReportContent(response.data.content_en);
        setCurrentLanguage('en');
        setStep('generated');
        toast.success('¡Reporte de impacto social generado exitosamente!');
      }
    } catch (error) {
      console.error('Error generating policy paper:', error);
      toast.error(error.response?.data?.detail || 'Error al generar el reporte');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Solución alternativa: usar window.location para forzar descarga
      const downloadUrl = `${API}/policy-papers/${paperId}/download?language=en`;
      
      // Crear un elemento a de forma diferente usando innerHTML
      const container = window.document.body;
      const tempDiv = window.document.createElement('div');
      tempDiv.innerHTML = '<a id="temp-download-link" style="display:none"></a>';
      container.appendChild(tempDiv);
      
      const link = window.document.getElementById('temp-download-link');
      
      // Fetch el blob
      const response = await axios.get(downloadUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Social_Impact_Report_EN.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].trim();
        }
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      link.click();
      
      // Cleanup
      setTimeout(() => {
        container.removeChild(tempDiv);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('✅ PDF descargado en inglés');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Error al descargar el reporte');
    }
  };

  const handleDownloadSpanish = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const downloadUrl = `${API}/policy-papers/${paperId}/download?language=es`;
      
      // Crear un elemento a de forma diferente usando innerHTML (mismo approach que inglés)
      const container = window.document.body;
      const tempDiv = window.document.createElement('div');
      tempDiv.innerHTML = '<a id="temp-download-link-es" style="display:none"></a>';
      container.appendChild(tempDiv);
      
      const link = window.document.getElementById('temp-download-link-es');
      
      // Fetch el blob
      const response = await axios.get(downloadUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Social_Impact_Report_ES.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].trim();
        }
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      link.click();
      
      // Cleanup
      setTimeout(() => {
        container.removeChild(tempDiv);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('✅ PDF descargado en español');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Error al descargar el reporte');
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">📊 Crear Reporte de Impacto Social</h1>
            <p className="app-subtitle">Policy Paper - Prong 1: Substantial Merit & National Importance</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Card style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)', color: 'white' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem' }}>
                  📋 Instrucciones: Descripción del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{ opacity: 0.95, marginBottom: '1rem' }}>
                  Carga la descripción completa de tu proyecto de interés nacional. El reporte generará un análisis de 10-15 páginas que demuestra el mérito sustancial e importancia nacional del proyecto (Prong 1 de Matter of Dhanasar).
                </p>
                <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                  Incluye: alcance del proyecto, usuarios/sectores objetivo, resultados esperados, impacto económico/social.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cargar Descripción del Proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ 
                  border: '2px dashed #d1d5db', 
                  borderRadius: '8px', 
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  background: '#f9fafb'
                }}>
                  <Upload size={48} style={{ color: '#9ca3af', margin: '0 auto 1rem' }} />
                  <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                    Arrastra el archivo aquí o haz click para seleccionar
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                    style={{ display: 'none' }}
                    id="file-upload-policypaper"
                  />
                  <label 
                    htmlFor="file-upload-policypaper"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.5rem 1rem',
                      background: '#000',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#333'}
                    onMouseLeave={(e) => e.target.style.background = '#000'}
                  >
                    <FileText className="mr-2" size={16} />
                    Seleccionar Archivo
                  </label>
                  
                  {document && (
                    <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                      <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        Archivo seleccionado:
                      </p>
                      <div style={{ padding: '0.5rem', background: 'white', margin: '0', borderRadius: '4px' }}>
                        📄 {document.name}
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={generating || !document}
                  style={{ marginTop: '2rem', width: '100%' }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Generando Reporte... (esto puede tardar 1-2 minutos)
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2" size={16} />
                      Generar Reporte de Impacto Social
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'generated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Card>
              <CardHeader>
                <CardTitle>✅ Reporte Generado Exitosamente</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <Button 
                    onClick={() => handleDownload()}
                    variant="outline"
                    style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (English)
                  </Button>
                  
                  <Button 
                    onClick={() => handleDownloadSpanish()}
                    variant="outline"
                    style={{ borderColor: '#10b981', color: '#10b981' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (Español)
                  </Button>

                  <Button variant="outline" onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await axios.get(`${API}/clients`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const clients = response.data.clients || [];
                      if (clients.length > 0) {
                        navigate(`/client-documents/${clients[0].id}/policypaper`);
                      } else {
                        navigate('/dashboard');
                      }
                    } catch (error) {
                      navigate('/dashboard');
                    }
                  }}>
                    <FileText className="mr-2" size={16} />
                    Volver a Reportes
                  </Button>

                  <Button variant="outline" onClick={() => {
                    setStep('upload');
                    setReportContent('');
                    setReportContentEn('');
                    setReportContentEs('');
                    setPaperId(null);
                    setDocument(null);
                  }}>
                    <Plus className="mr-2" size={16} />
                    Nuevo Reporte
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en')}
                  >
                    <Globe className="mr-2" size={16} />
                    {currentLanguage === 'en' ? 'Ver en Español' : 'View in English'}
                  </Button>
                </div>

                <div style={{ 
                  background: '#ffffff', 
                  padding: '3rem', 
                  borderRadius: '8px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  fontSize: '0.95rem',
                  lineHeight: '1.8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  {renderMarkdownContent(currentLanguage === 'en' ? reportContentEn : reportContentEs)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};


// ============================================================================
// CREATE SELF-PETITION V2 COMPONENT - Multi-document processing
// ============================================================================
const CreateSelfPetitionLetter = () => {
  const [documents, setDocuments] = useState({
    cv: null,
    project: null,
    patent: null,
    passport: null,
    econometric_study: null,
    recommendation_letters: [],  // Array de hasta 10 cartas
    additional_documents: []  // NUEVO: Array para documentos adicionales (certificados, títulos, etc.)
  });
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [generating, setGenerating] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterContentEn, setLetterContentEn] = useState('');
  const [letterContentEs, setLetterContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterId, setLetterId] = useState(null);
  const [step, setStep] = useState('upload'); // upload, generated
  
  const navigate = useNavigate();
  const clientId = new URLSearchParams(window.location.search).get('client_id');

  const handleFileUpload = async (fileType, file) => {
    if (!file) return;
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC, DOCX o TXT');
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [fileType]: true }));
    
    try {
      setDocuments(prev => ({
        ...prev,
        [fileType]: file
      }));
      toast.success(`✅ ${fileType.toUpperCase()} cargado correctamente`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar el archivo');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fileType]: false }));
    }
  };

  const handleRecommendationLetterUpload = async (file, index) => {
    if (!file) return;
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC, DOCX o TXT');
      return;
    }

    setDocuments(prev => {
      const newLetters = [...prev.recommendation_letters];
      newLetters[index] = file;
      return { ...prev, recommendation_letters: newLetters };
    });
    
    toast.success(`✅ Carta ${index + 1} cargada correctamente`);
  };

  const removeRecommendationLetter = (index) => {
    setDocuments(prev => {
      const newLetters = prev.recommendation_letters.filter((_, i) => i !== index);
      return { ...prev, recommendation_letters: newLetters };
    });
  };

  // NUEVO: Funciones para documentos adicionales (múltiples archivos en un solo campo)
  const handleAdditionalDocumentsUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const validFiles = [];
    
    for (let file of files) {
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error(`Archivo ${file.name} no permitido. Solo PDF, DOC, DOCX o TXT`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setDocuments(prev => ({
        ...prev,
        additional_documents: [...prev.additional_documents, ...validFiles]
      }));
      
      toast.success(`✅ ${validFiles.length} documento(s) adicional(es) cargado(s)`);
    }
  };

  const removeAdditionalDocument = (index) => {
    setDocuments(prev => {
      const newDocs = prev.additional_documents.filter((_, i) => i !== index);
      return { ...prev, additional_documents: newDocs };
    });
    toast.success('Documento eliminado');
  };

  const handleGenerate = async () => {
    // Verificar que al menos CV y proyecto estén cargados
    if (!documents.cv) {
      toast.error('Por favor carga al menos tu CV/Hoja de Vida');
      return;
    }

    // 1. INMEDIATAMENTE mostrar pantalla de loading y programar redirect
    setStep('generating');
    toast.success('📝 Iniciando generación de carta de autopetición...');
    setGenerating(true);

    // 2. Programar redirect AHORA (antes de await)
    setTimeout(() => {
      if (clientId) {
        toast.info('📋 Redirigiendo al dashboard del cliente...');
        navigate(`/client-dashboard/${clientId}`);
      } else {
        toast.info('📋 La carta se está generando en segundo plano');
        navigate('/dashboard');
      }
    }, 10000); // 10 segundos

    // 3. Enviar request en background
    try {
      const formData = new FormData();
      
      // Agregar documentos individuales
      if (documents.cv) formData.append('cv', documents.cv);
      if (documents.project) formData.append('project', documents.project);
      if (documents.patent) formData.append('patent', documents.patent);
      if (documents.passport) formData.append('passport', documents.passport);
      if (documents.econometric_study) formData.append('econometric_study', documents.econometric_study);
      
      // Agregar cartas de recomendación
      documents.recommendation_letters.forEach((letter, index) => {
        if (letter) {
          formData.append('recommendation_letters', letter);
        }
      });
      
      // Agregar documentos adicionales
      documents.additional_documents.forEach((doc, index) => {
        if (doc) {
          formData.append('additional_documents', doc);
        }
      });
      
      // Agregar client_id si está disponible
      if (clientId) {
        formData.append('client_id', clientId);
      }

      const token = localStorage.getItem('token');
      
      // NO usar await - dejar que se ejecute en background
      axios.post(
        `${API}/self-petition-letters/generate`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      ).then(response => {
        if (response.data) {
          console.log('✅ Carta generada exitosamente. ID:', response.data.letter_id);
          setLetterId(response.data.letter_id);
        }
      }).catch(error => {
        console.error('❌ Error generando carta:', error);
        // Usuario ya fue redirigido, solo loggear el error
      });

    } catch (error) {
      console.error('Error al iniciar generación:', error);
      setGenerating(false);
      setStep('upload');
      toast.error('Error al iniciar la generación. Por favor, intenta nuevamente.');
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/self-petition-letters/${letterId}/download?language=en`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Self_Petition_Letter_EN.pdf'; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('✅ PDF descargado en inglés');
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  const handleDownloadSpanish = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const downloadUrl = `${API}/self-petition-letters/${letterId}/download?language=es`;
      
      // Fetch el blob
      const response = await axios.get(downloadUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Self_Petition_Letter_ES.pdf'; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('✅ PDF descargado en español');
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">📄 Crear Carta de Autopetición EB-2 NIW</h1>
            <p className="app-subtitle">Cover Letter para Form I-140</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* REDIRECTING SCREEN */}
        {step === 'redirecting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <Card style={{ maxWidth: '500px', textAlign: 'center', padding: '2rem' }}>
              <CardContent>
                <Loader2 className="mx-auto animate-spin text-purple-600 mb-4" size={64} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  ¡Generación Iniciada!
                </h2>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                  Tu reporte de impacto social se está generando en segundo plano.
                  Este proceso puede tomar 5-10 minutos.
                </p>
                <div style={{ 
                  background: '#f3f4f6', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#374151' }}>
                    Redirigiendo al panel de documentos en <strong>{countdown}</strong> segundos...
                  </p>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                  Podrás ver el progreso y descargar el documento cuando esté listo.
                </p>
                <Button 
                  onClick={() => navigate(`/client-documents/${clientId}/policypaper`)}
                  style={{ marginTop: '1rem' }}
                >
                  Ir ahora al panel →
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Card style={{ background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', color: 'white' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem' }}>
                  📋 Instrucciones: Documentos del Caso EB-2 NIW
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{ opacity: 0.95, marginBottom: '1rem' }}>
                  Carga los documentos específicos de tu caso. Los campos marcados con * son obligatorios.
                </p>
                <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                  Mientras más evidencia proporciones, más completa será la carta generada.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documentos Principales</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gap: '2rem' }}>
                  
                  {/* CV / Hoja de Vida - OBLIGATORIO */}
                  <div className="form-field">
                    <Label htmlFor="cv">CV / Hoja de Vida *</Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Incluye estudios, experiencia laboral, logros y certificaciones
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload('cv', e.target.files[0])}
                        className="hidden"
                        id="cv-upload"
                      />
                      <label htmlFor="cv-upload" className="cursor-pointer">
                        {documents.cv ? (
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <p className="text-sm font-medium text-green-800">✅ {documents.cv.name}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-600">Click para subir CV</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Proyecto - OPCIONAL */}
                  <div className="form-field">
                    <Label htmlFor="project">Descripción del Proyecto (Opcional)</Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Documento con la descripción detallada de tu proyecto o propuesta
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload('project', e.target.files[0])}
                        className="hidden"
                        id="project-upload"
                      />
                      <label htmlFor="project-upload" className="cursor-pointer">
                        {documents.project ? (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-sm font-medium text-blue-800">✅ {documents.project.name}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-600">Click para subir Proyecto</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Patente - OPCIONAL */}
                  <div className="form-field">
                    <Label htmlFor="patent">Patente (Opcional)</Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Documento de patente relacionada con tu trabajo
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload('patent', e.target.files[0])}
                        className="hidden"
                        id="patent-upload"
                      />
                      <label htmlFor="patent-upload" className="cursor-pointer">
                        {documents.patent ? (
                          <div className="bg-purple-50 border border-purple-200 rounded p-3">
                            <p className="text-sm font-medium text-purple-800">✅ {documents.patent.name}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-600">Click para subir Patente</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Pasaporte - OPCIONAL */}
                  <div className="form-field">
                    <Label htmlFor="passport">Pasaporte (Opcional)</Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Copia de tu pasaporte vigente
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload('passport', e.target.files[0])}
                        className="hidden"
                        id="passport-upload"
                      />
                      <label htmlFor="passport-upload" className="cursor-pointer">
                        {documents.passport ? (
                          <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                            <p className="text-sm font-medium text-indigo-800">✅ {documents.passport.name}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-600">Click para subir Pasaporte</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Estudio Econométrico - OPCIONAL */}
                  <div className="form-field">
                    <Label htmlFor="econometric">Estudio Econométrico (Opcional)</Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Análisis económico o estadístico relacionado con tu trabajo
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload('econometric_study', e.target.files[0])}
                        className="hidden"
                        id="econometric-upload"
                      />
                      <label htmlFor="econometric-upload" className="cursor-pointer">
                        {documents.econometric_study ? (
                          <div className="bg-teal-50 border border-teal-200 rounded p-3">
                            <p className="text-sm font-medium text-teal-800">✅ {documents.econometric_study.name}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FileText size={32} className="text-gray-400" />
                            <p className="text-sm text-gray-600">Click para subir Estudio</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Cartas de Apoyo */}
            <Card>
              <CardHeader>
                <CardTitle>Cartas de Apoyo (Opcional)</CardTitle>
                <p className="text-sm text-gray-600">
                  Puedes subir hasta 10 cartas: recomendación, intención, de expertos, etc.
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[...Array(10)].map((_, index) => (
                    <div key={index} className="form-field">
                      <Label htmlFor={`letter-${index}`}>Carta {index + 1}</Label>
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-3">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => handleRecommendationLetterUpload(e.target.files[0], index)}
                          className="hidden"
                          id={`letter-${index}`}
                        />
                        <label htmlFor={`letter-${index}`} className="cursor-pointer">
                          {documents.recommendation_letters[index] ? (
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded p-2">
                              <p className="text-sm font-medium text-amber-800">
                                ✅ {documents.recommendation_letters[index].name}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeRecommendationLetter(index);
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500">
                              <FileText size={20} />
                              <p className="text-sm">Click para subir carta {index + 1}</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* NUEVO: Documentos Adicionales */}
            <Card>
              <CardHeader>
                <CardTitle>📎 Documentos Adicionales (Opcional)</CardTitle>
                <p className="text-sm text-gray-600">
                  Selecciona uno o más documentos: certificados, títulos adicionales, diplomas, premios, publicaciones, etc.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Input para múltiples archivos */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      multiple
                      onChange={(e) => handleAdditionalDocumentsUpload(Array.from(e.target.files))}
                      className="hidden"
                      id="additional-docs-upload"
                    />
                    <label htmlFor="additional-docs-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-3">
                        <FileText size={40} className="text-gray-400" />
                        <div>
                          <p className="text-base font-medium text-gray-700">
                            Click para seleccionar documentos
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Puedes seleccionar múltiples archivos a la vez
                          </p>
                        </div>
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('additional-docs-upload').click();
                          }}
                        >
                          <Plus size={16} className="mr-2" />
                          Seleccionar Archivos
                        </Button>
                      </div>
                    </label>
                  </div>

                  {/* Lista de documentos cargados */}
                  {documents.additional_documents.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2 block">
                        Documentos cargados ({documents.additional_documents.length})
                      </Label>
                      <div className="space-y-2">
                        {documents.additional_documents.map((doc, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2">
                              <FileText size={20} className="text-green-600" />
                              <p className="text-sm font-medium text-green-800">
                                {doc.name}
                              </p>
                              <span className="text-xs text-gray-500">
                                ({(doc.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              onClick={() => removeAdditionalDocument(index)}
                              className="text-red-600 hover:text-red-800 font-bold"
                              title="Eliminar documento"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guía de ejemplos */}
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800 mb-2">
                      💡 Ejemplos de documentos útiles:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <ul className="text-xs text-blue-700 list-disc ml-4 space-y-1">
                        <li>Certificaciones profesionales</li>
                        <li>Títulos académicos adicionales</li>
                        <li>Premios o reconocimientos</li>
                      </ul>
                      <ul className="text-xs text-blue-700 list-disc ml-4 space-y-1">
                        <li>Publicaciones académicas</li>
                        <li>Documentos de conferencias</li>
                        <li>Cartas de asociaciones</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleGenerate} 
              disabled={generating || !documents.cv}
              style={{ width: '100%', padding: '1.5rem', fontSize: '1.1rem' }}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={20} />
                  Generando Carta de Autopetición... (esto puede tomar 3-5 minutos)
                </>
              ) : (
                <>
                  <FileText className="mr-2" size={20} />
                  Generar Carta de Autopetición EB-2 NIW
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', textAlign: 'center', padding: '3rem 0' }}>
            <Card style={{ maxWidth: '600px', width: '100%' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem', color: '#ec4899' }}>
                  🚀 Generando Carta de Autopetición
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                  <div style={{ fontSize: '4rem' }}>⏳</div>
                  <div>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#374151' }}>
                      Tu carta de autopetición se está generando en segundo plano...
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Este proceso puede tomar varios minutos debido al análisis profundo de documentos.
                    </p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ec4899' }}>
                      ⏱️ Serás redirigido al dashboard del cliente en 10 segundos...
                    </p>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    background: '#f3f4f6', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                      animation: 'pulse 2s infinite'
                    }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'generated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Card>
              <CardHeader>
                <CardTitle>✅ Carta Generada Exitosamente</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <Button 
                    onClick={() => handleDownload()}
                    variant="outline"
                    style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (English)
                  </Button>
                  
                  <Button 
                    onClick={() => handleDownloadSpanish()}
                    variant="outline"
                    style={{ borderColor: '#10b981', color: '#10b981' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (Español)
                  </Button>

                  <Button variant="outline" onClick={() => {
                    // Navigate back to the correct client's selfpetition list
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
                    setStep('upload');
                    setLetterContent('');
                    setLetterContentEn('');
                    setLetterContentEs('');
                    setLetterId(null);
                    setDocuments([]);
                  }}>
                    <Plus className="mr-2" size={16} />
                    Nueva Carta
                  </Button>
                </div>

                <div style={{ 
                  background: '#f9fafb', 
                  padding: '2rem', 
                  borderRadius: '8px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                  lineHeight: '1.6'
                }}>
                  {currentLanguage === 'en' ? letterContentEn : letterContentEs}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

// ==========================================
// CREATE INTENT LETTER COMPONENT
// ==========================================
const CreateIntentLetter = () => {
  const [petitionerCV, setPetitionerCV] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [supportDoc, setSupportDoc] = useState(null);
  const [signerCV, setSignerCV] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [letterContentEn, setLetterContentEn] = useState('');
  const [letterContentEs, setLetterContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterId, setLetterId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [step, setStep] = useState('upload');
  const [generationProgress, setGenerationProgress] = useState(5);
  const [progressMessage, setProgressMessage] = useState('Iniciando generación...');
  const [petitionerName, setPetitionerName] = useState('');
  const [letterMode, setLetterMode] = useState('self_signed_personal_statement');
  const pollRef = React.useRef(null);

  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');

  React.useEffect(() => {
    if (step === 'generating' && letterId) {
      const token = localStorage.getItem('token');
      pollRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/intent-letters/${letterId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = res.data;
          setGenerationProgress(data.progress_percentage || 5);
          setProgressMessage(data.progress_message || 'Procesando...');
          if (data.status === 'completed') {
            clearInterval(pollRef.current);
            setStep('generated');
            setLetterContentEn(data.content_en || '');
            setLetterContentEs(data.content_es || '');
            setPetitionerName(data.petitioner_name || '');
            setLetterMode(data.letter_mode || 'self_signed_personal_statement');
            setGenerating(false);
            toast.success('✅ Carta de intención generada en inglés y español');
          } else if (data.status === 'error') {
            clearInterval(pollRef.current);
            setGenerating(false);
            setStep('upload');
            toast.error(data.error_message || 'Error al generar la carta');
          }
        } catch (e) { console.error('Poll error:', e); }
      }, 4000);
      return () => clearInterval(pollRef.current);
    }
  }, [step, letterId]);

  const handleFileUpload = (fileType, file) => {
    if (!file) return;
    const validExt = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExt.includes(ext)) { toast.error('Solo PDF, DOC, DOCX o TXT'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB'); return; }
    if (fileType === 'petitioner_cv') { setPetitionerCV(file); toast.success(`✅ CV del Peticionario: ${file.name}`); }
    else if (fileType === 'project_info') { setProjectInfo(file); toast.success(`✅ Descripción del Proyecto: ${file.name}`); }
    else if (fileType === 'support_doc') { setSupportDoc(file); toast.success(`✅ Documento de Apoyo: ${file.name}`); }
    else if (fileType === 'signer_cv') { setSignerCV(file); toast.success(`✅ CV del Firmante: ${file.name} — se generará una Letter of Intent de tercero`); }
  };

  const handleGenerate = async () => {
    if (!petitionerCV || !projectInfo || !signerCV) {
      toast.error('El CV del peticionario, la descripción del proyecto y el CV del firmante son obligatorios');
      return;
    }
    setGenerating(true);
    setStep('generating');
    setGenerationProgress(5);
    setProgressMessage('Enviando documentos...');
    try {
      const formData = new FormData();
      formData.append('petitioner_cv', petitionerCV);
      formData.append('project_info', projectInfo);
      formData.append('signer_cv', signerCV);
      if (supportDoc) formData.append('support_document', supportDoc);
      if (clientId) formData.append('client_id', clientId);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/intent-letters/generate`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setLetterId(response.data.letter_id);
      setLetterMode('third_party_loi');
      setProgressMessage('Generando carta en segundo plano...');
    } catch (error) {
      setGenerating(false);
      setStep('upload');
      toast.error(error.response?.data?.detail || 'Error al generar la carta');
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/intent-letters/${letterId}/download?language=${currentLanguage}`,
        { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `carta_intencion_${currentLanguage.toUpperCase()}_${letterId.substring(0,8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast.success(`✅ PDF descargado en ${currentLanguage === 'es' ? 'español' : 'inglés'}`);
    } catch (error) { toast.error('Error al descargar la carta'); }
  };

  const handleEdit = async () => {
    if (!editInstructions.trim()) { toast.error('Ingresa instrucciones de edición'); return; }
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/intent-letters/${letterId}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setLetterContentEn(response.data.content);
      setLetterContentEs('');
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) { toast.error('Error al editar la carta');
    } finally { setGenerating(false); }
  };

  const FileCard = ({ title, description, fileType, currentFile, color = '#0369A1' }) => (
    <Card style={{ border: `2px solid ${currentFile ? '#10b981' : '#e5e7eb'}`, transition: 'border-color 0.2s' }}>
      <CardHeader>
        <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
          <FileText size={20} style={{ color }} />
          {title}
          {currentFile && <CheckCircle size={18} style={{ color: '#10b981', marginLeft: 'auto' }} />}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {currentFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', padding: '0.6rem', borderRadius: '6px' }}>
            <CheckCircle size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.85rem', color: '#166534' }}>{currentFile.name}</span>
            <Button variant="ghost" size="sm" onClick={() => {
              if (fileType === 'petitioner_cv') setPetitionerCV(null);
              else if (fileType === 'project_info') setProjectInfo(null);
              else if (fileType === 'support_doc') setSupportDoc(null);
              else if (fileType === 'signer_cv') setSignerCV(null);
            }} style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem', color: '#dc2626' }}>✕</Button>
          </div>
        ) : (
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', background: '#fafafa', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = '#f0f9ff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa'; }}>
              <Upload size={24} style={{ color: '#9ca3af', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Arrastra o haz clic para subir</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>PDF, DOCX, TXT — Máx. 10MB</p>
            </div>
            <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt"
              onChange={e => handleFileUpload(fileType, e.target.files[0])} />
          </label>
        )}
      </CardContent>
    </Card>
  );

  const letterContent = currentLanguage === 'es' ? letterContentEs : letterContentEn;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => clientId ? navigate(`/client-documents/${clientId}/intentletter`) : navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} /> Volver
          </Button>
          <div>
            <h1 className="app-title">📝 Carta de Intención</h1>
            <p className="app-subtitle">Letter of Intent EB-2 NIW — firmada por tercero (Framework Dhanasar)</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <CardContent style={{ paddingTop: '1.2rem' }}>
                <p style={{ color: '#0c4a6e', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  <strong>¿Qué es una Carta de Intención (Letter of Intent)?</strong> Es una carta firmada por un tercero que <strong>apoya formalmente al peticionario</strong> expresando un compromiso concreto. En la práctica EB-2 NIW, <strong>usualmente la firma un inversor</strong> que se compromete a aportar capital al proyecto del peticionario (aunque también puede firmarla un empleador, cliente o colaborador). Justifica los 3 Prongs de <em>Matter of Dhanasar</em> desde la voz del firmante y fortalece sustancialmente la petición.
                </p>
                <p style={{ color: '#0c4a6e', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #bae6fd' }}>
                  <strong>📎 El CV del Firmante es obligatorio.</strong> USCIS espera que las credenciales del firmante estén documentadas como <em>enclosure</em> para validar su autoridad para hacer el compromiso (por ejemplo, el historial de inversiones del inversor).
                </p>
              </CardContent>
            </Card>

            {/* Fixed LOI mode banner — the module ONLY produces third-party LOIs */}
            <div
              data-testid="intent-letter-mode-banner"
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.88rem',
                color: '#92400e',
                fontWeight: '500'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>💼</span>
              <div>
                <strong>Letter of Intent de Inversor (o Tercero)</strong> — por defecto el sistema redactará la carta como si el firmante fuera un inversor comprometiendo capital. Si el CV del firmante indica otro rol (empleador, cliente, colaborador académico), la IA lo detectará automáticamente. 8-11 párrafos, 1.5k-2.5k palabras, tercera persona.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <FileCard title="CV del Peticionario *" description="Curriculum vitae completo del solicitante (PDF, DOCX)" fileType="petitioner_cv" currentFile={petitionerCV} color="#0369A1" />
              <FileCard title="Descripción del Proyecto *" description="Descripción técnica del proyecto NIW (PDF, DOCX, TXT)" fileType="project_info" currentFile={projectInfo} color="#7c3aed" />
              <FileCard title="CV del Firmante (Inversor) *" description="CV del tercero que firmará la carta. Por defecto se asume un inversor comprometiendo capital. También válido: empleador, cliente o colaborador académico" fileType="signer_cv" currentFile={signerCV} color="#d97706" />
              <FileCard title="Documento de Apoyo (opcional)" description="Term sheet, carta de compromiso, patente, publicación u otro documento relevante" fileType="support_doc" currentFile={supportDoc} color="#059669" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem' }}>
              <Button onClick={handleGenerate} disabled={!petitionerCV || !projectInfo || !signerCV}
                data-testid="generate-intent-letter-btn"
                style={{ background: (!petitionerCV || !projectInfo || !signerCV) ? '#9ca3af' : '#0369A1', color: 'white', padding: '0.8rem 2.5rem', fontSize: '1rem', borderRadius: '8px', cursor: (!petitionerCV || !projectInfo || !signerCV) ? 'not-allowed' : 'pointer' }}>
                <FileText size={18} style={{ marginRight: '0.5rem' }} />
                Generar Letter of Intent
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={52} style={{ color: '#0369A1' }} />
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Generando Carta de Intención</h2>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{progressMessage}</p>
            </div>
            <div style={{ width: '100%', maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#374151' }}>Progreso</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0369A1' }}>{generationProgress}%</span>
              </div>
              <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#0369A1,#7c3aed)', borderRadius: '999px', width: `${generationProgress}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '1rem', textAlign: 'center' }}>
              {[['10-25%','Analizando documentos'],['25-80%','Redactando 7 secciones Dhanasar'],['80-100%','Traduciendo al español']].map(([pct,label],i)=>(
                <div key={i} style={{ background: generationProgress > (i===0?5:i===1?25:80) ? '#f0fdf4' : '#f9fafb', border: `1px solid ${generationProgress > (i===0?5:i===1?25:80) ? '#86efac' : '#e5e7eb'}`, borderRadius: '8px', padding: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{pct}</p>
                  <p style={{ fontSize: '0.8rem', fontWeight: '600', color: generationProgress > (i===0?5:i===1?25:80) ? '#166534' : '#374151' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'generated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <CardContent style={{ paddingTop: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle size={24} style={{ color: '#16a34a' }} />
                  <div>
                    <p style={{ fontWeight: '700', color: '#166534' }}>
                      ✅ Letter of Intent generada exitosamente
                    </p>
                    {petitionerName && (
                      <p style={{ fontSize: '0.85rem', color: '#16a34a' }}>
                        Peticionario: {petitionerName} • Visa: EB-2 NIW • Framework: Matter of Dhanasar • Firmada por tercero
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
                {['en','es'].map(lang => (
                  <button key={lang} onClick={() => setCurrentLanguage(lang)}
                    style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: currentLanguage === lang ? '#0369A1' : 'transparent', color: currentLanguage === lang ? 'white' : '#374151', transition: 'all 0.2s' }}>
                    {lang === 'en' ? '🇺🇸 English' : '🇪🇸 Español'}
                  </button>
                ))}
              </div>
              <Button onClick={handleDownload} data-testid="download-intent-letter-btn"
                style={{ background: '#0369A1', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} /> Descargar PDF ({currentLanguage.toUpperCase()})
              </Button>
              <Button variant="outline" onClick={() => setEditMode(!editMode)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={16} /> {editMode ? 'Cancelar edición' : 'Editar con IA'}
              </Button>
              {letterId && (
                <Button variant="outline" onClick={() => navigate(`/view-intent-letter/${letterId}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={16} /> Ver página completa
                </Button>
              )}
            </div>

            {editMode && (
              <Card>
                <CardHeader><CardTitle>✏️ Instrucciones de Edición</CardTitle></CardHeader>
                <CardContent>
                  <textarea value={editInstructions} onChange={e => setEditInstructions(e.target.value)}
                    placeholder="Ej: Amplía la sección de Importancia Nacional con más datos de BLS. Agrega más métricas en el Prong 2. Fortalece el argumento del Prong 3..."
                    style={{ width: '100%', minHeight: '100px', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }} />
                  <Button onClick={handleEdit} disabled={generating} style={{ marginTop: '0.75rem', background: '#7c3aed', color: 'white' }}>
                    {generating ? <><Loader2 className="animate-spin mr-2" size={16} />Editando...</> : 'Aplicar edición'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: '#0369A1' }} />
                  Carta de Intención — {currentLanguage === 'es' ? 'Español' : 'English'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem', maxHeight: '600px', overflowY: 'auto', fontFamily: 'Georgia, serif', fontSize: '0.95rem', lineHeight: 1.8, color: '#1f2937' }}
                  dangerouslySetInnerHTML={{ __html: letterContent }} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

// ==========================================
// VIEW INTENT LETTER COMPONENT
// ==========================================
const ViewIntentLetter = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => { loadLetter(); }, [id]);

  const loadLetter = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/intent-letters/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setLetter(response.data);
      setCurrentLanguage('en');
    } catch (error) {
      toast.error('Error al cargar la carta');
    } finally { setLoading(false); }
  };

  const handleDownload = async (lang) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/intent-letters/${id}/download?language=${lang}`,
        { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `carta_intencion_${lang.toUpperCase()}_${id.substring(0,8)}.pdf`);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast.success(`✅ PDF descargado en ${lang === 'es' ? 'español' : 'inglés'}`);
    } catch (error) { toast.error('Error al descargar la carta'); }
  };

  const handleEdit = async () => {
    if (!editInstructions.trim()) { toast.error('Ingresa instrucciones de edición'); return; }
    setEditing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/intent-letters/${id}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setLetter({ ...letter, content_en: response.data.content, content_es: null });
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) { toast.error('Error al editar la carta');
    } finally { setEditing(false); }
  };

  const letterContent = letter ? (currentLanguage === 'es' ? (letter.content_es || letter.content_en) : letter.content_en) : '';

  if (loading) return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
      <Loader2 className="animate-spin" size={48} style={{ color: '#0369A1' }} />
    </div>
  );

  if (!letter) return (
    <div className="dashboard-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Carta no encontrada</p>
      <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>Volver</Button>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => letter.client_id ? navigate(`/client-documents/${letter.client_id}/intentletter`) : navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} /> Volver
          </Button>
          <div>
            <h1 className="app-title">📝 Carta de Intención</h1>
            <p className="app-subtitle">{letter.petitioner_name || 'Peticionario'} • EB-2 NIW Personal Statement</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <CardContent style={{ paddingTop: '1.2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Peticionario:</strong> {letter.petitioner_name || 'N/A'}<br/><strong>Campo:</strong> {letter.petitioner_field || 'N/A'}</div>
                <div><strong>Proyecto:</strong> {letter.project_title || 'N/A'}<br/><strong>Visa:</strong> {letter.visa_type || 'EB-2 NIW'}</div>
                <div><strong>Framework:</strong> Matter of Dhanasar<br/><strong>Creada:</strong> {new Date(letter.created_at).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
              {['en','es'].map(lang => (
                <button key={lang} onClick={() => setCurrentLanguage(lang)}
                  style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: currentLanguage === lang ? '#0369A1' : 'transparent', color: currentLanguage === lang ? 'white' : '#374151', transition: 'all 0.2s' }}>
                  {lang === 'en' ? '🇺🇸 English' : '🇪🇸 Español'}
                </button>
              ))}
            </div>
            <Button onClick={() => handleDownload(currentLanguage)} data-testid="download-btn"
              style={{ background: '#0369A1', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={16} /> Descargar PDF ({currentLanguage.toUpperCase()})
            </Button>
            <WordDownloadButton
              url={`${API}/intent-letters/${id}/download-docx`}
              testId="download-word-en-intent"
            />
            <Button variant="outline" onClick={() => setEditMode(!editMode)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit size={16} /> {editMode ? 'Cancelar' : 'Editar con IA'}
            </Button>
          </div>

          {editMode && (
            <Card>
              <CardHeader><CardTitle>✏️ Editar con IA</CardTitle></CardHeader>
              <CardContent>
                <textarea value={editInstructions} onChange={e => setEditInstructions(e.target.value)}
                  placeholder="Ej: Agrega más evidencia cuantitativa en el Prong 2. Fortalece la sección de Importancia Nacional con datos del HHS..."
                  style={{ width: '100%', minHeight: '100px', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }} />
                <Button onClick={handleEdit} disabled={editing} style={{ marginTop: '0.75rem', background: '#7c3aed', color: 'white' }}>
                  {editing ? <><Loader2 className="animate-spin mr-2" size={16} />Editando...</> : 'Aplicar edición'}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} style={{ color: '#0369A1' }} />
                Personal Statement — {currentLanguage === 'es' ? 'Español' : 'English'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem', maxHeight: '700px', overflowY: 'auto', fontFamily: 'Georgia, serif', fontSize: '0.95rem', lineHeight: 1.8, color: '#1f2937' }}
                dangerouslySetInnerHTML={{ __html: letterContent }} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// ==========================================
// CREATE EXPERT LETTER COMPONENT
// ==========================================
const CreateExpertLetter = () => {
  // File states for 3 mandatory uploads
  const [clientCV, setClientCV] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [expertCV, setExpertCV] = useState(null);
  
  const [generating, setGenerating] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterContentEn, setLetterContentEn] = useState('');
  const [letterContentEs, setLetterContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterId, setLetterId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [step, setStep] = useState('upload'); // upload, generating, generated
  const [extractedData, setExtractedData] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(5);
  const [progressMessage, setProgressMessage] = useState('Iniciando generación...');
  const pollRef = React.useRef(null);

  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const clientId = new URLSearchParams(window.location.search).get('client_id');

  // Polling: check progress while generating
  React.useEffect(() => {
    if (step === 'generating' && letterId) {
      const token = localStorage.getItem('token');
      pollRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/expert-letters/${letterId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = res.data;
          setGenerationProgress(data.progress_percentage || 5);
          setProgressMessage(data.progress_message || 'Procesando...');
          if (data.status === 'completed') {
            clearInterval(pollRef.current);
            setStep('generated');
            setLetterContentEn(data.content_en || '');
            setLetterContentEs(data.content_es || '');
            setLetterContent(data.content_en || '');
            toast.success('Carta de experto generada exitosamente en inglés y español');
          } else if (data.status === 'error') {
            clearInterval(pollRef.current);
            setGenerating(false);
            setStep('upload');
            toast.error(data.error_message || 'Error al generar la carta');
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 4000);
      return () => clearInterval(pollRef.current);
    }
  }, [step, letterId]);

  const handleFileUpload = (fileType, file) => {
    if (!file) return;
    
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExt)) {
      toast.error('Formato no válido. Solo PDF, DOC, DOCX o TXT');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 10MB');
      return;
    }
    
    if (fileType === 'client_cv') {
      setClientCV(file);
      toast.success(`✅ CV del Cliente: ${file.name}`);
    } else if (fileType === 'project_info') {
      setProjectInfo(file);
      toast.success(`✅ Información del Proyecto: ${file.name}`);
    } else if (fileType === 'expert_cv') {
      setExpertCV(file);
      toast.success(`✅ CV del Experto: ${file.name}`);
    }
  };

  const handleGenerateLetter = async () => {
    if (!clientCV || !projectInfo || !expertCV) {
      toast.error('Los 3 archivos son obligatorios para generar la carta');
      return;
    }

    setGenerating(true);
    setStep('generating');
    setGenerationProgress(5);
    setProgressMessage('Enviando documentos al servidor...');

    try {
      const formData = new FormData();
      formData.append('client_cv', clientCV);
      formData.append('project_info', projectInfo);
      formData.append('expert_cv', expertCV);
      if (clientId) formData.append('client_id', clientId);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/expert-letters/generate`,
        formData,
        {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );
      if (response.data?.letter_id) {
        setLetterId(response.data.letter_id);
        setGenerationProgress(10);
        setProgressMessage('Analizando documentos con IA...');
        // Polling starts via useEffect when letterId + step='generating' are set
      }
    } catch (error) {
      console.error('Error al iniciar generación:', error);
      setGenerating(false);
      setStep('upload');
      toast.error(error.response?.data?.detail || 'Error al iniciar la generación');
    }
  };

  const handleSwitchLanguage = (lang) => {
    if (lang === 'en') {
      setCurrentLanguage('en');
      setLetterContent(letterContentEn);
    } else if (lang === 'es') {
      setCurrentLanguage('es');
      setLetterContent(letterContentEs);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/expert-letters/${letterId}/download?language=en`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const contentDisposition = response.headers['content-disposition'];
      let filename = `Carta_Experto_EN.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast.success(`✅ PDF descargado en inglés: ${filename}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  const handleDownloadSpanish = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const downloadUrl = `${API}/expert-letters/${letterId}/download?language=es`;
      
      // Crear un elemento a de forma diferente usando innerHTML
      const container = window.document.body;
      const tempDiv = window.document.createElement('div');
      tempDiv.innerHTML = '<a id="temp-download-link-expert-es" style="display:none"></a>';
      container.appendChild(tempDiv);
      
      const link = window.document.getElementById('temp-download-link-expert-es');
      
      // Fetch el blob
      const response = await axios.get(downloadUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Carta_Experto_ES.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].trim();
        }
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      link.click();
      
      // Cleanup
      setTimeout(() => {
        container.removeChild(tempDiv);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success(`✅ PDF descargado en español: ${filename}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  const handleEditLetter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor ingresa instrucciones de edición');
      return;
    }

    setGenerating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/expert-letters/${letterId}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setLetterContent(response.data.content);
      setLetterContentEn(response.data.content);
      setLetterContentEs(null);
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) {
      console.error('Error editing letter:', error);
      toast.error(error.response?.data?.detail || 'Error al editar la carta');
    } finally {
      setGenerating(false);
    }
  };

  const FileUploadCard = ({ title, description, fileType, currentFile, icon, color }) => {
    return (
      <Card style={{ border: `2px solid ${currentFile ? '#10b981' : '#e5e7eb'}` }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            {icon}
            {title}
            {currentFile && <CheckCircle size={20} style={{ color: '#10b981', marginLeft: 'auto' }} />}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentFile ? (
            <div style={{ 
              padding: '1rem',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #86efac'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: '#16a34a' }} />
                  <div>
                    <p style={{ fontWeight: '600', color: '#166534', margin: 0 }}>{currentFile.name}</p>
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                      {(currentFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (fileType === 'client_cv') setClientCV(null);
                    else if (fileType === 'project_info') setProjectInfo(null);
                    else if (fileType === 'expert_cv') setExpertCV(null);
                    toast.info('Archivo eliminado');
                  }}
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '12px', 
              padding: '2rem', 
              textAlign: 'center',
              background: '#f9fafb'
            }}>
              <Upload size={40} style={{ margin: '0 auto 1rem', color: color }} />
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                PDF, DOC, DOCX o TXT (máx. 10MB)
              </p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileUpload(fileType, e.target.files[0])}
                style={{ display: 'none' }}
                id={`file-${fileType}`}
              />
              <button
                type="button"
                onClick={() => document.getElementById(`file-${fileType}`).click()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Upload size={16} />
                Seleccionar Archivo
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">🏆 Carta de Experto</h1>
            <p className="app-subtitle">
              Cartas profesionales de opinión experta
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        {step === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', textAlign: 'center', padding: '3rem 0' }}>
            <Card style={{ maxWidth: '640px', width: '100%' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem', color: '#8b5cf6' }}>
                  Generando Carta de Experto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                  <Loader2 size={48} style={{ color: '#8b5cf6', animation: 'spin 1.5s linear infinite' }} />

                  {/* Porcentaje */}
                  <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#8b5cf6' }}>
                    {generationProgress}%
                  </div>

                  {/* Mensaje de paso actual */}
                  <p style={{ fontSize: '1rem', color: '#374151', fontWeight: '500', margin: 0 }}>
                    {progressMessage}
                  </p>

                  {/* Barra de progreso */}
                  <div style={{ width: '100%', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${generationProgress}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #F8BF13)',
                      borderRadius: '999px',
                      transition: 'width 0.8s ease-in-out'
                    }} />
                  </div>

                  {/* Pasos */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                    {[
                      { label: 'Extracción de texto de documentos', threshold: 15 },
                      { label: 'Análisis con IA (cliente, proyecto, experto)', threshold: 40 },
                      { label: 'Redacción de carta en inglés', threshold: 75 },
                      { label: 'Traducción al español', threshold: 95 },
                      { label: 'Guardando en el sistema', threshold: 100 },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: generationProgress >= s.threshold ? '#166534' : generationProgress >= s.threshold - 30 ? '#92400e' : '#9ca3af' }}>
                        <span style={{ fontSize: '1rem' }}>
                          {generationProgress >= s.threshold ? '✓' : generationProgress >= s.threshold - 30 ? '◉' : '○'}
                        </span>
                        {s.label}
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
                    Este proceso puede tomar 2-4 minutos. No cierres esta página.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step !== 'generating' && step === 'upload' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardHeader>
                <CardTitle style={{ fontSize: '1.5rem' }}>
                  📋 Instrucciones: 3 Archivos Obligatorios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      1️⃣ CV del Cliente
                    </h3>
                    <p style={{ opacity: 0.95, margin: 0 }}>
                      Currículum vitae completo del cliente
                    </p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      2️⃣ Información del Proyecto
                    </h3>
                    <p style={{ opacity: 0.95, margin: 0 }}>
                      Descripción detallada del proyecto o trabajo
                    </p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      3️⃣ CV del Experto
                    </h3>
                    <p style={{ opacity: 0.95, margin: 0 }}>
                      CV del experto que firma la opinión
                    </p>
                  </div>
                </div>
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}>
                  <strong>📄 Nota:</strong> La carta se generará automáticamente en <strong>inglés</strong> y se traducirá a <strong>español</strong>. Ambas versiones estarán disponibles para descarga.
                </div>
              </CardContent>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              <FileUploadCard
                title="CV del Cliente"
                description="Sube el currículum vitae del cliente"
                fileType="client_cv"
                currentFile={clientCV}
                icon="👤"
                color="#667eea"
              />
              <FileUploadCard
                title="Información del Proyecto"
                description="Documento con detalles del proyecto"
                fileType="project_info"
                currentFile={projectInfo}
                icon="📊"
                color="#f5576c"
              />
              <FileUploadCard
                title="CV del Experto"
                description="Currículum del experto que firma"
                fileType="expert_cv"
                currentFile={expertCV}
                icon="🏆"
                color="#00f2fe"
              />
            </div>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Button
                onClick={handleGenerateLetter}
                disabled={!clientCV || !projectInfo || !expertCV || generating}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  background: (!clientCV || !projectInfo || !expertCV) 
                    ? '#d1d5db' 
                    : 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
                  color: 'white',
                  border: 'none',
                  minWidth: '300px'
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={20} />
                    Generando Carta (30-60 segundos)...
                  </>
                ) : (
                  <>
                    <Send className="mr-2" size={20} />
                    Generar Carta de Experto
                  </>
                )}
              </Button>
              {(!clientCV || !projectInfo || !expertCV) && (
                <p style={{ color: '#6b7280', marginTop: '1rem', fontSize: '0.95rem' }}>
                  ⚠️ Debes subir los 3 archivos antes de generar
                </p>
              )}
            </div>
          </div>
        ) : step === 'generated' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {extractedData && (
              <Card style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#166534' }}>✅ Documentos Procesados Exitosamente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <strong>Cliente:</strong> {extractedData.client_name}<br/>
                      <strong>Campo:</strong> {extractedData.client_field}
                    </div>
                    <div>
                      <strong>Proyecto:</strong> {extractedData.project_title || 'N/A'}<br/>
                      <strong>Experto:</strong> {extractedData.expert_name}
                    </div>
                    <div>
                      <strong>Organización:</strong> {extractedData.expert_organization}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                background: '#f3f4f6', 
                padding: '0.25rem', 
                borderRadius: '8px',
                marginRight: 'auto'
              }}>
                <Button 
                  variant={currentLanguage === 'en' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSwitchLanguage('en')}
                  style={{ 
                    background: currentLanguage === 'en' ? '#2563eb' : 'transparent',
                    color: currentLanguage === 'en' ? 'white' : '#374151'
                  }}
                >
                  🇺🇸 English
                </Button>
                <Button 
                  variant={currentLanguage === 'es' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSwitchLanguage('es')}
                  style={{ 
                    background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                    color: currentLanguage === 'es' ? 'white' : '#374151'
                  }}
                >
                  🇪🇸 Español
                </Button>
              </div>

              <Button 
                onClick={() => handleDownload()}
                variant="outline"
                style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
              >
                <Download className="mr-2" size={16} />
                PDF (English)
              </Button>
              
              <Button 
                onClick={() => handleDownloadSpanish()}
                variant="outline"
                style={{ borderColor: '#10b981', color: '#10b981' }}
              >
                <Download className="mr-2" size={16} />
                PDF (Español)
              </Button>

              <Button variant="outline" onClick={() => setEditMode(!editMode)}>
                <Edit className="mr-2" size={16} />
                Editar Carta
              </Button>
              <Button variant="outline" onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const response = await axios.get(`${API}/clients`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const clients = response.data.clients || [];
                  if (clients.length > 0) {
                    navigate(`/client-documents/${clients[0].id}/expert`);
                  } else {
                    navigate('/dashboard');
                  }
                } catch (error) {
                  navigate('/dashboard');
                }
              }}>
                <FileText className="mr-2" size={16} />
                Volver a Cartas
              </Button>
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setLetterContent('');
                setLetterContentEn('');
                setLetterContentEs('');
                setLetterId(null);
                setCurrentLanguage('en');
                setClientCV(null);
                setProjectInfo(null);
                setExpertCV(null);
                setExtractedData(null);
              }}>
                <Plus className="mr-2" size={16} />
                Nueva Carta
              </Button>
            </div>

            {editMode && (
              <Card>
                <CardHeader>
                  <CardTitle>Editar Carta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder="Describe los cambios que quieres hacer a la carta..."
                      rows={4}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button onClick={handleEditLetter} disabled={generating}>
                        {generating ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={16} />
                            Editando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2" size={16} />
                            Aplicar Cambios
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setEditMode(false);
                        setEditInstructions('');
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Carta Generada ({currentLanguage === 'en' ? 'Inglés' : 'Español'})</CardTitle>
                <CardDescription>
                  Carta profesional de opinión experta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ 
                  lineHeight: '1.8',
                  fontFamily: 'Georgia, serif',
                  fontSize: '1rem',
                  padding: '2rem',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  maxHeight: '800px',
                  overflowY: 'auto'
                }}>
                  <div
                    className="letter-html-preview"
                    dangerouslySetInnerHTML={{ __html: renderLetterHTML(letterContent) }}
                    style={{ textAlign: "justify", lineHeight: "1.8", fontFamily: "Georgia, serif", fontSize: "1rem" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
};


// ==========================================
// VIEW SELF-PETITION LETTER COMPONENT  
// ==========================================
const ViewSelfPetitionLetter = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    loadLetter();
  }, [id]);

  const loadLetter = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/self-petition-letters/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setLetter(response.data);
      setCurrentLanguage(response.data.current_language || 'en');
      setEditedContent(response.data.content_en || '');
    } catch (error) {
      console.error('Error loading letter:', error);
      toast.error('Error al cargar la carta');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/self-petition-letters/${id}`,
        { 
          content_en: editedContent,
          current_language: currentLanguage 
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setLetter({ ...letter, content_en: editedContent });
      setIsEditing(false);
      toast.success('✅ Carta actualizada correctamente');
    } catch (error) {
      console.error('Error saving letter:', error);
      toast.error('Error al guardar los cambios');
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(letter.content_en);
    setIsEditing(false);
  };

  const handleDownload = async (language) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/self-petition-letters/${id}/download?language=${language}`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Self_Petition_Letter_${language.toUpperCase()}.pdf`; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      const langText = language === 'es' ? 'español' : 'inglés';
      toast.success(`✅ PDF descargado en ${langText}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };

  const handleGoBack = () => {
    // Navigate back to the correct client's document list
    if (letter && letter.client_id) {
      navigate(`/client-documents/${letter.client_id}/selfpetition`);
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Loader2 className="animate-spin" size={48} />
        </div>
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="dashboard-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Carta no encontrada</p>
          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Clean markdown markers from content
  const cleanContent = (text) => {
    if (!text) return '';
    // Remove markdown code block markers
    let cleaned = text.replace(/^\*\*markdown\s*/i, '').replace(/^```markdown\s*/i, '').replace(/```\s*$/,'').replace(/^```html\s*/i, '').replace(/^```\s*/i, '');
    // Remove HTML wrapper tags if present
    cleaned = cleaned.replace(/^<\?xml[^>]*\?>/i, '');
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/i, '');
    cleaned = cleaned.replace(/<html[^>]*>/i, '');
    cleaned = cleaned.replace(/<\/html>/i, '');
    cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/i, '');
    cleaned = cleaned.replace(/<body[^>]*>/i, '');
    cleaned = cleaned.replace(/<\/body>/i, '');
    return cleaned.trim();
  };

  // Check if content is HTML (contains HTML tags)
  const isHtmlContent = (text) => {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
  };

  const content = currentLanguage === 'es' ? (letter.content_es || letter.content_en) : letter.content_en;
  const displayContent = cleanContent(isEditing ? editedContent : content);
  const contentIsHtml = isHtmlContent(displayContent);
  
  // Get the name - V2 uses applicant_name, V1 uses beneficiary_name
  const displayName = letter.applicant_name || letter.beneficiary_name || 'Solicitante';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={handleGoBack} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver a Mis Cartas
          </Button>
          <div>
            <h1 className="app-title">📄 Carta de Autopetición EB-2 NIW</h1>
            <p className="app-subtitle">
              Beneficiario: {displayName} | {letter.document_count || letter.total_documents || 0} documento(s)
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Card>
          <CardHeader>
            <CardTitle>Carta Generada</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant={currentLanguage === 'en' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentLanguage('en')}
                >
                  🇺🇸 English
                </Button>
                <Button
                  variant={currentLanguage === 'es' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentLanguage('es')}
                >
                  🇪🇸 Español
                </Button>
              </div>

              {!isEditing ? (
                <>
                  <Button 
                    onClick={() => {
                      setEditedContent(content);
                      setIsEditing(true);
                    }}
                    variant="outline"
                    style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                  >
                    <Edit className="mr-2" size={16} />
                    Editar Carta
                  </Button>
                  
                  <Button 
                    onClick={() => handleDownload('en')}
                    variant="outline"
                    style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (English)
                  </Button>
                  
                  <Button 
                    onClick={() => handleDownload('es')}
                    variant="outline"
                    style={{ borderColor: '#10b981', color: '#10b981' }}
                  >
                    <Download className="mr-2" size={16} />
                    PDF (Español)
                  </Button>

                  <WordDownloadButton
                    url={`${API}/self-petition-letters/${id}/download-docx`}
                    testId="download-word-en-selfpetition"
                  />
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleSaveEdit}
                    style={{ background: '#10b981', color: 'white' }}
                  >
                    <Save className="mr-2" size={16} />
                    Guardar Cambios
                  </Button>
                  
                  <Button 
                    onClick={handleCancelEdit}
                    variant="outline"
                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                  >
                    <X className="mr-2" size={16} />
                    Cancelar
                  </Button>
                </>
              )}
            </div>

            {isEditing ? (
              <div>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '600px',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  placeholder="Edita el contenido de la carta aquí..."
                />
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  💡 Puedes usar formato Markdown: **negrita**, *cursiva*, # Títulos, etc.
                </p>
              </div>
            ) : (
              <div style={{ 
                background: '#ffffff', 
                padding: '2.5rem', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                maxHeight: '700px',
                overflowY: 'auto',
                fontSize: '11pt',
                lineHeight: '1.7',
                fontFamily: 'Georgia, "Times New Roman", serif'
              }}>
                {contentIsHtml ? (
                  <div 
                    className="prose prose-sm max-w-none letter-content"
                    style={{
                      '--tw-prose-headings': '#1a1a1a',
                      '--tw-prose-body': '#374151'
                    }}
                    dangerouslySetInnerHTML={{ __html: displayContent }}
                  />
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayContent}
                  </ReactMarkdown>
                )}
              </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                <strong>Creada:</strong> {new Date(letter.created_at).toLocaleString('es')}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// ==========================================
// VIEW EXPERT LETTER COMPONENT  
// ==========================================
const ViewExpertLetter = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterContent, setLetterContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [editing, setEditing] = useState(false);
  
  useEffect(() => {
    loadLetter();
  }, [id]);
  
  const loadLetter = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/expert-letters/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setLetter(response.data);
      setLetterContent(response.data.content_en);
      setCurrentLanguage('en');
      setLoading(false);
    } catch (error) {
      console.error('Error loading letter:', error);
      toast.error('Error al cargar la carta');
      setLoading(false);
    }
  };
  
  const handleSwitchLanguage = (lang) => {
    if (lang === 'en') {
      setCurrentLanguage('en');
      setLetterContent(letter.content_en);
    } else if (lang === 'es') {
      setCurrentLanguage('es');
      setLetterContent(letter.content_es || letter.content_en);
    }
  };
  
  const handleDownload = async (language) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/expert-letters/${id}/download?language=${language}`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Carta_Experto_${language.toUpperCase()}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      toast.success(`✅ PDF descargado: ${filename}`);
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Error al descargar la carta');
    }
  };
  
  const handleEdit = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor ingresa instrucciones de edición');
      return;
    }
    
    setEditing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/expert-letters/${id}/edit`,
        { instructions: editInstructions },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setLetter({
        ...letter,
        content_en: response.data.content,
        content_es: null
      });
      setLetterContent(response.data.content);
      setCurrentLanguage('en');
      setEditMode(false);
      setEditInstructions('');
      toast.success('Carta editada exitosamente');
    } catch (error) {
      console.error('Error editing letter:', error);
      toast.error('Error al editar la carta');
    } finally {
      setEditing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Loader2 className="animate-spin" size={48} />
        </div>
      </div>
    );
  }
  
  if (!letter) {
    return (
      <div className="dashboard-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Carta no encontrada</p>
          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleGoBack = () => {
    // Si la carta tiene client_id, volver a la lista de cartas de experto del cliente
    if (letter && letter.client_id) {
      navigate(`/client-documents/${letter.client_id}/expert`);
    } else {
      navigate(-1);
    }
  };
  
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={handleGoBack} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver al Cliente
          </Button>
          <div>
            <h1 className="app-title">🏆 Carta de Experto</h1>
            <p className="app-subtitle">
              {letter.client_name} • Firmada por {letter.expert_name}
            </p>
          </div>
        </div>
      </header>
      
      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <Card style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <CardHeader>
              <CardTitle style={{ color: '#166534' }}>📋 Información de la Carta</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <strong>Cliente:</strong> {letter.client_name}<br/>
                  <strong>Campo:</strong> {letter.client_field || 'N/A'}
                </div>
                <div>
                  <strong>Experto:</strong> {letter.expert_name}<br/>
                  <strong>Organización:</strong> {letter.expert_organization || 'N/A'}
                </div>
                <div>
                  <strong>Proyecto:</strong> {letter.project_title || 'N/A'}<br/>
                  <strong>Creada:</strong> {new Date(letter.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              background: '#f3f4f6', 
              padding: '0.25rem', 
              borderRadius: '8px',
              marginRight: 'auto'
            }}>
              <Button 
                variant={currentLanguage === 'en' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSwitchLanguage('en')}
                style={{ 
                  background: currentLanguage === 'en' ? '#2563eb' : 'transparent',
                  color: currentLanguage === 'en' ? 'white' : '#374151'
                }}
              >
                🇺🇸 English
              </Button>
              <Button 
                variant={currentLanguage === 'es' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSwitchLanguage('es')}
                style={{ 
                  background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                  color: currentLanguage === 'es' ? 'white' : '#374151'
                }}
              >
                🇪🇸 Español
              </Button>
            </div>

            <Button 
              onClick={() => handleDownload('en')}
              variant="outline"
              style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
            >
              <Download className="mr-2" size={16} />
              PDF (English)
            </Button>
            
            <Button 
              onClick={() => handleDownload('es')}
              variant="outline"
              style={{ borderColor: '#10b981', color: '#10b981' }}
            >
              <Download className="mr-2" size={16} />
              PDF (Español)
            </Button>
            
            <WordDownloadButton
              url={`${API}/expert-letters/${id}/download-docx`}
              testId="download-word-en-expert"
            />

            <Button variant="outline" onClick={() => setEditMode(!editMode)}>
              <Edit className="mr-2" size={16} />
              Editar Carta
            </Button>
          </div>

          {editMode && (
            <Card>
              <CardHeader>
                <CardTitle>Editar Carta</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="Describe los cambios que quieres hacer a la carta..."
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button onClick={handleEdit} disabled={editing}>
                      {editing ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          Editando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2" size={16} />
                          Aplicar Cambios
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Carta Generada ({currentLanguage === 'en' ? 'Inglés' : 'Español'})</CardTitle>
              <CardDescription>
                Carta profesional de opinión experta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ 
                lineHeight: '1.8',
                fontFamily: 'Georgia, serif',
                fontSize: '1rem',
                padding: '2rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                maxHeight: '800px',
                overflowY: 'auto'
              }}>
                <div
                  className="letter-html-preview"
                  dangerouslySetInnerHTML={{ __html: renderLetterHTML(letterContent) }}
                  style={{ textAlign: "justify", lineHeight: "1.8", fontFamily: "Georgia, serif", fontSize: "1rem" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};






// ============================================================================


// ============================================================================
// TRASH/RECYCLE BIN COMPONENT - Papelera de Documentos
// ============================================================================

const TrashBin = () => {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clientId } = useParams();

  useEffect(() => {
    loadTrashItems();
  }, [clientId]);

  const loadTrashItems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = clientId ? `${API}/trash?client_id=${clientId}` : `${API}/trash`;
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTrashItems(response.data.items);
      setSelectedItems(new Set()); // Clear selection when reloading
    } catch (error) {
      console.error('Error loading trash:', error);
      toast.error('Error al cargar la papelera');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/trash/${item.collection}/${item.id}/restore`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      toast.success('Documento restaurado exitosamente');
      loadTrashItems();
    } catch (error) {
      console.error('Error restoring document:', error);
      toast.error(error.response?.data?.detail || 'Error al restaurar documento');
    }
  };

  const handlePermanentDelete = async (item) => {
    if (!window.confirm('¿Estás seguro? Esta acción NO se puede deshacer.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/trash/${item.collection}/${item.id}/permanent`,
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      toast.success('Documento eliminado permanentemente');
      loadTrashItems();
    } catch (error) {
      console.error('Error permanently deleting:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar documento');
    }
  };

  const toggleSelectItem = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(trashItems.map(item => item.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar permanentemente ${selectedItems.size} documento(s)? Esta acción NO se puede deshacer.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const deletePromises = Array.from(selectedItems).map(itemId => {
        const item = trashItems.find(t => t.id === itemId);
        return axios.delete(
          `${API}/trash/${item.collection}/${item.id}/permanent`,
          { headers: { 'Authorization': `Bearer ${token}` }}
        );
      });

      await Promise.all(deletePromises);
      toast.success(`${selectedItems.size} documento(s) eliminado(s) permanentemente`);
      loadTrashItems();
      setIsSelectMode(false);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Error al eliminar algunos documentos');
      loadTrashItems(); // Reload to see which ones failed
    }
  };

  const handleEmptyTrash = async () => {
    if (trashItems.length === 0) {
      return;
    }

    if (!window.confirm(`¿Estás seguro de vaciar toda la papelera? Se eliminarán permanentemente ${trashItems.length} documento(s). Esta acción NO se puede deshacer.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const deletePromises = trashItems.map(item => 
        axios.delete(
          `${API}/trash/${item.collection}/${item.id}/permanent`,
          { headers: { 'Authorization': `Bearer ${token}` }}
        )
      );

      await Promise.all(deletePromises);
      toast.success('Papelera vaciada exitosamente');
      loadTrashItems();
    } catch (error) {
      console.error('Error emptying trash:', error);
      toast.error('Error al vaciar la papelera');
      loadTrashItems(); // Reload to see current state
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Loader2 className="animate-spin" size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(clientId ? `/client-dashboard/${clientId}` : '/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            {clientId ? 'Volver al Cliente' : 'Volver al Dashboard'}
          </Button>
          <div>
            <h1 className="app-title">🗑️ Papelera</h1>
            <p className="app-subtitle">Documentos eliminados - Puedes restaurarlos</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        {trashItems.length === 0 ? (
          <Card>
            <CardContent style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗑️</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>La papelera está vacía</h3>
              <p style={{ color: '#64748b' }}>Los documentos eliminados aparecerán aquí</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {trashItems.length} documento{trashItems.length !== 1 ? 's' : ''} en papelera
              </h2>
              
              {user?.role === 'ADMIN' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!isSelectMode ? (
                    <>
                      <Button
                        onClick={() => setIsSelectMode(true)}
                        variant="outline"
                        style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Seleccionar Múltiples
                      </Button>
                      <Button
                        onClick={handleEmptyTrash}
                        variant="outline"
                        style={{ color: '#ef4444', borderColor: '#ef4444' }}
                      >
                        <Trash2 size={16} className="mr-2" />
                        Vaciar Papelera
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={selectAll}
                        size="sm"
                        variant="outline"
                      >
                        Seleccionar Todos
                      </Button>
                      <Button
                        onClick={deselectAll}
                        size="sm"
                        variant="outline"
                      >
                        Deseleccionar Todos
                      </Button>
                      <Button
                        onClick={handleBulkDelete}
                        size="sm"
                        disabled={selectedItems.size === 0}
                        style={{ 
                          background: selectedItems.size > 0 ? '#ef4444' : '#cbd5e1', 
                          color: 'white',
                          cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Trash2 size={16} className="mr-2" />
                        Eliminar Seleccionados ({selectedItems.size})
                      </Button>
                      <Button
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedItems(new Set());
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <X size={16} className="mr-2" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {trashItems.map((item) => (
                <Card 
                  key={item.id} 
                  style={{ 
                    border: selectedItems.has(item.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: selectedItems.has(item.id) ? '#eff6ff' : 'white',
                    cursor: isSelectMode ? 'pointer' : 'default'
                  }}
                  onClick={() => isSelectMode && toggleSelectItem(item.id)}
                >
                  <CardContent style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'start', gap: '1rem' }}>
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              cursor: 'pointer',
                              marginTop: '0.25rem'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: '#fef3c7',
                              color: '#92400e'
                            }}>
                              {item.document_type}
                            </span>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                              {item.title}
                            </h3>
                          </div>
                          
                          {item.client_name && (
                            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                              Cliente: {item.client_name}
                            </p>
                          )}
                          
                          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                            Eliminado: {new Date(item.deleted_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      {!isSelectMode && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Button
                            size="sm"
                            onClick={() => handleRestore(item)}
                            style={{ background: '#10b981', color: 'white' }}
                          >
                            <RefreshCw size={16} className="mr-2" />
                            Restaurar
                          </Button>
                          
                          {user?.role === 'ADMIN' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePermanentDelete(item)}
                              style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            >
                              <Trash2 size={16} className="mr-2" />
                              Eliminar Permanente
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};


// USER MANAGEMENT COMPONENT - Gestión de Usuarios (Solo ADMIN)
// ============================================================================

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const importFileRef = React.useRef(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'USER',
    language_preference: 'es'
  });
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFileSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const invalid = files.filter(f => !f.name.toLowerCase().endsWith('.json'));
    if (invalid.length) {
      toast.error(`Algunos archivos no son JSON: ${invalid.map(f => f.name).join(', ')}`);
      return;
    }
    setSelectedFiles(files);
    setShowImportConfirm(true);
    e.target.value = '';
  };

  const handleImportDatabase = async () => {
    if (!selectedFiles.length) return;
    setShowImportConfirm(false);
    setImportProgress({ current: 0, total: selectedFiles.length, currentName: '' });
    const token = localStorage.getItem('token');
    let totalUpserted = 0;
    let totalCollections = 0;
    let fileResults = [];
    let skippedSet = new Set();
    try {
      setIsImporting(true);
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setImportProgress({ current: i + 1, total: selectedFiles.length, currentName: file.name });
        const formPayload = new FormData();
        formPayload.append('file', file);
        const response = await axios.post(`${API}/admin/import-database`, formPayload, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          timeout: 1800000  // 30 min — bulk de archivos grandes (cientos de MB)
        });
        const result = response.data;
        totalUpserted += result.total_upserted || 0;
        totalCollections = Math.max(totalCollections, result.total_collections || 0);
        (result.skipped_collections || []).forEach(s => skippedSet.add(s.name));
        fileResults.push({ name: file.name, database: result.database_name, upserted: result.total_upserted, skipped: (result.skipped_collections || []).length });
      }
      setImportResult({ total_upserted: totalUpserted, total_collections: totalCollections, files: fileResults, skipped_collections: Array.from(skippedSet) });
      setSelectedFiles([]);
      toast.success(`${selectedFiles.length} archivo(s): ${totalUpserted} registros importados${skippedSet.size ? `, ${skippedSet.size} tabla(s) omitida(s)` : ''}.`);
      loadUsers();
    } catch (error) {
      console.error('Error importing database:', error);
      toast.error(error.response?.data?.detail || 'Error al importar la base de datos');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Verificar que el usuario es ADMIN
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      toast.error('Acceso denegado. Se requieren privilegios de administrador.');
      navigate('/');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/users`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Usuario creado exitosamente');
      setShowCreateModal(false);
      setFormData({ full_name: '', email: '', password: '', role: 'USER', language_preference: 'es' });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.response?.data?.detail || 'Error al crear usuario');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const updateData = {};
      
      // Solo enviar campos que cambiaron
      if (formData.full_name && formData.full_name !== selectedUser.full_name) {
        updateData.full_name = formData.full_name;
      }
      
      // Solo enviar email si cambió
      if (formData.email && formData.email !== selectedUser.email) {
        updateData.email = formData.email;
      }
      
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      // Siempre enviar rol ya que puede cambiar
      if (formData.role) {
        updateData.role = formData.role;
      }
      
      if (formData.language_preference && formData.language_preference !== selectedUser.language_preference) {
        updateData.language_preference = formData.language_preference;
      }

      await axios.put(`${API}/admin/users/${selectedUser.id}`, updateData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Usuario actualizado exitosamente');
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData({ full_name: '', email: '', password: '', role: 'USER', language_preference: 'es' });
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar usuario');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Usuario eliminado exitosamente');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      language_preference: user.language_preference
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Loader2 className="animate-spin" size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver al Dashboard
          </Button>
          <div>
            <h1 className="app-title">👥 Gestión de Usuarios</h1>
            <p className="app-subtitle">Administrar usuarios del sistema</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            Usuarios Registrados ({users.length})
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {user?.role?.toUpperCase() === 'ADMIN' && (
              <>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
                <Button
                  data-testid="import-database-btn"
                  onClick={() => importFileRef.current?.click()}
                  disabled={isImporting}
                  variant="outline"
                  style={{ borderColor: '#F8BF13', color: '#92400e', background: '#fffbeb' }}
                >
                  {isImporting ? (
                    <><Loader2 className="mr-2 animate-spin" size={18} />{importProgress ? `Importando ${importProgress.current}/${importProgress.total}...` : 'Importando...'}</>
                  ) : (
                    <><Upload className="mr-2" size={18} />Importar BD</>
                  )}
                </Button>
              </>
            )}
            <Button onClick={() => {
              setFormData({ full_name: '', email: '', password: '', role: 'USER', language_preference: 'es' });
              setShowCreateModal(true);
            }} style={{ background: '#8b5cf6', color: 'white' }}>
              <Plus className="mr-2" size={18} />
              Crear Usuario
            </Button>
          </div>
        </div>

        {/* Import Result Summary */}
        {importResult && (
          <div data-testid="import-result-summary" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #86efac' }}>
            <h3 style={{ fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
              Importación Completada
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.5rem' }}>
              {importResult.total_upserted} registros importados · {importResult.total_collections} colecciones procesadas
            </p>
            {importResult.files && importResult.files.length > 0 && (
              <ul style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                {importResult.files.map((f, i) => (
                  <li key={i}>
                    <strong>{f.name}</strong> ({f.database}) — {f.upserted} importados{f.skipped ? `, ${f.skipped} colección(es) omitida(s)` : ''}
                  </li>
                ))}
              </ul>
            )}
            {importResult.skipped_collections && importResult.skipped_collections.length > 0 && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '0.25rem', fontSize: '0.8rem', color: '#92400e' }}>
                <strong>Colecciones sin tabla destino en Supabase:</strong> {importResult.skipped_collections.join(', ')}
              </div>
            )}
            <button
              style={{ fontSize: '0.75rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
              onClick={() => setImportResult(null)}
            >
              Cerrar
            </button>
          </div>
        )}

        <Card>
          <CardContent style={{ padding: '0' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Nombre</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Email</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Rol</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Fecha de Registro</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem' }}>{u.full_name}</td>
                      <td style={{ padding: '1rem' }}>{u.email}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: u.role === 'ADMIN' ? '#8b5cf6' : '#3b82f6',
                          color: 'white'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {new Date(u.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(u)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ color: '#ef4444' }}
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={u.id === user?.id}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Import Confirmation Dialog */}
        <Dialog open={showImportConfirm} onOpenChange={(open) => { setShowImportConfirm(open); if (!open) setSelectedFiles([]); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Importación de Base de Datos</DialogTitle>
              <DialogDescription>
                {selectedFiles.length > 0 && (
                  <span>
                    <strong>{selectedFiles.length} archivo(s) seleccionado(s):</strong><br/>
                    {selectedFiles.map((f, i) => (
                      <span key={i} style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginTop: '0.25rem' }}>
                        • {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    ))}
                    <br/>
                  </span>
                )}
                Detecta automáticamente lo que haya en el archivo (usuarios, clientes, documentos, etc.). Los documentos existentes serán actualizados (upsert) y los nuevos serán insertados. Las contraseñas de usuarios existentes no se modificarán.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter style={{ marginTop: '1rem' }}>
              <Button variant="outline" onClick={() => { setShowImportConfirm(false); setSelectedFiles([]); }}>
                Cancelar
              </Button>
              <Button
                data-testid="confirm-import-btn"
                onClick={handleImportDatabase}
                style={{ background: '#F8BF13', color: '#111827', fontWeight: '600' }}
              >
                <Upload className="mr-2" size={16} />
                Sí, importar ahora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create User Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <Label>Nombre Completo *</Label>
                  <Input
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div>
                  <Label>Contraseña *</Label>
                  <Input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
                <div>
                  <Label>Rol *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER - Acceso completo a clientes</SelectItem>
                      <SelectItem value="OPERATOR">OPERATOR - Solo clientes asignados</SelectItem>
                      <SelectItem value="ADMIN">ADMIN - Administrador del sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select value={formData.language_preference} onValueChange={(value) => setFormData({ ...formData, language_preference: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter style={{ marginTop: '1.5rem' }}>
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" style={{ background: '#8b5cf6', color: 'white' }}>
                  Crear Usuario
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <Label>Nombre Completo</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>
                <div>
                  <Label>Nueva Contraseña</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="USER (recomendado)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER - Acceso completo a clientes</SelectItem>
                      <SelectItem value="OPERATOR">OPERATOR - Solo clientes asignados</SelectItem>
                      <SelectItem value="ADMIN">ADMIN - Administrador del sistema</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Por defecto: USER (recomendado para la mayoría de usuarios)</p>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select value={formData.language_preference} onValueChange={(value) => setFormData({ ...formData, language_preference: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter style={{ marginTop: '1.5rem' }}>
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" style={{ background: '#8b5cf6', color: 'white' }}>
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

// ============================================================
// TRANSLATION MODULE COMPONENTS
// ============================================================

// Translation Theme Styles
const translationTheme = {
  colors: {
    background: '#FDFCF8',
    primary: '#0F766E',
    primaryHover: '#0D5D58',
    textPrimary: '#1C1917',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    accent: '#FEF08A',
    border: '#E7E5E4',
    cardBg: '#FFFFFF',
  },
  fonts: {
    heading: "'Playfair Display', serif",
    body: "'Manrope', sans-serif",
    mono: "'JetBrains Mono', monospace",
  }
};

// TranslateModule - Main Translation Page
const TranslateModule = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [filename, setFilename] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef(null);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setText(response.data.content);
      setFilename(response.data.filename);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationStatus, setTranslationStatus] = useState('');

  const handleTranslate = async () => {
    if (!text.trim()) {
      alert('Please enter text to translate');
      return;
    }
    
    setIsTranslating(true);
    setTranslationProgress(0);
    setTranslationStatus('Iniciando traducción...');
    
    try {
      const token = localStorage.getItem('token');
      
      // For small documents, use sync endpoint
      if (text.length < 10000) {
        const response = await axios.post(`${API}/translate`, {
          text: text,
          filename: filename
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        navigate(`/translate/view/${response.data.id}`);
        return;
      }
      
      // For large documents, use async endpoint with polling
      setTranslationStatus('Documento grande detectado. Iniciando traducción asíncrona...');
      
      const startResponse = await axios.post(`${API}/translate-async`, {
        text: text,
        filename: filename
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const taskId = startResponse.data.task_id;
      setTranslationStatus(`Traduciendo... (${startResponse.data.word_count.toLocaleString()} palabras)`);
      
      // Poll for status
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes max (300 * 1s)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await axios.get(`${API}/translate-status/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const status = statusResponse.data;
        setTranslationProgress(status.progress || 0);
        
        if (status.status === 'processing') {
          setTranslationStatus(`Traduciendo fragmento ${status.current_chunk}/${status.total_chunks}...`);
        } else if (status.status === 'completed') {
          setTranslationStatus('¡Traducción completada!');
          navigate(`/translate/view/${status.result.id}`);
          return;
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Translation failed');
        }
        
        attempts++;
      }
      
      throw new Error('Translation timed out after 5 minutes');
      
    } catch (error) {
      console.error('Translation error:', error);
      alert('Translation failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsTranslating(false);
      setTranslationProgress(0);
      setTranslationStatus('');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ 
            fontFamily: translationTheme.fonts.heading, 
            fontSize: '1.5rem',
            color: translationTheme.colors.textPrimary,
            margin: 0
          }}>
            Translator
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button 
            variant="outline" 
            onClick={() => navigate('/translate/certified')}
            style={{ borderRadius: '9999px' }}
          >
            <Award size={18} className="mr-2" />
            Certified
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/translate/history')}
            style={{ borderRadius: '9999px' }}
          >
            <History size={18} className="mr-2" />
            History
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ 
            fontFamily: translationTheme.fonts.heading,
            fontSize: '2.5rem',
            color: translationTheme.colors.textPrimary,
            marginBottom: '1rem'
          }}>
            Translate with Precision
          </h2>
          <p style={{ 
            color: translationTheme.colors.textSecondary,
            fontSize: '1.1rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Professional Spanish to English translation that preserves every detail of your documents.
          </p>
        </div>

        {/* Drop Zone / Text Area */}
        <Card style={{ 
          background: 'white',
          border: `2px dashed ${isDragOver ? translationTheme.colors.primary : translationTheme.colors.border}`,
          borderRadius: '16px',
          transition: 'all 0.2s',
          marginBottom: '1.5rem'
        }}>
          <CardContent style={{ padding: '2rem' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem'
                }}>
                  <Loader2 
                    className="animate-spin" 
                    size={48} 
                    style={{ color: translationTheme.colors.primary, marginBottom: '1rem' }} 
                  />
                  <h3 style={{ 
                    fontFamily: translationTheme.fonts.heading,
                    fontSize: '1.25rem',
                    marginBottom: '0.5rem'
                  }}>
                    Cargando archivo...
                  </h3>
                  <p style={{ color: translationTheme.colors.textMuted }}>
                    Extrayendo texto del documento
                  </p>
                </div>
              ) : !text ? (
                <div 
                  style={{ 
                    textAlign: 'center', 
                    padding: '3rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={48} style={{ color: translationTheme.colors.primary, marginBottom: '1rem' }} />
                  <h3 style={{ 
                    fontFamily: translationTheme.fonts.heading,
                    fontSize: '1.25rem',
                    marginBottom: '0.5rem'
                  }}>
                    Drop your document here
                  </h3>
                  <p style={{ color: translationTheme.colors.textMuted, marginBottom: '1rem' }}>
                    Supports .txt, .md, .docx, .pdf, .jpg, .png files
                  </p>
                  <Button 
                    variant="outline" 
                    style={{ borderRadius: '9999px' }}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Browse Files
                  </Button>
                </div>
              ) : (
                <div>
                  {filename && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      padding: '0.5rem 1rem',
                      background: translationTheme.colors.accent,
                      borderRadius: '8px',
                      width: 'fit-content'
                    }}>
                      <FileText size={16} />
                      <span style={{ fontWeight: 500 }}>{filename}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setText(''); setFilename(null); }}
                        style={{ padding: '0.25rem' }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  )}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your Spanish text here..."
                    style={{
                      width: '100%',
                      minHeight: '300px',
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: translationTheme.fonts.mono,
                      fontSize: '0.95rem',
                      lineHeight: '1.6',
                      color: translationTheme.colors.textPrimary
                    }}
                  />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </CardContent>
        </Card>

        {/* Stats & Translate Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{ display: 'flex', gap: '2rem', color: translationTheme.colors.textMuted }}>
            <span>{charCount.toLocaleString()} characters</span>
            <span>{wordCount.toLocaleString()} words</span>
          </div>
          <Button
            onClick={handleTranslate}
            disabled={!text.trim() || isTranslating}
            style={{
              background: translationTheme.colors.primary,
              color: 'white',
              borderRadius: '9999px',
              padding: '0.75rem 2rem',
              fontSize: '1rem'
            }}
          >
            {isTranslating ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                {translationProgress > 0 ? `${translationProgress}%` : 'Translating...'}
              </>
            ) : (
              <>
                <Languages size={18} className="mr-2" />
                Translate to English
              </>
            )}
          </Button>
        </div>

        {/* Translation Progress */}
        {isTranslating && translationStatus && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '12px',
            border: `1px solid ${translationTheme.colors.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <Loader2 className="animate-spin" size={20} style={{ color: translationTheme.colors.primary }} />
              <span style={{ color: translationTheme.colors.textPrimary }}>{translationStatus}</span>
            </div>
            {translationProgress > 0 && (
              <div style={{
                width: '100%',
                height: '8px',
                background: translationTheme.colors.border,
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${translationProgress}%`,
                  height: '100%',
                  background: translationTheme.colors.primary,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '1.5rem',
          marginTop: '1.5rem'
        }}>
          {[
            { icon: Shield, title: 'Complete Preservation', desc: 'Every word, every detail preserved' },
            { icon: Columns, title: 'Side-by-Side View', desc: 'Compare original and translation' },
            { icon: History, title: 'Translation History', desc: 'Access all your translations' }
          ].map((feature, i) => (
            <div key={i} style={{ 
              textAlign: 'center',
              padding: '1.5rem',
              background: 'white',
              borderRadius: '12px',
              border: `1px solid ${translationTheme.colors.border}`
            }}>
              <feature.icon size={32} style={{ color: translationTheme.colors.primary, marginBottom: '0.75rem' }} />
              <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{feature.title}</h4>
              <p style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

// TranslationViewPage - Side by side view
const TranslationViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTranslation = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/translations/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setTranslation(response.data);
      } catch (error) {
        console.error('Error fetching translation:', error);
        alert('Translation not found');
        navigate('/translate/history');
      } finally {
        setLoading(false);
      }
    };
    fetchTranslation();
  }, [id, navigate]);

  const handleCopy = () => {
    if (translation?.translated_text) {
      navigator.clipboard.writeText(translation.translated_text);
      alert('Translation copied to clipboard!');
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/export/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Include client name in filename if available
      const clientPart = translation?.client_name ? `${translation.client_name}_` : '';
      link.setAttribute('download', `${clientPart}${translation?.filename || 'translation'}_translated.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: translationTheme.colors.background 
      }}>
        <Loader2 className="animate-spin" size={48} style={{ color: translationTheme.colors.primary }} />
      </div>
    );
  }

  const lengthRatio = translation?.char_count_original > 0 
    ? ((translation.char_count_translated / translation.char_count_original) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => {
            if (translation?.client_id) {
              navigate(`/client-documents/${translation.client_id}/translation`);
            } else {
              navigate('/translate/history');
            }
          }} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ 
            fontFamily: translationTheme.fonts.heading, 
            fontSize: '1.25rem',
            color: translationTheme.colors.textPrimary,
            margin: 0
          }}>
            {translation?.filename || 'Translation'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={() => navigate('/translate')} style={{ borderRadius: '9999px' }}>
            <Plus size={18} className="mr-2" />
            New
          </Button>
          <Button variant="outline" onClick={handleCopy} style={{ borderRadius: '9999px' }}>
            <Copy size={18} className="mr-2" />
            Copy
          </Button>
          <Button 
            onClick={handleExportPDF}
            style={{ 
              background: translationTheme.colors.primary, 
              color: 'white',
              borderRadius: '9999px'
            }}
          >
            <Download size={18} className="mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => navigate('/translate/history')} style={{ borderRadius: '9999px' }}>
            <History size={18} />
          </Button>
        </div>
      </header>

      {/* Stats Bar */}
      <div style={{ 
        background: 'white',
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '0.75rem 2rem',
        display: 'flex',
        gap: '2rem',
        fontSize: '0.875rem',
        color: translationTheme.colors.textSecondary
      }}>
        <span>📄 {translation?.filename || 'Direct Input'}</span>
        <span>📅 {new Date(translation?.created_at).toLocaleDateString()}</span>
        <span>📝 Original: {translation?.char_count_original?.toLocaleString()} chars / {translation?.word_count_original?.toLocaleString()} words</span>
        <span>🔄 Translated: {translation?.char_count_translated?.toLocaleString()} chars / {translation?.word_count_translated?.toLocaleString()} words</span>
        <span>📊 Length ratio: {lengthRatio}%</span>
      </div>

      {/* Split View Container with margins */}
      <div style={{ 
        flex: 1, 
        padding: '1.5rem 3rem',
        overflow: 'hidden'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          height: '100%',
          border: `1px solid ${translationTheme.colors.border}`,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'white',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Original Panel */}
          <div style={{ 
            borderRight: `1px solid ${translationTheme.colors.border}`,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              padding: '1rem 1.5rem',
              background: '#FEF3C7',
              borderBottom: `1px solid ${translationTheme.colors.border}`,
              fontWeight: 600,
              color: '#92400E'
            }}>
              ORIGINAL (SPANISH)
            </div>
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '2rem',
              fontFamily: translationTheme.fonts.mono,
              fontSize: '0.9rem',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              color: translationTheme.colors.textPrimary
            }}>
              {translation?.original_text}
            </div>
          </div>

          {/* Translated Panel */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '1rem 1.5rem',
              background: '#D1FAE5',
              borderBottom: `1px solid ${translationTheme.colors.border}`,
              fontWeight: 600,
              color: '#065F46'
            }}>
              TRANSLATION (ENGLISH)
            </div>
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '2rem',
              fontFamily: translationTheme.fonts.mono,
              fontSize: '0.9rem',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              color: translationTheme.colors.textPrimary
            }}>
              {translation?.translated_text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// TranslationHistoryModule
const TranslationHistoryModule = () => {
  const navigate = useNavigate();
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchTranslations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/translations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTranslations(response.data);
    } catch (error) {
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTranslations(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/translations/${deleteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTranslations(prev => prev.filter(t => t.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete translation');
    }
  };

  const handleExportPDF = async (id, filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/export/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename || 'translation'}_translated.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const filteredTranslations = translations.filter(t => 
    (t.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.original_preview || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate('/translate')} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ 
            fontFamily: translationTheme.fonts.heading, 
            fontSize: '1.5rem',
            color: translationTheme.colors.textPrimary,
            margin: 0
          }}>
            Translation History
          </h1>
        </div>
        <Button 
          onClick={() => navigate('/translate')}
          style={{ 
            background: translationTheme.colors.primary, 
            color: 'white',
            borderRadius: '9999px'
          }}
        >
          <Plus size={18} className="mr-2" />
          New Translation
        </Button>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {/* Search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Input
            placeholder="Search translations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={48} style={{ color: translationTheme.colors.primary }} />
          </div>
        ) : filteredTranslations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: translationTheme.colors.textMuted }}>
            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No translations found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredTranslations.map((t) => (
              <Card 
                key={t.id} 
                style={{ 
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s'
                }}
                onClick={() => navigate(`/translate/view/${t.id}`)}
              >
                <CardContent style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        fontWeight: 600, 
                        marginBottom: '0.5rem',
                        color: translationTheme.colors.textPrimary
                      }}>
                        {t.filename || 'Direct Input'}
                      </h3>
                      <p style={{ 
                        color: translationTheme.colors.textMuted, 
                        fontSize: '0.875rem',
                        marginBottom: '0.5rem'
                      }}>
                        {new Date(t.created_at).toLocaleDateString()} • {t.char_count_original?.toLocaleString()} chars
                      </p>
                      <p style={{ 
                        color: translationTheme.colors.textSecondary,
                        fontSize: '0.875rem',
                        marginBottom: '0.25rem'
                      }}>
                        <strong>ES:</strong> {t.original_preview}
                      </p>
                      <p style={{ 
                        color: translationTheme.colors.textSecondary,
                        fontSize: '0.875rem'
                      }}>
                        <strong>EN:</strong> {t.translated_preview}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleExportPDF(t.id, t.filename)}
                      >
                        <Download size={16} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDeleteId(t.id)}
                        style={{ color: '#EF4444', borderColor: '#EF4444' }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Translation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this translation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button 
              onClick={handleDelete}
              style={{ background: '#EF4444', color: 'white' }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// CertifiedTranslationModule
const CertifiedTranslationModule = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null); // null = new profile
  const [text, setText] = useState('');
  const [filename, setFilename] = useState(null);
  const [docDescription, setDocDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [certifications, setCertifications] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const fileInputRef = React.useRef(null);

  const emptyProfileForm = {
    full_name: '', id_number: '', title: 'Certified Translator',
    phone: '', email: '', certificate_prefix: 'TRAD'
  };
  const [profileForm, setProfileForm] = useState(emptyProfileForm);

  useEffect(() => {
    fetchProfiles();
    fetchCertifications();
  }, []);

  const fetchProfiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/translator/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      setProfiles(list);
      if (list.length > 0 && !selectedProfile) setSelectedProfile(list[0]);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchCertifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/certified/translations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCertifications(response.data);
    } catch (error) {
      console.error('Error fetching certifications:', error);
    }
  };

  const openNewProfileModal = () => {
    setEditingProfileId(null);
    setProfileForm(emptyProfileForm);
    setShowProfileModal(true);
  };

  const openEditProfileModal = (profile) => {
    setEditingProfileId(profile.id);
    setProfileForm({
      full_name: profile.full_name || '',
      id_number: profile.id_number || '',
      title: profile.title || 'Certified Translator',
      phone: profile.phone || '',
      email: profile.email || '',
      certificate_prefix: profile.certificate_prefix || 'TRAD',
      signature_image: profile.signature_image || ''
    });
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      let response;
      if (editingProfileId) {
        response = await axios.put(`${API}/translator/profile/${editingProfileId}`, profileForm, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        response = await axios.post(`${API}/translator/profile`, profileForm, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      setShowProfileModal(false);
      await fetchProfiles();
      if (!editingProfileId) setSelectedProfile(response.data);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    }
  };

  const deleteProfile = async (profileId) => {
    if (!window.confirm('¿Eliminar este perfil de traductor?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/translator/profile/${profileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchProfiles();
      if (selectedProfile?.id === profileId) setSelectedProfile(null);
    } catch (error) {
      alert('Error eliminando perfil');
    }
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setText(response.data.content);
      setFilename(response.data.filename);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    }
  };

  const handleCreateCertified = async () => {
    if (!selectedProfile) {
      alert('Please configure your translator profile first');
      openNewProfileModal();
      return;
    }
    if (!text.trim()) {
      alert('Please enter or upload document text');
      return;
    }

    setIsTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/certified/translate`, {
        original_text: text,
        filename: filename,
        document_description: docDescription || null,
        profile_id: selectedProfile.id
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Poll for completion (background task)
      const certId = response.data.id;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API}/certified/translations/${certId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (statusRes.data.status === 'completed') {
            clearInterval(pollInterval);
            setIsTranslating(false);
            navigate(`/translate/certified/view/${certId}`);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(pollInterval);
            setIsTranslating(false);
            alert('Translation failed: ' + (statusRes.data.error_message || 'Unknown error'));
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Certified translation error:', error);
      alert('Failed to create certified translation: ' + (error.response?.data?.detail || error.message));
      setIsTranslating(false);
    }
  };

  const handleDownloadCert = async (certId, certNumber, clientName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/certified/export/${certId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const clientPart = clientName ? `${clientName}_` : '';
      link.setAttribute('download', `${clientPart}${certNumber}_certified.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate('/translate')} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ 
            fontFamily: translationTheme.fonts.heading, 
            fontSize: '1.5rem',
            color: translationTheme.colors.textPrimary,
            margin: 0
          }}>
            Certified Translation
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="outline" onClick={() => navigate('/translate')} style={{ borderRadius: '9999px' }}>
            Normal Translation
          </Button>
          <Button variant="outline" onClick={() => navigate('/translate/certified/history')} style={{ borderRadius: '9999px' }}>
            <History size={18} className="mr-2" />
            History
          </Button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {/* Profile Banner */}
        {loadingProfile ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : profiles.length > 0 ? (
          <Card style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: '2rem' }}>
            <CardContent style={{ padding: '1rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} style={{ color: '#059669' }} />
                  <strong style={{ color: '#065F46' }}>Translator Profile(s)</strong>
                </div>
                <Button size="sm" onClick={openNewProfileModal}>
                  <Plus size={14} className="mr-1" /> Add Profile
                </Button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {profiles.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '9999px',
                    background: selectedProfile?.id === p.id ? '#059669' : 'white',
                    color: selectedProfile?.id === p.id ? 'white' : '#065F46',
                    border: '1px solid #A7F3D0',
                    cursor: 'pointer', fontSize: '0.85rem'
                  }} onClick={() => setSelectedProfile(p)}>
                    {p.full_name} ({p.certificate_prefix})
                    <button onClick={(e) => { e.stopPropagation(); openEditProfileModal(p); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <Settings size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteProfile(p.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card style={{ background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: '2rem' }}>
            <CardContent style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <AlertCircle size={18} style={{ color: '#D97706' }} />
                  <strong style={{ color: '#92400E' }}>Profile Required</strong>
                </div>
                <p style={{ color: '#B45309', fontSize: '0.875rem', margin: 0 }}>
                  Please configure your translator profile to create certified translations
                </p>
              </div>
              <Button onClick={openNewProfileModal} style={{ background: '#D97706', color: 'white' }}>
                <Plus size={16} className="mr-2" /> Set Up Profile
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Document Upload */}
        <Card style={{ marginBottom: '2rem' }}>
          <CardHeader>
            <CardTitle>Document to Translate</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              style={{
                border: `2px dashed ${translationTheme.colors.border}`,
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {filename ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <FileText size={20} />
                  <span>{filename}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setText(''); setFilename(null); }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload size={32} style={{ color: translationTheme.colors.primary, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0 }}>Click to upload or drag and drop</p>
                  <p style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem', margin: 0 }}>
                    .txt, .md, .docx, .pdf, .jpg, .png
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
              style={{ display: 'none' }}
            />
            
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Or paste your Spanish text here..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '1rem',
                border: `1px solid ${translationTheme.colors.border}`,
                borderRadius: '8px',
                fontFamily: translationTheme.fonts.mono,
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
            />

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Document Description (optional - will be auto-generated if empty)
              </label>
              <Input
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="e.g., Academic diploma issued by Universidad Central de Venezuela"
              />
            </div>
          </CardContent>
        </Card>

        {/* Create Button */}
        <Button
          onClick={handleCreateCertified}
          disabled={!text.trim() || isTranslating || !selectedProfile}
          style={{
            width: '100%',
            background: translationTheme.colors.primary,
            color: 'white',
            padding: '1rem',
            fontSize: '1rem',
            borderRadius: '9999px',
            marginBottom: '2rem'
          }}
        >
          {isTranslating ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Creating Certified Translation...
            </>
          ) : (
            <>
              <Award size={20} className="mr-2" />
              Create Certified Translation
            </>
          )}
        </Button>

        {/* Recent Certifications */}
        {certifications.length > 0 && (
          <div>
            <h3 style={{ 
              fontFamily: translationTheme.fonts.heading,
              marginBottom: '1rem'
            }}>
              Recent Certifications
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {certifications.slice(0, 5).map((cert) => (
                <Card key={cert.id} style={{ background: 'white' }}>
                  <CardContent style={{ 
                    padding: '1rem', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong style={{ color: translationTheme.colors.primary }}>
                        {cert.certificate_number}
                      </strong>
                      <p style={{ 
                        color: translationTheme.colors.textSecondary,
                        fontSize: '0.875rem',
                        margin: '0.25rem 0 0 0'
                      }}>
                        {cert.document_description} • {cert.certification_date}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadCert(cert.id, cert.certificate_number, cert.client_name)}
                    >
                      <Download size={16} className="mr-2" />
                      PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent style={{ maxWidth: '500px' }}>
          <DialogHeader>
            <DialogTitle>{editingProfileId ? 'Edit Translator Profile' : 'New Translator Profile'}</DialogTitle>
            <DialogDescription>
              This information will appear on your certified translation certificates.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Full Name *</label>
              <Input value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} placeholder="Veruska Andreina Sosa Córdova" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>ID Number *</label>
              <Input value={profileForm.id_number} onChange={(e) => setProfileForm({...profileForm, id_number: e.target.value})} placeholder="14.464.948" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Title/Position *</label>
              <Input value={profileForm.title} onChange={(e) => setProfileForm({...profileForm, title: e.target.value})} placeholder="Certified Translator" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Phone *</label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} placeholder="+1 (555) 123-4567" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email *</label>
              <Input value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} placeholder="translator@email.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Certificate Prefix</label>
              <Input value={profileForm.certificate_prefix} onChange={(e) => setProfileForm({...profileForm, certificate_prefix: e.target.value})} placeholder="TRAD" />
              <p style={{ fontSize: '0.75rem', color: translationTheme.colors.textMuted, marginTop: '0.25rem' }}>
                Certificates will be numbered: {profileForm.certificate_prefix}1{new Date().getFullYear()}, etc.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Signature Image (optional)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif"
                id="sig-upload-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onloadend = () => setProfileForm(prev => ({...prev, signature_image: reader.result}));
                  reader.readAsDataURL(f);
                }}
              />
              {profileForm.signature_image ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src={profileForm.signature_image} alt="Signature preview" style={{ maxHeight: '60px', maxWidth: '200px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  <Button variant="outline" size="sm" onClick={() => setProfileForm(prev => ({...prev, signature_image: ''}))}>
                    Remove
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => document.getElementById('sig-upload-input').click()}>
                  Upload Signature Image
                </Button>
              )}
              <p style={{ fontSize: '0.75rem', color: translationTheme.colors.textMuted, marginTop: '0.25rem' }}>
                PNG or JPG — will appear on the certificate PDF
              </p>
            </div>
          </div>
          <DialogFooter style={{ marginTop: '1.5rem' }}>
            <Button variant="outline" onClick={() => setShowProfileModal(false)}>Cancel</Button>
            <Button 
              onClick={saveProfile}
              style={{ background: translationTheme.colors.primary, color: 'white' }}
              disabled={!profileForm.full_name || !profileForm.id_number || !profileForm.title || !profileForm.phone || !profileForm.email}
            >
              {editingProfileId ? 'Update Profile' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// CertifiedHistoryModule
const CertifiedHistoryModule = () => {
  const navigate = useNavigate();
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCertifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/certified/translations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setCertifications(response.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCertifications();
  }, []);

  const handleDownload = async (certId, certNumber, clientName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/certified/export/${certId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const clientPart = clientName ? `${clientName}_` : '';
      link.setAttribute('download', `${clientPart}${certNumber}_certified.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body
    }}>
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate('/translate/certified')} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ 
            fontFamily: translationTheme.fonts.heading, 
            fontSize: '1.5rem',
            color: translationTheme.colors.textPrimary,
            margin: 0
          }}>
            Certified Translation History
          </h1>
        </div>
        <Button 
          onClick={() => navigate('/translate/certified')}
          style={{ background: translationTheme.colors.primary, color: 'white', borderRadius: '9999px' }}
        >
          <Plus size={18} className="mr-2" />
          New Certified
        </Button>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={48} style={{ color: translationTheme.colors.primary }} />
          </div>
        ) : certifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: translationTheme.colors.textMuted }}>
            <Award size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No certified translations yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {certifications.map((cert) => (
              <Card key={cert.id} style={{ background: 'white' }}>
                <CardContent style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={{ 
                          background: translationTheme.colors.primary,
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }}>
                          {cert.certificate_number}
                        </span>
                        <span style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem' }}>
                          {cert.certification_date}
                        </span>
                      </div>
                      <p style={{ 
                        color: translationTheme.colors.textPrimary,
                        fontWeight: 500,
                        marginBottom: '0.25rem'
                      }}>
                        {cert.document_description}
                      </p>
                      <p style={{ 
                        color: translationTheme.colors.textMuted,
                        fontSize: '0.875rem',
                        margin: 0
                      }}>
                        {cert.original_filename || 'Direct Input'} • Translator: {cert.translator_name}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button 
                        variant="outline"
                        onClick={() => navigate(`/translate/certified/view/${cert.id}`)}
                      >
                        <Columns size={16} className="mr-2" />
                        View
                      </Button>
                      <Button 
                        onClick={() => handleDownload(cert.id, cert.certificate_number, cert.client_name)}
                        style={{ background: translationTheme.colors.primary, color: 'white' }}
                      >
                        <Download size={16} className="mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// CertifiedTranslationViewPage - Side by side view for certified translations
const CertifiedTranslationViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCertification = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/certified/translations/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setCert(response.data);
        
        // If still translating, start polling
        if (response.data.status === 'translating') {
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await axios.get(`${API}/certified/translations/${id}/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (statusRes.data.status === 'completed') {
                clearInterval(pollInterval);
                // Re-fetch full data
                const fullRes = await axios.get(`${API}/certified/translations/${id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                setCert(fullRes.data);
              } else if (statusRes.data.status === 'failed') {
                clearInterval(pollInterval);
                alert('Error en traducción: ' + (statusRes.data.error_message || 'Error desconocido'));
              }
            } catch (pollErr) {
              console.error('Polling error:', pollErr);
            }
          }, 5000);
          return () => clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error fetching certification:', error);
        alert('Certified translation not found');
        navigate('/translate/certified/history');
      } finally {
        setLoading(false);
      }
    };
    fetchCertification();
  }, [id, navigate]);

  const handleCopy = () => {
    if (cert?.translated_text) {
      navigator.clipboard.writeText(cert.translated_text);
      alert('Translation copied to clipboard!');
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/certified/export/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Include client name in filename if available
      const clientPart = cert?.client_name ? `${cert.client_name}_` : '';
      link.setAttribute('download', `${clientPart}${cert?.certificate_number || 'certified'}_certified.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: translationTheme.colors.background 
      }}>
        <Loader2 className="animate-spin" size={48} style={{ color: translationTheme.colors.primary }} />
      </div>
    );
  }

  // Prevent blank screen if cert failed to load
  if (!cert) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: translationTheme.colors.background,
        gap: '1rem'
      }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>No se encontró la traducción certificada</p>
        <Button onClick={() => navigate('/translate/certified/history')} variant="outline">
          <ArrowLeft size={18} className="mr-2" />
          Volver al Historial
        </Button>
      </div>
    );
  }

  // Show loading state if translation is still in progress
  if (cert.status === 'translating') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: translationTheme.colors.background,
        gap: '1rem'
      }}>
        <Loader2 className="animate-spin" size={48} style={{ color: translationTheme.colors.primary }} />
        <p style={{ fontSize: '1.1rem', color: '#666' }}>Traduciendo documento...</p>
        <p style={{ fontSize: '0.875rem', color: '#999' }}>Certificado: {cert.certificate_number}</p>
        <Button onClick={() => {
          if (cert?.client_id) {
            navigate(`/client-documents/${cert.client_id}/certified`);
          } else {
            navigate('/translate/certified/history');
          }
        }} variant="ghost" style={{ marginTop: '1rem' }}>
          <ArrowLeft size={18} className="mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => {
            if (cert?.client_id) {
              navigate(`/client-documents/${cert.client_id}/certified`);
            } else {
              navigate('/translate/certified/history');
            }
          }} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 style={{ 
              fontFamily: translationTheme.fonts.heading, 
              fontSize: '1.25rem',
              color: translationTheme.colors.textPrimary,
              margin: 0
            }}>
              {cert?.certificate_number || 'Certified Translation'}
            </h1>
            <p style={{ 
              fontSize: '0.875rem', 
              color: translationTheme.colors.textMuted,
              margin: '0.25rem 0 0 0'
            }}>
              {cert?.original_filename || 'Direct Input'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={() => navigate('/translate/certified')}>
            <Plus size={18} className="mr-2" />
            New
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            <Copy size={18} className="mr-2" />
            Copy
          </Button>
          <Button 
            onClick={handleExportPDF}
            style={{ background: translationTheme.colors.primary, color: 'white', borderRadius: '9999px' }}
          >
            <Download size={18} className="mr-2" />
            Export PDF
          </Button>
        </div>
      </header>

      {/* Certificate Info Bar */}
      <div style={{ 
        background: '#FEF3C7',
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '0.75rem 2rem',
        display: 'flex',
        gap: '2rem',
        fontSize: '0.875rem',
        color: '#92400E',
        alignItems: 'center'
      }}>
        <span><Award size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />Certificate: {cert?.certificate_number}</span>
        <span>📅 {new Date(cert?.certification_date).toLocaleDateString()}</span>
        <span>👤 Translator: {cert?.translator_name}</span>
        <span>📄 {cert?.document_description?.substring(0, 60)}...</span>
      </div>

      {/* Split View Container with margins */}
      <div style={{ 
        flex: 1, 
        padding: '1.5rem 3rem',
        overflow: 'hidden'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          height: '100%',
          border: `1px solid ${translationTheme.colors.border}`,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'white',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Original Panel */}
          <div style={{ 
            borderRight: `1px solid ${translationTheme.colors.border}`,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              padding: '1rem 1.5rem',
              background: '#FEF3C7',
              borderBottom: `1px solid ${translationTheme.colors.border}`,
              fontWeight: 600,
              color: '#92400E'
            }}>
              ORIGINAL (SPANISH)
            </div>
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '2rem',
              fontFamily: translationTheme.fonts.mono,
              fontSize: '0.9rem',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              color: translationTheme.colors.textPrimary
            }}>
              {cert?.original_text}
            </div>
          </div>

          {/* Translated Panel */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '1rem 1.5rem',
              background: '#D1FAE5',
              borderBottom: `1px solid ${translationTheme.colors.border}`,
              fontWeight: 600,
              color: '#065F46'
            }}>
              CERTIFIED TRANSLATION (ENGLISH)
            </div>
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '2rem',
              fontFamily: translationTheme.fonts.mono,
              fontSize: '0.9rem',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              color: translationTheme.colors.textPrimary
            }}>
              {cert?.translated_text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ClientTranslateModule - Translation within client context
const ClientTranslateModule = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id');
  
  const [client, setClient] = useState(null);
  const [text, setText] = useState('');
  const [filename, setFilename] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const fileInputRef = React.useRef(null);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch client info
        if (clientId) {
          const clientRes = await axios.get(`${API}/clients/${clientId}`, { headers });
          setClient(clientRes.data);
          
          // Fetch translations for this client
          const transRes = await axios.get(`${API}/translations?client_id=${clientId}`, { headers });
          setTranslations(transRes.data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setText(response.data.content);
      setFilename(response.data.filename);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) {
      alert('Por favor ingresa texto para traducir');
      return;
    }
    
    setIsTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/translate?client_id=${clientId}`, {
        text: text,
        filename: filename
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Refresh translations list
      const transRes = await axios.get(`${API}/translations?client_id=${clientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTranslations(transRes.data || []);
      
      // Clear form and switch to history
      setText('');
      setFilename(null);
      setActiveTab('history');
      
      // Navigate to view
      navigate(`/translate/view/${response.data.id}`);
    } catch (error) {
      console.error('Translation error:', error);
      alert('Error en traducción: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExportPDF = async (id, fname) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/export/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fname || 'translation'}_translated.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta traducción?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/translations/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTranslations(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: translationTheme.colors.background,
      fontFamily: translationTheme.fonts.body
    }}>
      {/* Header */}
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate(`/client/${clientId}/documents/translation`)} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 style={{ 
              fontFamily: translationTheme.fonts.heading, 
              fontSize: '1.25rem',
              color: translationTheme.colors.textPrimary,
              margin: 0
            }}>
              Traducciones
            </h1>
            {client && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: translationTheme.colors.textMuted }}>
                Cliente: {client.name}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button 
            variant={activeTab === 'new' ? 'default' : 'outline'}
            onClick={() => setActiveTab('new')}
            style={activeTab === 'new' ? { background: translationTheme.colors.primary, color: 'white' } : {}}
          >
            <Plus size={18} className="mr-2" />
            Nueva
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            style={activeTab === 'history' ? { background: translationTheme.colors.primary, color: 'white' } : {}}
          >
            <History size={18} className="mr-2" />
            Historial ({translations.length})
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/client-translate/certified?client_id=${clientId}`)}
          >
            <Award size={18} className="mr-2" />
            Certificada
          </Button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {activeTab === 'new' ? (
          <>
            {/* New Translation Form */}
            <Card style={{ marginBottom: '1.5rem' }}>
              <CardContent style={{ padding: '2rem' }}>
                <div
                  style={{
                    border: `2px dashed ${translationTheme.colors.border}`,
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: isUploading ? 'wait' : 'pointer',
                    marginBottom: '1rem'
                  }}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <div>
                      <Loader2 className="animate-spin" size={32} style={{ color: translationTheme.colors.primary, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>Cargando archivo...</p>
                      <p style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem', margin: 0 }}>
                        Extrayendo texto del documento
                      </p>
                    </div>
                  ) : filename ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <FileText size={20} />
                      <span>{filename}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setText(''); setFilename(null); }}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} style={{ color: translationTheme.colors.primary, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0 }}>Arrastra un archivo o haz clic para subir</p>
                      <p style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem', margin: 0 }}>
                        .txt, .md, .docx, .pdf
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf"
                  onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="O pega tu texto en español aquí..."
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    padding: '1rem',
                    border: `1px solid ${translationTheme.colors.border}`,
                    borderRadius: '8px',
                    fontFamily: translationTheme.fonts.mono,
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                />
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '1rem'
                }}>
                  <div style={{ color: translationTheme.colors.textMuted, fontSize: '0.875rem' }}>
                    {charCount.toLocaleString()} caracteres • {wordCount.toLocaleString()} palabras
                  </div>
                  <Button
                    onClick={handleTranslate}
                    disabled={!text.trim() || isTranslating}
                    style={{
                      background: translationTheme.colors.primary,
                      color: 'white',
                      borderRadius: '9999px'
                    }}
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Traduciendo...
                      </>
                    ) : (
                      <>
                        <Languages size={18} className="mr-2" />
                        Traducir a Inglés
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Translation History */}
            {translations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: translationTheme.colors.textMuted }}>
                <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>No hay traducciones para este cliente</p>
                <Button 
                  onClick={() => setActiveTab('new')}
                  style={{ marginTop: '1rem', background: translationTheme.colors.primary, color: 'white' }}
                >
                  <Plus size={18} className="mr-2" />
                  Crear Primera Traducción
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {translations.map((t) => (
                  <Card 
                    key={t.id} 
                    style={{ background: 'white', cursor: 'pointer' }}
                    onClick={() => navigate(`/translate/view/${t.id}`)}
                  >
                    <CardContent style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            fontWeight: 600, 
                            marginBottom: '0.5rem',
                            color: translationTheme.colors.textPrimary
                          }}>
                            {t.filename || 'Entrada directa'}
                          </h3>
                          <p style={{ 
                            color: translationTheme.colors.textMuted, 
                            fontSize: '0.875rem',
                            marginBottom: '0.5rem'
                          }}>
                            {new Date(t.created_at).toLocaleDateString()} • {t.char_count_original?.toLocaleString()} caracteres
                          </p>
                          <p style={{ 
                            color: translationTheme.colors.textSecondary,
                            fontSize: '0.875rem',
                            marginBottom: '0.25rem'
                          }}>
                            <strong>ES:</strong> {t.original_preview}
                          </p>
                          <p style={{ 
                            color: translationTheme.colors.textSecondary,
                            fontSize: '0.875rem'
                          }}>
                            <strong>EN:</strong> {t.translated_preview}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleExportPDF(t.id, t.filename)}
                          >
                            <Download size={16} />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDelete(t.id)}
                            style={{ color: '#EF4444', borderColor: '#EF4444' }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ClientCertifiedTranslateModule - Certified translation within client context
const ClientCertifiedTranslateModule = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id');
  
  const [client, setClient] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [text, setText] = useState('');
  const [filename, setFilename] = useState(null);
  const [docDescription, setDocDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = React.useRef(null);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    id_number: '',
    title: 'Certified Translator',
    phone: '',
    email: '',
    certificate_prefix: 'TRAD'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        if (clientId) {
          const clientRes = await axios.get(`${API}/clients/${clientId}`, { headers });
          setClient(clientRes.data);
          
          const certRes = await axios.get(`${API}/certified/translations?client_id=${clientId}`, { headers });
          setCertifications(certRes.data || []);
        }
        
        const profileRes = await axios.get(`${API}/translator/profile`, { headers });
        if (profileRes.data) {
          setProfile(profileRes.data);
          setProfileForm({
            full_name: profileRes.data.full_name || '',
            id_number: profileRes.data.id_number || '',
            title: profileRes.data.title || 'Certified Translator',
            phone: profileRes.data.phone || '',
            email: profileRes.data.email || '',
            certificate_prefix: profileRes.data.certificate_prefix || 'TRAD'
          });
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  const saveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/translator/profile`, profileForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProfile(response.data);
      setShowProfileModal(false);
    } catch (error) {
      console.error('Error:', error);
      alert('Error guardando perfil');
    }
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setText(response.data.content);
      setFilename(response.data.filename);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleCreateCertified = async () => {
    if (!profile) {
      alert('Configura tu perfil de traductor primero');
      setShowProfileModal(true);
      return;
    }
    if (!text.trim()) return;

    setIsTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/certified/translate?client_id=${clientId}`, {
        original_text: text,
        filename: filename,
        document_description: docDescription || null
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Poll for completion (background task)
      const certId = response.data.id;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API}/certified/translations/${certId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (statusRes.data.status === 'completed') {
            clearInterval(pollInterval);
            setIsTranslating(false);
            navigate(`/translate/certified/view/${certId}`);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(pollInterval);
            setIsTranslating(false);
            alert('Error en traducción: ' + (statusRes.data.error_message || 'Error desconocido'));
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + (error.response?.data?.detail || error.message));
      setIsTranslating(false);
    }
  };

  const handleDownloadCert = async (certId, certNumber, clientName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/certified/export/${certId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const clientPart = clientName ? `${clientName}_` : '';
      link.setAttribute('download', `${clientPart}${certNumber}_certified.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: translationTheme.colors.background, fontFamily: translationTheme.fonts.body }}>
      <header style={{ 
        background: 'white', 
        borderBottom: `1px solid ${translationTheme.colors.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => navigate(`/client-translate?client_id=${clientId}`)} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 style={{ fontFamily: translationTheme.fonts.heading, fontSize: '1.25rem', margin: 0 }}>
              Traducción Certificada
            </h1>
            {client && <p style={{ margin: 0, fontSize: '0.875rem', color: translationTheme.colors.textMuted }}>Cliente: {client.name}</p>}
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(`/client-translate?client_id=${clientId}`)}>
          Traducción Normal
        </Button>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {/* Profile Banner */}
        {profile ? (
          <Card style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: '2rem' }}>
            <CardContent style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} style={{ color: '#059669' }} />
                  <strong style={{ color: '#065F46' }}>Perfil Configurado</strong>
                </div>
                <p style={{ color: '#047857', fontSize: '0.875rem', margin: 0 }}>
                  {profile.full_name} • {profile.title}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowProfileModal(true)}>
                <Settings size={16} className="mr-2" /> Editar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card style={{ background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: '2rem' }}>
            <CardContent style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#92400E' }}>Perfil Requerido</strong>
                <p style={{ color: '#B45309', fontSize: '0.875rem', margin: 0 }}>Configura tu perfil para crear traducciones certificadas</p>
              </div>
              <Button onClick={() => setShowProfileModal(true)} style={{ background: '#D97706', color: 'white' }}>
                <Plus size={16} className="mr-2" /> Configurar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Document Form */}
        <Card style={{ marginBottom: '2rem' }}>
          <CardHeader><CardTitle>Documento a Traducir</CardTitle></CardHeader>
          <CardContent>
            <div 
              style={{ border: `2px dashed ${translationTheme.colors.border}`, borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {filename ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <FileText size={20} /><span>{filename}</span>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setText(''); setFilename(null); }}><X size={16} /></Button>
                </div>
              ) : (
                <>
                  <Upload size={32} style={{ color: translationTheme.colors.primary, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0 }}>Subir archivo (.txt, .md, .docx, .pdf, .jpg, .png)</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.docx,.pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])} style={{ display: 'none' }} />
            
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="O pega el texto aquí..."
              style={{ width: '100%', minHeight: '150px', padding: '1rem', border: `1px solid ${translationTheme.colors.border}`, borderRadius: '8px', fontFamily: translationTheme.fonts.mono, marginBottom: '1rem' }}
            />
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Descripción del Documento (opcional)</label>
              <Input value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Ej: Título universitario emitido por..." />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleCreateCertified} disabled={!text.trim() || isTranslating || !profile}
          style={{ width: '100%', background: translationTheme.colors.primary, color: 'white', padding: '1rem', borderRadius: '9999px', marginBottom: '2rem' }}>
          {isTranslating ? <><Loader2 className="animate-spin mr-2" size={20} />Creando...</> : <><Award size={20} className="mr-2" />Crear Traducción Certificada</>}
        </Button>

        {/* Recent Certifications */}
        {certifications.length > 0 && (
          <div>
            <h3 style={{ fontFamily: translationTheme.fonts.heading, marginBottom: '1rem' }}>Certificaciones del Cliente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {certifications.map((cert) => (
                <Card key={cert.id} style={{ background: 'white' }}>
                  <CardContent style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: translationTheme.colors.primary }}>{cert.certificate_number}</strong>
                      <p style={{ color: translationTheme.colors.textSecondary, fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                        {cert.document_description} • {cert.certification_date}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadCert(cert.id, cert.certificate_number, cert.client_name)}>
                      <Download size={16} className="mr-2" />PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent style={{ maxWidth: '500px' }}>
          <DialogHeader>
            <DialogTitle>Perfil del Traductor</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo *</label>
              <Input value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Número de ID *</label>
              <Input value={profileForm.id_number} onChange={(e) => setProfileForm({...profileForm, id_number: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Título *</label>
              <Input value={profileForm.title} onChange={(e) => setProfileForm({...profileForm, title: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Teléfono *</label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email *</label>
              <Input value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Prefijo Certificado</label>
              <Input value={profileForm.certificate_prefix} onChange={(e) => setProfileForm({...profileForm, certificate_prefix: e.target.value})} />
            </div>
          </div>
          <DialogFooter style={{ marginTop: '1.5rem' }}>
            <Button variant="outline" onClick={() => setShowProfileModal(false)}>Cancelar</Button>
            <Button onClick={saveProfile} style={{ background: translationTheme.colors.primary, color: 'white' }}
              disabled={!profileForm.full_name || !profileForm.id_number || !profileForm.title || !profileForm.phone || !profileForm.email}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================
// END TRANSLATION MODULE COMPONENTS
// ============================================================


function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <SSOHandler>
        <Routes>
          <Route path="/" element={<LandingOrDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/prompts" element={<ProtectedRoute><PromptManager /></ProtectedRoute>} />

          <Route path="/trash" element={<ProtectedRoute><TrashBin /></ProtectedRoute>} />
          <Route path="/trash/:clientId" element={<ProtectedRoute><TrashBin /></ProtectedRoute>} />

          <Route path="/drafts" element={<ProtectedRoute><DraftsManager /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/client-dashboard/:clientId" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
          <Route path="/client-documents/:clientId/:docType" element={<ProtectedRoute><ClientDocumentsList /></ProtectedRoute>} />
          <Route path="/create-business-plan" element={<ProtectedRoute><CreateNIWInteractive /></ProtectedRoute>} />
          <Route path="/create-book" element={<ProtectedRoute><CreateBookInteractive /></ProtectedRoute>} />
          <Route path="/create-patent" element={<ProtectedRoute><CreatePatentV2 /></ProtectedRoute>} />
          <Route path="/create-patent-v2" element={<ProtectedRoute><CreatePatentV2 /></ProtectedRoute>} />
          <Route path="/create-patent-direct" element={<ProtectedRoute><CreatePatentDirect /></ProtectedRoute>} />
          <Route path="/view-patent-v2/:patentId" element={<ProtectedRoute><ViewPatentV2 /></ProtectedRoute>} />
          <Route path="/create-whitepaper" element={<ProtectedRoute><CreateWhitepaperInteractive /></ProtectedRoute>} />
          <Route path="/create-recommendation-letter" element={<ProtectedRoute><CreateRecommendationLetter /></ProtectedRoute>} />
          <Route path="/view-recommendation-letter/:id" element={<ProtectedRoute><ViewRecommendationLetter /></ProtectedRoute>} />
          <Route path="/create-intent-letter" element={<ProtectedRoute><CreateIntentLetter /></ProtectedRoute>} />
          <Route path="/view-intent-letter/:id" element={<ProtectedRoute><ViewIntentLetter /></ProtectedRoute>} />
          <Route path="/create-expert-letter" element={<ProtectedRoute><CreateExpertLetter /></ProtectedRoute>} />
          <Route path="/view-expert-letter/:id" element={<ProtectedRoute><ViewExpertLetter /></ProtectedRoute>} />
          <Route path="/create-self-petition-letter" element={<ProtectedRoute><CreateSelfPetitionLetter /></ProtectedRoute>} />
          <Route path="/create-self-petition-v2" element={<ProtectedRoute><CreateSelfPetitionV2 /></ProtectedRoute>} />
          <Route path="/view-self-petition-letter/:id" element={<ProtectedRoute><ViewSelfPetitionLetter /></ProtectedRoute>} />
          <Route path="/create-policy-paper" element={<ProtectedRoute><CreatePolicyPaper /></ProtectedRoute>} />
          <Route path="/view-policy-paper/:id" element={<ProtectedRoute><ViewPolicyPaper /></ProtectedRoute>} />
          <Route path="/create-econometric-study" element={<ProtectedRoute><CreateEconometricStudy /></ProtectedRoute>} />
          <Route path="/design-document" element={<ProtectedRoute><DesignDocument /></ProtectedRoute>} />
          <Route path="/view-business-plan/:id" element={<ProtectedRoute><ViewBusinessPlan /></ProtectedRoute>} />


          <Route path="/view-book/:id" element={<ProtectedRoute><ViewBook /></ProtectedRoute>} />
          <Route path="/view-patent/:id" element={<ProtectedRoute><ViewPatent /></ProtectedRoute>} />
          <Route path="/view-whitepaper/:id" element={<ProtectedRoute><ViewWhitepaper /></ProtectedRoute>} />
          <Route path="/view-econometric-study/:id" element={<ProtectedRoute><ViewEconometricStudy /></ProtectedRoute>} />
          <Route path="/create-case-study" element={<ProtectedRoute><CreateCaseStudy /></ProtectedRoute>} />
          <Route path="/view-case-study/:id" element={<ProtectedRoute><ViewCaseStudy /></ProtectedRoute>} />
          
          {/* Translation Module Routes */}
          <Route path="/translate" element={<ProtectedRoute><TranslateModule /></ProtectedRoute>} />
          <Route path="/translate/view/:id" element={<ProtectedRoute><TranslationViewPage /></ProtectedRoute>} />
          <Route path="/translate/history" element={<ProtectedRoute><TranslationHistoryModule /></ProtectedRoute>} />
          <Route path="/translate/certified" element={<ProtectedRoute><CertifiedTranslationModule /></ProtectedRoute>} />
          <Route path="/translate/certified/history" element={<ProtectedRoute><CertifiedHistoryModule /></ProtectedRoute>} />
          <Route path="/translate/certified/view/:id" element={<ProtectedRoute><CertifiedTranslationViewPage /></ProtectedRoute>} />
          
          {/* Client Translation Routes */}
          <Route path="/client-translate" element={<ProtectedRoute><ClientTranslateModule /></ProtectedRoute>} />
          <Route path="/client-translate/certified" element={<ProtectedRoute><ClientCertifiedTranslateModule /></ProtectedRoute>} />
        </Routes>
        </SSOHandler>
      </BrowserRouter>
    </div>
  );
}

// ========================================
// PATENTS V2 COMPONENTS
// ========================================

const CreatePatentV2 = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('cv'); // cv, invention_titles, details, generating, generation-started
  const [redirectCountdown, setRedirectCountdown] = useState(10);
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    project_description: '',
    // Structured contact info from /upload-cv. Forwarded as
    // cv_extracted_address so the patent's INVENTOR INFORMATION block
    // uses CV-extracted values before falling back to the client record.
    extracted_address: null
  });
  const [inventionSuggestions, setInventionSuggestions] = useState([]);
  const [patentRecommendation, setPatentRecommendation] = useState(null);
  const [selectedInvention, setSelectedInvention] = useState(null);
  const [formData, setFormData] = useState({
    invention_title: '',
    inventor_name: '',
    inventor_residence: '',
    technical_field: '',
    invention_description: '',
    mode: 'provisional',
    language: 'es',
    client_id: null
  });
  const [generating, setGenerating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('text');
  const [uploadingCV, setUploadingCV] = useState(false);
  const [projectInputMode, setProjectInputMode] = useState('text'); // 'text' or 'file'
  const [uploadingProject, setUploadingProject] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);

  // Get client_id from URL params - using both methods for reliability
  const searchParams = new URLSearchParams(window.location.search);
  const clientIdFromSearch = searchParams.get('client_id');
  const clientId = clientIdFromSearch;

  // Debug logging
  console.log('[CreatePatentV2] ===== CLIENT ID DEBUG =====');
  console.log('[CreatePatentV2] window.location.href:', window.location.href);
  console.log('[CreatePatentV2] window.location.search:', window.location.search);
  console.log('[CreatePatentV2] clientId from search params:', clientIdFromSearch);
  console.log('[CreatePatentV2] Final clientId:', clientId);
  console.log('[CreatePatentV2] ================================');

  // Validate that client_id is present and load client data
  React.useEffect(() => {
    console.log('[CreatePatentV2 useEffect] Checking clientId:', clientId);
    
    if (clientId) {
      console.log('[CreatePatentV2] ✅ Client ID found:', clientId);
      setFormData(prev => ({ ...prev, client_id: clientId }));
      
      // Load client data to pre-fill form
      const loadClientData = async () => {
        setLoadingClientData(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/clients/${clientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setClientData(response.data);
          
          // Pre-fill inventor name and applicant name with client name if available
          if (response.data.name) {
            setFormData(prev => ({ 
              ...prev, 
              inventor_name: response.data.name 
            }));
            
            // Also pre-fill the applicant name in CV form
            setCvData(prev => ({
              ...prev,
              applicant_name: response.data.name
            }));
          }
        } catch (error) {
          console.error('Error loading client data:', error);
        } finally {
          setLoadingClientData(false);
        }
      };
      
      loadClientData();
    }
  }, [clientId, navigate]);

  const handleCVPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingCV(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-cv`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setCvData({
          ...cvData,
          applicant_cv: response.data.analyzed_cv,
          extracted_address: response.data.extracted_address || null
        });
        toast.success('✅ CV analizado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingCV(false);
    }
  };

  const handleProjectFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingProject(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-project`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setCvData({
          ...cvData,
          project_description: response.data.analyzed_content
        });
        toast.success('✅ Documento del proyecto analizado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo del proyecto');
    } finally {
      setUploadingProject(false);
    }
  };

  const handleCVSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/patents/suggest-invention-titles`, {
        ...cvData,
        language: 'es'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('🔍 PATENT SUGGESTIONS RESPONSE:', response.data);
      console.log('   Suggestions:', response.data.suggestions);
      console.log('   Recommendation:', response.data.recommendation);
      
      setInventionSuggestions(response.data.suggestions || []);
      setPatentRecommendation(response.data.recommendation || null); // Restaurar recomendación de Monica
      
      if (!response.data.recommendation) {
        console.warn('⚠️ NO RECOMMENDATION RECEIVED FROM BACKEND');
      }
      
      setStep('invention_titles');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sugerencias');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleInventionSelection = async (invention) => {
    setSelectedInvention(invention);
    
    // If client data exists with name and country, skip details step and generate directly
    if (clientData && clientData.name && clientData.country) {
      // Use client data directly
      const patentData = {
        invention_title: invention.title,
        inventor_name: clientData.name,
        inventor_residence: clientData.country,
        invention_description: invention.description,
        technical_field: invention.technical_field,
        mode: 'provisional',
        language: 'es',
        client_id: clientId,
        applicant_cv: cvData.applicant_cv || '',  // ✅ Incluir CV
        inventor_cv: cvData.applicant_cv || '',   // ✅ También como inventor_cv
        project_description: cvData.project_description || '',  // ✅ Incluir proyecto
        // Address resolution priority for the patent INVENTOR INFORMATION block:
        // CV-extracted (this field) → top-level patent field → client record → [VERIFY]
        cv_extracted_address: cvData.extracted_address || null
      };
      
      setFormData(patentData);
      
      // Start patent generation directly
      setGenerating(true);
      setStep('generating');
      
      try {
        const token = localStorage.getItem('token');
        
        // Create patent V2
        const createResponse = await axios.post(
          `${API}/patents-v2/start`,
          patentData,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const patentId = createResponse.data.id;
      toast.success('Patente creada! Generando todas las secciones...');
      setStep('generating');

      // Generate complete patent using NEW OPTIMIZED system
      
      // Start generation in background (don't await)
      axios.post(
        `${API}/patents-v2/generate-complete/${patentId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).catch(error => {
        console.error('Background generation error:', error);
      });

      // ✅ SOLUCIÓN: Redirigir al dashboard del cliente
      const clientIdForRedirect = createResponse.data.client_id || clientId || patentData.client_id;
      console.log('[Patent V2 Invention] Patent created:', patentId);
      console.log('[Patent V2 Invention] Redirecting to client dashboard:', clientIdForRedirect);
      
      toast.success('¡Patente creada exitosamente! La generación completa tomará aproximadamente 10 minutos.', { duration: 8000 });
      toast.info('Serás redirigido al dashboard del cliente en 8 segundos...', { duration: 8000 });
      
      // Redirigir al dashboard del cliente después de 8 segundos
      setTimeout(() => {
        if (clientIdForRedirect) {
          navigate(`/client-dashboard/${clientIdForRedirect}`);
        } else {
          navigate('/dashboard');
        }
      }, 8000);
      
      } catch (error) {
        console.error('Error:', error);
        toast.error(error.response?.data?.detail || 'Error al generar la patente');
        setGenerating(false);
        setStep('invention_titles');
      }
    } else {
      // No client data or incomplete data - show details step
      setFormData({
        invention_title: invention.title,
        inventor_name: cvData.applicant_name,
        inventor_residence: '',
        invention_description: invention.description,
        technical_field: invention.technical_field,
        mode: 'provisional',
        language: 'es'
      });
      setStep('details');
    }
  };

  const handleStartPatentV2 = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      
      // Crear patente V2 - incluir CV y proyecto
      const patentPayload = {
        ...formData,
        client_id: clientId,
        applicant_cv: cvData.applicant_cv || formData.applicant_cv || '',
        inventor_cv: cvData.applicant_cv || formData.inventor_cv || '',
        project_description: cvData.project_description || formData.project_description || '',
        // Address resolution priority for the patent INVENTOR INFORMATION block:
        // CV-extracted (this field) → top-level patent field → client record → [VERIFY]
        cv_extracted_address: cvData.extracted_address || null
      };
      
      const createResponse = await axios.post(
        `${API}/patents-v2/start`,
        patentPayload,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const patentId = createResponse.data.id;
      const clientIdForRedirect = createResponse.data.client_id || clientId || formData.client_id;
      
      // Start generation in background (don't await)
      axios.post(
        `${API}/patents-v2/generate-complete/${patentId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).catch(error => {
        console.error('Background generation error:', error);
      });

      // ✅ SOLUCIÓN: Redirigir al dashboard del cliente
      console.log('[Patent V2] Patent created:', patentId);
      console.log('[Patent V2] Redirecting to client dashboard:', clientIdForRedirect);
      
      toast.success('¡Patente creada exitosamente! La generación completa tomará aproximadamente 10 minutos.', { duration: 8000 });
      toast.info('Serás redirigido al dashboard del cliente en 8 segundos...', { duration: 8000 });
      
      // Redirigir al dashboard del cliente después de 8 segundos
      setTimeout(() => {
        if (clientIdForRedirect) {
          navigate(`/client-dashboard/${clientIdForRedirect}`);
        } else {
          // Fallback si no hay client_id
          navigate('/dashboard');
        }
      }, 8000);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al generar patente');
      setGenerating(false);
    }
  };

  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  // Step: CV and Project Info
  if (step === 'cv') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">Solicitud de Patente USPTO Provisional</h1>
            <p className="form-subtitle">
              Paso 1: Proporciona tu información técnica y el sistema sugerirá invenciones patentables
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleCVSubmit} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="applicant_name">
                    Nombre del Inventor *
                    {clientData && clientData.name && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '0.75rem', 
                        color: '#10b981',
                        fontWeight: 'normal'
                      }}>
                        ✓ Pre-cargado del cliente
                      </span>
                    )}
                  </Label>
                  <Input
                    id="applicant_name"
                    value={cvData.applicant_name}
                    onChange={(e) => setCvData({ ...cvData, applicant_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
                    style={clientData && clientData.name ? {
                      backgroundColor: '#f0fdf4',
                      borderColor: '#86efac'
                    } : {}}
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="applicant_cv">Hoja de Vida / Experiencia Técnica *</Label>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={cvInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={cvInputMode === 'pdf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('pdf')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {cvInputMode === 'text' ? (
                    <Textarea
                      id="applicant_cv"
                      value={cvData.applicant_cv}
                      onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                      required
                      placeholder="Incluye: educación, experiencia técnica, investigación, publicaciones, proyectos relevantes..."
                      rows={8}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVPdfUpload}
                          className="hidden"
                          id="cv-pdf-upload"
                          disabled={uploadingCV}
                        />
                        <label 
                          htmlFor="cv-pdf-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingCV ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Analizando CV...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir tu CV (PDF, DOC o DOCX)
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.applicant_cv && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ CV Analizado
                          </p>
                          <Textarea
                            value={cvData.applicant_cv}
                            onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                            rows={6}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="project_description">Proyecto o Investigación (Opcional)</Label>
                  
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={projectInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProjectInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={projectInputMode === 'file' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProjectInputMode('file')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {projectInputMode === 'text' ? (
                    <Textarea
                      id="project_description"
                      value={cvData.project_description}
                      onChange={(e) => setCvData({ ...cvData, project_description: e.target.value })}
                      placeholder="Describe tu proyecto de investigación, innovación o tecnología que deseas patentar..."
                      rows={6}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleProjectFileUpload}
                          className="hidden"
                          id="project-file-upload"
                          disabled={uploadingProject}
                        />
                        <label 
                          htmlFor="project-file-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingProject ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Analizando documento...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir documento del proyecto (PDF, DOC o DOCX)
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.project_description && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ Documento Analizado
                          </p>
                          <Textarea
                            value={cvData.project_description}
                            onChange={(e) => setCvData({ ...cvData, project_description: e.target.value })}
                            rows={6}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSuggestions} 
                  className="submit-button"
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Generando Sugerencias...
                    </>
                  ) : (
                    <>
                      Sugerir Invenciones Patentables →
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step: Invention Title Selection
  if (step === 'invention_titles') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('cv')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">Selecciona una Invención para Patentar</h1>
            <p className="form-subtitle">
              Paso 2: Elige la invención que deseas desarrollar como patente USPTO
            </p>
          </div>

          {patentRecommendation && (
            <Card className="mb-6 border-2 border-purple-300 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <span className="text-2xl">💡</span>
                  Recomendación de Monica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 italic">"{patentRecommendation.reason}"</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {inventionSuggestions.map((invention, index) => {
              const isRecommended = patentRecommendation && patentRecommendation.recommended_index === index;
              
              return (
                <Card 
                  key={index} 
                  className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${
                    isRecommended ? 'border-purple-400 bg-purple-50' : 'hover:border-blue-500'
                  }`}
                  onClick={() => handleInventionSelection(invention)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">💡</span>
                      {invention.title}
                      {isRecommended && (
                        <span className="ml-auto text-xs font-semibold px-3 py-1 bg-purple-600 text-white rounded-full">
                          ⭐ Recomendada
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      <strong>Campo Técnico:</strong> {invention.technical_field}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{invention.description}</p>
                    <Button className={`mt-4 w-full ${isRecommended ? 'bg-purple-600 hover:bg-purple-700' : ''}`} variant={isRecommended ? 'default' : 'outline'}>
                      {clientData && clientData.name && clientData.country 
                        ? '🚀 Generar Patente Completa' 
                        : 'Seleccionar esta Invención →'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step: Final Details
  if (step === 'details') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('invention_titles')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Scale size={48} className="form-icon" />
            <h1 className="form-title">{selectedInvention?.title}</h1>
            <p className="form-subtitle">
              Paso 3: Confirma los detalles y comienza la generación completa
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartPatentV2} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="invention_title">Título de la Invención *</Label>
                  <Input
                    id="invention_title"
                    value={formData.invention_title}
                    onChange={(e) => setFormData({ ...formData, invention_title: e.target.value })}
                    required
                  />
                </div>

                {/* Show client info if pre-loaded, otherwise show editable fields */}
                {clientData && clientData.name ? (
                  <div className="form-field full-width" style={{
                    background: '#f0f9ff',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}>
                    <Label style={{ color: '#1e40af', fontWeight: '600' }}>
                      ℹ️ Información del Cliente (Pre-cargada)
                    </Label>
                    <p style={{ marginTop: '0.5rem', color: '#1e3a8a' }}>
                      <strong>Inventor:</strong> {clientData.name}
                    </p>
                    {clientData.country && (
                      <p style={{ color: '#1e3a8a' }}>
                        <strong>País:</strong> {clientData.country}
                      </p>
                    )}
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Si necesitas modificar estos datos, actualiza la información del cliente.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="form-field">
                      <Label htmlFor="inventor_name">Nombre del Inventor *</Label>
                      <Input
                        id="inventor_name"
                        value={formData.inventor_name}
                        onChange={(e) => setFormData({ ...formData, inventor_name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <Label htmlFor="inventor_residence">Residencia del Inventor *</Label>
                      <Input
                        id="inventor_residence"
                        value={formData.inventor_residence}
                        onChange={(e) => setFormData({ ...formData, inventor_residence: e.target.value })}
                        required
                        placeholder="San Francisco, California, USA"
                      />
                    </div>
                  </>
                )}

                <div className="form-field full-width">
                  <Label htmlFor="technical_field">Campo Técnico</Label>
                  <Input
                    id="technical_field"
                    value={formData.technical_field}
                    onChange={(e) => setFormData({ ...formData, technical_field: e.target.value })}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={generating}
                  className="submit-button"
                  style={{ gridColumn: '1 / -1' }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Generando Patente Completa... (2-3 min)
                    </>
                  ) : (
                    <>
                      🚀 Generar Patente Completa
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step: Generating
  if (step === 'generating') {
    return (
      <div className="create-container">
        <div className="create-content" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Loader2 className="animate-spin mx-auto mb-4" size={64} style={{ color: '#667eea' }} />
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Generando Patente Completa USPTO...
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            ⏱️ Esto toma entre 8 y 10 minutos
          </p>
          <p style={{ color: '#888', fontSize: '0.95rem' }}>
            Generando 12 secciones + diagramas técnicos + reivindicaciones fortalecidas
          </p>
        </div>
      </div>
    );
  }

  // Step: Generation Started (redirect countdown)
  if (step === 'generation-started') {
    return (
      <div className="create-container">
        <div className="create-content" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              margin: '0 auto 1.5rem', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <FileText size={40} style={{ color: 'white' }} />
            </div>
          </div>
          
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#1a1a1a' }}>
            ✅ Patente Iniciada con Éxito
          </h1>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
            borderRadius: '16px',
            padding: '2rem',
            margin: '2rem auto',
            maxWidth: '600px',
            border: '2px solid #667eea40'
          }}>
            <p style={{ fontSize: '1.2rem', color: '#333', marginBottom: '1rem', fontWeight: '500' }}>
              🚀 Tu patente se está generando en segundo plano
            </p>
            <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1.5rem' }}>
              Tiempo estimado de generación: <strong>8-10 minutos</strong>
            </p>
            <div style={{ 
              fontSize: '0.95rem', 
              color: '#888',
              lineHeight: '1.6',
              textAlign: 'left',
              paddingLeft: '1rem'
            }}>
              <p style={{ marginBottom: '0.5rem' }}>✓ Generando 12 secciones técnicas</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Creando diagramas USPTO</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Formulando reivindicaciones</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Verificando formato legal</p>
            </div>
          </div>

          <div style={{ 
            marginTop: '3rem',
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '12px',
            maxWidth: '500px',
            margin: '3rem auto 0'
          }}>
            <p style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
              Redirigiendo a tu patente en...
            </p>
            <div style={{ 
              fontSize: '3rem', 
              fontWeight: 'bold', 
              color: '#667eea',
              marginBottom: '1rem'
            }}>
              {redirectCountdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Serás redirigido a la página de tu patente donde podrás ver el progreso de generación
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};


// Componente para crear patente directamente con título y propuesta ya definidos
const CreatePatentDirect = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    invention_title: '',
    invention_description: '',
    inventor_name: '',
    inventor_residence: '',
    technical_field: '',
    mode: 'provisional',
    language: 'es',
    client_id: null,
    applicant_cv: ''
  });
  const [step, setStep] = useState('form'); // 'form', 'generating', or 'generation-started'
  const [redirectCountdown, setRedirectCountdown] = useState(10);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);

  // Get client_id from URL params - using both methods for reliability
  const searchParams = new URLSearchParams(window.location.search);
  const clientIdFromSearch = searchParams.get('client_id');
  const clientId = clientIdFromSearch;

  // Debug logging
  console.log('[CreatePatentDirect] ===== CLIENT ID DEBUG =====');
  console.log('[CreatePatentDirect] window.location.href:', window.location.href);
  console.log('[CreatePatentDirect] window.location.search:', window.location.search);
  console.log('[CreatePatentDirect] clientId from search params:', clientIdFromSearch);
  console.log('[CreatePatentDirect] Final clientId:', clientId);
  console.log('[CreatePatentDirect] ================================');

  // Validate client_id and load client data
  React.useEffect(() => {
    console.log('[CreatePatentDirect useEffect] Checking clientId:', clientId);
    
    if (clientId) {
      console.log('[CreatePatentDirect] ✅ Client ID found:', clientId);
      setFormData(prev => ({ ...prev, client_id: clientId }));
      
      const loadClientData = async () => {
        setLoadingClientData(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/clients/${clientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setClientData(response.data);
          
          // Pre-fill inventor name and residence from client data
          const client = response.data;
          const residenceParts = [];
          
          if (client.city) residenceParts.push(client.city);
          if (client.state) residenceParts.push(client.state);
          if (client.country) residenceParts.push(client.country);
          
          const residence = residenceParts.join(', ') || '';
          
          setFormData(prev => ({ 
            ...prev, 
            inventor_name: client.name || '',
            inventor_residence: residence
          }));
        } catch (error) {
          console.error('Error loading client data:', error);
        } finally {
          setLoadingClientData(false);
        }
      };
      
      loadClientData();
    }
  }, [clientId, navigate]);

  const handleCVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingCV(true);
    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload-cv`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const analyzedCV = response.data.analyzed_cv;
        const extractedAddress = response.data.extracted_address || null;

        // Extract technical field from CV using AI
        try {
          const extractResponse = await axios.post(
            `${API}/patents/extract-technical-field`,
            { cv_text: analyzedCV },
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );

          if (extractResponse.data.technical_field) {
            setFormData(prev => ({
              ...prev,
              applicant_cv: analyzedCV,
              cv_extracted_address: extractedAddress,
              technical_field: extractResponse.data.technical_field
            }));
            toast.success('✅ CV analizado y campo técnico extraído exitosamente');
          } else {
            setFormData(prev => ({
              ...prev,
              applicant_cv: analyzedCV,
              cv_extracted_address: extractedAddress
            }));
            toast.success('✅ CV analizado. Por favor completa el campo técnico manualmente.');
          }
        } catch (extractError) {
          // If extraction fails, just save the CV
          setFormData(prev => ({
            ...prev,
            applicant_cv: analyzedCV,
            cv_extracted_address: extractedAddress
          }));
          toast.success('✅ CV analizado. Por favor completa el campo técnico manualmente.');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingCV(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.invention_title || !formData.invention_description) {
      toast.error('Por favor completa el título y la descripción de la invención');
      return;
    }

    if (!formData.applicant_cv) {
      toast.error('Por favor sube tu hoja de vida para continuar');
      return;
    }

    if (!formData.technical_field) {
      toast.error('Por favor completa el campo técnico');
      return;
    }

    // Cambiar a pantalla de carga
    setStep('generating');
    
    try {
      const token = localStorage.getItem('token');
      
      // Crear la patente con los datos proporcionados
      const response = await axios.post(
        `${API}/patents/start-interactive`,
        formData,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const patentId = response.data.id;
      const clientIdForRedirect = response.data.client_id || clientId || formData.client_id;
      
      // Iniciar generación completa en background (sin await)
      axios.post(
        `${API}/patents/${patentId}/generate-complete`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      ).catch(error => {
        console.error('Background generation error:', error);
      });
      
      // ✅ SOLUCIÓN: Redirigir al dashboard del cliente
      console.log('[Patent Direct] Patent created:', patentId);
      console.log('[Patent Direct] Redirecting to client dashboard:', clientIdForRedirect);
      
      toast.success('¡Patente creada exitosamente! La generación completa tomará aproximadamente 10 minutos.', { duration: 8000 });
      toast.info('Serás redirigido al dashboard del cliente en 8 segundos...', { duration: 8000 });
      
      // Redirigir al dashboard del cliente después de 8 segundos
      setTimeout(() => {
        if (clientIdForRedirect) {
          navigate(`/client-dashboard/${clientIdForRedirect}`);
        } else {
          // Fallback si no hay client_id
          navigate('/dashboard');
        }
      }, 8000);
      
    } catch (error) {
      console.error('Error creating/generating patent:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la patente');
      setStep('form'); // Volver al formulario si hay error
    }
  };

  // Step: Generating (pantalla de carga)
  if (step === 'generating') {
    return (
      <div className="create-container">
        <div className="create-content" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Loader2 className="animate-spin mx-auto mb-4" size={64} style={{ color: '#667eea' }} />
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 600 }}>
            Generando Patente Completa USPTO...
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            ⏱️ Esto puede tomar entre 3 y 5 minutos
          </p>
          <p style={{ color: '#888', fontSize: '0.95rem', marginBottom: '2rem' }}>
            Generando patente completa con todas las secciones en español e inglés
          </p>
          
          <div style={{ 
            maxWidth: '600px', 
            margin: '2rem auto', 
            padding: '1.5rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            textAlign: 'left'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#333' }}>
              🔄 Proceso en curso:
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, color: '#666' }}>
              <li style={{ marginBottom: '0.5rem' }}>✅ Analizando CV y perfil técnico</li>
              <li style={{ marginBottom: '0.5rem' }}>✅ Generando especificación técnica</li>
              <li style={{ marginBottom: '0.5rem' }}>⏳ Creando dibujos técnicos</li>
              <li style={{ marginBottom: '0.5rem' }}>⏳ Generando reivindicaciones</li>
              <li style={{ marginBottom: '0.5rem' }}>⏳ Traduciendo a español</li>
            </ul>
          </div>

          <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '2rem' }}>
            Por favor no cierres esta ventana. Serás redirigido automáticamente cuando esté lista.
          </p>
        </div>
      </div>
    );
  }

  // Step: Generation Started (redirect countdown)
  if (step === 'generation-started') {
    return (
      <div className="create-container">
        <div className="create-content" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              margin: '0 auto 1.5rem', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <FileText size={40} style={{ color: 'white' }} />
            </div>
          </div>
          
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#1a1a1a' }}>
            ✅ Patente Iniciada con Éxito
          </h1>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
            borderRadius: '16px',
            padding: '2rem',
            margin: '2rem auto',
            maxWidth: '600px',
            border: '2px solid #667eea40'
          }}>
            <p style={{ fontSize: '1.2rem', color: '#333', marginBottom: '1rem', fontWeight: '500' }}>
              🚀 Tu patente se está generando en segundo plano
            </p>
            <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1.5rem' }}>
              Tiempo estimado de generación: <strong>8-10 minutos</strong>
            </p>
            <div style={{ 
              fontSize: '0.95rem', 
              color: '#888',
              lineHeight: '1.6',
              textAlign: 'left',
              paddingLeft: '1rem'
            }}>
              <p style={{ marginBottom: '0.5rem' }}>✓ Generando 12 secciones técnicas</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Creando diagramas USPTO</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Formulando reivindicaciones</p>
              <p style={{ marginBottom: '0.5rem' }}>✓ Verificando formato legal</p>
            </div>
          </div>

          <div style={{ 
            marginTop: '3rem',
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '12px',
            maxWidth: '500px',
            margin: '3rem auto 0'
          }}>
            <p style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
              Redirigiendo a tu patente en...
            </p>
            <div style={{ 
              fontSize: '3rem', 
              fontWeight: 'bold', 
              color: '#667eea',
              marginBottom: '1rem'
            }}>
              {redirectCountdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Serás redirigido a la página de tu patente donde podrás ver el progreso de generación
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step: Form (formulario normal)
  return (
    <div className="create-container">
      <div className="create-header">
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/client-documents/${clientId}/patent`)}
        >
          <ArrowLeft className="mr-2" size={18} />
          Volver a Patentes
        </Button>
      </div>

      <div className="create-content">
        <div className="form-header">
          <Scale size={48} className="form-icon" />
          <h1 className="form-title">Redactar Patente con Propuesta Definida</h1>
          <p className="form-subtitle">
            Proporciona el título y la descripción de tu invención para generar la patente USPTO provisional
          </p>
        </div>

        <Card className="form-card">
          <CardContent style={{ padding: '2rem' }}>
            <form onSubmit={handleSubmit} className="form-grid">
              
              {/* Título de la Invención */}
              <div className="form-field full-width">
                <Label htmlFor="invention_title">
                  Título de la Invención *
                </Label>
                <Input
                  id="invention_title"
                  value={formData.invention_title}
                  onChange={(e) => setFormData({ ...formData, invention_title: e.target.value })}
                  placeholder="Ej: Sistema de IA para Detección de Fraudes en Tiempo Real"
                  required
                />
              </div>

              {/* Descripción/Propuesta de la Invención */}
              <div className="form-field full-width">
                <Label htmlFor="invention_description">
                  Descripción de la Invención *
                </Label>
                <Textarea
                  id="invention_description"
                  value={formData.invention_description}
                  onChange={(e) => setFormData({ ...formData, invention_description: e.target.value })}
                  placeholder="Describe tu invención en detalle: problema que resuelve, cómo funciona, componentes principales, ventajas técnicas..."
                  rows={10}
                  required
                />
                <p className="text-xs text-gray-600 mt-2">
                  Proporciona una descripción detallada de tu invención. Esta información se usará para generar todas las secciones de la patente.
                </p>
              </div>

              {/* Upload CV para extraer campo técnico */}
              <div className="form-field full-width">
                <Label>Subir Hoja de Vida *</Label>
                <div className="space-y-2">
                  <input
                    type="file"
                    id="cv-upload-direct"
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={handleCVUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('cv-upload-direct').click()}
                    disabled={uploadingCV}
                    className="w-full"
                  >
                    {uploadingCV ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        Analizando CV...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2" size={16} />
                        {formData.applicant_cv ? '✅ CV Cargado - Subir Otro' : 'Subir CV (PDF, DOC, DOCX)'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-600">
                    Sube tu hoja de vida y extraeremos automáticamente tu campo técnico. Puedes editarlo después si es necesario.
                  </p>
                </div>
              </div>

              {/* Campo Técnico */}
              <div className="form-field full-width">
                <Label htmlFor="technical_field">
                  Campo Técnico *
                </Label>
                <Input
                  id="technical_field"
                  value={formData.technical_field}
                  onChange={(e) => setFormData({ ...formData, technical_field: e.target.value })}
                  placeholder="Ej: Inteligencia Artificial, Machine Learning"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  {formData.technical_field ? 
                    '✅ Campo técnico establecido. Puedes editarlo si es necesario.' : 
                    'Se extraerá automáticamente del CV o puedes ingresarlo manualmente.'
                  }
                </p>
              </div>

              {/* Nombre del Inventor */}
              <div className="form-field">
                <Label htmlFor="inventor_name">
                  Nombre del Inventor *
                </Label>
                <Input
                  id="inventor_name"
                  value={formData.inventor_name}
                  onChange={(e) => setFormData({ ...formData, inventor_name: e.target.value })}
                  placeholder="Nombre completo"
                  required
                />
              </div>

              {/* Residencia del Inventor */}
              <div className="form-field full-width">
                <Label htmlFor="inventor_residence">
                  Ciudad, Estado, País *
                </Label>
                <Input
                  id="inventor_residence"
                  value={formData.inventor_residence}
                  onChange={(e) => setFormData({ ...formData, inventor_residence: e.target.value })}
                  placeholder="Ej: San Francisco, CA, USA"
                  required
                />
              </div>

              {/* Botón de Submit */}
              <div className="form-field full-width" style={{ marginTop: '1.5rem' }}>
                <Button 
                  type="submit" 
                  disabled={!formData.invention_title || !formData.invention_description || !formData.applicant_cv || !formData.technical_field}
                  className="submit-button"
                  style={{ width: '100%' }}
                >
                  <FileText className="mr-2" size={18} />
                  Generar Patente USPTO
                </Button>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Se generará la patente completa con todas las secciones en español e inglés. Esto puede tomar 3-5 minutos.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ViewPatentV2 = () => {
  const { patentId } = useParams();
  const navigate = useNavigate();
  const [patent, setPatent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatent();
  }, [patentId]);

  const fetchPatent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/patents/${patentId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPatent(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar patente');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!patent) {
    return <div>Patente no encontrada</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate('/dashboard')}
        style={{
          marginBottom: '2rem',
          padding: '0.5rem 1rem',
          background: 'transparent',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <ArrowLeft size={20} />
        Volver
      </button>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{patent.invention_title}</h1>
            <p style={{ color: '#666' }}>
              {patent.technical_field} • {patent.sections?.length || 0} secciones
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => window.open(`${API}/patents/${patentId}/download-complete?language=en`, '_blank')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Download size={20} />
              Descargar PDF Completo (Incluye Algoritmo)
            </button>
            <WordDownloadButton
              url={`${API}/patents/${patentId}/download-docx`}
              testId="download-word-en-patent"
            />
            {/* 🔥 HIDDEN: Numbered document now included automatically in ZIP
            <button
              onClick={() => window.open(`${API}/patents/${patentId}/download-numbered?language=en`, '_blank')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              title="Formato USPTO con líneas numeradas"
            >
              <Download size={20} />
              PDF con Líneas Numeradas
            </button>
            */}
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Secciones Generadas</h2>
          {patent.sections?.map((section) => (
            <div 
              key={section.number}
              style={{
                padding: '1.5rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '1rem',
                background: '#f9f9f9'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{section.number}. {section.title}</h3>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  ES: {section.content_es?.length || 0} chars | EN: {section.content_en?.length || 0} chars
                </div>
              </div>
              {section.number === 10 && section.content_es && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '4px' }}>
                  <strong>Vista previa:</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    {section.content_es.substring(0, 200)}...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// ========================================
// CASE STUDY COMPONENTS
// ========================================

const CreateCaseStudy = () => {
  const navigate = useNavigate();
  const { clientId: paramClientId } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = paramClientId || searchParams.get('client_id');
  const [title, setTitle] = useState('');
  const [projectFile, setProjectFile] = useState(null);
  const [cvFile, setCvFile] = useState(null); // Campo separado para CV
  const [supportFiles, setSupportFiles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState('input'); // input, generating, success
  const [redirectCountdown, setRedirectCountdown] = useState(10);
  const [generatedStudyId, setGeneratedStudyId] = useState(null);

  // Handle countdown and redirect when generation starts
  React.useEffect(() => {
    if (step !== 'success') return;
    
    let timeLeft = 10;
    const countdownInterval = setInterval(() => {
      timeLeft--;
      setRedirectCountdown(timeLeft);
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        // Redirect to dashboard
        window.location.href = `/client-dashboard/${clientId}`;
      }
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [step, clientId]);

  const handleGenerate = async () => {
    if (!projectFile) {
      toast.error('Por favor sube la descripción del proyecto');
      return;
    }

    if (!clientId) {
      toast.error('Client ID no encontrado');
      return;
    }

    setGenerating(true);
    setStep('generating');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('project_description', projectFile);
      formData.append('client_id', clientId);
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      
      // Add CV file if provided (as cv_file parameter)
      if (cvFile) {
        formData.append('cv_file', cvFile);
      }
      
      // Add other support files
      supportFiles.forEach((file) => {
        formData.append('support_files', file);
      });

      const response = await axios.post(
        `${API}/case-studies/generate`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Show success screen and start countdown to redirect
      setGeneratedStudyId(response.data.id);
      setStep('success');
      toast.success('✅ Generación iniciada. El documento se creará en segundo plano.');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al generar caso de estudio');
      setStep('input');
    } finally {
      setGenerating(false);
    }
  };

  // Pantalla de generación en progreso
  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <Button variant="ghost" onClick={() => {
            setStep('input');
            setGenerating(false);
          }}>
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
            {/* Logo animado */}
            <div style={{ 
              width: '120px', 
              height: '120px', 
              margin: '0 auto 30px',
              backgroundColor: '#166534',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s ease-in-out infinite',
              boxShadow: '0 0 40px rgba(22,101,52,0.3)'
            }}>
              <span style={{ fontSize: '48px', color: '#fff' }}>📚</span>
            </div>

            {/* Barra de progreso indeterminada */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '30%',
                  height: '100%',
                  backgroundColor: '#166534',
                  animation: 'loading 1.5s ease-in-out infinite',
                  borderRadius: '4px'
                }}></div>
              </div>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '10px', color: '#166534' }}>
              Preparando Caso de Estudio...
            </h2>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
              Por favor espera mientras procesamos tu solicitud
            </p>
            <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.8' }}>
              <p>✨ Validando documentos...</p>
              <p>📤 Enviando al servidor...</p>
            </div>
          </div>
        </div>
        
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(200%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </div>
    );
  }

  // Pantalla de éxito con countdown
  if (step === 'success') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
            {/* Logo animado de éxito */}
            <div style={{ 
              width: '120px', 
              height: '120px', 
              margin: '0 auto 30px',
              backgroundColor: '#166534',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 40px rgba(22,101,52,0.3)'
            }}>
              <span style={{ fontSize: '48px', color: '#fff' }}>✓</span>
            </div>

            <div style={{ 
              backgroundColor: '#f0fdf4', 
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '30px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', color: '#166534' }}>
                ¡Generación Iniciada!
              </h2>
              <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8', marginBottom: '20px' }}>
                Su caso de estudio empresarial se está generando en segundo plano.
              </p>
              <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8', marginBottom: '20px' }}>
                ⏱️ Estará listo en aproximadamente 2-3 minutos.
              </p>
              <p style={{ fontSize: '16px', color: '#15803d', lineHeight: '1.8' }}>
                💼 Mientras tanto, puede continuar trabajando en otros documentos.
              </p>
            </div>
            
            <div style={{ 
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px'
            }}>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Redirigiendo al dashboard en {redirectCountdown} segundo{redirectCountdown !== 1 ? 's' : ''}...
              </p>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${((10 - redirectCountdown) / 10) * 100}%`,
                  height: '100%',
                  backgroundColor: '#166534',
                  transition: 'width 1s linear'
                }}></div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button 
                variant="outline"
                onClick={() => navigate(`/client-dashboard/${clientId}`)}
                style={{ borderColor: '#166534', color: '#166534' }}
              >
                Ir al Dashboard Ahora
              </Button>
              {generatedStudyId && (
                <Button 
                  onClick={() => navigate(`/view-case-study/${generatedStudyId}`)}
                  style={{ backgroundColor: '#166534', color: 'white' }}
                >
                  Ver Caso de Estudio
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de formulario (input)
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(`/client-documents/${clientId}/casestudy`)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver
          </Button>
          <div>
            <h1 className="app-title">📚 Caso de Estudio Empresarial</h1>
            <p className="app-subtitle">
              Estilo Harvard Business School • 3,000-4,000 palabras • Bilingüe (EN/ES)
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>
        <Card style={{ padding: '2rem' }}>
          <form
            onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerate(); }}
            autoComplete="off"
          >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#166534' }}>
            Generar Caso de Estudio Empresarial
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            Estilo Harvard Business School • 3,000-4,000 palabras • Bilingüe (EN/ES)
          </p>

          {/* 1. Descripción del Proyecto (Obligatorio) */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#166534' }}>
              Descripción del Proyecto (Obligatorio) *
            </label>
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => {
                e.stopPropagation();
                const f = e.target.files && e.target.files[0];
                if (f) setProjectFile(f);
              }}
              data-testid="project-file-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px dashed #166534',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
            {projectFile && (
              <p style={{ marginTop: '0.5rem', color: '#166534', fontSize: '0.875rem' }}>
                ✓ {projectFile.name}
              </p>
            )}
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Sube el plan de negocio o descripción detallada del proyecto
            </p>
          </div>

          {/* 2. CV del Beneficiario (Recomendado) - CRÍTICO para evitar información inventada */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#166534' }}>
              📋 Curriculum Vitae del Beneficiario (Recomendado)
            </label>
            <div style={{ 
              background: '#fef3c7', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              marginBottom: '0.5rem',
              border: '1px solid #f59e0b',
              fontSize: '0.8rem',
              color: '#92400e'
            }}>
              <strong>⚠️ Importante:</strong> Sin el CV, el sistema podría generar información ficticia sobre la experiencia del cliente.
              Sube el CV para garantizar que el documento refleje datos reales.
            </div>
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => {
                e.stopPropagation();
                const f = e.target.files && e.target.files[0];
                if (f) setCvFile(f);
              }}
              data-testid="cv-file-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px dashed #f59e0b',
                borderRadius: '8px',
                cursor: 'pointer',
                background: '#fffbeb'
              }}
            />
            {cvFile && (
              <p style={{ marginTop: '0.5rem', color: '#166534', fontSize: '0.875rem' }}>
                ✓ {cvFile.name}
              </p>
            )}
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Formatos aceptados: PDF, DOCX, DOC, TXT
            </p>
          </div>

          {/* 3. Título (Opcional) */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#166534' }}>
              Título del Caso de Estudio (Opcional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Transformación Digital en Logística de Carga"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Si no especificas un título, se generará automáticamente basado en el proyecto
            </p>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#166534' }}>
              Archivos de Soporte Adicionales (Opcional)
            </label>
            <input
              type="file"
              multiple
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => {
                e.stopPropagation();
                setSupportFiles(Array.from(e.target.files || []));
              }}
              data-testid="support-files-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px dashed #15803d',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
            {supportFiles.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                {supportFiles.map((file, idx) => (
                  <p key={idx} style={{ color: '#15803d', fontSize: '0.875rem' }}>
                    ✓ {file.name}
                  </p>
                ))}
              </div>
            )}
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Documentos adicionales: estudios de mercado, reportes, etc.
            </p>
          </div>

          <div style={{ 
            background: '#f0fdf4', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '2rem',
            border: '1px solid #166534'
          }}>
            <h3 style={{ fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
              📋 Estructura del Caso de Estudio:
            </h3>
            <ul style={{ color: '#15803d', fontSize: '0.875rem', marginLeft: '1.5rem' }}>
              <li>I. Cover Page (HBS-style)</li>
              <li>II. Company/Entity Context</li>
              <li>III. Challenge (National Scale)</li>
              <li>IV. Solution (Implementation Details)</li>
              <li>V. Results with Metrics</li>
              <li>VI. Testimonials & Validations</li>
              <li>VII. Lessons Learned & National Scalability</li>
            </ul>
          </div>

          <Button
            type="submit"
            disabled={!projectFile || generating}
            data-testid="generate-case-study-btn"
            style={{
              width: '100%',
              padding: '1rem',
              background: generating ? '#9ca3af' : '#166534',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            <FileText className="mr-2" size={20} />
            Generar Caso de Estudio
          </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

// ============================================================================
// COMPONENTE: ViewCaseStudy - Vista de Casos de Estudio Empresariales
// Versión: 2.0.0 - ReactMarkdown con formato completo
// ============================================================================
const ViewCaseStudy = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseStudy, setCaseStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');

  // Función de limpieza de marcadores mejorada
  const removeAllMarkers = (text) => {
    if (!text) return '';
    
    return text
      // Remover bloques de código markdown al inicio y final
      .replace(/^```markdown\s*/gi, '')
      .replace(/^```\s*/gi, '')
      .replace(/\s*```$/gi, '')
      // Remover marcadores con guión largo
      .replace(/\s*—\s*\[SM\]/gi, '')
      .replace(/\s*—\s*\[NI\]/gi, '')
      .replace(/\s*—\s*\[PR\]/gi, '')
      // Remover marcadores simples
      .replace(/\s*\[SM\]/gi, '')
      .replace(/\s*\[NI\]/gi, '')
      .replace(/\s*\[PR\]/gi, '')
      // Remover marcadores con paréntesis
      .replace(/\s*\(SM\)/gi, '')
      .replace(/\s*\(NI\)/gi, '')
      .replace(/\s*\(PR\)/gi, '')
      // Remover marcadores standalone (pero no en medio de palabras)
      .replace(/\b\s*SM\s*\b/g, ' ')
      .replace(/\b\s*NI\s*\b/g, ' ')
      .replace(/\b\s*PR\s*\b/g, ' ')
      // Limpiar espacios múltiples horizontales SOLO (no saltos de línea)
      .replace(/[^\S\r\n]{2,}/g, ' ')
      .trim();
  };

  useEffect(() => {
    loadCaseStudy();
  }, [id]);

  const loadCaseStudy = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/case-studies/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCaseStudy(response.data);
      setEditedContent(response.data.content_en);
      setCurrentLanguage(response.data.current_language || 'en');
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar caso de estudio:', error);
      toast.error('Error al cargar caso de estudio');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('content_en', editedContent);
      formData.append('content_es', caseStudy.content_es || '');
      formData.append('current_language', currentLanguage);

      await axios.put(`${API}/case-studies/${id}`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      toast.success('✅ Cambios guardados exitosamente');
      setIsEditing(false);
      loadCaseStudy();
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar cambios');
    }
  };

  const handleDownload = async (language) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/case-studies/${id}/download?language=${language}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const contentDisposition = response.headers['content-disposition'];
      let filename = `Case_Study_${language.toUpperCase()}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const langText = language === 'es' ? 'español' : 'inglés';
      toast.success(`✅ PDF descargado en ${langText}`);
    } catch (error) {
      console.error('Error al descargar:', error);
      toast.error('Error al descargar PDF');
    }
  };

  const handleGoBack = () => {
    if (caseStudy && caseStudy.client_id) {
      navigate(`/client-documents/${caseStudy.client_id}/casestudy`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleLanguageChange = () => {
    const newLang = currentLanguage === 'en' ? 'es' : 'en';
    setCurrentLanguage(newLang);
    setEditedContent(newLang === 'en' ? caseStudy.content_en : caseStudy.content_es);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <Loader2 className="animate-spin" size={48} color="#166534" />
      </div>
    );
  }

  if (!caseStudy) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <Card style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.125rem', color: '#374151' }}>Caso de estudio no encontrado</p>
          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Volver al Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Obtener contenido según idioma y limpiar marcadores
  const rawContent = currentLanguage === 'es' ? caseStudy.content_es : caseStudy.content_en;
  const cleanContent = removeAllMarkers(rawContent);
  
  // Debug para verificar que el componente está actualizado
  console.log('[ViewCaseStudy v2.0.0] Component loaded');
  console.log('[ViewCaseStudy] Clean content length:', cleanContent?.length);
  console.log('[ViewCaseStudy] First 100 chars:', cleanContent?.substring(0, 100));

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Barra de acciones superior */}
      <div style={{ 
        background: 'white', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '1rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleGoBack} size="sm">
            <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
            Volver
          </Button>

          <Button
            onClick={() => setIsEditing(!isEditing)}
            style={{ background: isEditing ? '#dc2626' : '#166534', color: 'white' }}
            size="sm"
          >
            <Edit size={16} style={{ marginRight: '0.5rem' }} />
            {isEditing ? 'Cancelar' : 'Editar'}
          </Button>

          <Button onClick={handleLanguageChange} variant="outline" size="sm">
            <Globe size={16} style={{ marginRight: '0.5rem' }} />
            {currentLanguage === 'en' ? '🇪🇸 Ver en Español' : '🇺🇸 View in English'}
          </Button>

          <Button onClick={() => handleDownload('en')} style={{ background: '#166534', color: 'white' }} size="sm">
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            PDF EN
          </Button>

          <Button onClick={() => handleDownload('es')} style={{ background: '#15803d', color: 'white' }} size="sm">
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            PDF ES
          </Button>

          <WordDownloadButton
            url={`${API}/case-studies/${id}/download-docx`}
            testId="download-word-en-casestudy"
            size="sm"
          />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="view-content">
        {/* ✅ Evaluación de Coherencia para Casos de Estudio Empresariales */}
        {caseStudy && caseStudy.coherence_evaluation && (
          <Card style={{ 
            marginBottom: '1.5rem',
            borderColor: caseStudy.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        caseStudy.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444',
            backgroundColor: caseStudy.coherence_evaluation.coherence_score >= 80 ? '#f0fdf4' : 
                            caseStudy.coherence_evaluation.coherence_score >= 50 ? '#fffbeb' : '#fef2f2'
          }}>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} style={{ color: caseStudy.coherence_evaluation.coherence_score >= 80 ? '#10b981' : '#f59e0b' }} />
                  Evaluación de Coherencia
                </CardTitle>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: caseStudy.coherence_evaluation.coherence_score >= 80 ? '#10b981' : 
                        caseStudy.coherence_evaluation.coherence_score >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {caseStudy.coherence_evaluation.coherence_score}/100
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p style={{ marginBottom: '1rem', color: '#374151' }}>
                {caseStudy.coherence_evaluation.summary}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Refleja CV: </span>
                  <span style={{ fontWeight: '500' }}>{caseStudy.coherence_evaluation.reflects_cv || 'N/A'}</span>
                </div>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Proyecto integrado: </span>
                  <span style={{ fontWeight: '500' }}>{caseStudy.coherence_evaluation.project_integrated || 'N/A'}</span>
                </div>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Años experiencia: </span>
                  <span style={{ fontWeight: '500' }}>{caseStudy.coherence_evaluation.correct_experience_years || 'N/A'}</span>
                </div>
                <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#6b7280' }}>Info inventada: </span>
                  <span style={{ fontWeight: '500', color: caseStudy.coherence_evaluation.invented_info === 'No' ? '#10b981' : '#ef4444' }}>
                    {caseStudy.coherence_evaluation.invented_info || 'N/A'}
                  </span>
                </div>
              </div>
              {caseStudy.coherence_evaluation.recommendation && (
                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: '500', color: '#374151' }}>💡 Recomendación: </span>
                  <span style={{ color: '#6b7280' }}>{caseStudy.coherence_evaluation.recommendation}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {caseStudy && !isEditing && (
          <div className="document-header">
            <h1 className="document-title">{caseStudy.title || 'Business Case Study'}</h1>
            <p className="document-meta">
              {caseStudy.author_name || 'Case Study'} • {new Date(caseStudy.created_at).toLocaleDateString('es', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        )}

        <Card className="editor-card">
          <CardContent className="p-6">
            {isEditing ? (
              /* Modo de edición */
              <div style={{ display: 'flex', gap: '1.5rem', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                    📝 Editor de Markdown
                  </h3>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '600px',
                      padding: '1rem',
                      border: '2px solid #166534',
                      borderRadius: '0.5rem',
                      fontSize: '0.925rem',
                      fontFamily: 'Monaco, Consolas, monospace',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    placeholder="Escribe tu contenido en Markdown aquí..."
                  />
                  <Button
                    onClick={handleSave}
                    style={{ marginTop: '1rem', background: '#166534', color: 'white', padding: '0.75rem 1.5rem' }}
                  >
                    <Save size={18} style={{ marginRight: '0.5rem' }} />
                    Guardar Cambios
                  </Button>
                </div>
                
                <div style={{ 
                  flex: 1, 
                  borderLeft: '2px solid #e5e7eb', 
                  paddingLeft: '1.5rem',
                  maxHeight: '700px',
                  overflowY: 'auto'
                }}>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                    👁️ Vista Previa
                  </h3>
                  <div className="prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {removeAllMarkers(editedContent)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              /* Modo de vista - usando ReactMarkdown para mejor compatibilidad */
              <div 
                className="prose max-w-none case-study-markdown-content" 
                style={{
                  minHeight: '500px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {cleanContent}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Estilos CSS adicionales para case studies */}
      <style>{`
        /* Sobrescribir cualquier estilo de pre/code que pueda causar fondo azul */
        .prose pre {
          background-color: #1f2937 !important;
          color: #f9fafb !important;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .prose code {
          background-color: #f3f4f6 !important;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: Monaco, Consolas, monospace;
          color: #dc2626 !important;
        }

        .prose pre code {
          background-color: transparent !important;
          padding: 0;
          color: #f9fafb !important;
        }

        /* Asegurar que el contenido principal NO sea un code block */
        .prose > pre:only-child {
          background: transparent !important;
          color: inherit !important;
          padding: 0 !important;
          font-family: Georgia, serif !important;
          white-space: normal !important;
          overflow: visible !important;
        }

        .prose > pre:only-child code {
          background: transparent !important;
          color: inherit !important;
          font-family: Georgia, serif !important;
          white-space: normal !important;
        }

        .prose h1 {
          font-size: 2rem !important;
          font-weight: 700 !important;
          margin: 2rem 0 1rem !important;
          color: #111827 !important;
          border-bottom: 2px solid #166534 !important;
          padding-bottom: 0.5rem !important;
        }

        .prose h2 {
          font-size: 1.75rem !important;
          font-weight: 600 !important;
          margin: 2rem 0 1rem !important;
          color: #1f2937 !important;
        }

        .prose h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin: 1.5rem 0 0.75rem !important;
          color: #374151 !important;
        }

        .prose p {
          margin-bottom: 1rem !important;
          line-height: 1.8 !important;
          text-align: justify !important;
          color: #374151 !important;
        }

        .prose strong {
          font-weight: 600 !important;
          color: #111827 !important;
        }

        .prose ul, .prose ol {
          margin: 1rem 0 !important;
          padding-left: 2rem !important;
        }

        .prose li {
          margin-bottom: 0.5rem !important;
        }

        .prose blockquote {
          border-left: 4px solid #166534 !important;
          padding-left: 1rem !important;
          margin: 1rem 0 !important;
          color: #6b7280 !important;
          font-style: italic !important;
        }

        .prose a {
          color: #166534 !important;
          text-decoration: underline !important;
        }

        .prose a:hover {
          color: #15803d !important;
        }
      `}</style>
    </div>
  );
};


export default App;