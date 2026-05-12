import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Book, Download, Trash2, Edit, Plus, Loader2, ArrowLeft, ArrowRight, Save, Scale, TrendingUp, CheckCircle, RefreshCw, Upload, FileBarChart, Briefcase, Globe, Mail, UserCheck, Award, BarChart3, History, MessageSquare, Send, Check, X, User, Users, Grid3x3, List, Search, Settings, Layers, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Eye } from 'lucide-react';
import AsyncSelect from 'react-select/async';
import { useActivityPolling } from '../hooks/useActivityPolling';
import { API, BACKEND_URL, LOGO_URL } from '../utils/constants';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    total_clients: 0,
    total_documents: 0,
    in_progress: 0,
    completed: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [viewAllClients, setViewAllClients] = useState(false); // Estado para el filtro
  const [editingClient, setEditingClient] = useState(null); // Cliente en edición
  
  // Nuevos estados para filtros
  const [usersList, setUsersList] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState('all'); // Filtro por creador (default: all)
  const [showDocDetails, setShowDocDetails] = useState({}); // Para mostrar detalles de documentos
  const [clientDocuments, setClientDocuments] = useState({}); // Documentos detallados por cliente
  const [loadingDocs, setLoadingDocs] = useState({}); // Loading state para documentos
  
  // Estados para vista y búsqueda
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [searchQuery, setSearchQuery] = useState(''); // Búsqueda de clientes
  const [searchResults, setSearchResults] = useState(null); // Resultados de búsqueda del servidor
  const [isSearching, setIsSearching] = useState(false); // Loading de búsqueda
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const clientsPerPage = 50;
  
  // Activity polling para actividad en tiempo real (replaces WebSocket)
  const { activities: pollingActivities, isConnected } = useActivityPolling(user?.id);
  
  const [newClientData, setNewClientData] = useState({
    name: '', email: '', phone: '', company: '', country: '',
    city: '', state: '', street_address: '', postal_code: '', industry: '', notes: '', tags: []
  });

  // External panel client search
  const [externalQuery, setExternalQuery] = useState('');
  const [externalResults, setExternalResults] = useState([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [externalErrors, setExternalErrors] = useState([]);
  const [selectedExternalClient, setSelectedExternalClient] = useState(null);
  const externalSearchTimer = useRef(null);
  const externalSearchIdRef = useRef(0); // tracks the latest search to discard stale responses
  const [newClientMode, setNewClientMode] = useState('external'); // 'external' | 'manual'

  useEffect(() => {
    loadUsersList();
  }, []);

  // Search external panel clients with debounce — minimum 3 characters
  useEffect(() => {
    if (showClientModal && !editingClient) {
      // Don't search on empty query — just clear results
      if (!externalQuery || externalQuery.length === 0) {
        setExternalResults([]);
        setExternalErrors([]);
        return;
      }
      if (externalQuery.length < 3) {
        setExternalResults([]);
        setExternalErrors([]);
        return;
      }
      clearTimeout(externalSearchTimer.current);
      externalSearchTimer.current = setTimeout(() => {
        searchExternalClients(externalQuery);
      }, 500);
    }
    return () => clearTimeout(externalSearchTimer.current);
  }, [externalQuery, showClientModal, editingClient]);

  const searchExternalClients = async (q) => {
    if (!q || !q.trim()) return; // Never search with empty query
    // Stamp this search with a unique ID — discard response if a newer search started
    const searchId = ++externalSearchIdRef.current;
    setIsSearchingExternal(true);
    setExternalErrors([]);
    try {
      // Pass the panel token (from iframe URL ?token=) directly so the backend can
      // use it to authenticate against the external panel API
      const panelToken = window.__IFRAME_TOKEN__ || '';
      const res = await axios.get(
        `${API}/external/search-clients?q=${encodeURIComponent(q)}&panel_token=${encodeURIComponent(panelToken)}`,
        { timeout: 20000 }
      );
      // Ignore stale responses — only update state if this is still the latest search
      if (searchId !== externalSearchIdRef.current) return;
      setExternalResults(res.data.clients || []);
      if (res.data.errors?.length) setExternalErrors(res.data.errors);
    } catch (err) {
      if (searchId !== externalSearchIdRef.current) return; // ignore stale errors
      const detail = err.response?.data?.detail || 'Error al buscar clientes del panel';
      setExternalErrors([detail]);
      setExternalResults([]);
    } finally {
      if (searchId === externalSearchIdRef.current) setIsSearchingExternal(false);
    }
  };

  const handleImportExternalClient = async (client) => {
    setSelectedExternalClient(client);
    setIsCreatingClient(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: client.name || 'Sin nombre',
        email: client.email || `importado_${Date.now()}@panel.ext`,
        phone: client.phone || '',
        company: client.company || '',
        country: client.country || '',
        city: client.city || '',
        state: client.state || '',
        industry: client.industry || '',
        notes: [client.notes, `Importado de: ${client.external_source} (ID: ${client.external_id})`].filter(Boolean).join(' | '),
        tags: ['importado-panel']
      };
      await axios.post(`${API}/clients`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(`✅ Cliente "${client.name}" importado exitosamente`);
      setShowClientModal(false);
      setExternalQuery('');
      setExternalResults([]);
      setSelectedExternalClient(null);
      loadDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al importar el cliente');
    } finally {
      setIsCreatingClient(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [viewAllClients, selectedCreator, currentPage]); // Recargar cuando cambie el filtro o la página
  
  // Búsqueda en el servidor con debounce
  useEffect(() => {
    const searchClients = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults(null);
        return;
      }
      
      setIsSearching(true);
      try {
        const response = await axios.get(`${API}/clients/search?q=${encodeURIComponent(searchQuery)}&limit=100`);
        setSearchResults(response.data.clients || []);
      } catch (error) {
        console.error('Error searching clients:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };
    
    // Debounce de 300ms
    const timeoutId = setTimeout(searchClients, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  
  // Reset página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCreator]);
  
  // Actualizar actividades desde polling
  useEffect(() => {
    if (pollingActivities.length > 0) {
      setRecentActivity(pollingActivities);
    }
  }, [pollingActivities]);

  const loadUsersList = async () => {
    try {
      const response = await axios.get(`${API}/users/list`);
      setUsersList(response.data.users || []);
    } catch (error) {
      console.error('Error loading users list:', error);
    }
  };

  const loadClientDocuments = async (clientId) => {
    // Verificar si este cliente ya está expandido
    if (showDocDetails[clientId]) {
      // Si ya está expandido, solo cerrarlo
      setShowDocDetails(prev => ({...prev, [clientId]: false}));
      return;
    }
    
    // Comportamiento de acordeón: cerrar todos los demás clientes
    // Solo este cliente quedará expandido
    if (!clientDocuments[clientId]) {
      // Si no están cargados, cargarlos primero
      setLoadingDocs(prev => ({...prev, [clientId]: true}));
      try {
        const response = await axios.get(`${API}/clients/${clientId}/documents-detail`);
        setClientDocuments(prev => ({...prev, [clientId]: response.data.documents || []}));
        // Cerrar todos y abrir solo este
        setShowDocDetails({[clientId]: true});
      } catch (error) {
        console.error('Error loading client documents:', error);
        toast.error('Error al cargar documentos detallados');
      } finally {
        setLoadingDocs(prev => ({...prev, [clientId]: false}));
      }
    } else {
      // Ya están cargados, solo mostrar (cerrar todos los demás)
      setShowDocDetails({[clientId]: true});
    }
  };
  
  // Función para filtrar y ordenar clientes
  const getFilteredAndSortedClients = () => {
    // Si hay búsqueda y resultados del servidor, usar esos
    if (searchQuery.trim().length >= 2 && searchResults !== null) {
      let filtered = [...searchResults];
      
      // Ordenar alfabéticamente por nombre (especialmente para vista de lista)
      if (viewMode === 'list') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
      }
      
      return filtered;
    }
    
    // Si no hay búsqueda, usar clientes cargados inicialmente
    let filtered = [...clients];
    
    // Ordenar alfabéticamente por nombre (especialmente para vista de lista)
    if (viewMode === 'list') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
    }
    
    return filtered;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Construir query params con paginación
      const createdByParam = (selectedCreator && selectedCreator !== 'all') ? `&created_by=${selectedCreator}` : '';
      
      const [clientsRes, statsRes, activityRes] = await Promise.all([
        axios.get(`${API}/clients?limit=${clientsPerPage}&page=${currentPage}${createdByParam}`),
        axios.get(`${API}/dashboard/overview?view_all=${viewAllClients}`),
        axios.get(`${API}/dashboard/recent-activity?limit=10`)
      ]);
      
      setClients(clientsRes.data.clients || []);
      setTotalPages(clientsRes.data.pages || 1);
      setTotalClients(clientsRes.data.total || 0);
      setDashboardStats(statsRes.data);
      setRecentActivity(activityRes.data.activities || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setNewClientData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      country: client.country || '',
      city: client.city || '',
      state: client.state || '',
      street_address: client.street_address || '',
      postal_code: client.postal_code || '',
      industry: client.industry || '',
      notes: client.notes || '',
      tags: client.tags || []
    });
    setShowClientModal(true);
  };

  const handleUpdateClient = async () => {
    if (isCreatingClient) return;
    
    try {
      setIsCreatingClient(true);
      const token = localStorage.getItem('token');
      
      await axios.put(`${API}/clients/${editingClient.id}`, newClientData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success('Cliente actualizado exitosamente');
      setShowClientModal(false);
      setEditingClient(null);
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        company: '',
        country: '',
        city: '',
        state: '',
        street_address: '',
        postal_code: '',
        notes: '',
        industry: '',
        tags: []
      });
      loadDashboardData();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Error al actualizar cliente');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleCreateClient = async () => {
    // Prevenir doble click
    if (isCreatingClient) return;
    
    try {
      if (!newClientData.name || !newClientData.email) {
        toast.error('Nombre y email son requeridos');
        return;
      }

      setIsCreatingClient(true);
      await axios.post(`${API}/clients`, newClientData);
      toast.success('Cliente creado exitosamente');
      setShowClientModal(false);
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        company: '',
        country: '',
        city: '',
        state: '',
        street_address: '',
        postal_code: '',
        industry: '',
        notes: '',
        tags: []
      });
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear cliente');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleDeleteClient = async (clientId, clientName, e) => {
    e.stopPropagation(); // Evitar que se navegue al cliente
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al cliente "${clientName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/clients/${clientId}`);
      toast.success('Cliente eliminado exitosamente');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar cliente');
    }
  };

  const loadClientOptions = async (inputValue) => {
    if (inputValue.length < 2) return [];
    
    try {
      const response = await axios.get(`${API}/clients/search?q=${inputValue}&limit=20`);
      return response.data.clients.map(c => ({
        value: c.id,
        label: `${c.name} (${c.email})`,
        client: c
      }));
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  };

  const handleQuickCreate = (client, docType) => {
    // Navegar a crear documento con client_id en la URL
    const routes = {
      'niw': `/create-business-plan?client_id=${client.value}`,
      'patent': `/create-patent?client_id=${client.value}`,
      'book': `/create-book?client_id=${client.value}`,
      'study': `/create-econometric-study?client_id=${client.value}`,
      'whitepaper': `/create-whitepaper?client_id=${client.value}`,
      'translation': `/client-translate?client_id=${client.value}`
    };
    navigate(routes[docType]);
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
          <div className="logo-section">
          </div>
          <div className="flex items-center gap-3">
            <Select value={i18n.language} onValueChange={(lng) => i18n.changeLanguage(lng)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 {t('common.spanish')}</SelectItem>
                <SelectItem value="en">🇬🇧 {t('common.english')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => toast.info('Analytics - ¡Próximamente!', { description: 'Esta funcionalidad estará disponible pronto.' })} variant="outline" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
              <BarChart3 className="mr-2" size={18} />
              Analytics
            </Button>
            <Button onClick={() => navigate('/translate')} variant="outline" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
              <Languages className="mr-2" size={18} />
              Traductor
            </Button>
            <Button onClick={() => navigate('/chat')} variant="outline" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
              <MessageSquare className="mr-2" size={18} />
              Chat con Mónica
            </Button>
            {user?.role?.toUpperCase() === 'ADMIN' && (
              <Button onClick={() => navigate('/admin/users')} variant="outline" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                <Users className="mr-2" size={18} />
                Gestión de Usuarios
              </Button>
            )}
            {user?.role?.toUpperCase() === 'ADMIN' && (
              <Button
                onClick={() => navigate('/admin/prompts')}
                data-testid="btn-prompt-manager"
                variant="outline"
                style={{ borderColor: '#E5E7EB', color: '#374151' }}
              >
                <Settings className="mr-2" size={18} />
                Prompt Manager
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <Card style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <CardHeader style={{ paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#FFFBEB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} style={{ color: '#F8BF13' }} />
                </div>
              </div>
              <CardTitle style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', fontFamily: 'Manrope, sans-serif' }}>
                {dashboardStats.total_clients}
              </CardTitle>
              <CardDescription style={{ fontWeight: '500', color: '#6B7280' }}>Clientes Activos</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <CardHeader style={{ paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} style={{ color: '#DC2626' }} />
                </div>
              </div>
              <CardTitle style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', fontFamily: 'Manrope, sans-serif' }}>
                {dashboardStats.total_documents}
              </CardTitle>
              <CardDescription style={{ fontWeight: '500', color: '#6B7280' }}>Documentos Totales</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <CardHeader style={{ paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#EFF6FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={20} style={{ color: '#3B82F6' }} />
                </div>
              </div>
              <CardTitle style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', fontFamily: 'Manrope, sans-serif' }}>
                {dashboardStats.in_progress}
              </CardTitle>
              <CardDescription style={{ fontWeight: '500', color: '#6B7280' }}>En Progreso</CardDescription>
            </CardHeader>
          </Card>
          <Card style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <CardHeader style={{ paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#F0FDF4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={20} style={{ color: '#16A34A' }} />
                </div>
              </div>
              <CardTitle style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', fontFamily: 'Manrope, sans-serif' }}>
                {dashboardStats.completed}
              </CardTitle>
              <CardDescription style={{ fontWeight: '500', color: '#6B7280' }}>Completados</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', marginBottom: '3rem' }}>
          
          {/* Quick Create Panel */}
          <Card>
            <CardHeader>
              <CardTitle>⚡ Creación Rápida</CardTitle>
              <CardDescription>Selecciona un cliente y crea un documento</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ marginBottom: '1.5rem' }}>
                <Label>Cliente</Label>
                <AsyncSelect
                  cacheOptions
                  loadOptions={loadClientOptions}
                  onChange={setSelectedClient}
                  placeholder="Buscar cliente... (mín 2 caracteres)"
                  noOptionsMessage={() => "Escribe para buscar"}
                  loadingMessage={() => "Buscando..."}
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '40px',
                      borderRadius: '8px'
                    })
                  }}
                />
              </div>
              
              {selectedClient && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'niw')} style={{ background: '#F8BF13', color: '#111827', fontWeight: '600' }}>
                    NIW
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'patent')} variant="outline" style={{ borderColor: '#E5E7EB' }}>
                    Patente
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'book')} variant="outline" style={{ borderColor: '#E5E7EB' }}>
                    Libro
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'study')} variant="outline" style={{ borderColor: '#E5E7EB' }}>
                    Estudio
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'whitepaper')} variant="outline" style={{ borderColor: '#E5E7EB' }}>
                    White Paper
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'translation')} variant="outline" style={{ borderColor: '#E5E7EB' }}>
                    Traducción
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>🔥 Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>
                  No hay actividad reciente
                </p>
              ) : (
                <div
                  data-testid="recent-activity-list"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    paddingRight: '0.5rem'
                  }}
                >
                  {recentActivity.map((activity, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        border: '1px solid #F3F4F6'
                      }}
                    >
                      <div style={{ fontWeight: '600', color: '#374151' }}>{activity.entity_name || activity.operator_name}</div>
                      <div style={{ color: '#666' }}>{activity.description || activity.action}</div>
                      <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {new Date(activity.timestamp).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Clientes de la Empresa</h2>
            
            {/* Buscador de clientes */}
            <div style={{ position: 'relative', width: '280px' }}>
              {isSearching ? (
                <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              ) : (
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              )}
              <Input
                type="text"
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
            
            {/* Filtro por usuario creador */}
            <Select value={selectedCreator || "all"} onValueChange={(value) => setSelectedCreator(value === "all" ? '' : value)}>
              <SelectTrigger style={{ width: '220px' }}>
                <SelectValue placeholder="Filtrar por creador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                <SelectItem value={user?.id}>Solo mis clientes</SelectItem>
                {usersList.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Botones de cambio de vista */}
            <div style={{ display: 'flex', gap: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '4px' }}>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                style={{ padding: '0.5rem' }}
                title="Vista de tarjetas"
              >
                <Grid3x3 size={18} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                style={{ padding: '0.5rem' }}
                title="Vista de lista"
              >
                <List size={18} />
              </Button>
            </div>
            
            {(selectedCreator && selectedCreator !== 'all') || searchQuery ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSelectedCreator('all');
                  setSearchQuery('');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <X size={14} />
                Limpiar filtros
              </Button>
            ) : null}
          </div>
          <Button onClick={() => setShowClientModal(true)} style={{ background: '#F8BF13', color: '#111827', fontWeight: '600' }}>
            <Plus className="mr-2" size={18} />
            Nuevo Cliente
          </Button>
        </div>

        {/* Vista de clientes - Grid o Lista */}
        {viewMode === 'grid' ? (
          // Vista de Grid (tarjetas)
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {getFilteredAndSortedClients().map(client => (
              <Card 
                key={client.id}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onClick={() => navigate(`/client-dashboard/${client.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClient(client);
                  }}
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '6rem',
                    background: '#dbeafe',
                    color: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#dbeafe';
                    e.currentTarget.style.color = '#2563eb';
                  }}
                >
                  <Edit size={14} />
                  Editar
                </button>
                <button
                  onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
                <CardHeader>
                  <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '6rem' }}>
                    👤 {client.name}
                  </CardTitle>
                  <CardDescription>{client.email}</CardDescription>
                  {client.company && (
                    <CardDescription style={{ marginTop: '0.25rem' }}>
                      🏢 {client.company}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ 
                      background: '#e0e7ff', 
                      color: '#4f46e5',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      loadClientDocuments(client.id);
                    }}
                    title="Click para ver documentos completados"
                    >
                      {loadingDocs[client.id] ? '⏳ Cargando...' : `✅ ${client.documents_count || 0} completados`}
                    </span>
                    {client.tags && client.tags.map((tag, idx) => (
                      <span key={idx} style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Detalles de documentos con autor de cada uno */}
                  {showDocDetails[client.id] && clientDocuments[client.id] && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '0.75rem' 
                      }}>
                        <div style={{ fontWeight: '600', color: '#374151' }}>
                          ✅ Documentos Completados ({clientDocuments[client.id].length})
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDocDetails(prev => ({...prev, [client.id]: false}));
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            color: '#6b7280'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      
                      {clientDocuments[client.id].length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem' }}>
                          No hay documentos para este cliente
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {clientDocuments[client.id].map((doc, idx) => (
                            <div 
                              key={doc.id || idx} 
                              style={{
                                padding: '0.5rem',
                                background: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb'
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '0.5rem'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#111827' }}>
                                    {doc.title || 'Sin título'}
                                  </div>
                                  <div style={{ 
                                    display: 'inline-block',
                                    marginTop: '0.25rem',
                                    padding: '0.15rem 0.5rem',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                  }}>
                                    {doc.type}
                                  </div>
                                  {doc.created_by && (
                                    <div style={{ 
                                      marginTop: '0.25rem',
                                      color: '#6b7280',
                                      fontSize: '0.75rem'
                                    }}>
                                      👤 {doc.created_by.name}
                                    </div>
                                  )}
                                  {doc.created_at && (
                                    <div style={{ marginTop: '0.25rem' }}>
                                      📅 {new Date(doc.created_at).toLocaleDateString('es', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Audit info con información del creador */}
                  <div style={{ 
                    marginTop: '1rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid #f3f4f6',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    <div>📅 Creado: {client.created_at ? new Date(client.created_at).toLocaleDateString('es', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }) : 'N/A'}</div>
                    {client.created_by && (
                      <div style={{ 
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: '#f0fdf4',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        👤 Creado por: <strong>{client.created_by.name}</strong>
                        {client.created_by.email && (
                          <span style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                            ({client.created_by.email})
                          </span>
                        )}
                      </div>
                    )}
                    {client.updated_by_name && client.updated_at && (
                      <div style={{ marginTop: '0.5rem' }}>
                        ✏️ Modificado: {new Date(client.updated_at).toLocaleDateString('es', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        })} por {client.updated_by_name}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Vista de Lista
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {getFilteredAndSortedClients().map(client => (
              <Card 
                key={client.id}
                style={{ 
                  cursor: 'pointer', 
                  transition: 'all 0.2s ease',
                  border: '1px solid #e5e7eb'
                }}
                onClick={() => navigate(`/client-dashboard/${client.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <CardContent style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Fila principal con información */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      {/* Información principal */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ flex: '0 0 250px' }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827' }}>
                            👤 {client.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {client.email}
                          </div>
                        </div>
                        
                        {client.company && (
                          <div style={{ flex: '0 0 200px', fontSize: '0.85rem', color: '#4b5563' }}>
                            🏢 {client.company}
                          </div>
                        )}
                        
                        <div style={{ flex: '0 0 150px' }}>
                          <span 
                            style={{ 
                              background: '#e0e7ff', 
                              color: '#4f46e5',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              display: 'inline-block',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              loadClientDocuments(client.id);
                            }}
                            title="Click para ver documentos completados"
                          >
                            {loadingDocs[client.id] ? '⏳ Cargando...' : `✅ ${client.documents_count || 0} completados`}
                          </span>
                        </div>
                        
                        {client.created_by && (
                          <div style={{ 
                            flex: '0 0 180px',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            background: '#f0fdf4',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px'
                          }}>
                            👤 {client.created_by.name}
                          </div>
                        )}
                      </div>
                      
                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(client);
                          }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <Edit size={14} className="mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                          style={{ fontSize: '0.8rem', color: '#dc2626', borderColor: '#fecaca' }}
                        >
                          <Trash2 size={14} className="mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    
                    {/* Detalles de documentos expandibles (igual que en grid) */}
                    {showDocDetails[client.id] && clientDocuments[client.id] && (
                      <div 
                        style={{
                          padding: '0.75rem',
                          background: '#f9fafb',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          border: '1px solid #e5e7eb'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '0.75rem' 
                        }}>
                          <div style={{ fontWeight: '600', color: '#374151' }}>
                            ✅ Documentos Completados ({clientDocuments[client.id].length})
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDocDetails(prev => ({...prev, [client.id]: false}));
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              color: '#6b7280'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        
                        {clientDocuments[client.id].length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem' }}>
                            No hay documentos para este cliente
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {clientDocuments[client.id].map((doc, idx) => (
                              <div 
                                key={doc.id || idx} 
                                style={{
                                  padding: '0.5rem',
                                  background: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #e5e7eb'
                                }}
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '0.5rem'
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', color: '#111827' }}>
                                      {doc.title || 'Sin título'}
                                    </div>
                                    <div style={{ 
                                      display: 'inline-block',
                                      marginTop: '0.25rem',
                                      padding: '0.15rem 0.5rem',
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: '600'
                                    }}>
                                      {doc.type}
                                    </div>
                                    {doc.created_by && (
                                      <div style={{ 
                                        marginTop: '0.25rem',
                                        color: '#6b7280',
                                        fontSize: '0.75rem'
                                      }}>
                                        👤 {doc.created_by.name}
                                      </div>
                                    )}
                                    {doc.created_at && (
                                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                        📅 {new Date(doc.created_at).toLocaleDateString('es', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Controles de paginación */}
        {!searchQuery && totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '1rem', 
            marginTop: '2rem',
            marginBottom: '1rem'
          }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
              Anterior
            </Button>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: '#666',
              fontSize: '0.9rem'
            }}>
              <span>Página</span>
              <Select 
                value={currentPage.toString()} 
                onValueChange={(value) => setCurrentPage(parseInt(value))}
              >
                <SelectTrigger style={{ width: '80px' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <SelectItem key={page} value={page.toString()}>
                      {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>de {totalPages}</span>
              <span style={{ marginLeft: '1rem', color: '#888' }}>
                ({totalClients} clientes en total)
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Siguiente
              <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
            </Button>
          </div>
        )}
        
        {/* Mensaje cuando no hay resultados */}
        {getFilteredAndSortedClients().length === 0 && (
          <Card>
            <CardContent style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                No se encontraron clientes
              </div>
              <div style={{ color: '#6b7280' }}>
                {searchQuery || selectedCreator !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda' 
                  : 'Comienza creando tu primer cliente'}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Removed old empty state - now handled by the new filtered view */}

      </main>

      {/* New Client Modal */}
      <Dialog open={showClientModal} onOpenChange={(open) => {
        setShowClientModal(open);
        if (!open) {
          setEditingClient(null);
          setNewClientData({
            name: '',
            email: '',
            phone: '',
            company: '',
            country: '',
            city: '',
            state: '',
            street_address: '',
            postal_code: '',
            industry: '',
            notes: '',
            tags: []
          });
          setExternalQuery('');
          setExternalResults([]);
          setExternalErrors([]);
          setSelectedExternalClient(null);
          setNewClientMode('external');
        }
      }}>
        <DialogContent style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>{editingClient ? '✏️ Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Actualiza la información del cliente' : 'Importa un cliente del panel externo o créalo manualmente'}
            </DialogDescription>
          </DialogHeader>

          {/* Mode tabs — only for new client creation */}
          {!editingClient && (
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setNewClientMode('external')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: newClientMode === 'external' ? '700' : '400',
                  color: newClientMode === 'external' ? '#111827' : '#6b7280',
                  borderBottom: newClientMode === 'external' ? '2px solid #F8BF13' : '2px solid transparent',
                  fontSize: '0.875rem'
                }}
              >
                Importar del Panel
              </button>
              <button
                onClick={() => setNewClientMode('manual')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: newClientMode === 'manual' ? '700' : '400',
                  color: newClientMode === 'manual' ? '#111827' : '#6b7280',
                  borderBottom: newClientMode === 'manual' ? '2px solid #F8BF13' : '2px solid transparent',
                  fontSize: '0.875rem'
                }}
              >
                Crear Manualmente
              </button>
            </div>
          )}

          {/* SEARCH MODE — for creating new client from external panel */}
          {!editingClient && newClientMode === 'external' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {/* Search box */}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <Input
                  data-testid="external-client-search"
                  value={externalQuery}
                  onChange={e => setExternalQuery(e.target.value)}
                  placeholder="Buscar por nombre o email (mín. 3 caracteres)..."
                  style={{ paddingLeft: '2.25rem' }}
                  autoFocus
                />
              </div>

              {/* Errors */}
              {externalErrors.map((e, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #fecaca' }}>
                  {e}
                </div>
              ))}

              {/* Loading */}
              {isSearchingExternal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem', padding: '0.5rem' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Buscando en el panel...
                </div>
              )}

              {/* Results */}
              {!isSearchingExternal && externalResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>{externalResults.length} cliente(s) encontrado(s)</p>
                  {externalResults.map((client, idx) => (
                    <div key={idx} data-testid={`external-client-result-${idx}`} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                      background: selectedExternalClient?.external_id === client.external_id ? '#f5f3ff' : 'white',
                      transition: 'background 0.15s'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: '600', fontSize: '0.9rem', color: '#111827', margin: 0 }}>
                          {client.name || '(Sin nombre)'}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.1rem 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {client.email} {client.country ? `· ${client.country}` : ''} {client.company ? `· ${client.company}` : ''}
                        </p>
                        <span style={{ fontSize: '0.7rem', background: client.external_source === 'classic' ? '#dbeafe' : '#d1fae5', color: client.external_source === 'classic' ? '#1e40af' : '#065f46', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                          {client.external_source === 'classic' ? 'Classic Case' : 'Visa Case'}
                        </span>
                      </div>
                      <Button
                        data-testid={`import-client-btn-${idx}`}
                        size="sm"
                        disabled={isCreatingClient}
                        onClick={() => handleImportExternalClient(client)}
                        style={{ marginLeft: '0.75rem', background: '#8b5cf6', color: 'white', minWidth: '80px' }}
                      >
                        {isCreatingClient && selectedExternalClient?.external_id === client.external_id
                          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          : 'Importar'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!isSearchingExternal && externalResults.length === 0 && !externalErrors.length && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <Search size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.875rem' }}>
                    {externalQuery.length > 0 && externalQuery.length < 3
                      ? `Escribe ${3 - externalQuery.length} caracter(es) más para buscar`
                      : externalQuery
                        ? 'No se encontraron clientes con ese término'
                        : 'Escribe al menos 3 caracteres para buscar clientes del panel'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="outline" onClick={() => { setShowClientModal(false); setExternalQuery(''); setExternalResults([]); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* EDIT MODE or MANUAL CREATE — keep original form */}
          {(editingClient || (!editingClient && newClientMode === 'manual')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newClientData.name}
                onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                placeholder="juan@example.com"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <Label>País</Label>
                <Input
                  value={newClientData.country}
                  onChange={(e) => setNewClientData({...newClientData, country: e.target.value})}
                  placeholder="USA"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Ciudad</Label>
                <Input
                  value={newClientData.city}
                  onChange={(e) => setNewClientData({...newClientData, city: e.target.value})}
                  placeholder="New York"
                />
              </div>
              <div>
                <Label>Estado/Región</Label>
                <Input
                  value={newClientData.state}
                  onChange={(e) => setNewClientData({...newClientData, state: e.target.value})}
                  placeholder="NY"
                />
              </div>
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={newClientData.street_address}
                onChange={(e) => setNewClientData({...newClientData, street_address: e.target.value})}
                placeholder="123 Main Street, Suite 100"
              />
            </div>
            <div>
              <Label>Código Postal</Label>
              <Input
                value={newClientData.postal_code}
                onChange={(e) => setNewClientData({...newClientData, postal_code: e.target.value})}
                placeholder="10001"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Empresa</Label>
                <Input
                  value={newClientData.company}
                  onChange={(e) => setNewClientData({...newClientData, company: e.target.value})}
                  placeholder="Tech Corp"
                />
              </div>
              <div>
                <Label>Industria</Label>
                <Input
                  value={newClientData.industry}
                  onChange={(e) => setNewClientData({...newClientData, industry: e.target.value})}
                  placeholder="Technology"
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={newClientData.notes}
                onChange={(e) => setNewClientData({...newClientData, notes: e.target.value})}
                placeholder="Información adicional sobre el cliente..."
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Button 
                onClick={editingClient ? handleUpdateClient : handleCreateClient} 
                style={{ flex: 1 }}
                disabled={isCreatingClient}
              >
                {isCreatingClient 
                  ? (editingClient ? 'Actualizando...' : 'Creando...') 
                  : (editingClient ? 'Actualizar Cliente' : 'Crear Cliente')
                }
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowClientModal(false);
                  setEditingClient(null);
                }} 
                style={{ flex: 1 }}
                disabled={isCreatingClient}
              >
                Cancelar
              </Button>
            </div>
          </div>
          )} {/* end editingClient */}
        </DialogContent>
      </Dialog>
      
    </div>
  );
};

// Chat Page - Full Screen View with Conversations

export default Dashboard;
